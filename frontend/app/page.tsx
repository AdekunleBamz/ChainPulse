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
  Star,
  Medal,
  Target
} from 'lucide-react';

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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

export default function Dashboard() {
  const [connected, setConnected] = useState(false);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentPulse, setRecentPulse] = useState<ActivityRecord | null>(null);

  // Fetch initial data
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

  // WebSocket connection for real-time updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    function connect() {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);
        // Reconnect after 3 seconds
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      };
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
      case 'platinum': return 'text-purple-400';
      case 'gold': return 'text-yellow-400';
      case 'silver': return 'text-gray-300';
      case 'bronze': return 'text-orange-400';
      default: return 'text-gray-500';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'platinum': return <Star className="w-4 h-4" />;
      case 'gold': return <Medal className="w-4 h-4" />;
      case 'silver': return <Trophy className="w-4 h-4" />;
      case 'bronze': return <Target className="w-4 h-4" />;
      default: return null;
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'pulse': return <Activity className="w-4 h-4 text-blue-400" />;
      case 'boost': return <Zap className="w-4 h-4 text-yellow-400" />;
      case 'checkin': return <Clock className="w-4 h-4 text-green-400" />;
      case 'mega-pulse': return <Flame className="w-4 h-4 text-red-400" />;
      case 'challenge': return <Trophy className="w-4 h-4 text-purple-400" />;
      default: return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  const formatSTX = (microSTX: number) => {
    return (microSTX / 1000000).toFixed(6);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <header className="border-b border-purple-500/20 bg-black/30 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">ChainPulse</h1>
                <p className="text-xs text-gray-400">Chainhook-Powered Activity Tracker</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                <span className="text-xs font-medium">{connected ? 'Live' : 'Connecting...'}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Recent Pulse Notification */}
      {recentPulse && (
        <div className="fixed top-20 right-4 z-50 animate-slide-in">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-3 rounded-lg shadow-lg">
            <div className="flex items-center gap-3">
              {getEventIcon(recentPulse.eventType)}
              <div>
                <p className="font-medium">{recentPulse.eventType.toUpperCase()}</p>
                <p className="text-sm opacity-80">+{recentPulse.points} points</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Total Users</p>
                <p className="text-2xl font-bold text-white">{stats?.totalUsers || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Activity className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Total Activities</p>
                <p className="text-2xl font-bold text-white">{stats?.totalActivities || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Total Fees (STX)</p>
                <p className="text-2xl font-bold text-white">{formatSTX(stats?.totalFees || 0)}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Zap className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Transactions</p>
                <p className="text-2xl font-bold text-white">{stats?.totalTransactions || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Leaderboard */}
          <div className="md:col-span-1">
            <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-xl">
              <div className="p-4 border-b border-gray-700/50">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Leaderboard
                </h2>
              </div>
              <div className="divide-y divide-gray-700/50">
                {leaderboard.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    No activity yet. Be the first!
                  </div>
                ) : (
                  leaderboard.slice(0, 10).map((entry, index) => (
                    <div key={entry.user} className="p-3 flex items-center gap-3 hover:bg-gray-700/30 transition-colors">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                        index === 1 ? 'bg-gray-400/20 text-gray-300' :
                        index === 2 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-gray-600/20 text-gray-400'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{formatAddress(entry.user)}</p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`flex items-center gap-1 ${getTierColor(entry.tier)}`}>
                            {getTierIcon(entry.tier)}
                            {entry.tier}
                          </span>
                          <span className="text-gray-500">•</span>
                          <span className="text-orange-400 flex items-center gap-1">
                            <Flame className="w-3 h-3" />
                            {entry.currentStreak}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold">{entry.totalPoints.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">points</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="md:col-span-2">
            <div className="bg-gray-800/50 backdrop-blur border border-gray-700/50 rounded-xl">
              <div className="p-4 border-b border-gray-700/50">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-400" />
                  Live Activity Feed
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full ml-2">
                    Powered by Chainhooks
                  </span>
                </h2>
              </div>
              <div className="divide-y divide-gray-700/50 max-h-[600px] overflow-y-auto">
                {activities.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Waiting for blockchain activity...</p>
                    <p className="text-sm mt-2">Events will appear here in real-time</p>
                  </div>
                ) : (
                  activities.map((activity) => (
                    <div key={activity.id} className="p-4 hover:bg-gray-700/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-gray-700/50 rounded-lg">
                          {getEventIcon(activity.eventType)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-white font-medium">
                              {activity.eventType.charAt(0).toUpperCase() + activity.eventType.slice(1).replace('-', ' ')}
                            </p>
                            <span className="text-xs text-gray-400">
                              {new Date(activity.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 mt-1">
                            {formatAddress(activity.user)}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            {activity.points !== 0 && (
                              <span className={`${activity.points > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {activity.points > 0 ? '+' : ''}{activity.points} pts
                              </span>
                            )}
                            {activity.fee > 0 && (
                              <span className="text-yellow-400">
                                {formatSTX(activity.fee)} STX
                              </span>
                            )}
                            {activity.metadata?.streak && (
                              <span className="text-orange-400 flex items-center gap-1">
                                <Flame className="w-3 h-3" />
                                {activity.metadata.streak} streak
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Chainhook Info */}
        <div className="mt-8 p-6 bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-500/30 rounded-xl">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <Zap className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-2">Powered by Hiro Chainhooks</h3>
              <p className="text-gray-300 text-sm mb-4">
                This dashboard receives real-time blockchain events through Hiro&apos;s Chainhooks API. 
                Every pulse, boost, and activity is streamed directly from the Stacks blockchain.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs">
                  @hirosystems/chainhooks-client
                </span>
                <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-xs">
                  Real-time Events
                </span>
                <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded-full text-xs">
                  Reorg Aware
                </span>
                <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs">
                  IFTTT Logic
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-700/50 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-sm">
          <p>ChainPulse - Built for Stacks Builder Challenge Week 2</p>
          <p className="mt-1">Demonstrating Hiro Chainhooks Integration</p>
        </div>
      </footer>

      <style jsx>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
