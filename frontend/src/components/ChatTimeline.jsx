import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  FileText, 
  ShieldAlert, 
  Check, 
  CheckCheck, 
  Sparkles, 
  User, 
  Clock, 
  AlertTriangle,
  Smile,
  MoreVertical,
  Phone,
  Bookmark,
  StickyNote,
  ChevronDown,
  ChevronLeft
} from 'lucide-react';
import CannedRepliesModal from './CannedRepliesModal';
import { api } from '../services/api';

export default function ChatTimeline({
  conversation,
  messages = [],
  onSendMessage,
  onOpenTemplates,
  onOpenApprovalDrawer,
  onApproveMessage,
  onRejectMessage,
  onConversationUpdated,
  onBackToConversations
}) {
  const [inputText, setInputText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [showCannedModal, setShowCannedModal] = useState(false);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0c1317] text-gray-500 border-r border-[#222e35]">
        <div className="w-16 h-16 rounded-full bg-[#182229] flex items-center justify-center mb-4">
          <Phone className="w-8 h-8 text-gray-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-300">Enterprise WhatsApp Shared Team Inbox</h3>
        <p className="text-xs text-gray-500 mt-1 max-w-sm text-center">
          Select a customer conversation from the list to view real-time messages, internal notes, and AI Copilot suggestions.
        </p>
      </div>
    );
  }

  const { contact } = conversation;

  // Handle status update
  const handleStatusChange = async (newStatus) => {
    try {
      await api.updateConversationStatus(conversation.id, newStatus);
      if (onConversationUpdated) onConversationUpdated();
    } catch (err) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  // Handle Copilot Suggestion trigger
  const handleGenerateCopilot = async () => {
    try {
      setCopilotLoading(true);
      const approval = await api.generateCopilotSuggestion(conversation.id);
      if (onOpenApprovalDrawer) onOpenApprovalDrawer();
      if (onConversationUpdated) onConversationUpdated();
    } catch (err) {
      alert(`Copilot suggestion error: ${err.message}`);
    } finally {
      setCopilotLoading(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (isInternalNote) {
      try {
        await api.addInternalNote(conversation.id, inputText.trim(), 'Supervisor Agent');
        setInputText('');
        if (onConversationUpdated) onConversationUpdated();
      } catch (err) {
        alert(`Failed to add internal note: ${err.message}`);
      }
    } else {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  // Status badge style helper
  const getStatusBadgeClass = (st) => {
    switch (st) {
      case 'PENDING_APPROVAL': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'RESOLVED': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'SNOOZED': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'CLOSED': return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
      default: return 'bg-teal-500/10 text-teal-400 border-teal-500/30';
    }
  };

  // Find if there is an active pending approval for this conversation
  const pendingDraftMsg = messages.find(m => m.status === 'PENDING_APPROVAL');

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0c1317] border-r border-[#222e35] overflow-hidden">
      {/* 1. Header */}
      <div className="h-16 px-6 border-b border-[#222e35] flex items-center justify-between bg-[#111b21] shrink-0">
        <div className="flex items-center gap-3">
          {onBackToConversations && (
            <button
              onClick={onBackToConversations}
              className="md:hidden p-1.5 rounded-lg bg-[#182229] hover:bg-[#202c33] text-teal-400 border border-[#2a3942] transition mr-1"
              title="Back to conversations"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-teal-700 to-teal-500 text-white font-bold flex items-center justify-center text-sm shadow">
            {contact.name ? contact.name.charAt(0) : '#'}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-100">{contact.name || contact.phone_number}</h2>
              {/* Dynamic Status Dropdown */}
              <div className="relative inline-block">
                <select
                  value={conversation.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className={`text-[10px] font-bold uppercase rounded-full px-2.5 py-0.5 border cursor-pointer appearance-none pr-5 focus:outline-none bg-[#111b21] ${getStatusBadgeClass(conversation.status)}`}
                >
                  <option value="OPEN">Open</option>
                  <option value="PENDING_APPROVAL">Pending Approval</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="SNOOZED">Snoozed</option>
                  <option value="CLOSED">Closed</option>
                </select>
                <ChevronDown className="w-3 h-3 text-gray-400 absolute right-1.5 top-1 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-gray-400">
              <span className="font-mono text-gray-300">{contact.phone_number}</span>
              {contact.tags && contact.tags.map((tag, idx) => (
                <span key={idx} className="bg-[#202c33] text-teal-300 px-1.5 py-0.2 rounded text-[10px]">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right header actions */}
        <div className="flex items-center gap-2">
          {/* OpenMausBot Copilot Trigger Button */}
          <button
            onClick={handleGenerateCopilot}
            disabled={copilotLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-semibold transition"
            title="Invoke OpenMausBot Copilot to generate suggested response"
          >
            <Sparkles className={`w-3.5 h-3.5 text-purple-400 ${copilotLoading ? 'animate-spin' : ''}`} />
            Copilot Suggest
          </button>

          <button
            onClick={onOpenTemplates}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#202c33] hover:bg-[#2a3942] text-teal-400 rounded-lg text-xs font-semibold transition border border-[#2a3942]"
            title="Send WhatsApp Template"
          >
            <FileText className="w-3.5 h-3.5" />
            Template
          </button>
        </div>
      </div>

      {/* 2. OpenMausBot Copilot Bar & Gatekeeper Banner */}
      <div className="px-6 py-2 bg-[#182229] border-b border-[#222e35] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 font-semibold text-purple-300">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            OpenMausBot Copilot:
          </span>
          <span className="text-[11px] font-mono bg-purple-950/60 text-purple-300 px-2 py-0.5 rounded border border-purple-800/40">
            gemini-2.5-pro
          </span>
          <span className="text-gray-400 text-[11px]">Strict Approval Gatekeeper Active</span>
        </div>

        {pendingDraftMsg && (
          <button
            onClick={onOpenApprovalDrawer}
            className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline flex items-center gap-1"
          >
            <ShieldAlert className="w-3.5 h-3.5" /> 1 Draft Needs Approval
          </button>
        )}
      </div>

      {/* 3. Messages Timeline */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-[radial-gradient(#1a252d_1px,transparent_1px)] [background-size:16px_16px]">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 text-xs py-12">
            No messages yet. Send an approved template or text message to initiate conversation.
          </div>
        ) : (
          messages.map((msg) => {
            const isInbound = msg.direction === 'INBOUND';
            const isNote = msg.is_internal || msg.message_type === 'NOTE';
            const isPending = msg.status === 'PENDING_APPROVAL';

            if (isNote) {
              return (
                <div key={msg.id} className="mx-auto max-w-lg my-2">
                  <div className="bg-amber-950/40 border border-amber-600/40 rounded-xl p-3 text-amber-200 text-xs shadow-sm">
                    <div className="flex items-center justify-between font-semibold mb-1 text-[11px] text-amber-400">
                      <span className="flex items-center gap-1">
                        <StickyNote className="w-3 h-3" />
                        Internal Whisper Note &bull; {msg.author_agent || 'Supervisor'}
                      </span>
                      <span className="font-mono text-[10px]">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="leading-relaxed whitespace-pre-line">{msg.content}</div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isInbound ? 'items-start' : 'items-end'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-sm relative leading-relaxed ${
                    isInbound
                      ? 'bg-[#202c33] text-gray-100 rounded-tl-none border border-[#2a3942]'
                      : isPending
                      ? 'bg-amber-950/60 text-amber-200 rounded-tr-none border border-amber-600/60'
                      : 'bg-teal-700 text-white rounded-tr-none'
                  }`}
                >
                  {/* Gatekeeper warning badge on pending AI message */}
                  {isPending && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-400 font-bold mb-1 pb-1 border-b border-amber-700/50">
                      <ShieldAlert className="w-3 h-3" />
                      HELD BY GATEKEEPER &bull; Awaiting Human Approval
                    </div>
                  )}

                  <div className="whitespace-pre-line">{msg.content}</div>

                  <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                    isInbound ? 'text-gray-400' : isPending ? 'text-amber-400' : 'text-teal-200'
                  }`}>
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {!isInbound && (
                      <span>
                        {msg.status === 'READ' && <CheckCheck className="w-3.5 h-3.5 text-cyan-300" />}
                        {msg.status === 'DELIVERED' && <CheckCheck className="w-3.5 h-3.5" />}
                        {msg.status === 'SENT' && <Check className="w-3.5 h-3.5" />}
                        {msg.status === 'FAILED' && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 4. Composer Mode Switcher (Customer Reply vs Internal Whisper Note) */}
      <div className="px-6 pt-2 bg-[#111b21] flex items-center justify-between text-xs border-t border-[#222e35]">
        <div className="flex items-center gap-1 bg-[#182229] p-1 rounded-lg border border-[#222e35]">
          <button
            onClick={() => setIsInternalNote(false)}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
              !isInternalNote ? 'bg-teal-500 text-slate-950' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Reply Customer
          </button>
          <button
            onClick={() => setIsInternalNote(true)}
            className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition ${
              isInternalNote ? 'bg-amber-500 text-slate-950 font-bold' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <StickyNote className="w-3 h-3" /> Whisper Note
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCannedModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#182229] hover:bg-[#202c33] text-gray-300 hover:text-teal-400 rounded-md text-xs font-medium border border-[#2a3942] transition"
            title="Browse canned responses"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Canned (/shortcut)</span>
          </button>
        </div>
      </div>

      {/* 5. Message Input Bar */}
      <form onSubmit={handleSend} className="p-4 bg-[#111b21] flex items-center gap-3">
        <input
          type="text"
          placeholder={isInternalNote ? "Type a private internal note for the team (never sent to customer)..." : "Type a message or type / for canned shortcut..."}
          value={inputText}
          onChange={(e) => {
            const val = e.target.value;
            setInputText(val);
            if (val === '/') {
              setShowCannedModal(true);
            }
          }}
          className={`flex-1 border rounded-xl px-4 py-2.5 text-xs text-gray-100 focus:outline-none transition ${
            isInternalNote
              ? 'bg-[#182229] border-amber-500/50 focus:border-amber-400'
              : 'bg-[#182229] border-[#2a3942] focus:border-teal-500'
          }`}
        />

        <button
          type="submit"
          disabled={!inputText.trim()}
          className={`px-4 py-2.5 rounded-xl text-slate-950 font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-40 ${
            isInternalNote ? 'bg-amber-400 hover:bg-amber-300' : 'bg-teal-500 hover:bg-teal-400'
          }`}
        >
          <Send className="w-4 h-4" />
          {isInternalNote ? 'Save Note' : 'Send'}
        </button>
      </form>

      {/* Canned Replies Modal */}
      <CannedRepliesModal
        isOpen={showCannedModal}
        onClose={() => setShowCannedModal(false)}
        onSelectReply={(text) => setInputText(text)}
      />
    </div>
  );
}
