/**
 * ChainPulse - Webhook Handler
 * 
 * Processes incoming chainhook events and updates application state
 * Real-time activity tracking powered by Hiro Chainhooks
 */

import { EventEmitter } from 'events';

// Event types from our contracts
export interface PulseEvent {
  event: 'pulse-sent';
  user: string;
  points: number;
  streak: number;
  fee: number;
  total_pulses: number;
}

export interface BoostEvent {
  event: 'boost-activated';
  user: string;
  points: number;
  fee: number;
  total_boosts: number;
}

export interface CheckinEvent {
  event: 'daily-checkin';
  user: string;
  day: number;
  points: number;
}

export interface MegaPulseEvent {
  event: 'mega-pulse';
  user: string;
  multiplier: number;
  points: number;
  fee: number;
}

export interface ChallengeEvent {
  event: 'challenge-completed';
  user: string;
  challenge_id: number;
  points: number;
  fee: number;
}

export interface RewardEvent {
  event: 'reward-claimed';
  user: string;
  reward_id: number;
  points_spent: number;
  stx_value: number;
  new_tier: string;
}

export interface TierEvent {
  event: 'tier-achieved';
  user: string;
  tier: string;
  total_points: number;
  previous_tier: string;
}

export interface BadgeEvent {
  event: 'badge-minted';
  token_id: number;
  badge_type: number;
  recipient: string;
  milestone: number;
}

export interface STXTransferEvent {
  sender: string;
  recipient: string;
  amount: number;
  block_height: number;
}

// Chainhook payload structure
export interface ChainhookPayload {
  apply: Array<{
    block_identifier: {
      index: number;
      hash: string;
    };
    timestamp: number;
    transactions: Array<{
      transaction_identifier: {
        hash: string;
      };
      metadata: {
        receipt: {
          events: Array<{
            type: string;
            data: any;
          }>;
        };
      };
    }>;
  }>;
  rollback?: Array<{
    block_identifier: {
      index: number;
      hash: string;
    };
  }>;
  chainhook: {
    uuid: string;
    predicate: any;
    is_streaming_blocks: boolean;
  };
}

// Activity record for database storage
export interface ActivityRecord {
  id: string;
  user: string;
  eventType: string;
  points: number;
  fee: number;
  blockHeight: number;
  txHash: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

// Leaderboard entry
export interface LeaderboardEntry {
  user: string;
  totalPoints: number;
  totalPulses: number;
  currentStreak: number;
  longestStreak: number;
  tier: string;
  lastActive: Date;
}

class WebhookHandler extends EventEmitter {
  private activities: ActivityRecord[] = [];
  private leaderboard: Map<string, LeaderboardEntry> = new Map();
  private totalFees: number = 0;
  private totalTransactions: number = 0;

  constructor() {
    super();
    console.log('[WebhookHandler] Initialized');
  }

