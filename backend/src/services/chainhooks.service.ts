/**
 * ChainPulse - Chainhooks Service
 * 
 * This service uses @hirosystems/chainhooks-client to:
 * 1. Register chainhooks that monitor pulse-core contract events
 * 2. Process incoming webhook payloads
 * 3. Track real-time activity across all users
 * 
 * Built for Stacks Builder Challenge Week 2 - Chainhooks Integration
 */

import { 
  ChainhooksClient, 
  CHAINHOOKS_BASE_URL,
  type Chainhook,
  type PaginatedChainhookResponse 
} from '@hirosystems/chainhooks-client';

// Contract configuration
const PULSE_CORE_CONTRACT = process.env.PULSE_CORE_CONTRACT || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.pulse-core';
const PULSE_REWARDS_CONTRACT = process.env.PULSE_REWARDS_CONTRACT || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.pulse-rewards';
const PULSE_BADGE_CONTRACT = process.env.PULSE_BADGE_CONTRACT || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.pulse-badge-nft';
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://your-app.com/api/chainhook/events';
const NETWORK = process.env.STACKS_NETWORK || 'mainnet';

export class ChainhooksService {
  private client: ChainhooksClient;
  private registeredHooks: Map<string, Chainhook> = new Map();
  
  constructor(apiKey: string) {
    // Initialize the Hiro Chainhooks client
    this.client = new ChainhooksClient({
      baseUrl: NETWORK === 'mainnet' 
        ? CHAINHOOKS_BASE_URL.mainnet 
        : CHAINHOOKS_BASE_URL.testnet,
      apiKey: apiKey,
    });
    
    console.log(`[ChainhooksService] Initialized for ${NETWORK}`);
  }

  /**
   * Check API status
   */
  async checkStatus(): Promise<{ status: string; version: string }> {
    try {
      const status = await this.client.getStatus();
      console.log('[ChainhooksService] API Status:', status.status);
      console.log('[ChainhooksService] Server Version:', status.server_version);
      return {
        status: status.status,
        version: status.server_version,
      };
    } catch (error) {
      console.error('[ChainhooksService] Failed to check status:', error);
      throw error;
    }
  }

  /**
   * Register chainhook for pulse-sent events
   * Triggers when users send pulses (main activity)
   */
  async registerPulseSentHook(): Promise<Chainhook> {
    const definition: any = {
      name: 'ChainPulse - Pulse Sent Events',
      chain: 'stacks',
      network: NETWORK as 'mainnet' | 'testnet',
      filters: {
        scope: 'print_event',
        contract_identifier: PULSE_CORE_CONTRACT,
        contains: 'pulse-sent',
      },
      options: {
        start_at_block_height: 'latest',
        decode_clarity_values: true,
      },
      action: {
        http_post: {
          url: `${WEBHOOK_URL}/pulse`,
          authorization_header: `Bearer ${process.env.WEBHOOK_SECRET || 'chainpulse-secret'}`,
        },
      },
    };

    try {
      const result = await this.client.registerChainhook(definition);
      console.log('[ChainhooksService] Registered pulse-sent hook:', result.uuid);
      this.registeredHooks.set('pulse-sent', result);
      return result;
    } catch (error) {
      console.error('[ChainhooksService] Failed to register pulse hook:', error);
      throw error;
    }
  }

  /**
   * Register chainhook for boost-activated events
   * Triggers when users activate boosts (premium action)
   */
  async registerBoostHook(): Promise<Chainhook> {
    const definition: any = {
      name: 'ChainPulse - Boost Activated Events',
      chain: 'stacks',
      network: NETWORK as 'mainnet' | 'testnet',
      filters: {
        scope: 'print_event',
        contract_identifier: PULSE_CORE_CONTRACT,
        contains: 'boost-activated',
      },
      options: {
        start_at_block_height: 'latest',
        decode_clarity_values: true,
      },
      action: {
        http_post: {
          url: `${WEBHOOK_URL}/boost`,
          authorization_header: `Bearer ${process.env.WEBHOOK_SECRET || 'chainpulse-secret'}`,
        },
      },
    };

    try {
      const result = await this.client.registerChainhook(definition);
      console.log('[ChainhooksService] Registered boost hook:', result.uuid);
      this.registeredHooks.set('boost-activated', result);
      return result;
    } catch (error) {
      console.error('[ChainhooksService] Failed to register boost hook:', error);
      throw error;
    }
  }

