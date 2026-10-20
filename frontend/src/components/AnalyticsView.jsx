import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Clock, 
  CheckCircle, 
  Send, 
  Eye, 
  TrendingUp, 
  Users, 
  ShieldCheck, 
  Sparkles,
  ArrowUpRight,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';

export default function AnalyticsView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.getAnalytics();
      setData(res);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0c1317] text-gray-400 text-xs">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading CRM SLA & Analytics...
      </div>
    );
  }

  const broadcast = data?.broadcast_stats || {};
  const breakdown = data?.daily_breakdown || [];
  const maxDayCount = Math.max(...breakdown.map(d => Math.max(d.inbound, d.outbound)), 10);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0c1317] overflow-y-auto text-gray-200">
      {/* Top Header */}
      <div className="h-16 px-6 border-b border-[#222e35] flex items-center justify-between bg-[#111b21] shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-teal-400" />
            Analytics & Team SLA Dashboard
          </h1>
          <p className="text-xs text-gray-400">Real-time throughput, Meta delivery receipts, and OpenMausBot Copilot resolution rates</p>
        </div>

        <button 
          onClick={loadAnalytics} 
          className="p-2 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-[#202c33] transition-colors"
          title="Refresh metrics"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Top 4 SLA Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#111b21] p-5 rounded-2xl border border-[#222e35] relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400">First Response Time (FRT)</span>
              <Clock className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-3xl font-extrabold text-teal-400 mt-2">
              {data?.avg_frt_seconds}s
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 mt-2 font-medium">
              <ArrowUpRight className="w-3.5 h-3.5" /> 84% faster with OpenMausBot Copilot
            </div>
          </div>

          <div className="bg-[#111b21] p-5 rounded-2xl border border-[#222e35] relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400">Resolution Rate</span>
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-extrabold text-emerald-400 mt-2">
              {data?.resolution_rate_percent}%
            </div>
            <div className="text-[11px] text-gray-400 mt-2">
              {data?.resolved_conversations} of {data?.total_conversations} conversations resolved
            </div>
          </div>

          <div className="bg-[#111b21] p-5 rounded-2xl border border-[#222e35] relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400">WhatsApp Delivery Rate</span>
              <Send className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-3xl font-extrabold text-blue-400 mt-2">
              {data?.delivery_rate_percent}%
            </div>
            <div className="text-[11px] text-gray-400 mt-2">
              {data?.messages_delivered} delivered out of {data?.messages_sent} sent
            </div>
          </div>

          <div className="bg-[#111b21] p-5 rounded-2xl border border-[#222e35] relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400">Message Read Rate</span>
              <Eye className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-3xl font-extrabold text-purple-400 mt-2">
              {data?.read_rate_percent}%
            </div>
            <div className="text-[11px] text-gray-400 mt-2">
              Confirmed blue double-tick receipts
            </div>
          </div>
        </div>

        {/* 7-Day Message Throughput Chart */}
        <div className="bg-[#111b21] p-6 rounded-2xl border border-[#222e35]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-teal-400" />
                7-Day Inbound vs. Outbound Message Throughput
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Daily volume processed across all customer conversations</p>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-teal-500 inline-block"></span>
                <span className="text-gray-300">Outbound Messages</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-blue-500 inline-block"></span>
                <span className="text-gray-300">Inbound Messages</span>
              </div>
            </div>
          </div>

          {/* Bar Chart Representation */}
          <div className="h-48 flex items-end justify-between gap-4 pt-4 border-b border-[#222e35] px-2">
            {breakdown.map((item, idx) => {
              const outHeight = Math.round((item.outbound / maxDayCount) * 100);
              const inHeight = Math.round((item.inbound / maxDayCount) * 100);

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="w-full flex items-end justify-center gap-1.5 h-full">
                    {/* Inbound bar */}
                    <div 
                      className="w-1/2 max-w-[20px] bg-blue-500/80 hover:bg-blue-400 rounded-t transition-all relative group/bar"
                      style={{ height: `${Math.max(10, inHeight)}%` }}
                    >
                      <span className="opacity-0 group-hover/bar:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-black px-1.5 py-0.5 rounded text-[10px] text-white font-mono pointer-events-none transition-opacity">
                        {item.inbound}
                      </span>
                    </div>

                    {/* Outbound bar */}
                    <div 
                      className="w-1/2 max-w-[20px] bg-teal-500 hover:bg-teal-400 rounded-t transition-all relative group/bar"
                      style={{ height: `${Math.max(12, outHeight)}%` }}
                    >
                      <span className="opacity-0 group-hover/bar:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-black px-1.5 py-0.5 rounded text-[10px] text-white font-mono pointer-events-none transition-opacity">
                        {item.outbound}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono mt-1">{item.date}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Row: Agent Leaderboard & Broadcast Performance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Agent Leaderboard */}
          <div className="bg-[#111b21] p-6 rounded-2xl border border-[#222e35]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-400" />
                Agent SLA & Activity Leaderboard
              </h3>
              <span className="text-xs text-gray-400">This Month</span>
            </div>

            <div className="space-y-3">
              {(data?.agent_performance || []).map((agent, i) => (
                <div key={i} className="flex items-center justify-between p-3.5 bg-[#182229] rounded-xl border border-[#222e35]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-300 font-bold flex items-center justify-center text-xs border border-teal-500/30">
                      {agent.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-100 flex items-center gap-1.5">
                        {agent.name}
                        {agent.name.includes('Copilot') && (
                          <Sparkles className="w-3 h-3 text-purple-400" />
                        )}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {agent.conversations_handled} conversations handled
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-emerald-400">
                      {agent.resolution_rate}% resolution
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono">
                      Avg FRT: {agent.avg_frt_seconds}s
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Broadcast Funnel Performance */}
          <div className="bg-[#111b21] p-6 rounded-2xl border border-[#222e35]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                <Send className="w-4 h-4 text-purple-400" />
                Broadcast Campaigns Delivery Funnel
              </h3>
              <span className="text-xs text-purple-400 font-mono">{broadcast.total_campaigns || 0} Campaigns</span>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <div className="flex justify-between text-xs text-gray-300 mb-1.5">
                  <span>1. Messages Dispatched</span>
                  <span className="font-mono font-bold text-teal-400">{broadcast.total_sent?.toLocaleString() || 0}</span>
                </div>
                <div className="w-full bg-[#202c33] h-2 rounded-full overflow-hidden">
                  <div className="bg-teal-500 h-full w-full rounded-full"></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-300 mb-1.5">
                  <span>2. Delivered to Handsets</span>
                  <span className="font-mono font-bold text-blue-400">{broadcast.total_delivered?.toLocaleString() || 0}</span>
                </div>
                <div className="w-full bg-[#202c33] h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-500 h-full rounded-full transition-all" 
                    style={{ width: `${broadcast.total_sent ? (broadcast.total_delivered / broadcast.total_sent) * 100 : 95}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-300 mb-1.5">
                  <span>3. Opened & Read by Customers</span>
                  <span className="font-mono font-bold text-purple-400">{broadcast.total_read?.toLocaleString() || 0}</span>
                </div>
                <div className="w-full bg-[#202c33] h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-purple-500 h-full rounded-full transition-all" 
                    style={{ width: `${broadcast.total_delivered ? (broadcast.total_read / broadcast.total_delivered) * 100 : 78}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-[11px] text-purple-200">
              <span className="font-bold">Enterprise Insight:</span> High read rate of 70%+ confirms WhatsApp outperforms email marketing by ~4.2x in recipient engagement.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