  /**
   * Process incoming chainhook payload
   */
  async processPayload(payload: ChainhookPayload): Promise<void> {
    console.log('[WebhookHandler] Processing chainhook payload...');
    const p: any = payload as any;
    
    // Debug: Log payload structure
    console.log('[WebhookHandler] Payload keys:', Object.keys(p || {}));
    console.log('[WebhookHandler] Has apply:', Array.isArray(p?.apply));
    console.log('[WebhookHandler] Has event:', Boolean(p?.event));
    if (p?.event) {
      console.log('[WebhookHandler] Event keys:', Object.keys(p.event || {}));
      console.log('[WebhookHandler] Has event.apply:', Array.isArray(p?.event?.apply));
      console.log('[WebhookHandler] Has event.blocks:', Array.isArray(p?.event?.blocks));
    }
    // Safe payload dump (limit size to avoid huge logs)
    try {
      const payloadStr = JSON.stringify(p).substring(0, 2000);
      console.log('[WebhookHandler] Payload preview:', payloadStr + (JSON.stringify(p).length > 2000 ? '...' : ''));
    } catch (e) {
      console.log('[WebhookHandler] Could not stringify payload');
    }
    
    const hookUuid =
      p?.chainhook?.uuid ??
      p?.chainhook_uuid ??
      p?.hook_uuid ??
      p?.uuid ??
      'unknown';
    const isStreaming =
      p?.chainhook?.is_streaming_blocks ??
      p?.is_streaming_blocks ??
      p?.chainhook?.status?.is_streaming_blocks ??
      false;

    console.log(`[WebhookHandler] Hook UUID: ${hookUuid}`);
    console.log(`[WebhookHandler] Streaming: ${Boolean(isStreaming)}`);

    // Handle rollbacks first - check multiple possible locations
    const rollback = p?.rollback ?? p?.event?.rollback ?? [];
    if (Array.isArray(rollback) && rollback.length > 0) {
      await this.handleRollback(rollback);
    }

    // Process new blocks - check multiple possible locations
    // Hiro Chainhooks can send data in different formats:
    // 1. Standard format: { apply: [...blocks...] }
    // 2. Event format: { event: { apply: [...blocks...] } }
    // 3. Contract log format: { event: { ...transaction data... } }
    let applyBlocks: any[] = [];
    
    if (Array.isArray(p?.apply)) {
      // Standard format with apply blocks at root
      applyBlocks = p.apply;
      console.log('[WebhookHandler] Using root-level apply blocks');
    } else if (Array.isArray(p?.event?.apply)) {
      // Event format with apply blocks nested
      applyBlocks = p.event.apply;
      console.log('[WebhookHandler] Using event.apply blocks');
    } else if (Array.isArray(p?.event?.blocks)) {
      // Alternative event format
      applyBlocks = p.event.blocks;
      console.log('[WebhookHandler] Using event.blocks');
    } else if (p?.event && typeof p.event === 'object') {
      // Handle contract_log event format - event data might be directly in event
      console.log('[WebhookHandler] Event object found, checking for transaction data...');
      
      // Check if event has transaction data directly
      if (p.event.transaction_identifier || p.event.transaction || p.event.metadata) {
        // Single transaction in event (contract_log format)
        const tx = p.event.transaction || p.event;
        const blockInfo = p.event.block_identifier || p.event.block || { index: 0, hash: '' };
        const timestamp = p.event.timestamp || p.event.block_timestamp || Date.now() / 1000;
        
        applyBlocks = [{
          block_identifier: typeof blockInfo === 'object' ? blockInfo : { index: blockInfo, hash: '' },
          timestamp: timestamp,
          transactions: [tx]
        }];
        console.log('[WebhookHandler] Created block from single event transaction');
      } else if (p.event.contract_log) {
        // Nested contract_log format
        const contractLog = p.event.contract_log;
        const blockInfo = contractLog.block_identifier || { index: 0, hash: '' };
        const timestamp = contractLog.timestamp || Date.now() / 1000;
        
        applyBlocks = [{
          block_identifier: blockInfo,
          timestamp: timestamp,
          transactions: [{
            transaction_identifier: { hash: contractLog.tx_id || '' },
            metadata: {
              receipt: {
                events: [{
                  type: 'contract_log',
                  data: contractLog
                }]
              }
            }
          }]
        }];
        console.log('[WebhookHandler] Created block from contract_log event');
      }
    }
    
    console.log(`[WebhookHandler] Found ${applyBlocks.length} blocks to process`);
    
    for (const block of applyBlocks) {
      console.log(`[WebhookHandler] Processing block ${block.block_identifier?.index ?? 'unknown'}`);
      
      const transactions = block.transactions || [];
      console.log(`[WebhookHandler] Block has ${transactions.length} transactions`);
      
      for (const tx of transactions) {
        await this.processTransaction(tx, block.block_identifier?.index ?? 0, block.timestamp ?? 0);
      }
    }

    const txCount = applyBlocks.reduce((sum: number, block: any) => {
      const txArray = block.transactions || [];
      return sum + txArray.length;
    }, 0);
    
    this.totalTransactions += txCount;

    console.log(`[WebhookHandler] Total transactions processed: ${this.totalTransactions}`);
  }

  /**
   * Handle blockchain rollback (reorg)
   */
  private async handleRollback(rollback: ChainhookPayload['rollback']): Promise<void> {
    if (!rollback) return;

    for (const block of rollback) {
      console.log(`[WebhookHandler] Rolling back block ${block.block_identifier.index}`);
      
      // Remove activities from rolled back blocks
      this.activities = this.activities.filter(
        activity => activity.blockHeight !== block.block_identifier.index
      );
    }

    this.emit('rollback', rollback);
  }

