import React, { useState } from 'react';
import { 
  FileText, 
  X, 
  Send, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  RefreshCw,
  Plus,
  Eye,
  Smartphone
} from 'lucide-react';
import { api } from '../services/api';

export default function TemplateModal({ 
  isOpen, 
  onClose, 
  templates = [], 
  onSendTemplate,
  activeConversation,
  onRefreshTemplates
}) {
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'create'
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // New Template Form State
  const [newTplName, setNewTplName] = useState('');
  const [newTplCategory, setNewTplCategory] = useState('MARKETING');
  const [newTplHeader, setNewTplHeader] = useState('');
  const [newTplBody, setNewTplBody] = useState('Hi {{1}}, thank you for contacting us!');
  const [newTplFooter, setNewTplFooter] = useState('Reply STOP to unsubscribe');

  if (!isOpen) return null;

  const handleSyncMeta = async () => {
    try {
      setSyncing(true);
      const res = await api.syncTemplatesWithMeta();
      alert(`Successfully synced ${res.count} templates from Meta WhatsApp Business Account.`);
      if (onRefreshTemplates) onRefreshTemplates();
    } catch (err) {
      alert(`Meta template sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!newTplName || !newTplBody) return;

    try {
      const components = [];
      if (newTplHeader) {
        components.push({ type: 'HEADER', format: 'TEXT', text: newTplHeader });
      }
      components.push({ type: 'BODY', text: newTplBody });
      if (newTplFooter) {
        components.push({ type: 'FOOTER', text: newTplFooter });
      }

      await api.createTemplate({
        name: newTplName.toLowerCase().replace(/\s+/g, '_'),
        category: newTplCategory,
        language: 'en_US',
        components
      });

      alert(`Template submitted to Meta Graph API for approval!`);
      setActiveTab('catalog');
      if (onRefreshTemplates) onRefreshTemplates();
    } catch (err) {
      alert(`Failed to submit template: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#1f2c34] w-full max-w-4xl h-[85vh] rounded-2xl border border-[#2a3942] shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="p-4 border-b border-[#2a3942] flex items-center justify-between bg-[#111b21]">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-teal-400" />
            <div>
              <h3 className="font-bold text-sm text-gray-100">Meta WhatsApp Template Manager</h3>
              <p className="text-[11px] text-gray-400">Bi-directional Meta Graph API catalog & creation studio</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncMeta}
              disabled={syncing}
              className="px-3 py-1.5 bg-[#202c33] hover:bg-[#2a3942] text-teal-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-[#2a3942]"
              title="Sync with Meta Graph API"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              Sync Meta
            </button>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-200">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#2a3942] bg-[#182229] px-4">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'catalog'
                ? 'border-teal-400 text-teal-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            Approved Template Catalog ({templates.length})
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'create'
                ? 'border-teal-400 text-teal-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            + Create New Template
          </button>
        </div>

        {/* Catalog Tab */}
        {activeTab === 'catalog' ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Template List */}
            <div className="w-1/2 border-r border-[#2a3942] overflow-y-auto p-4 space-y-3">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition ${
                    selectedTemplate?.id === tpl.id
                      ? 'bg-[#202c33] border-teal-500/50 shadow-md'
                      : 'bg-[#111b21] border-[#2a3942] hover:bg-[#182229]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs font-bold text-gray-100">{tpl.name}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" /> {tpl.meta_status || 'APPROVED'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1">
                    <span className="bg-[#182229] px-2 py-0.5 rounded uppercase font-mono">{tpl.category}</span>
                    <span>Language: {tpl.language}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Template WhatsApp Smartphone Preview */}
            <div className="w-1/2 bg-[#0c1317] p-6 flex flex-col items-center justify-center">
              {selectedTemplate ? (
                <div className="w-full max-w-sm flex flex-col">
                  <div className="text-center mb-3">
                    <span className="text-xs font-semibold text-gray-400 flex items-center justify-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-teal-400" /> WhatsApp Live Preview
                    </span>
                  </div>

                  {/* WhatsApp Message Bubble Mockup */}
                  <div className="bg-[#202c33] rounded-2xl rounded-tl-none p-4 shadow-xl border border-[#2a3942] text-xs text-gray-200 space-y-2">
                    {/* Header */}
                    {selectedTemplate.components?.find(c => c.type === 'HEADER') && (
                      <div className="font-bold text-gray-100 text-sm pb-1 border-b border-[#2a3942]/60">
                        {selectedTemplate.components.find(c => c.type === 'HEADER').text}
                      </div>
                    )}

                    {/* Body */}
                    <div className="leading-relaxed whitespace-pre-line text-gray-200">
                      {selectedTemplate.components?.find(c => c.type === 'BODY')?.text?.replace('{{1}}', activeConversation?.contact?.name || 'Customer') || 'Template body content'}
                    </div>

                    {/* Footer */}
                    {selectedTemplate.components?.find(c => c.type === 'FOOTER') && (
                      <div className="text-[10px] text-gray-400 pt-1">
                        {selectedTemplate.components.find(c => c.type === 'FOOTER').text}
                      </div>
                    )}

                    {/* Meta Timestamp */}
                    <div className="text-right text-[10px] text-gray-400">
                      12:00 PM &bull; Meta Approved
                    </div>
                  </div>

                  {/* Send to Active Conversation Button */}
                  {activeConversation && onSendTemplate && (
                    <button
                      onClick={() => {
                        onSendTemplate(selectedTemplate);
                        onClose();
                      }}
                      className="mt-6 w-full py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20"
                    >
                      <Send className="w-4 h-4" /> Send to {activeConversation.contact.name || activeConversation.contact.phone_number}
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-500 text-xs">
                  Select a template on the left to preview its WhatsApp message layout.
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Create New Template Studio */
          <div className="flex-1 flex overflow-hidden p-6 gap-6">
            <form onSubmit={handleCreateTemplate} className="w-1/2 space-y-4 text-xs overflow-y-auto pr-2">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Template Name (lower_snake_case)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., payment_reminder_v1"
                  value={newTplName}
                  onChange={(e) => setNewTplName(e.target.value)}
                  className="w-full bg-[#111b21] border border-[#2a3942] rounded-lg px-3 py-2 text-gray-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Category</label>
                <select
                  value={newTplCategory}
                  onChange={(e) => setNewTplCategory(e.target.value)}
                  className="w-full bg-[#111b21] border border-[#2a3942] rounded-lg px-3 py-2 text-gray-100"
                >
                  <option value="MARKETING">Marketing (Promotions, Offers)</option>
                  <option value="UTILITY">Utility (Reminders, Confirmations)</option>
                  <option value="AUTHENTICATION">Authentication (OTPs, Security)</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Header Text (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Special Deal For You!"
                  value={newTplHeader}
                  onChange={(e) => setNewTplHeader(e.target.value)}
                  className="w-full bg-[#111b21] border border-[#2a3942] rounded-lg px-3 py-2 text-gray-100"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Body Text (Supports variables like &#123;&#123;1&#125;&#125;)</label>
                <textarea
                  rows={4}
                  required
                  value={newTplBody}
                  onChange={(e) => setNewTplBody(e.target.value)}
                  className="w-full bg-[#111b21] border border-[#2a3942] rounded-lg px-3 py-2 text-gray-100 leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Footer Text (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Reply STOP to opt out"
                  value={newTplFooter}
                  onChange={(e) => setNewTplFooter(e.target.value)}
                  className="w-full bg-[#111b21] border border-[#2a3942] rounded-lg px-3 py-2 text-gray-100"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20"
              >
                <Plus className="w-4 h-4" /> Submit to Meta Graph API
              </button>
            </form>

            {/* Real-time preview */}
            <div className="w-1/2 bg-[#0c1317] rounded-2xl p-6 flex flex-col items-center justify-center border border-[#222e35]">
              <span className="text-xs text-gray-400 mb-4 font-semibold flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-teal-400" /> Interactive Simulation Preview
              </span>

              <div className="w-full max-w-sm bg-[#202c33] rounded-2xl rounded-tl-none p-4 shadow-xl border border-[#2a3942] text-xs space-y-2">
                {newTplHeader && (
                  <div className="font-bold text-gray-100 text-sm pb-1 border-b border-[#2a3942]/60">
                    {newTplHeader}
                  </div>
                )}
                <div className="text-gray-200 leading-relaxed whitespace-pre-line">
                  {newTplBody.replace('{{1}}', 'Sarah Connor')}
                </div>
                {newTplFooter && (
                  <div className="text-[10px] text-gray-400 pt-1">
                    {newTplFooter}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
