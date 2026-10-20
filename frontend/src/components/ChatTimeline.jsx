import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  FileText, 
  Check, 
  CheckCheck, 
  Clock, 
  ShieldAlert, 
  Sparkles,
  Phone,
  User,
  AlertCircle,
  ThumbsUp,
  XCircle
} from 'lucide-react';

export default function ChatTimeline({ 
  conversation, 
  messages, 
  onSendMessage, 
  onOpenTemplates, 
  onOpenApprovalDrawer,
  onApproveMessage,
  onRejectMessage
}) {
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    setSending(true);
    try {
      await onSendMessage(inputText.trim());
      setInputText('');
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const formatMessageTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderStatusIcon = (status) => {
    switch (status) {
      case 'READ':
        return <CheckCheck className="w-3.5 h-3.5 text-sky-500 inline ml-1" title="Read" />;
      case 'DELIVERED':
        return <CheckCheck className="w-3.5 h-3.5 text-gray-500 inline ml-1" title="Delivered" />;
      case 'SENT':
        return <Check className="w-3.5 h-3.5 text-gray-500 inline ml-1" title="Sent" />;
      case 'PENDING_APPROVAL':
        return <Clock className="w-3.5 h-3.5 text-amber-500 inline ml-1" title="Awaiting Approval" />;
      case 'REJECTED':
        return <XCircle className="w-3.5 h-3.5 text-rose-500 inline ml-1" title="Rejected" />;
      case 'FAILED':
        return <AlertCircle className="w-3.5 h-3.5 text-red-500 inline ml-1" title="Failed" />;
      default:
        return null;
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 bg-[#efeae2] dark:bg-[#0b141a] flex flex-col items-center justify-center text-center p-8 select-none">
        <div className="w-20 h-20 rounded-full bg-[#111b21] border border-[#222e35] flex items-center justify-center text-teal-400 mb-4 shadow-xl">
          <Phone className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">WhatsApp Business CRM</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mt-2">
          Select a customer from the left list to view their message history, review AI suggested drafts, or send pre-approved Meta WhatsApp templates.
        </p>
      </div>
    );
  }

  const contact = conversation.contact || {};

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b141a] relative">
      {/* Top Header */}
      <div className="h-16 bg-[#202c33] px-4 flex items-center justify-between border-b border-[#222e35] shadow-sm select-none z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-teal-700 to-emerald-600 flex items-center justify-center text-white font-semibold text-sm">
            {(contact.name || contact.phone_number || 'U').substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-100 text-sm">
                {contact.name || contact.phone_number}
              </span>
              <span className="text-xs text-gray-400 font-mono">
                {contact.phone_number}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              {contact.metadata?.company && <span>{contact.metadata.company} • </span>}
              <span className="text-emerald-400 font-medium">Meta WhatsApp Cloud API</span>
            </div>
          </div>
        </div>

        {/* Quick action controls */}
        <div className="flex items-center gap-2">
          {conversation.status === 'PENDING_APPROVAL' && (
            <button
              onClick={() => onOpenApprovalDrawer(conversation.id)}
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm animate-pulse"
            >
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Review AI Draft
            </button>
          )}

          <button
            onClick={() => onOpenTemplates(conversation)}
            className="px-3 py-1.5 bg-[#2a3942] hover:bg-[#32424b] text-gray-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border border-[#3b4a54]"
            title="Send WhatsApp Template"
          >
            <FileText className="w-3.5 h-3.5 text-teal-400" />
            Send Template
          </button>
        </div>
      </div>

      {/* Messages Timeline */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{
          backgroundImage: 'radial-gradient(#1f2c34 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          backgroundColor: '#0b141a'
        }}
      >
        {messages.map((msg) => {
          const isInbound = msg.direction === 'INBOUND';
          const isPendingApproval = msg.status === 'PENDING_APPROVAL';

          if (isPendingApproval) {
            return (
              <div key={msg.id} className="max-w-xl mx-auto my-3">
                <div className="bg-[#1f2c34] border-2 border-amber-500/60 rounded-xl p-4 shadow-xl text-gray-100">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#2a3942]">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-md bg-amber-500/20 text-amber-400">
                        <Sparkles className="w-4 h-4" />
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                        AI Suggested Response (Needs Approval)
                      </span>
                    </div>
                    <span className="text-[11px] text-amber-400 font-mono bg-amber-950/80 px-2 py-0.5 rounded border border-amber-700/50">
                      High Sensitivity Intent
                    </span>
                  </div>

                  <p className="text-sm text-gray-200 leading-relaxed font-sans mb-3 bg-[#111b21] p-3 rounded-lg border border-[#222e35]">
                    {msg.content}
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-gray-400">
                      Generated at {formatMessageTime(msg.timestamp)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onOpenApprovalDrawer(conversation.id)}
                        className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 shadow-md transition-all"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Inspect & 1-Click Approve
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-md lg:max-w-lg px-3.5 py-2 rounded-2xl shadow-md text-sm relative group ${
                  isInbound
                    ? 'bg-[#202c33] text-gray-100 rounded-tl-none border border-[#2a3942]'
                    : 'bg-[#005c4b] text-white rounded-tr-none'
                }`}
              >
                {/* Message Body */}
                <div className="whitespace-pre-wrap break-words leading-relaxed">
                  {msg.content}
                </div>

                {/* Meta footer (timestamp + checks) */}
                <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-gray-300/80 float-right ml-3">
                  <span>{formatMessageTime(msg.timestamp)}</span>
                  {!isInbound && renderStatusIcon(msg.status)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Bar */}
      <div className="bg-[#202c33] p-3 border-t border-[#222e35] z-10">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenTemplates(conversation)}
            title="Browse Approved Templates"
            className="p-2.5 rounded-lg text-gray-400 hover:text-teal-400 hover:bg-[#2a3942] transition-colors"
          >
            <FileText className="w-5 h-5" />
          </button>

          <input
            type="text"
            placeholder="Type a WhatsApp message to customer..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={sending}
            className="flex-1 bg-[#2a3942] text-sm text-gray-100 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 placeholder-gray-400 disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className="p-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium transition-colors shadow-sm flex items-center justify-center"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