  /**
   * Process individual transaction
   */
  private async processTransaction(
    tx: ChainhookPayload['apply'][0]['transactions'][0],
    blockHeight: number,
    timestamp: number
  ): Promise<void> {
    const txHash = tx.transaction_identifier.hash;
    const txAny = tx as any;
    
    // Chainhooks can send events in different formats:
    // 1. Standard: tx.metadata.receipt.events
    // 2. Operations format: tx.operations (with type: "contract_log")
    let events: any[] = [];
    
    // Check standard format first
    if (Array.isArray(txAny.metadata?.receipt?.events)) {
      events = txAny.metadata.receipt.events;
    }
    
    // Check operations format (chainhook contract_log format)
    if (Array.isArray(txAny.operations)) {
      for (const op of txAny.operations) {
        if (op.type === 'contract_log' && op.metadata?.topic === 'print') {
          // Decode the hex-encoded Clarity value
          const hexValue = op.metadata.value;
          if (hexValue) {
            try {
              // The hex value is a Clarity value that needs to be decoded
              // For now, we'll try to parse it as JSON if it's already decoded
              // Otherwise, we'll need to decode the Clarity value
              const decoded = this.decodeClarityValue(hexValue);
              events.push({
                type: 'print_event',
                data: decoded
              });
            } catch (e) {
              console.error('[WebhookHandler] Failed to decode contract_log value:', e);
              // Try to process the raw metadata
              events.push({
                type: 'print_event',
                data: op.metadata
              });
            }
          }
        } else if (op.type === 'stx_transfer') {
          events.push({
            type: 'stx_transfer_event',
            data: {
              sender: op.account?.address || '',
              recipient: op.amount?.value ? 'fee-receiver' : '',
              amount: Math.abs(parseInt(op.amount?.value || '0')),
              block_height: blockHeight
            }
          });
        }
      }
    }

    console.log(`[WebhookHandler] Processing transaction ${txHash}, found ${events.length} events`);

    for (const event of events) {
      if (event.type === 'print_event' || event.type === 'SmartContractEvent') {
        await this.processPrintEvent(event.data, txHash, blockHeight, timestamp);
      } else if (event.type === 'nft_mint_event' || event.type === 'NFTMintEvent') {
        await this.processNFTEvent(event.data, txHash, blockHeight, timestamp);
      } else if (event.type === 'stx_transfer_event' || event.type === 'STXTransferEvent') {
        await this.processSTXTransfer(event.data, txHash, blockHeight, timestamp);
      }
    }
  }
  
  /**
   * Decode Clarity hex-encoded value
   * The hex value from chainhooks is a Clarity value that needs parsing
   * If decode_clarity_values is enabled in chainhook config, this might already be decoded
   */
  private decodeClarityValue(hexValue: string): any {
    // Remove 0x prefix if present
    const hex = hexValue.startsWith('0x') ? hexValue.slice(2) : hexValue;
    
    try {
      // First, try to parse as if it's already decoded JSON (if decode_clarity_values is enabled)
      const asString = Buffer.from(hex, 'hex').toString('utf-8');
      try {
        return JSON.parse(asString);
      } catch {
        // Not JSON, continue with manual parsing
      }
      
      // Manual parsing of Clarity tuple format
      const buffer = Buffer.from(hex, 'hex');
      
      // Check if it starts with 0c (tuple type)
      if (buffer.length > 0 && buffer[0] === 0x0c) {
        return this.parseClarityTuple(buffer);
      }
      
      // Return raw metadata if we can't decode
      console.warn('[WebhookHandler] Could not decode Clarity value, using raw');
      return { raw: hexValue };
    } catch (e) {
      console.error('[WebhookHandler] Failed to decode Clarity value:', e);
      return { raw: hexValue };
    }
  }
  
