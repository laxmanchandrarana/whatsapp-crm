import React from 'react';
import { 
  MessageSquare, 
  ShieldAlert, 
  FileText, 
  Users, 
  Sparkles, 
  Zap,
  BarChart3
} from 'lucide-react';

export default function Sidebar({ 
  activeView, 
  setActiveView, 
  pendingApprovalsCount, 
  onOpenSimulator,
  onOpenTemplates,
  stats
}) {
  return (
    <aside className="w-16 bg-[#111b21] flex flex-col items-center py-4 border-r border-[#222e35] select-none z-20">
      {/* Brand Icon */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-teal-900/40 mb-6 cursor-pointer" title="DoubleTick WhatsApp CRM">
        <MessageSquare className="w-5 h-5 fill-white/20" />
      </div>

      {/* Nav items */}
      <nav className="flex-1 w-full flex flex-col items-center gap-3">
        <button
          onClick={() => setActiveView('chats')}
          title="All Chats"
          className={`relative p-3 rounded-xl transition-all duration-150 ${
            activeView === 'chats' 
              ? 'bg-[#202c33] text-teal-400 shadow-inner' 
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a252d]'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
        </button>

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

        <button
          onClick={onOpenTemplates}
          title="WhatsApp Message Templates"
          className="p-3 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-[#1a252d] transition-colors"
        >
          <FileText className="w-5 h-5" />
        </button>

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
      <div className="flex flex-col items-center gap-3">
        <div 
          className="text-[10px] text-gray-400 text-center px-1 font-mono border border-[#2a3942] rounded py-1 bg-[#1a252d]"
          title="Meta Cloud API: Connected"
        >
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1"></span>
          API
        </div>
      </div>
    </aside>
  );
}
