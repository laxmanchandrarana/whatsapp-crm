import React from 'react';
import { Search, ShieldAlert, CheckCheck, Clock, Check } from 'lucide-react';

export default function ConversationList({ 
  conversations, 
  activeId, 
  onSelectConversation, 
  statusFilter, 
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  pendingApprovalsTotal
}) {
  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getStatusBadge = (status, pendingCount) => {
    if (status === 'PENDING_APPROVAL' || pendingCount > 0) {
      return (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-950/70 border border-amber-800/60 px-1.5 py-0.5 rounded">
          <ShieldAlert className="w-3 h-3" />
          Approval
        </span>
      );
    }
    if (status === 'CLOSED') {
      return (
        <span className="text-[10px] text-gray-400 bg-gray-800/80 px-1.5 py-0.5 rounded">
          Closed
        </span>
      );
    }
    return null;
  };

  return (
    <div className="w-80 lg:w-96 bg-[#111b21] flex flex-col border-r border-[#222e35] h-full select-none">
      {/* Header */}
      <div className="p-3.5 pb-2 border-b border-[#222e35]">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-100 tracking-tight flex items-center gap-2">
            WhatsApp CRM
            <span className="text-xs font-normal text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-full">
              DoubleTick
            </span>
          </h1>
        </div>

        {/* Search Input */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search chats or phone numbers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#202c33] text-sm text-gray-100 pl-9 pr-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 placeholder-gray-400"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'PENDING_APPROVAL', label: 'Needs Approval', count: pendingApprovalsTotal },
            { id: 'OPEN', label: 'Open' },
            { id: 'CLOSED', label: 'Closed' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-colors flex items-center gap-1.5 font-medium ${
                statusFilter === tab.id
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-[#202c33] text-gray-300 hover:bg-[#2a3942]'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  statusFilter === tab.id ? 'bg-white text-teal-900' : 'bg-amber-500 text-slate-950'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Conversations Scrollable List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#202c33]/40">
        {conversations.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            <p>No conversations found</p>
            <p className="text-xs text-gray-500 mt-1">Simulate an incoming message or start a new chat.</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isSelected = activeId === conv.id;
            const hasPending = conv.status === 'PENDING_APPROVAL' || (conv.pending_approval_count > 0);
            const contactName = conv.contact?.name || conv.contact?.phone_number || 'Unknown';
            const lastMsg = conv.last_message;

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`flex items-start gap-3 p-3 cursor-pointer transition-colors ${
                  isSelected ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]/70'
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-sm ${
                    hasPending 
                      ? 'bg-gradient-to-tr from-amber-600 to-amber-400 ring-2 ring-amber-500/50' 
                      : 'bg-gradient-to-tr from-teal-700 to-emerald-600'
                  }`}>
                    {contactName.substring(0, 2).toUpperCase()}
                  </div>
                  {conv.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 bg-emerald-500 text-slate-950 font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border border-[#111b21]">
                      {conv.unread_count}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-semibold text-gray-200 text-sm truncate">
                      {contactName}
                    </span>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">
                      {formatTime(conv.last_message_at)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-xs text-gray-400 truncate">
                      {lastMsg?.direction === 'OUTBOUND' && (
                        <span>
                          {lastMsg.status === 'READ' && <CheckCheck className="w-3.5 h-3.5 text-sky-400 inline" />}
                          {lastMsg.status === 'DELIVERED' && <CheckCheck className="w-3.5 h-3.5 text-gray-400 inline" />}
                          {lastMsg.status === 'SENT' && <Check className="w-3.5 h-3.5 text-gray-400 inline" />}
                          {lastMsg.status === 'PENDING_APPROVAL' && <Clock className="w-3.5 h-3.5 text-amber-400 inline" />}
                        </span>
                      )}
                      <span className="truncate">
                        {lastMsg ? lastMsg.content : 'No messages yet'}
                      </span>
                    </div>

                    {/* Status Badge */}
                    {getStatusBadge(conv.status, conv.pending_approval_count)}
                  </div>

                  {/* Tags */}
                  {conv.contact?.tags && conv.contact.tags.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {conv.contact.tags.slice(0, 2).map((tag, idx) => (
                        <span key={idx} className="text-[9px] bg-[#1a252d] text-teal-300/80 px-1.5 py-0.2 rounded border border-[#2a3942]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