  /**
   * Basic Clarity tuple parser for hex-encoded values
   * Parses format: 0c (tuple type) + length + key-value pairs
   */
  private parseClarityTuple(buffer: Buffer): any {
    try {
      let offset = 3; // Skip type byte (0x0c) and length bytes (2 bytes)
      const result: any = {};
      
      while (offset < buffer.length - 1) {
        // Read key length (2 bytes, big-endian)
        if (offset + 2 > buffer.length) break;
        const keyLen = buffer.readUInt16BE(offset);
        offset += 2;
        
        if (offset + keyLen > buffer.length) break;
        
        // Read key string
        const key = buffer.slice(offset, offset + keyLen).toString('utf-8');
        offset += keyLen;
        
        // Read value type byte
        if (offset >= buffer.length) break;
        const valueType = buffer[offset];
        offset += 1;
        
        // Parse value based on type
        if (valueType === 0x00 || valueType === 0x01) { // int or uint (16 bytes)
          if (offset + 16 > buffer.length) break;
          const value = buffer.readBigUInt64BE(offset);
          result[key] = value.toString();
          offset += 16;
        } else if (valueType === 0x06 || valueType === 0x07) { // string/ascii (2-byte length + string)
          if (offset + 2 > buffer.length) break;
          const strLen = buffer.readUInt16BE(offset);
          offset += 2;
          if (offset + strLen > buffer.length) break;
          const value = buffer.slice(offset, offset + strLen).toString('utf-8');
          result[key] = value;
          offset += strLen;
        } else if (valueType === 0x09) { // principal (standard or contract)
          // Principal is 21 bytes for standard, 22 for contract
          if (offset + 21 > buffer.length) break;
          const principalBytes = buffer.slice(offset, offset + 21);
          const principal = '0x' + principalBytes.toString('hex');
          result[key] = principal;
          offset += 21;
        } else {
          // Unknown type, try to skip or break
          console.warn(`[WebhookHandler] Unknown Clarity value type: 0x${valueType.toString(16)}`);
          break;
        }
      }
      
      return result;
    } catch (e) {
      console.error('[WebhookHandler] Failed to parse Clarity tuple:', e);
      return {};
    }
  }

  /**
   * Process print events from smart contracts
   */
  private async processPrintEvent(
    data: any,
    txHash: string,
    blockHeight: number,
    timestamp: number
  ): Promise<void> {
    try {
      // Parse the print event data
      const eventData = typeof data === 'string' ? JSON.parse(data) : data;
      const eventType = eventData.event;

      console.log(`[WebhookHandler] Processing ${eventType} event`);

      switch (eventType) {
        case 'pulse-sent':
          await this.handlePulseEvent(eventData as PulseEvent, txHash, blockHeight, timestamp);
          break;
        case 'boost-activated':
          await this.handleBoostEvent(eventData as BoostEvent, txHash, blockHeight, timestamp);
          break;
        case 'daily-checkin':
          await this.handleCheckinEvent(eventData as CheckinEvent, txHash, blockHeight, timestamp);
          break;
        case 'mega-pulse':
          await this.handleMegaPulseEvent(eventData as MegaPulseEvent, txHash, blockHeight, timestamp);
          break;
        case 'challenge-completed':
          await this.handleChallengeEvent(eventData as ChallengeEvent, txHash, blockHeight, timestamp);
          break;
        case 'reward-claimed':
          await this.handleRewardEvent(eventData as RewardEvent, txHash, blockHeight, timestamp);
          break;
        case 'tier-achieved':
          await this.handleTierEvent(eventData as TierEvent, txHash, blockHeight, timestamp);
          break;
        default:
          console.log(`[WebhookHandler] Unknown event type: ${eventType}`);
      }
    } catch (error) {
      console.error('[WebhookHandler] Failed to process print event:', error);
    }
  }

  /**
   * Handle pulse-sent event
   */
  private async handlePulseEvent(
    event: PulseEvent,
    txHash: string,
    blockHeight: number,
    timestamp: number
  ): Promise<void> {
    const activity: ActivityRecord = {
      id: `${txHash}-pulse`,
      user: event.user,
      eventType: 'pulse',
      points: event.points,
      fee: event.fee,
      blockHeight,
      txHash,
      timestamp: new Date(timestamp * 1000),
      metadata: {
        streak: event.streak,
        totalPulses: event.total_pulses,
      },
    };

    this.activities.push(activity);
    this.totalFees += event.fee;
    this.updateLeaderboard(event.user, event.points, 1, event.streak);
    
    this.emit('pulse', activity);
    console.log(`[WebhookHandler] Pulse from ${event.user}: +${event.points} points, streak: ${event.streak}`);
  }

