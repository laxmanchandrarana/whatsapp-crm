import React, { useState } from 'react';
import { X, Sparkles, Send, ShieldAlert, CheckCircle, Zap } from 'lucide-react';

export default function SimulateWebhookModal({ isOpen, onClose, onSimulateSuccess }) {
  const [phoneNumber, setPhoneNumber] = useState('+14155552671');
  const [senderName, setSenderName] = useState('Marcus Vance');
  const [messageText, setMessageText] = useState('I was double billed $499, please refund immediately!');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  if (!isOpen) return null;

  const presets = [
    {
      title: 'High Risk: Refund Dispute',
      phone: '+14155552671',
      name: 'Marcus Vance',
      text: 'I demand an immediate refund for my double charge or I will file a credit card dispute.',
      expected: 'Risk 94% -> Enqueued to Approval Queue'
    },
    {
      title: 'High Risk: Enterprise Pricing',
      phone: '+919876543210',
      name: 'Priya Sharma',
      text: 'We are buying 30 enterprise seats. Can you approve a 25% discount for a multi-year deal?',
      expected: 'Risk 78% -> Enqueued to Approval Queue'
    },
    {
      title: 'High Risk: Cancellation Request',
      phone: '+447911123456',
      name: 'Elena Rostova',
      text: 'Please cancel our subscription and close our account at end of month.',
      expected: 'Risk 88% -> Enqueued to Approval Queue'
    },
    {
      title: 'Low Risk: FAQ & Office Hours',
      phone: '+12025550143',
      name: 'David Miller',
      text: 'Hello! What are your business operating hours and support email?',
      expected: 'Risk 10% -> Auto-replied immediately by Bot'
    }
  ];

  const applyPreset = (preset) => {
    setPhoneNumber(preset.phone);
    setSenderName(preset.name);
    setMessageText(preset.text);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || loading) return;

    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await onSimulateSuccess(phoneNumber, senderName, messageText);
      setStatusMessage({ type: 'success', text: 'Webhook dispatched and ingested! Check the conversation list and approval queue.' });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to simulate webhook' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111b21] border border-[#222e35] rounded-2xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 bg-[#202c33] border-b border-[#222e35] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-100 flex items-center gap-1.5">
                Simulate Inbound WhatsApp Webhook
              </h2>
              <p className="text-xs text-gray-400">Trigger real-time Cloud API payloads & test AI approval risk scoring</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-[#2a3942]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* Quick Presets */}
          <div>
            <label className="text-xs font-semibold text-gray-300 mb-2 block">
              Quick Test Scenarios:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="p-2.5 rounded-lg bg-[#202c33] hover:bg-[#2a3942] border border-[#2a3942] text-left transition-colors"
                >
                  <div className="text-xs font-semibold text-gray-200">{p.title}</div>
                  <div className="text-[10px] text-teal-400 mt-1">{p.expected}</div>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-300 mb-1 block">Sender Phone:</label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full bg-[#202c33] text-xs text-gray-100 p-2 rounded-lg border border-[#2a3942] focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-300 mb-1 block">Sender Name:</label>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="w-full bg-[#202c33] text-xs text-gray-100 p-2 rounded-lg border border-[#2a3942] focus:outline-none focus:ring-1 focus:ring-purple-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 mb-1 block">WhatsApp Message Body:</label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={3}
                className="w-full bg-[#202c33] text-xs text-gray-100 p-2.5 rounded-lg border border-[#2a3942] focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                placeholder="Type customer WhatsApp message..."
                required
              />
            </div>

            {statusMessage && (
              <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                statusMessage.type === 'success' 
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' 
                  : 'bg-rose-950/80 text-rose-300 border border-rose-800'
              }`}>
                {statusMessage.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <ShieldAlert className="w-4 h-4 text-rose-400" />}
                {statusMessage.text}
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:bg-[#2a3942]"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={loading || !messageText.trim()}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md disabled:opacity-50 transition-all"
              >
                <Zap className="w-4 h-4" />
                {loading ? 'Simulating...' : 'Send Simulated Webhook'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
