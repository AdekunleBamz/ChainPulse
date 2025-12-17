'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Star,
  Medal,
  Target
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

const PULSE_CORE_CONTRACT = 'SP3FKNEZ86RG5RT7SZ5FBRGH85FZNG94ZH1MCGG6N.pulse-core';
const [CONTRACT_ADDRESS, CONTRACT_NAME] = PULSE_CORE_CONTRACT.split('.');

interface ActivityRecord {
  id: string;
  user: string;
  eventType: string;
  points: number;
  fee: number;
  timestamp: string;
  metadata: Record<string, any>;
}

interface LeaderboardEntry {
  user: string;
  totalPoints: number;
  totalPulses: number;
  currentStreak: number;
  longestStreak: number;
  tier: string;
}

interface Stats {
  totalUsers: number;
  totalActivities: number;
  totalFees: number;
  totalTransactions: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://chainpulse-backend.onrender.com';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://chainpulse-backend.onrender.com/ws';

export default function Dashboard() {
  const [connected, setConnected] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentPulse, setRecentPulse] = useState<ActivityRecord | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);

  useEffect(() => {
    if (userSession.isUserSignedIn()) {
      const userData = userSession.loadUserData();
      setWalletConnected(true);
      setUserAddress(userData.profile.stxAddress.mainnet);
      setShowDashboard(true);
    }
  }, []);

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

    setLoading(functionName);
    setTxStatus('Preparing transaction...');

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
          setTxStatus(`Success! TX: ${data.txId.slice(0, 10)}...`);
          setTimeout(() => {
            setTxStatus(null);
            setLoading(null);
          }, 5000);
        },
        onCancel: () => {
          setTxStatus(null);
          setLoading(null);
        },
      };

      const { openContractCall } = await import('@stacks/connect');
      await openContractCall(txOptions);
    } catch (error) {
      console.error('Contract call error:', error);
      setTxStatus('Error: ' + (error as Error).message);
      setLoading(null);
      setTimeout(() => setTxStatus(null), 5000);
    }
  };

  const sendPulse = () => callContract('send-pulse', [], 1000);
  const sendBoost = () => callContract('send-boost', [], 5000);
  const dailyCheckin = () => callContract('daily-checkin-action', []);
  const sendMegaPulse = () => callContract('send-mega-pulse', [uintCV(5)], 5000);
  const completeChallenge = () => callContract('complete-challenge', [uintCV(1)], 3000);

  useEffect(() => {
    async function fetchData() {
      try {
        const [activitiesRes, leaderboardRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/api/activities?limit=50`),
          fetch(`${API_URL}/api/leaderboard?limit=20`),
          fetch(`${API_URL}/api/stats`),
        ]);

        if (activitiesRes.ok) {
          const data = await activitiesRes.json();
          setActivities(data.activities);
        }
        if (leaderboardRes.ok) {
          const data = await leaderboardRes.json();
          setLeaderboard(data.leaderboard);
        }
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    function connect() {
      try {
        ws = new WebSocket(WS_URL);
        ws.onopen = () => setConnected(true);
        ws.onclose = () => {
          setConnected(false);
          reconnectTimeout = setTimeout(connect, 3000);
        };
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        };
      } catch (e) {
        console.error('WebSocket error:', e);
      }
    }
    connect();
    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimeout);
    };
  }, []);

  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'pulse':
      case 'boost':
      case 'checkin':
      case 'mega-pulse':
      case 'challenge':
        setActivities(prev => [data.activity, ...prev.slice(0, 49)]);
        setRecentPulse(data.activity);
        setTimeout(() => setRecentPulse(null), 3000);
        break;
      case 'leaderboard-update':
        setLeaderboard(prev => {
          const index = prev.findIndex(e => e.user === data.entry.user);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = data.entry;
            return updated.sort((a, b) => b.totalPoints - a.totalPoints);
          }
          return [...prev, data.entry].sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 20);
        });
        break;
      case 'connected':
        if (data.stats) setStats(data.stats);
        break;
    }
  }, []);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'platinum': return 'from-purple-400 to-pink-400';
      case 'gold': return 'from-yellow-400 to-orange-400';
      case 'silver': return 'from-gray-300 to-gray-400';
      case 'bronze': return 'from-orange-400 to-red-400';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'pulse': return <Activity className="w-5 h-5" />;
      case 'boost': return <Zap className="w-5 h-5" />;
      case 'checkin': return <Clock className="w-5 h-5" />;
      case 'mega-pulse': return <Flame className="w-5 h-5" />;
      case 'challenge': return <Trophy className="w-5 h-5" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'pulse': return 'from-blue-500 to-cyan-500';
      case 'boost': return 'from-yellow-500 to-orange-500';
      case 'checkin': return 'from-green-500 to-emerald-500';
      case 'mega-pulse': return 'from-red-500 to-pink-500';
      case 'challenge': return 'from-purple-500 to-indigo-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;
  const formatSTX = (microSTX: number) => (microSTX / 1000000).toFixed(4);

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
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 border border-green-500/40">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm text-green-400 font-semibold">{connected ? 'Live' : 'Connecting...'}</span>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <main className="relative z-10 px-6 pt-16 pb-20">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-500/20 border border-purple-500/30 rounded-full mb-8 animate-fade-in">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-gray-200">Powered by Hiro Chainhooks</span>
              <span className="px-2 py-1 bg-purple-500/30 rounded-full text-xs text-purple-300 font-bold">Week 2</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-5xl md:text-6xl font-extrabold mb-6 leading-tight animate-slide-up">
              <span className="text-white">Real-Time Blockchain</span>
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                Activity Tracker
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Send pulses, earn points, climb the leaderboard — all powered by instant blockchain events.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in" style={{ animationDelay: '0.4s' }}>
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
                View Dashboard
              </button>
            </div>

            {/* Stats Preview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
              {[
                { icon: Users, label: 'Users', value: stats?.totalUsers || '0', bg: 'from-blue-500 to-cyan-500' },
                { icon: Activity, label: 'Pulses', value: stats?.totalActivities || '0', bg: 'from-green-500 to-emerald-500' },
                { icon: Zap, label: 'Hooks', value: '9', bg: 'from-yellow-500 to-orange-500' },
                { icon: Trophy, label: 'STX', value: formatSTX(stats?.totalFees || 0), bg: 'from-purple-500 to-pink-500' },
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
                { icon: Globe, title: 'Real-Time Events', desc: 'Instant blockchain streaming via Hiro Chainhooks', bg: 'from-blue-500 to-cyan-500' },
                { icon: Shield, title: 'Secure & Transparent', desc: 'All activities on Stacks blockchain', bg: 'from-green-500 to-emerald-500' },
                { icon: Trophy, title: 'Gamified Experience', desc: 'Earn points and compete globally', bg: 'from-purple-500 to-pink-500' },
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
            Built for Stacks Builder Challenge Week 2 • Powered by Hiro Chainhooks
          </p>
        </footer>
      </div>
    );
  }

  // Dashboard
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
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">ChainPulse</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 text-green-400">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-semibold">{connected ? 'Live' : 'Offline'}</span>
            </div>
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
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-slide-in">
          <div className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl shadow-2xl flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {txStatus}
          </div>
        </div>
      )}

      {/* Recent Event Toast */}
      {recentPulse && (
        <div className="fixed top-20 right-6 z-50 animate-slide-in">
          <div className={`px-6 py-4 bg-gradient-to-r ${getEventColor(recentPulse.eventType)} text-white rounded-xl shadow-2xl`}>
            <div className="flex items-center gap-3">
              {getEventIcon(recentPulse.eventType)}
              <div>
                <p className="font-bold">{recentPulse.eventType.toUpperCase()}</p>
                <p className="text-sm opacity-80">+{recentPulse.points} points</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="relative z-10 max-w-6xl mx-auto px-5 py-6">
        {/* Action Buttons */}
        {walletConnected && (
          <div className="mb-6 animate-fade-in">
            <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <Rocket className="w-5 h-5 text-purple-400" />
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { fn: sendPulse, icon: Send, name: 'Send Pulse', cost: '0.001 STX', bg: 'from-blue-500 to-cyan-500' },
                { fn: sendBoost, icon: Zap, name: 'Boost', cost: '0.005 STX', bg: 'from-yellow-500 to-orange-500' },
                { fn: dailyCheckin, icon: CheckCircle, name: 'Check In', cost: 'Free', bg: 'from-green-500 to-emerald-500' },
                { fn: sendMegaPulse, icon: Flame, name: 'Mega Pulse', cost: '0.005 STX', bg: 'from-red-500 to-pink-500' },
                { fn: completeChallenge, icon: Trophy, name: 'Challenge', cost: '0.003 STX', bg: 'from-purple-500 to-indigo-500' },
              ].map((action, i) => (
                <button
                  key={i}
                  onClick={action.fn}
                  disabled={loading !== null}
                  className={`group p-4 bg-gradient-to-br ${action.bg} rounded-xl text-white hover:scale-105 hover:shadow-xl transition-all disabled:opacity-50 disabled:hover:scale-100`}
                >
                  <action.icon className="w-7 h-7 mb-2 mx-auto group-hover:scale-110 transition-transform" />
                  <p className="font-bold text-sm">{action.name}</p>
                  <p className="text-xs opacity-80">{action.cost}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Users, label: 'Users', value: stats?.totalUsers || 0, bg: 'from-blue-500 to-cyan-500' },
            { icon: Activity, label: 'Activities', value: stats?.totalActivities || 0, bg: 'from-green-500 to-emerald-500' },
            { icon: TrendingUp, label: 'STX Fees', value: formatSTX(stats?.totalFees || 0), bg: 'from-yellow-500 to-orange-500' },
            { icon: Zap, label: 'Transactions', value: stats?.totalTransactions || 0, bg: 'from-purple-500 to-pink-500' },
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
          {/* Leaderboard */}
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-400" />
                Leaderboard
              </h2>
            </div>
            <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
              {leaderboard.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No activity yet</p>
                  <p className="text-sm">Be the first!</p>
                </div>
              ) : (
                leaderboard.slice(0, 10).map((entry, index) => (
                  <div key={entry.user} className="p-3 flex items-center gap-3 hover:bg-white/5 transition-all">
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
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`px-2 py-0.5 rounded bg-gradient-to-r ${getTierColor(entry.tier)} text-white text-xs`}>
                          {entry.tier}
                        </span>
                        <span className="text-orange-400 flex items-center gap-1">
                          <Flame className="w-3 h-3" />
                          {entry.currentStreak}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">{entry.totalPoints.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">pts</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Activity Feed */}
          <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-400" />
                Live Activity
              </h2>
              <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-semibold">
                ⚡ Chainhooks
              </span>
            </div>
            <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
              {activities.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <Activity className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">Waiting for activity...</p>
                  <p className="text-sm mt-2">Connect wallet and send a pulse!</p>
                </div>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="p-4 flex items-center gap-4 hover:bg-white/5 transition-all">
                    <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${getEventColor(activity.eventType)} flex items-center justify-center text-white`}>
                      {getEventIcon(activity.eventType)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-white font-medium capitalize">{activity.eventType.replace('-', ' ')}</p>
                        <span className="text-xs text-gray-400">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">{formatAddress(activity.user)}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {activity.points !== 0 && (
                          <span className="text-sm text-green-400 font-semibold">+{activity.points} pts</span>
                        )}
                        {activity.fee > 0 && (
                          <span className="text-sm text-yellow-400">{formatSTX(activity.fee)} STX</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Chainhook Banner */}
        <div className="mt-6 p-5 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-xl flex items-center gap-5">
          <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/30">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white mb-1">Powered by Hiro Chainhooks</h3>
            <p className="text-gray-300 text-sm mb-2">9 active chainhooks streaming real-time blockchain events.</p>
            <div className="flex flex-wrap gap-2">
              {['@hirosystems/chainhooks-client', 'Real-time', 'WebSocket', '9 Hooks'].map((tag) => (
                <span key={tag} className="px-3 py-1 bg-white/10 rounded-full text-xs text-white">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-5 mt-8">
        <p className="text-center text-gray-500 text-sm">ChainPulse • Stacks Builder Challenge Week 2</p>
      </footer>
    </div>
  );
}
