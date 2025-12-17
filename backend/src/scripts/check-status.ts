#!/usr/bin/env tsx
/**
 * ChainPulse - Check Chainhook Status Script
 * 
 * This script checks the status of registered chainhooks
 * Run: npm run chainhook:status
 */

import { createChainhooksService } from '../services/chainhooks.service.js';
import 'dotenv/config';

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('ChainPulse - Chainhook Status Check');
  console.log('='.repeat(60));

  if (!process.env.HIRO_API_KEY) {
    console.error('Error: HIRO_API_KEY environment variable is required');
    process.exit(1);
  }

  try {
    const service = createChainhooksService();
    
    // Check API status
    console.log('\n📡 Hiro API Status:');
    console.log('-'.repeat(40));
    const status = await service.checkStatus();
    console.log(`  Status: ${status.status}`);
    console.log(`  Version: ${status.version}`);

    // List chainhooks
    console.log('\n📋 Registered Chainhooks:');
    console.log('-'.repeat(40));
    
    const response = await service.listChainhooks(50);
    
    if (response.total === 0) {
      console.log('  No chainhooks registered.');
      console.log('  Run: npm run chainhook:register');
    } else {
      console.log(`  Total: ${response.total}\n`);
      
      for (const hook of response.results) {
        const statusEmoji = hook.status.status === 'streaming' ? '🟢' : '🔴';
        console.log(`  ${statusEmoji} ${hook.definition.name}`);
        console.log(`     UUID: ${hook.uuid}`);
        console.log(`     Status: ${hook.status.status}`);
        console.log(`     Enabled: ${hook.status.enabled}`);
        console.log(`     Chain: ${hook.definition.chain}`);
        console.log(`     Network: ${hook.definition.network}`);
        console.log('');
      }
    }

  } catch (error) {
    console.error('\n❌ Status check failed:', error);
    process.exit(1);
  }
}

main();
