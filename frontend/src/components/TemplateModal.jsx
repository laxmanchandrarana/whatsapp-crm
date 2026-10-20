import React, { useState } from 'react';
import { X, FileText, CheckCircle2, Send, Tag } from 'lucide-react';

export default function TemplateModal({ isOpen, onClose, templates, onSendTemplate, activeConversation }) {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [sending, setSending] = useState(false);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!selectedTemplate) return;
    setSending(true);
    try {
      await onSendTemplate(selectedTemplate);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const contactName = activeConversation?.contact?.name || activeConversation?.contact?.phone_number || 'Recipient';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111b21] border border-[#222e35] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 bg-[#202c33] border-b border-[#222e35] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-500/20 text-teal-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-100">Meta WhatsApp Templates</h2>
              <p className="text-xs text-gray-400">Select an approved Meta business template to dispatch</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-[#2a3942]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {templates.map((tpl) => {
            const isSelected = selectedTemplate?.id === tpl.id;
            const bodyComp = tpl.components?.find(c => c.type === 'BODY') || {};
            const headerComp = tpl.components?.find(c => c.type === 'HEADER') || {};

            return (
              <div
                key={tpl.id}
                onClick={() => setSelectedTemplate(tpl)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-teal-500 bg-[#202c33] ring-1 ring-teal-500 shadow-md'
                    : 'border-[#222e35] bg-[#182229] hover:border-[#2a3942] hover:bg-[#202c33]/50'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <span className="font-semibold text-gray-100 text-sm">
                      {tpl.name}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                      {tpl.meta_status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-2 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1 font-mono">
                      <Tag className="w-3 h-3 text-teal-400" />
                      {tpl.category}
                    </span>
                    <span>• {tpl.language}</span>
                  </div>

                  {headerComp.text && (
                    <div className="text-xs font-bold text-gray-200 mb-1">
                      {headerComp.text}
                    </div>
                  )}

                  <p className="text-xs text-gray-300 leading-relaxed font-sans bg-[#111b21] p-2.5 rounded-lg border border-[#222e35]">
                    {bodyComp.text || 'No preview available'}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-end">
                  <span className={`text-xs font-medium flex items-center gap-1 ${
                    isSelected ? 'text-teal-400 font-bold' : 'text-gray-400'
                  }`}>
                    {isSelected && <CheckCircle2 className="w-4 h-4" />}
                    {isSelected ? 'Selected' : 'Click to select'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#202c33] border-t border-[#222e35] flex items-center justify-between">
          <div className="text-xs text-gray-300">
            Sending to: <strong className="text-teal-400">{contactName}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:bg-[#2a3942]"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!selectedTemplate || sending}
              className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Dispatching...' : 'Dispatch Template Message'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
