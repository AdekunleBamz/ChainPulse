import { 
  ChainhooksClient, 
  CHAINHOOKS_BASE_URL,
  type Chainhook,
  type PaginatedChainhookResponse 
} from '@hirosystems/chainhooks-client';

const PULSE_CORE_CONTRACT = process.env.PULSE_CORE_CONTRACT || 'SP3FKNEZ86RG5RT7SZ5FBRGH85FZNG94ZH1MCGG6N.pulse-core';
const PULSE_REWARDS_CONTRACT = process.env.PULSE_REWARDS_CONTRACT || 'SP3FKNEZ86RG5RT7SZ5FBRGH85FZNG94ZH1MCGG6N.pulse-rewards';
const PULSE_BADGE_CONTRACT = process.env.PULSE_BADGE_CONTRACT || 'SP3FKNEZ86RG5RT7SZ5FBRGH85FZNG94ZH1MCGG6N.pulse-badge-nft';
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://chainpulse-backend.onrender.com/api/chainhook/events';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const NETWORK = process.env.STACKS_NETWORK || 'mainnet';

function webhookUrl(path: string) {
  const base = WEBHOOK_URL.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : '/' + path;
  return WEBHOOK_SECRET ? base + p + '?token=' + encodeURIComponent(WEBHOOK_SECRET) : base + p;
}

export class ChainhooksService {
  private client: ChainhooksClient;
  private registeredHooks: Map<string, Chainhook> = new Map();

  private desiredHookNames = new Set([
    'ChainPulse-PulseSent',
    'ChainPulse-Boost',
    'ChainPulse-Checkin',
    'ChainPulse-MegaPulse',
    'ChainPulse-Challenge',
    'ChainPulse-Reward',
    'ChainPulse-Tier',
    'ChainPulse-Badge',
    'ChainPulse-STXTransfer',
  ]);

  private async findExistingByDisplayName(displayName: string): Promise<Chainhook | undefined> {
    // Page through hooks (limit max 60) and find first matching definition.name
    const pageSize = 60;
    let offset = 0;
    for (let i = 0; i < 20; i++) {
      const resp = await this.client.getChainhooks({ limit: pageSize, offset });
      const found = resp.results.find(h => h.definition?.name === displayName);
      if (found) return found;
      offset += resp.results.length;
      if (resp.results.length < pageSize) break;
    }
    return undefined;
  }
  
  constructor(apiKey: string) {
    this.client = new ChainhooksClient({
      baseUrl: NETWORK === 'testnet' ? CHAINHOOKS_BASE_URL.testnet : CHAINHOOKS_BASE_URL.mainnet,
      apiKey: apiKey,
    });
    console.log('[ChainhooksService] Initialized for ' + NETWORK);
  }

  async checkStatus(): Promise<{ status: string; version: string }> {
    const status = await this.client.getStatus();
    console.log('[ChainhooksService] API Status:', status.status);
    console.log('[ChainhooksService] Server Version:', status.server_version);
    return { status: status.status, version: status.server_version };
  }

  async registerHook(key: string, displayName: string, contract: string, path: string): Promise<Chainhook> {
    const existing = await this.findExistingByDisplayName(displayName);
    if (existing) {
      console.log('[ChainhooksService] Already exists ' + key + ':', existing.uuid);
      this.registeredHooks.set(key, existing);
      return existing;
    }
    const definition: any = {
      name: displayName,
      version: '1',
      chain: 'stacks',
      network: NETWORK === 'testnet' ? 'testnet' : 'mainnet',
      filters: {
        events: [
          {
            type: 'contract_log',
            contract_identifier: contract,
          }
        ]
      },
      action: {
        type: 'http_post',
        url: webhookUrl(path),
      }
    };
    const result = await this.client.registerChainhook(definition);
    console.log('[ChainhooksService] Registered ' + key + ':', result.uuid);
    this.registeredHooks.set(key, result);
    return result;
  }

  async registerStxTransferHook(): Promise<Chainhook> {
    const existing = await this.findExistingByDisplayName('ChainPulse-STXTransfer');
    if (existing) {
      console.log('[ChainhooksService] Already exists stx-transfer:', existing.uuid);
      this.registeredHooks.set('stx-transfer', existing);
      return existing;
    }
    const definition: any = {
      name: 'ChainPulse-STXTransfer',
      version: '1',
      chain: 'stacks',
      network: NETWORK === 'testnet' ? 'testnet' : 'mainnet',
      filters: {
        events: [
          {
            type: 'stx_transfer',
          }
        ]
      },
      action: {
        type: 'http_post',
        url: webhookUrl('/stx-transfer'),
      }
    };
    const result = await this.client.registerChainhook(definition);
    console.log('[ChainhooksService] Registered stx-transfer:', result.uuid);
    this.registeredHooks.set('stx-transfer', result);
    return result;
  }

