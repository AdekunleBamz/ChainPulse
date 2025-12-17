import { createChainhooksService } from '../services/chainhooks.service.js';
import 'dotenv/config';

async function main() {
  const service = createChainhooksService();
  const hooks = await service.listChainhooks(20);
  
  console.log('Enabling all chainhooks...\n');
  
  for (const hook of hooks.results) {
    if (!hook.enabled) {
      await service.toggleChainhook(hook.uuid, true);
      console.log('Enabled:', hook.definition?.name);
    } else {
      console.log('Already enabled:', hook.definition?.name);
    }
  }
  
  console.log('\nDone!');
}

main().catch(console.error);