  /**
   * Register chainhook for daily-checkin events
   */
  async registerCheckinHook(): Promise<Chainhook> {
    const definition: any = {
      name: 'ChainPulse - Daily Check-in Events',
      chain: 'stacks',
      network: NETWORK as 'mainnet' | 'testnet',
      filters: {
        scope: 'print_event',
        contract_identifier: PULSE_CORE_CONTRACT,
        contains: 'daily-checkin',
      },
      options: {
        start_at_block_height: 'latest',
        decode_clarity_values: true,
      },
      action: {
        http_post: {
          url: `${WEBHOOK_URL}/checkin`,
          authorization_header: `Bearer ${process.env.WEBHOOK_SECRET || 'chainpulse-secret'}`,
        },
      },
    };

    try {
      const result = await this.client.registerChainhook(definition);
      console.log('[ChainhooksService] Registered checkin hook:', result.uuid);
      this.registeredHooks.set('daily-checkin', result);
      return result;
    } catch (error) {
      console.error('[ChainhooksService] Failed to register checkin hook:', error);
      throw error;
    }
  }

  /**
   * Register chainhook for mega-pulse events
   */
  async registerMegaPulseHook(): Promise<Chainhook> {
    const definition: any = {
      name: 'ChainPulse - Mega Pulse Events',
      chain: 'stacks',
      network: NETWORK as 'mainnet' | 'testnet',
      filters: {
        scope: 'print_event',
        contract_identifier: PULSE_CORE_CONTRACT,
        contains: 'mega-pulse',
      },
      options: {
        start_at_block_height: 'latest',
        decode_clarity_values: true,
      },
      action: {
        http_post: {
          url: `${WEBHOOK_URL}/mega-pulse`,
          authorization_header: `Bearer ${process.env.WEBHOOK_SECRET || 'chainpulse-secret'}`,
        },
      },
    };

    try {
      const result = await this.client.registerChainhook(definition);
      console.log('[ChainhooksService] Registered mega-pulse hook:', result.uuid);
      this.registeredHooks.set('mega-pulse', result);
      return result;
    } catch (error) {
      console.error('[ChainhooksService] Failed to register mega-pulse hook:', error);
      throw error;
    }
  }

  /**
   * Register chainhook for challenge-completed events
   */
  async registerChallengeHook(): Promise<Chainhook> {
    const definition: any = {
      name: 'ChainPulse - Challenge Completed Events',
      chain: 'stacks',
      network: NETWORK as 'mainnet' | 'testnet',
      filters: {
        scope: 'print_event',
        contract_identifier: PULSE_CORE_CONTRACT,
        contains: 'challenge-completed',
      },
      options: {
        start_at_block_height: 'latest',
        decode_clarity_values: true,
      },
      action: {
        http_post: {
          url: `${WEBHOOK_URL}/challenge`,
          authorization_header: `Bearer ${process.env.WEBHOOK_SECRET || 'chainpulse-secret'}`,
        },
      },
    };

    try {
      const result = await this.client.registerChainhook(definition);
      console.log('[ChainhooksService] Registered challenge hook:', result.uuid);
      this.registeredHooks.set('challenge-completed', result);
      return result;
    } catch (error) {
      console.error('[ChainhooksService] Failed to register challenge hook:', error);
      throw error;
    }
  }