  /**
   * Handle boost-activated event
   */
  private async handleBoostEvent(
    event: BoostEvent,
    txHash: string,
    blockHeight: number,
    timestamp: number
  ): Promise<void> {
    const activity: ActivityRecord = {
      id: `${txHash}-boost`,
      user: event.user,
      eventType: 'boost',
      points: event.points,
      fee: event.fee,
      blockHeight,
      txHash,
      timestamp: new Date(timestamp * 1000),
      metadata: {
        totalBoosts: event.total_boosts,
      },
    };

    this.activities.push(activity);
    this.totalFees += event.fee;
    this.updateLeaderboard(event.user, event.points, 0, 0);
    
    this.emit('boost', activity);
    console.log(`[WebhookHandler] Boost from ${event.user}: +${event.points} points`);
  }

  /**
   * Handle daily-checkin event
   */
  private async handleCheckinEvent(
    event: CheckinEvent,
    txHash: string,
    blockHeight: number,
    timestamp: number
  ): Promise<void> {
    const activity: ActivityRecord = {
      id: `${txHash}-checkin`,
      user: event.user,
      eventType: 'checkin',
      points: event.points,
      fee: 0,
      blockHeight,
      txHash,
      timestamp: new Date(timestamp * 1000),
      metadata: {
        day: event.day,
      },
    };

    this.activities.push(activity);
    this.updateLeaderboard(event.user, event.points, 0, 0);
    
    this.emit('checkin', activity);
    console.log(`[WebhookHandler] Check-in from ${event.user}: day ${event.day}`);
  }

  /**
   * Handle mega-pulse event
   */
  private async handleMegaPulseEvent(
    event: MegaPulseEvent,
    txHash: string,
    blockHeight: number,
    timestamp: number
  ): Promise<void> {
    const activity: ActivityRecord = {
      id: `${txHash}-mega`,
      user: event.user,
      eventType: 'mega-pulse',
      points: event.points,
      fee: event.fee,
      blockHeight,
      txHash,
      timestamp: new Date(timestamp * 1000),
      metadata: {
        multiplier: event.multiplier,
      },
    };

    this.activities.push(activity);
    this.totalFees += event.fee;
    this.updateLeaderboard(event.user, event.points, event.multiplier, 0);
    
    this.emit('mega-pulse', activity);
    console.log(`[WebhookHandler] Mega pulse from ${event.user}: ${event.multiplier}x = +${event.points} points`);
  }

  /**
   * Handle challenge-completed event
   */
  private async handleChallengeEvent(
    event: ChallengeEvent,
    txHash: string,
    blockHeight: number,
    timestamp: number
  ): Promise<void> {
    const activity: ActivityRecord = {
      id: `${txHash}-challenge`,
      user: event.user,
      eventType: 'challenge',
      points: event.points,
      fee: event.fee,
      blockHeight,
      txHash,
      timestamp: new Date(timestamp * 1000),
      metadata: {
        challengeId: event.challenge_id,
      },
    };

    this.activities.push(activity);
    this.totalFees += event.fee;
    this.updateLeaderboard(event.user, event.points, 0, 0);
    
    this.emit('challenge', activity);
    console.log(`[WebhookHandler] Challenge ${event.challenge_id} completed by ${event.user}`);
  }

  /**
   * Handle reward-claimed event
   */
  private async handleRewardEvent(
    event: RewardEvent,
    txHash: string,
    blockHeight: number,
    timestamp: number
  ): Promise<void> {
    const activity: ActivityRecord = {
      id: `${txHash}-reward`,
      user: event.user,
      eventType: 'reward',
      points: -event.points_spent, // Negative because points are spent
      fee: 0,
      blockHeight,
      txHash,
      timestamp: new Date(timestamp * 1000),
      metadata: {
        rewardId: event.reward_id,
        stxValue: event.stx_value,
        newTier: event.new_tier,
      },
    };

    this.activities.push(activity);
    
    // Update tier in leaderboard
    const entry = this.leaderboard.get(event.user);
    if (entry) {
      entry.tier = event.new_tier;
    }
    
    this.emit('reward', activity);
    console.log(`[WebhookHandler] Reward claimed by ${event.user}: ${event.stx_value} STX`);
  }

