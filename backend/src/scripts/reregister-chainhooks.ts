import { createChainhooksService } from '../services/chainhooks.service.js';
import 'dotenv/config';

async function main() {
  const service = createChainhooksService();
  
  console.log('Deleting all existing chainhooks...');
  const hooks = await service.listChainhooks(20);
  
  for (const hook of hooks.results) {
    await service.deleteChainhook(hook.uuid);
    console.log('Deleted:', hook.definition?.name);
  }
  
  console.log('\nRe-registering with token in URLs...\n');
  await service.registerAllHooks();
  
  console.log('\nEnabling all hooks...');
  const newHooks = await service.listChainhooks(20);
  for (const hook of newHooks.results) {
    await service.toggleChainhook(hook.uuid, true);
    console.log('Enabled:', hook.definition?.name);
  }
  
  console.log('\nDone!');
}

main().catch(console.error);