  async registerAllHooks(): Promise<Map<string, Chainhook>> {
    console.log('[ChainhooksService] Registering all chainhooks...');
    
    // pulse-core events (5 hooks)
    await this.registerHook('pulse-sent', 'ChainPulse-PulseSent', PULSE_CORE_CONTRACT, '/pulse');
    await this.registerHook('boost', 'ChainPulse-Boost', PULSE_CORE_CONTRACT, '/boost');
    await this.registerHook('checkin', 'ChainPulse-Checkin', PULSE_CORE_CONTRACT, '/checkin');
    await this.registerHook('mega-pulse', 'ChainPulse-MegaPulse', PULSE_CORE_CONTRACT, '/mega-pulse');
    await this.registerHook('challenge', 'ChainPulse-Challenge', PULSE_CORE_CONTRACT, '/challenge');
    
    // pulse-rewards events (2 hooks)
    await this.registerHook('reward', 'ChainPulse-Reward', PULSE_REWARDS_CONTRACT, '/reward');
    await this.registerHook('tier', 'ChainPulse-Tier', PULSE_REWARDS_CONTRACT, '/tier');
    
    // pulse-badge events (1 hook)
    await this.registerHook('badge', 'ChainPulse-Badge', PULSE_BADGE_CONTRACT, '/badge');
    
    // stx transfers (1 hook)
    await this.registerStxTransferHook();
    
    console.log('[ChainhooksService] Registered ' + this.registeredHooks.size + ' chainhooks');
    return this.registeredHooks;
  }

  async listChainhooks(limit: number = 20): Promise<PaginatedChainhookResponse> {
    const response = await this.client.getChainhooks({ limit, offset: 0 });
    console.log('[ChainhooksService] Found ' + response.total + ' chainhooks');
    return response;
  }

  async listAllChainhooks(limit: number = 200): Promise<PaginatedChainhookResponse> {
    // Hiro API enforces limit <= 60
    const pageSize = Math.min(limit, 60);
    const response = await this.client.getChainhooks({ limit: pageSize, offset: 0 });
    return response;
  }

  async deleteDuplicateHooks(): Promise<void> {
    // Page through all chainhooks (API limit max is 60)
    const all: Chainhook[] = [];
    const pageSize = 60;
    let offset = 0;
    for (let i = 0; i < 20; i++) {
      const resp = await this.client.getChainhooks({ limit: pageSize, offset });
      all.push(...resp.results);
      offset += resp.results.length;
      if (resp.results.length < pageSize) break;
    }

    // Group only ChainPulse hooks by name
    const groups = new Map<string, { uuid: string }[]>();
    for (const hook of all) {
      const name = hook.definition?.name;
      if (!name || !this.desiredHookNames.has(name)) continue;
      const arr = groups.get(name) ?? [];
      arr.push({ uuid: hook.uuid });
      groups.set(name, arr);
    }

    // Keep one per name; delete the rest
    for (const [name, hooks] of groups) {
      if (hooks.length <= 1) continue;
      const [, ...dupes] = hooks; // keep first
      for (const h of dupes) {
        await this.deleteChainhook(h.uuid);
        console.log('[ChainhooksService] Deleted duplicate for ' + name + ':', h.uuid);
      }
    }
  }

  async getChainhook(uuid: string): Promise<Chainhook> {
    const chainhook = await this.client.getChainhook(uuid);
    console.log('[ChainhooksService] Retrieved chainhook:', uuid);
    return chainhook;
  }

  async toggleChainhook(uuid: string, enabled: boolean): Promise<void> {
    await this.client.enableChainhook(uuid, enabled);
    console.log('[ChainhooksService] Chainhook ' + uuid + ' ' + (enabled ? 'enabled' : 'disabled'));
  }

  async deleteChainhook(uuid: string): Promise<void> {
    await this.client.deleteChainhook(uuid);
    console.log('[ChainhooksService] Deleted:', uuid);
  }

  async deleteAllHooks(): Promise<void> {
    const response = await this.client.getChainhooks({ limit: 200, offset: 0 });
    for (const hook of response.results) {
      await this.deleteChainhook(hook.uuid);
    }
    this.registeredHooks.clear();
    console.log('[ChainhooksService] Deleted all chainhooks');
  }

  getRegisteredHooks(): Map<string, Chainhook> {
    return this.registeredHooks;
  }
}

export function createChainhooksService(): ChainhooksService {
  const apiKey = process.env.HIRO_API_KEY;
  if (!apiKey) throw new Error('HIRO_API_KEY required');
  return new ChainhooksService(apiKey);
}

export default ChainhooksService;