  /**
   * Handle tier-achieved event
   */
  private async handleTierEvent(
    event: TierEvent,
    txHash: string,
    blockHeight: number,
    timestamp: number
  ): Promise<void> {
    const activity: ActivityRecord = {
      id: `${txHash}-tier`,
      user: event.user,
      eventType: 'tier',
      points: 0,
      fee: 0,
      blockHeight,
      txHash,
      timestamp: new Date(timestamp * 1000),
      metadata: {
        tier: event.tier,
        previousTier: event.previous_tier,
        totalPoints: event.total_points,
      },
    };

    this.activities.push(activity);
    
    // Update tier in leaderboard
    const entry = this.leaderboard.get(event.user);
    if (entry) {
      entry.tier = event.tier;
    }
    
    this.emit('tier', activity);
    console.log(`[WebhookHandler] ${event.user} achieved ${event.tier} tier!`);
  }

  /**
   * Process NFT mint events
   */
  private async processNFTEvent(
    data: any,
    txHash: string,
    blockHeight: number,
    timestamp: number
  ): Promise<void> {
    const activity: ActivityRecord = {
      id: `${txHash}-nft`,
      user: data.recipient || 'unknown',
      eventType: 'badge-minted',
      points: 0,
      fee: 0,
      blockHeight,
      txHash,
      timestamp: new Date(timestamp * 1000),
      metadata: {
        tokenId: data.asset_identifier,
        recipient: data.recipient,
      },
    };

    this.activities.push(activity);
    this.emit('badge', activity);
    console.log(`[WebhookHandler] Badge minted to ${data.recipient}`);
  }

  /**
   * Process STX transfer events
   */
  private async processSTXTransfer(
    data: STXTransferEvent,
    txHash: string,
    blockHeight: number,
    timestamp: number
  ): Promise<void> {
    const activity: ActivityRecord = {
      id: `${txHash}-stx`,
      user: data.sender,
      eventType: 'stx-transfer',
      points: 0,
      fee: data.amount,
      blockHeight,
      txHash,
      timestamp: new Date(timestamp * 1000),
      metadata: {
        sender: data.sender,
        recipient: data.recipient,
        amount: data.amount,
      },
    };

    this.activities.push(activity);
    this.emit('stx-transfer', activity);
  }

  /**
   * Update leaderboard entry for a user
   */
  private updateLeaderboard(
    user: string,
    points: number,
    pulses: number,
    streak: number
  ): void {
    let entry = this.leaderboard.get(user);

    if (!entry) {
      entry = {
        user,
        totalPoints: 0,
        totalPulses: 0,
        currentStreak: 0,
        longestStreak: 0,
        tier: 'none',
        lastActive: new Date(),
      };
      this.leaderboard.set(user, entry);
    }

    entry.totalPoints += points;
    entry.totalPulses += pulses;
    entry.lastActive = new Date();

    if (streak > 0) {
      entry.currentStreak = streak;
      if (streak > entry.longestStreak) {
        entry.longestStreak = streak;
      }
    }

    // Update tier based on points
    if (entry.totalPoints >= 5000) entry.tier = 'platinum';
    else if (entry.totalPoints >= 1000) entry.tier = 'gold';
    else if (entry.totalPoints >= 500) entry.tier = 'silver';
    else if (entry.totalPoints >= 100) entry.tier = 'bronze';

    this.emit('leaderboard-update', entry);
  }

  /**
   * Get recent activities
   */
  getActivities(limit: number = 100): ActivityRecord[] {
    return this.activities.slice(-limit).reverse();
  }

  /**
   * Get user activities
   */
  getUserActivities(user: string, limit: number = 50): ActivityRecord[] {
    return this.activities
      .filter(a => a.user === user)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get leaderboard
   */
  getLeaderboard(limit: number = 100): LeaderboardEntry[] {
    return Array.from(this.leaderboard.values())
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, limit);
  }

  /**
   * Get total fees collected
   */
  getTotalFees(): number {
    return this.totalFees;
  }

  /**
   * Get total transactions processed
   */
  getTotalTransactions(): number {
    return this.totalTransactions;
  }

  /**
   * Get stats summary
   */
  getStats(): {
    totalUsers: number;
    totalActivities: number;
    totalFees: number;
    totalTransactions: number;
  } {
    return {
      totalUsers: this.leaderboard.size,
      totalActivities: this.activities.length,
      totalFees: this.totalFees,
      totalTransactions: this.totalTransactions,
    };
  }
}

// Export singleton instance
export const webhookHandler = new WebhookHandler();
export default webhookHandler;
