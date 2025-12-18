'use client';

import { useState, useEffect } from 'react';
import { 
  Activity, 
  Zap, 
  Trophy, 
  Clock, 
  TrendingUp, 
  Users, 
  Flame,
  Wallet,
  Send,
  Rocket,
  CheckCircle,
  Sparkles,
  ArrowRight,
  Globe,
  Shield,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { AppConfig, UserSession, showConnect } from '@stacks/connect';
import { 
  AnchorMode,
  PostConditionMode,
  uintCV,
  FungibleConditionCode,
  makeStandardSTXPostCondition
} from '@stacks/transactions';

const appConfig = new AppConfig(['store_write']);
const userSession = new UserSession({ appConfig });

// Contract addresses
const PULSE_CORE_CONTRACT = 'SP3FKNEZ86RG5RT7SZ5FBRGH85FZNG94ZH1MCGG6N.pulse-core';
const PULSE_REWARDS_CONTRACT = 'SP3FKNEZ86RG5RT7SZ5FBRGH85FZNG94ZH1MCGG6N.pulse-rewards';
const PULSE_BADGE_CONTRACT = 'SP3FKNEZ86RG5RT7SZ5FBRGH85FZNG94ZH1MCGG6N.pulse-badge-nft';
const CONTRACT_ADDRESS = 'SP3FKNEZ86RG5RT7SZ5FBRGH85FZNG94ZH1MCGG6N';
const CONTRACT_NAME = 'pulse-core';

// Hiro API
const HIRO_API = 'https://api.hiro.so';

interface Transaction {
  tx_id: string;
  sender_address: string;
  tx_status: string;
  tx_type: string;
  block_height: number;
  burn_block_time: number;
  burn_block_time_iso: string;
  fee_rate: string;
  contract_call?: {
    function_name: string;
    function_args: any[];
  };
}

interface ActivityRecord {
  id: string;
  txId: string;
  user: string;
  eventType: string;
  blockHeight: number;
  timestamp: string;
  fee: number;
  status: string;
}

interface LeaderboardEntry {
  user: string;
  txCount: number;
  totalFees: number;
  lastActive: string;
}

interface Stats {
  totalTransactions: number;
  totalUsers: number;
  totalFees: number;
  successfulTxs: number;
}

export default function Dashboard() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<Stats>({ totalTransactions: 0, totalUsers: 0, totalFees: 0, successfulTxs: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [txLoading, setTxLoading] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check wallet connection on mount
  useEffect(() => {
    if (userSession.isUserSignedIn()) {
      const userData = userSession.loadUserData();
      setWalletConnected(true);
      setUserAddress(userData.profile.stxAddress.mainnet);
      setShowDashboard(true);
    }
  }, []);

  // Fetch real blockchain data
  const fetchBlockchainData = async () => {
    try {
      setError(null);
      
      // Fetch transactions for pulse-core contract
      const txResponse = await fetch(
        `${HIRO_API}/extended/v1/address/${PULSE_CORE_CONTRACT}/transactions?limit=50`
      );
      
      if (!txResponse.ok) {
        throw new Error('Failed to fetch transactions');
      }
      
      const txData = await txResponse.json();
      const transactions: Transaction[] = txData.results || [];

      // Process transactions into activities
      const processedActivities: ActivityRecord[] = transactions
        .filter((tx: Transaction) => tx.tx_type === 'contract_call')
        .map((tx: Transaction) => {
          const functionName = tx.contract_call?.function_name || 'unknown';
          let eventType = 'unknown';
          
          if (functionName.includes('pulse') && !functionName.includes('mega')) {
            eventType = 'pulse';
          } else if (functionName.includes('boost')) {
            eventType = 'boost';
          } else if (functionName.includes('checkin') || functionName.includes('check-in')) {
            eventType = 'checkin';
          } else if (functionName.includes('mega')) {
            eventType = 'mega-pulse';
          } else if (functionName.includes('challenge')) {
            eventType = 'challenge';
          } else {
            eventType = functionName;
          }

          return {
            id: tx.tx_id,
            txId: tx.tx_id,
            user: tx.sender_address,
            eventType,
            blockHeight: tx.block_height,
            timestamp: tx.burn_block_time_iso,
            fee: parseInt(tx.fee_rate) || 0,
            status: tx.tx_status
          };
        });

      setActivities(processedActivities);

      // Build leaderboard from transactions
      const userStats: Record<string, LeaderboardEntry> = {};
      transactions.forEach((tx: Transaction) => {
        if (tx.tx_type === 'contract_call') {
          const user = tx.sender_address;
          if (!userStats[user]) {
            userStats[user] = {
              user,
              txCount: 0,
              totalFees: 0,
              lastActive: tx.burn_block_time_iso
            };
          }
          userStats[user].txCount++;
          userStats[user].totalFees += parseInt(tx.fee_rate) || 0;
          if (new Date(tx.burn_block_time_iso) > new Date(userStats[user].lastActive)) {
            userStats[user].lastActive = tx.burn_block_time_iso;
          }
        }
      });

      const sortedLeaderboard = Object.values(userStats)
        .sort((a, b) => b.txCount - a.txCount);
      
      setLeaderboard(sortedLeaderboard);

      // Calculate stats
      const uniqueUsers = new Set(transactions.map((tx: Transaction) => tx.sender_address)).size;
      const totalFees = transactions.reduce((sum: number, tx: Transaction) => sum + (parseInt(tx.fee_rate) || 0), 0);
      const successfulTxs = transactions.filter((tx: Transaction) => tx.tx_status === 'success').length;

      setStats({
        totalTransactions: transactions.length,
        totalUsers: uniqueUsers,
        totalFees,
        successfulTxs
      });

    } catch (err) {
      console.error('Error fetching blockchain data:', err);
      setError('Failed to fetch blockchain data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch data on mount and showDashboard
  useEffect(() => {
    fetchBlockchainData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchBlockchainData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBlockchainData();
  };

  const connectWallet = () => {
    showConnect({
      appDetails: {
        name: 'ChainPulse',
        icon: 'https://chainpulse.app/icon.png',
      },
      redirectTo: '/',
      onFinish: () => {
        const userData = userSession.loadUserData();
        setWalletConnected(true);
        setUserAddress(userData.profile.stxAddress.mainnet);
        setShowDashboard(true);
      },
      userSession,
    });
  };

  const disconnectWallet = () => {
    userSession.signUserOut();
    setWalletConnected(false);
    setUserAddress(null);
  };

  const callContract = async (functionName: string, functionArgs: any[], postConditionAmount?: number) => {
    if (!walletConnected || !userAddress) {
      alert('Please connect your wallet first');
      return;
    }

    setTxLoading(functionName);
    setTxStatus('Opening wallet...');

    try {
      const postConditions = postConditionAmount ? [
        makeStandardSTXPostCondition(
          userAddress,
          FungibleConditionCode.LessEqual,
          postConditionAmount
        )
      ] : [];

      const txOptions = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName,
        functionArgs,
        network: 'mainnet' as const,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Deny,
        postConditions,
        onFinish: (data: any) => {
          setTxStatus(`Submitted! TX: ${data.txId.slice(0, 8)}...`);
          setTimeout(() => {
            setTxStatus(null);
            setTxLoading(null);
            // Refresh data after transaction
            setTimeout(fetchBlockchainData, 5000);
          }, 3000);
        },
        onCancel: () => {
          setTxStatus(null);
          setTxLoading(null);
        },
      };

      const { openContractCall } = await import('@stacks/connect');
      await openContractCall(txOptions);
    } catch (error) {
      console.error('Contract call error:', error);
      setTxStatus('Error: ' + (error as Error).message);
      setTxLoading(null);
      setTimeout(() => setTxStatus(null), 5000);
    }
  };

  const sendPulse = () => callContract('send-pulse', [], 100000);
  const sendBoost = () => callContract('send-boost', [], 500000);
  const dailyCheckin = () => callContract('daily-checkin-action', []);
  const sendMegaPulse = () => callContract('send-mega-pulse', [uintCV(5)], 500000);
  const completeChallenge = () => callContract('complete-challenge', [uintCV(1)], 300000);

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'pulse': case 'send-pulse': return <Send className="w-5 h-5" />;
      case 'boost': case 'send-boost': return <Zap className="w-5 h-5" />;
      case 'checkin': case 'daily-checkin-action': return <CheckCircle className="w-5 h-5" />;
      case 'mega-pulse': case 'send-mega-pulse': return <Flame className="w-5 h-5" />;
      case 'challenge': case 'complete-challenge': return <Trophy className="w-5 h-5" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'pulse': case 'send-pulse': return 'from-blue-500 to-cyan-500';
      case 'boost': case 'send-boost': return 'from-yellow-500 to-orange-500';
      case 'checkin': case 'daily-checkin-action': return 'from-green-500 to-emerald-500';
      case 'mega-pulse': case 'send-mega-pulse': return 'from-red-500 to-pink-500';
      case 'challenge': case 'complete-challenge': return 'from-purple-500 to-indigo-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;
  const formatSTX = (microSTX: number) => (microSTX / 1000000).toFixed(4);
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Landing Page
  if (!showDashboard) {
    return (
      <div className="min-h-screen bg-gray-950 overflow-hidden relative">
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-gray-950 to-blue-900/30" />
          <div className="absolute top-20 left-10 w-72 h-72 bg-purple-600/20 rounded-full filter blur-3xl animate-pulse" />
          <div className="absolute top-40 right-10 w-64 h-64 bg-blue-600/20 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-20 left-1/3 w-56 h-56 bg-pink-600/20 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        {/* Navigation */}
        <nav className="relative z-10 px-6 py-5">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/40">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">ChainPulse</span>
            </div>
            <a 
              href={`https://explorer.hiro.so/address/${PULSE_CORE_CONTRACT}?chain=mainnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30 transition-all"
            >
              <span className="text-sm font-medium">View Contract</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </nav>

        {/* Hero Section */}
        <main className="relative z-10 px-6 pt-16 pb-20">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-500/20 border border-purple-500/30 rounded-full mb-8">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-gray-200">Powered by Hiro Chainhooks</span>
              <span className="px-2 py-1 bg-green-500/30 rounded-full text-xs text-green-300 font-bold">MAINNET</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-5xl md:text-6xl font-extrabold mb-6 leading-tight">
              <span className="text-white">Real-Time Blockchain</span>
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                Activity Tracker
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto">
              Send pulses, earn points, climb the leaderboard — all live on Stacks mainnet with real blockchain data.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <button
                onClick={connectWallet}
                className="group px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl font-bold text-lg text-white shadow-2xl shadow-purple-500/40 hover:shadow-purple-500/60 hover:scale-105 transition-all flex items-center gap-3"
              >
                <Wallet className="w-5 h-5" />
                Connect Wallet
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => setShowDashboard(true)}
                className="px-8 py-4 bg-white/10 border border-white/20 rounded-2xl font-bold text-lg text-white hover:bg-white/20 transition-all"
              >
                View Live Data
              </button>
            </div>

            {/* Live Stats Preview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
              {[
                { icon: Users, label: 'Unique Users', value: loading ? '...' : stats.totalUsers, bg: 'from-blue-500 to-cyan-500' },
                { icon: Activity, label: 'Transactions', value: loading ? '...' : stats.totalTransactions, bg: 'from-green-500 to-emerald-500' },
                { icon: Zap, label: 'Chainhooks', value: '9', bg: 'from-yellow-500 to-orange-500' },
                { icon: TrendingUp, label: 'Fees (STX)', value: loading ? '...' : formatSTX(stats.totalFees), bg: 'from-purple-500 to-pink-500' },
              ].map((s, i) => (
                <div key={i} className="p-5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:scale-105 transition-all group">
                  <div className={`w-12 h-12 mb-3 bg-gradient-to-br ${s.bg} rounded-xl flex items-center justify-center mx-auto shadow-lg group-hover:scale-110 transition-transform`}>
                    <s.icon className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                  <p className="text-sm text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { icon: Globe, title: 'Real Blockchain Data', desc: 'Live data from Stacks mainnet via Hiro API', bg: 'from-blue-500 to-cyan-500' },
                { icon: Shield, title: 'Production Ready', desc: '3 deployed contracts with 9 active chainhooks', bg: 'from-green-500 to-emerald-500' },
                { icon: Trophy, title: 'Live Leaderboard', desc: 'Real rankings from on-chain activity', bg: 'from-purple-500 to-pink-500' },
              ].map((f, i) => (
                <div key={i} className="p-6 bg-white/5 border border-white/10 rounded-2xl hover:border-white/30 transition-all group">
                  <div className={`w-14 h-14 mb-4 bg-gradient-to-br ${f.bg} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                    <f.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-gray-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="relative z-10 border-t border-white/10 py-5">
          <p className="text-center text-gray-500 text-sm">
            Built for Stacks Builder Challenge Week 2 • Live on Mainnet
          </p>
        </footer>
      </div>
    );
  }

  // Dashboard with Real Data
  return (
    <div className="min-h-screen bg-gray-950 relative">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-gray-950 to-blue-900/20" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/15 rounded-full filter blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-600/15 rounded-full filter blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/10 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">ChainPulse</span>
            <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-bold">MAINNET</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="text-xs">Refresh</span>
            </button>
            {walletConnected ? (
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white font-mono">
                  {formatAddress(userAddress || '')}
                </span>
                <button 
                  onClick={disconnectWallet} 
                  className="px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition-all"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button 
                onClick={connectWallet} 
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg text-white font-semibold hover:scale-105 transition-transform"
              >
                <Wallet className="w-4 h-4" />
                Connect
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Status Toast */}
      {txStatus && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl shadow-2xl flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {txStatus}
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50">
          <div className="px-6 py-3 bg-red-600 text-white rounded-xl shadow-2xl">
            {error}
          </div>
        </div>
      )}

      <main className="relative z-10 max-w-6xl mx-auto px-5 py-6">
        {/* Action Buttons */}
        {walletConnected && (
          <div className="mb-6">
            <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <Rocket className="w-5 h-5 text-purple-400" />
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { fn: sendPulse, icon: Send, name: 'Send Pulse', cost: '~0.001 STX', bg: 'from-blue-500 to-cyan-500', key: 'send-pulse' },
                { fn: sendBoost, icon: Zap, name: 'Boost', cost: '~0.005 STX', bg: 'from-yellow-500 to-orange-500', key: 'send-boost' },
                { fn: dailyCheckin, icon: CheckCircle, name: 'Check In', cost: 'Gas only', bg: 'from-green-500 to-emerald-500', key: 'daily-checkin-action' },
                { fn: sendMegaPulse, icon: Flame, name: 'Mega Pulse', cost: '~0.005 STX', bg: 'from-red-500 to-pink-500', key: 'send-mega-pulse' },
                { fn: completeChallenge, icon: Trophy, name: 'Challenge', cost: '~0.003 STX', bg: 'from-purple-500 to-indigo-500', key: 'complete-challenge' },
              ].map((action, i) => (
                <button
                  key={i}
                  onClick={action.fn}
                  disabled={txLoading !== null}
                  className={`group p-4 bg-gradient-to-br ${action.bg} rounded-xl text-white hover:scale-105 hover:shadow-xl transition-all disabled:opacity-50 disabled:hover:scale-100`}
                >
                  {txLoading === action.key ? (
                    <div className="w-7 h-7 mb-2 mx-auto border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <action.icon className="w-7 h-7 mb-2 mx-auto group-hover:scale-110 transition-transform" />
                  )}
                  <p className="font-bold text-sm">{action.name}</p>
                  <p className="text-xs opacity-80">{action.cost}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stats from Real Data */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Users, label: 'Unique Users', value: loading ? '...' : stats.totalUsers, bg: 'from-blue-500 to-cyan-500' },
            { icon: Activity, label: 'Total TXs', value: loading ? '...' : stats.totalTransactions, bg: 'from-green-500 to-emerald-500' },
            { icon: CheckCircle, label: 'Successful', value: loading ? '...' : stats.successfulTxs, bg: 'from-yellow-500 to-orange-500' },
            { icon: TrendingUp, label: 'Fees (STX)', value: loading ? '...' : formatSTX(stats.totalFees), bg: 'from-purple-500 to-pink-500' },
          ].map((s, i) => (
            <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
              <div className={`w-10 h-10 mb-2 bg-gradient-to-br ${s.bg} rounded-lg flex items-center justify-center`}>
                <s.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {/* Leaderboard - Real Data */}
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                Leaderboard
              </h2>
              <span className="text-xs text-gray-400">By TX Count</span>
            </div>
            <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-400">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p>Loading from blockchain...</p>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No activity yet</p>
                </div>
              ) : (
                leaderboard.slice(0, 10).map((entry, index) => (
                  <a
                    key={entry.user}
                    href={`https://explorer.hiro.so/address/${entry.user}?chain=mainnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 flex items-center gap-3 hover:bg-white/5 transition-all block"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                      index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400' :
                      index === 2 ? 'bg-gradient-to-br from-orange-400 to-red-500' :
                      'bg-gray-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{formatAddress(entry.user)}</p>
                      <p className="text-xs text-gray-400">{formatSTX(entry.totalFees)} STX fees</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">{entry.txCount}</p>
                      <p className="text-xs text-gray-400">txs</p>
                    </div>
                  </a>
                ))
              )}
            </div>
          </div>

          {/* Activity Feed - Real Data */}
          <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-400" />
                Live Activity
              </h2>
              <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-semibold">
                ⚡ Real Blockchain Data
              </span>
            </div>
            <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="p-12 text-center text-gray-400">
                  <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-lg">Fetching from Hiro API...</p>
                </div>
              ) : activities.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <Activity className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">No transactions found</p>
                  <p className="text-sm mt-2">Be the first to send a pulse!</p>
                </div>
              ) : (
                activities.map((activity) => (
                  <a
                    key={activity.id}
                    href={`https://explorer.hiro.so/txid/${activity.txId}?chain=mainnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 flex items-center gap-4 hover:bg-white/5 transition-all block"
                  >
                    <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${getEventColor(activity.eventType)} flex items-center justify-center text-white`}>
                      {getEventIcon(activity.eventType)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium capitalize">
                            {activity.eventType.replace(/-/g, ' ')}
                          </p>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            activity.status === 'success' 
                              ? 'bg-green-500/20 text-green-400' 
                              : activity.status === 'pending'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {activity.status}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatTime(activity.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">{formatAddress(activity.user)}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500">Block #{activity.blockHeight}</span>
                        <span className="text-xs text-yellow-400">{formatSTX(activity.fee)} STX fee</span>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-500" />
                  </a>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Contract Info */}
        <div className="mt-6 p-5 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-xl">
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/30">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white mb-1">Live on Stacks Mainnet</h3>
              <p className="text-gray-300 text-sm mb-3">All data fetched directly from the blockchain via Hiro API.</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://explorer.hiro.so/address/${PULSE_CORE_CONTRACT}?chain=mainnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-white/10 rounded-full text-xs text-white hover:bg-white/20 transition-all flex items-center gap-1"
                >
                  pulse-core <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={`https://explorer.hiro.so/address/${PULSE_REWARDS_CONTRACT}?chain=mainnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-white/10 rounded-full text-xs text-white hover:bg-white/20 transition-all flex items-center gap-1"
                >
                  pulse-rewards <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={`https://explorer.hiro.so/address/${PULSE_BADGE_CONTRACT}?chain=mainnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-white/10 rounded-full text-xs text-white hover:bg-white/20 transition-all flex items-center gap-1"
                >
                  pulse-badge-nft <ExternalLink className="w-3 h-3" />
                </a>
                <span className="px-3 py-1 bg-green-500/20 rounded-full text-xs text-green-400">9 Chainhooks Active</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-5 mt-8">
        <p className="text-center text-gray-500 text-sm">ChainPulse • Stacks Builder Challenge Week 2 • Live on Mainnet</p>
      </footer>
    </div>
  );
}
