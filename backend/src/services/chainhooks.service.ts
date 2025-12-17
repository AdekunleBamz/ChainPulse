import { 
  ChainhooksClient, 
  CHAINHOOKS_BASE_URL,
  type Chainhook,
  type PaginatedChainhookResponse 
} from '@hirosystems/chainhooks-client';

const PULSE_CORE_CONTRACT = process.env.PULSE_CORE_CONTRACT || 'SP3FKNEZ86RG5RT7SZ5FBRGH85FZNG94ZH1MCGG6N.pulse-core';
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://chainpulse-backend.onrender.com/api/chainhook/events';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const NETWORK = process.env.STACKS_NETWORK || 'mainnet';

function webhookUrl(path: string) {
  const base = WEBHOOK_URL.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  // chainhooks-client action schema is only { type: "http_post", url }
  // so if you want auth, include a token in the URL.
  return WEBHOOK_SECRET ? `${base}${p}?token=${encodeURIComponent(WEBHOOK_SECRET)}` : `${base}${p}`;
}

export class ChainhooksService {
  private client: ChainhooksClient;
  private registeredHooks: Map<string, Chainhook> = new Map();
  
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

  async registerPulseSentHook(): Promise<Chainhook> {
    const definition: any = {
      name: 'ChainPulse-PulseSent',
      version: '1',
      chain: 'stacks',
      network: NETWORK === 'testnet' ? 'testnet' : 'mainnet',
      filters: {
        events: [
          {
            type: 'contract_log',
            contract_identifier: PULSE_CORE_CONTRACT,
          }
        ]
      },
      action: {
        type: 'http_post',
        url: webhookUrl('/pulse'),
      }
    };
    const result = await this.client.registerChainhook(definition);
    console.log('[ChainhooksService] Registered pulse-sent:', result.uuid);
    this.registeredHooks.set('pulse-sent', result);
    return result;
  }

  async registerBoostHook(): Promise<Chainhook> {
    throw new Error('Not implemented yet (stage 2)');
  }

  async registerCheckinHook(): Promise<Chainhook> {
    throw new Error('Not implemented yet (stage 2)');
  }

  async registerMegaPulseHook(): Promise<Chainhook> {
    throw new Error('Not implemented yet (stage 2)');
  }

  async registerChallengeHook(): Promise<Chainhook> {
    throw new Error('Not implemented yet (stage 2)');
  }

  async registerAllHooks(): Promise<Map<string, Chainhook>> {
    console.log('[ChainhooksService] Registering all chainhooks...');
    await this.registerPulseSentHook();
    // stage 2 will re-enable the remaining hooks once we confirm the schema works end-to-end
    console.log('[ChainhooksService] Registered ' + this.registeredHooks.size + ' chainhooks');
    return this.registeredHooks;
  }

  async listChainhooks(limit: number = 20): Promise<PaginatedChainhookResponse> {
    const response = await this.client.getChainhooks({ limit, offset: 0 });
    console.log('[ChainhooksService] Found ' + response.total + ' chainhooks');
    return response;
  }

  async deleteChainhook(uuid: string): Promise<void> {
    await this.client.deleteChainhook(uuid);
    console.log('[ChainhooksService] Deleted:', uuid);
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