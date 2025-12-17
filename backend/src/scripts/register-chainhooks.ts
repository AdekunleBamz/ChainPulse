#!/usr/bin/env tsx
/**
 * ChainPulse - Register Chainhooks Script
 * 
 * This script registers all chainhooks with the Hiro Chainhooks API
 * Run: npm run chainhook:register
 */

import { createChainhooksService } from '../services/chainhooks.service.js';
import 'dotenv/config';

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('ChainPulse - Chainhook Registration');
  console.log('='.repeat(60));

  // Validate environment
  if (!process.env.HIRO_API_KEY) {
    console.error('Error: HIRO_API_KEY environment variable is required');
    process.exit(1);
  }

  try {
    // Initialize service
    const service = createChainhooksService();
    console.log('\n📡 Checking Hiro API status...');
    
    const status = await service.checkStatus();
    console.log(`✅ API Status: ${status.status}`);
    console.log(`📦 Server Version: ${status.version}`);

    // Register all hooks
    console.log('\n🔗 Registering chainhooks...\n');
    console.log('🧹 Deleting duplicate ChainPulse hooks (if any)...\n');
    await service.deleteDuplicateHooks();
    const hooks = await service.registerAllHooks();

    // Display results
    console.log('\n' + '='.repeat(60));
    console.log('Registration Complete!');
    console.log('='.repeat(60));
    
    console.log('\nRegistered Chainhooks:');
    console.log('-'.repeat(40));
    
    for (const [name, hook] of hooks) {
      console.log(`  ✅ ${name}`);
      console.log(`     UUID: ${hook.uuid}`);
    }

    console.log(`\n📊 Total: ${hooks.size} chainhooks registered`);
    console.log('\n🎉 Your ChainPulse app is now connected to the Stacks blockchain!');
    console.log('   Events will be streamed to your webhook URL in real-time.\n');

  } catch (error) {
    console.error('\n❌ Registration failed:', error);
    process.exit(1);
  }
}

main();
