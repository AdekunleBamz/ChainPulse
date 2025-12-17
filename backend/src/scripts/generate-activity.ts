#!/usr/bin/env tsx
/**
 * ChainPulse - Fee Generation Strategy
 * 
 * This script automates high-volume activity generation
 * for maximizing the Stacks Builder Challenge scoring.
 * 
 * Run: npx tsx scripts/generate-activity.ts
 */

import { 
  makeContractCall, 
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  uintCV
} from '@stacks/transactions';
import { StacksMainnet, StacksTestnet } from '@stacks/network';

// Configuration
const NETWORK = process.env.STACKS_NETWORK || 'testnet';
const CONTRACT_ADDRESS = process.env.PULSE_CORE_CONTRACT?.split('.')[0] || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
const CONTRACT_NAME = 'pulse-core';

const network = NETWORK === 'mainnet' ? new StacksMainnet() : new StacksTestnet();

interface ActivityPlan {
  action: string;
  count: number;
  fee: number;
  points: number;
}

// Daily activity plan for maximum scoring
const DAILY_PLAN: ActivityPlan[] = [
  { action: 'send-pulse', count: 50, fee: 1000, points: 10 },
  { action: 'send-boost', count: 10, fee: 5000, points: 50 },
  { action: 'daily-checkin-action', count: 1, fee: 0, points: 5 },
  { action: 'send-mega-pulse', count: 5, fee: 5000, points: 50 }, // 5x multiplier
  { action: 'complete-challenge', count: 3, fee: 3000, points: 25 },
];

/**
 * Calculate daily totals
 */
function calculateDailyTotals(): { fees: number; points: number; transactions: number } {
  let totalFees = 0;
  let totalPoints = 0;
  let totalTx = 0;

  for (const activity of DAILY_PLAN) {
    totalFees += activity.fee * activity.count;
    totalPoints += activity.points * activity.count;
    totalTx += activity.count;
  }

  return { fees: totalFees, points: totalPoints, transactions: totalTx };
}

/**
 * Execute activity for a single user
 */
async function executeActivity(
  senderKey: string,
  action: string,
  args: any[] = []
): Promise<string | null> {
  try {
    const txOptions = {
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: action,
      functionArgs: args,
      senderKey,
      network,
      anchorMode: AnchorMode.Any,
      postConditionMode: PostConditionMode.Allow,
    };

    const transaction = await makeContractCall(txOptions);
    const result = await broadcastTransaction({ transaction, network });
    
    if ('error' in result) {
      console.error(`Failed: ${action} - ${result.error}`);
      return null;
    }

    console.log(`✅ ${action} - tx: ${result.txid}`);
    return result.txid;
  } catch (error) {
    console.error(`Error executing ${action}:`, error);
    return null;
  }
}

/**
 * Run daily activity batch for a user
 */
async function runDailyBatch(senderKey: string): Promise<void> {
  console.log('\n🚀 Starting daily activity batch...\n');

  for (const activity of DAILY_PLAN) {
    console.log(`\n📍 ${activity.action} (x${activity.count})`);
    
    for (let i = 0; i < activity.count; i++) {
      let args: any[] = [];
      
      if (activity.action === 'send-mega-pulse') {
        args = [uintCV(5)]; // 5x multiplier
      } else if (activity.action === 'complete-challenge') {
        args = [uintCV(i + 1)]; // Challenge ID
      }

      await executeActivity(senderKey, activity.action, args);
      
      // Small delay between transactions
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n✨ Daily batch complete!');
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('ChainPulse - Fee Generation Strategy');
  console.log('='.repeat(60));

  const totals = calculateDailyTotals();
  
  console.log('\n📊 Daily Plan Summary:');
  console.log('-'.repeat(40));
  console.log(`  Total Transactions: ${totals.transactions}`);
  console.log(`  Total Fees: ${(totals.fees / 1000000).toFixed(6)} STX`);
  console.log(`  Total Points: ${totals.points}`);
  
  console.log('\n📈 Weekly Projection (5 users):');
  console.log('-'.repeat(40));
  console.log(`  Total Transactions: ${totals.transactions * 5 * 7}`);
  console.log(`  Total Fees: ${((totals.fees * 5 * 7) / 1000000).toFixed(6)} STX`);
  console.log(`  Total Points: ${totals.points * 5 * 7}`);

  console.log('\n📋 Activity Breakdown:');
  console.log('-'.repeat(40));
  for (const activity of DAILY_PLAN) {
    console.log(`  ${activity.action}: ${activity.count}x (${(activity.fee / 1000000).toFixed(6)} STX each)`);
  }

  // Check if we should run the batch
  const privateKey = process.env.STACKS_PRIVATE_KEY;
  
  if (privateKey && process.argv.includes('--execute')) {
    await runDailyBatch(privateKey);
  } else {
    console.log('\n💡 To execute transactions:');
    console.log('   1. Set STACKS_PRIVATE_KEY in .env');
    console.log('   2. Run: npx tsx scripts/generate-activity.ts --execute');
  }
}

main().catch(console.error);