  /**
   * Register chainhook for reward-claimed events
   */
  async registerRewardClaimedHook(): Promise<Chainhook> {
    const definition: any = {
      name: 'ChainPulse - Reward Claimed Events',
      chain: 'stacks',
      network: NETWORK as 'mainnet' | 'testnet',
      filters: {
        scope: 'print_event',
        contract_identifier: PULSE_REWARDS_CONTRACT,
        contains: 'reward-claimed',
      },
      options: {
        start_at_block_height: 'latest',
        decode_clarity_values: true,
      },
      action: {
        http_post: {
          url: `${WEBHOOK_URL}/reward`,
          authorization_header: `Bearer ${process.env.WEBHOOK_SECRET || 'chainpulse-secret'}`,
        },
      },
    };

    try {
      const result = await this.client.registerChainhook(definition);
      console.log('[ChainhooksService] Registered reward-claimed hook:', result.uuid);
      this.registeredHooks.set('reward-claimed', result);
      return result;
    } catch (error) {
      console.error('[ChainhooksService] Failed to register reward hook:', error);
      throw error;
    }
  }

  /**
   * Register chainhook for tier-achieved events
   */
  async registerTierAchievedHook(): Promise<Chainhook> {
    const definition: any = {
      name: 'ChainPulse - Tier Achieved Events',
      chain: 'stacks',
      network: NETWORK as 'mainnet' | 'testnet',
      filters: {
        scope: 'print_event',
        contract_identifier: PULSE_REWARDS_CONTRACT,
        contains: 'tier-achieved',
      },
      options: {
        start_at_block_height: 'latest',
        decode_clarity_values: true,
      },
      action: {
        http_post: {
          url: `${WEBHOOK_URL}/tier`,
          authorization_header: `Bearer ${process.env.WEBHOOK_SECRET || 'chainpulse-secret'}`,
        },
      },
    };

    try {
      const result = await this.client.registerChainhook(definition);
      console.log('[ChainhooksService] Registered tier-achieved hook:', result.uuid);
      this.registeredHooks.set('tier-achieved', result);
      return result;
    } catch (error) {
      console.error('[ChainhooksService] Failed to register tier hook:', error);
      throw error;
    }
  }

  /**
   * Register chainhook for badge-minted events
   */
  async registerBadgeMintedHook(): Promise<Chainhook> {
    const definition: any = {
      name: 'ChainPulse - Badge Minted Events',
      chain: 'stacks',
      network: NETWORK as 'mainnet' | 'testnet',
      filters: {
        scope: 'nft_event',
        asset_identifier: `${PULSE_BADGE_CONTRACT}::pulse-badge`,
        actions: ['mint'],
      },
      options: {
        start_at_block_height: 'latest',
        decode_clarity_values: true,
      },
      action: {
        http_post: {
          url: `${WEBHOOK_URL}/badge`,
          authorization_header: `Bearer ${process.env.WEBHOOK_SECRET || 'chainpulse-secret'}`,
        },
      },
    };

    try {
      const result = await this.client.registerChainhook(definition);
      console.log('[ChainhooksService] Registered badge-minted hook:', result.uuid);
      this.registeredHooks.set('badge-minted', result);
      return result;
    } catch (error) {
      console.error('[ChainhooksService] Failed to register badge hook:', error);
      throw error;
    }
  }

  /**
   * Register chainhook for STX transfer events to the contracts
   */
  async registerSTXTransferHook(): Promise<Chainhook> {
    const definition: any = {
      name: 'ChainPulse - STX Fee Transfers',
      chain: 'stacks',
      network: NETWORK as 'mainnet' | 'testnet',
      filters: {
        scope: 'stx_event',
        actions: ['transfer'],
      },
      options: {
        start_at_block_height: 'latest',
        decode_clarity_values: true,
      },
      action: {
        http_post: {
          url: `${WEBHOOK_URL}/stx-transfer`,
          authorization_header: `Bearer ${process.env.WEBHOOK_SECRET || 'chainpulse-secret'}`,
        },
      },
    };

    try {
      const result = await this.client.registerChainhook(definition);
      console.log('[ChainhooksService] Registered STX transfer hook:', result.uuid);
      this.registeredHooks.set('stx-transfer', result);
      return result;
    } catch (error) {
      console.error('[ChainhooksService] Failed to register STX hook:', error);
      throw error;
    }
  }

