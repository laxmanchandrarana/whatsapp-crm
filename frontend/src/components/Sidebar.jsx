import React from 'react';
import { 
  MessageSquare, 
  ShieldAlert, 
  FileText, 
  Sparkles, 
  Send,
  Bot,
  BarChart3
} from 'lucide-react';

export default function Sidebar({ 
  activeView, 
  setActiveView, 
  pendingApprovalsCount, 
  onOpenSimulator,
  onOpenTemplates
}) {
  return (
    <aside className="w-16 bg-[#111b21] flex flex-col items-center py-4 border-r border-[#222e35] select-none z-20 shrink-0">
      {/* Brand Icon */}
      <div 
        onClick={() => setActiveView('chats')}
        className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-teal-900/40 mb-6 cursor-pointer hover:scale-105 transition-transform" 
        title="DoubleTick Enterprise WhatsApp CRM"
      >
        <MessageSquare className="w-5 h-5 fill-white/20" />
      </div>

      {/* Nav items */}
      <nav className="flex-1 w-full flex flex-col items-center gap-3">
        {/* 1. Chats View */}
        <button
          onClick={() => setActiveView('chats')}
          title="Shared Team Inbox & Chats"
          className={`relative p-3 rounded-xl transition-all duration-150 ${
            activeView === 'chats' 
              ? 'bg-[#202c33] text-teal-400 shadow-inner' 
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a252d]'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
        </button>

        {/* 2. Approval Queue View */}
        <button
          onClick={() => setActiveView('approvals')}
          title="Human-in-the-Loop Approval Queue"
          className={`relative p-3 rounded-xl transition-all duration-150 ${
            activeView === 'approvals' 
              ? 'bg-[#202c33] text-amber-400 shadow-inner' 
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a252d]'
          }`}
        >
          <ShieldAlert className="w-5 h-5" />
          {pendingApprovalsCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#111b21] animate-pulse">
              {pendingApprovalsCount}
            </span>
          )}
        </button>

        {/* 3. Broadcasts & Campaigns */}
        <button
          onClick={() => setActiveView('broadcasts')}
          title="WhatsApp Broadcast Campaigns"
          className={`relative p-3 rounded-xl transition-all duration-150 ${
            activeView === 'broadcasts' 
              ? 'bg-[#202c33] text-teal-400 shadow-inner' 
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a252d]'
          }`}
        >
          <Send className="w-5 h-5" />
        </button>

        {/* 4. No-Code Bot Studio */}
        <button
          onClick={() => setActiveView('bot_studio')}
          title="No-Code Bot Studio Flow Builder"
          className={`relative p-3 rounded-xl transition-all duration-150 ${
            activeView === 'bot_studio' 
              ? 'bg-[#202c33] text-teal-400 shadow-inner' 
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a252d]'
          }`}
        >
          <Bot className="w-5 h-5" />
        </button>

        {/* 5. Analytics & SLA Dashboard */}
        <button
          onClick={() => setActiveView('analytics')}
          title="Analytics & SLA Leaderboard"
          className={`relative p-3 rounded-xl transition-all duration-150 ${
            activeView === 'analytics' 
              ? 'bg-[#202c33] text-teal-400 shadow-inner' 
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a252d]'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
        </button>

        {/* Separator */}
        <div className="w-8 h-[1px] bg-[#222e35] my-1"></div>

        {/* 6. Message Templates Modal */}
        <button
          onClick={onOpenTemplates}
          title="WhatsApp Message Templates"
          className="p-3 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-[#1a252d] transition-colors"
        >
          <FileText className="w-5 h-5" />
        </button>

        {/* 7. Mock Webhook Simulator */}
        <button
          onClick={onOpenSimulator}
          title="Simulate Inbound Webhook (QA / Demo)"
          className="p-3 rounded-xl text-purple-400 hover:text-purple-300 hover:bg-[#1a252d] transition-colors group relative"
        >
          <Sparkles className="w-5 h-5 transition-transform group-hover:scale-110" />
          <span className="absolute -bottom-1 -right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
          </span>
        </button>
      </nav>

      {/* Footer stats badge */}
      <div className="flex flex-col items-center gap-2">
        <div 
          className="text-[10px] text-gray-400 text-center px-1 font-mono border border-[#2a3942] rounded py-1 bg-[#1a252d]"
          title="Meta Cloud API Connected"
        >
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>
          META
        </div>
      </div>
    </aside>
  );
}