  /**
   * Register ALL chainhooks at once
   */
  async registerAllHooks(): Promise<Map<string, Chainhook>> {
    console.log('[ChainhooksService] Registering all chainhooks...');
    
    await this.registerPulseSentHook();
    await this.registerBoostHook();
    await this.registerCheckinHook();
    await this.registerMegaPulseHook();
    await this.registerChallengeHook();
    await this.registerRewardClaimedHook();
    await this.registerTierAchievedHook();
    await this.registerBadgeMintedHook();
    await this.registerSTXTransferHook();
    
    console.log(`[ChainhooksService] Successfully registered ${this.registeredHooks.size} chainhooks`);
    return this.registeredHooks;
  }

  /**
   * Get all registered chainhooks
   */
  async listChainhooks(limit: number = 20): Promise<PaginatedChainhookResponse> {
    try {
      const response = await this.client.getChainhooks({ limit, offset: 0 });
      console.log(`[ChainhooksService] Found ${response.total} chainhooks`);
      return response;
    } catch (error) {
      console.error('[ChainhooksService] Failed to list chainhooks:', error);
      throw error;
    }
  }

  /**
   * Get a specific chainhook by UUID
   */
  async getChainhook(uuid: string): Promise<Chainhook> {
    try {
      const chainhook = await this.client.getChainhook(uuid);
      console.log(`[ChainhooksService] Retrieved chainhook: ${chainhook.definition.name}`);
      return chainhook;
    } catch (error) {
      console.error('[ChainhooksService] Failed to get chainhook:', error);
      throw error;
    }
  }

  /**
   * Enable or disable a chainhook
   */
  async toggleChainhook(uuid: string, enabled: boolean): Promise<void> {
    try {
      await this.client.enableChainhook(uuid, enabled);
      console.log(`[ChainhooksService] Chainhook ${uuid} ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('[ChainhooksService] Failed to toggle chainhook:', error);
      throw error;
    }
  }

  /**
   * Delete a chainhook
   */
  async deleteChainhook(uuid: string): Promise<void> {
    try {
      await this.client.deleteChainhook(uuid);
      console.log(`[ChainhooksService] Deleted chainhook: ${uuid}`);
      
      // Remove from local cache
      for (const [key, hook] of this.registeredHooks) {
        if (hook.uuid === uuid) {
          this.registeredHooks.delete(key);
          break;
        }
      }
    } catch (error) {
      console.error('[ChainhooksService] Failed to delete chainhook:', error);
      throw error;
    }
  }

  /**
   * Delete all registered chainhooks
   */
  async deleteAllHooks(): Promise<void> {
    console.log('[ChainhooksService] Deleting all chainhooks...');
    
    for (const [name, hook] of this.registeredHooks) {
      await this.deleteChainhook(hook.uuid);
      console.log(`[ChainhooksService] Deleted: ${name}`);
    }
    
    this.registeredHooks.clear();
    console.log('[ChainhooksService] All chainhooks deleted');
  }

  /**
   * Get locally cached hooks
   */
  getRegisteredHooks(): Map<string, Chainhook> {
    return this.registeredHooks;
  }
}

// Export singleton factory
export function createChainhooksService(): ChainhooksService {
  const apiKey = process.env.HIRO_API_KEY;
  if (!apiKey) {
    throw new Error('HIRO_API_KEY environment variable is required');
  }
  return new ChainhooksService(apiKey);
}

export default ChainhooksService;
