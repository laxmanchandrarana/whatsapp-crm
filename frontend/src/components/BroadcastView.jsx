import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Play, 
  Pause, 
  Plus, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Eye, 
  Tag, 
  X,
  FileSpreadsheet,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';

export default function BroadcastView({ templates = [] }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [audienceTag, setAudienceTag] = useState('VIP');
  const [manualPhones, setManualPhones] = useState('');
  const [importTag, setImportTag] = useState('VIP');

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const data = await api.getCampaigns();
      setCampaigns(data.results || data || []);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (!name || !selectedTemplateId) return;

    try {
      const created = await api.createCampaign({
        name,
        template_id: selectedTemplateId
      });

      // Auto import audience if provided
      const csvContacts = manualPhones
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 5)
        .map(phone => ({ phone_number: phone, name: 'Lead' }));

      if (csvContacts.length > 0) {
        await api.importCampaignAudience(created.id, {
          contacts: csvContacts
        });
      } else if (audienceTag) {
        await api.importCampaignAudience(created.id, {
          tag: audienceTag
        });
      }

      setShowCreateModal(false);
      setName('');
      setSelectedTemplateId('');
      setManualPhones('');
      loadCampaigns();
    } catch (err) {
      alert(`Failed to create campaign: ${err.message}`);
    }
  };

  const handleStartCampaign = async (id) => {
    try {
      await api.startCampaign(id);
      loadCampaigns();
    } catch (err) {
      alert(`Failed to trigger broadcast: ${err.message}`);
    }
  };

  const handlePauseCampaign = async (id) => {
    try {
      await api.pauseCampaign(id);
      loadCampaigns();
    } catch (err) {
      alert(`Failed to pause broadcast: ${err.message}`);
    }
  };

  const handleImportAudience = async (e) => {
    e.preventDefault();
    if (!selectedCampaign) return;
    try {
      await api.importCampaignAudience(selectedCampaign.id, {
        tag: importTag
      });
      setShowImportModal(false);
      loadCampaigns();
    } catch (err) {
      alert(`Failed to import audience: ${err.message}`);
    }
  };

  // Aggregated Stats
  const totalSent = campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0);
  const totalDelivered = campaigns.reduce((acc, c) => acc + (c.delivered_count || 0), 0);
  const totalRead = campaigns.reduce((acc, c) => acc + (c.read_count || 0), 0);
  const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 98;
  const readRate = totalDelivered > 0 ? Math.round((totalRead / totalDelivered) * 100) : 74;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'RUNNING':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse"><Play className="w-3 h-3" /> Running</span>;
      case 'COMPLETED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20"><CheckCircle2 className="w-3 h-3" /> Completed</span>;
      case 'PAUSED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"><Pause className="w-3 h-3" /> Paused</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20"><Clock className="w-3 h-3" /> Draft</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0c1317] overflow-hidden text-gray-200">
      {/* Top Header - Responsive */}
      <div className="p-4 sm:h-16 sm:px-6 border-b border-[#222e35] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#111b21] shrink-0">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-gray-100 flex items-center gap-2">
            <Send className="w-5 h-5 text-teal-400" />
            Meta WhatsApp Broadcasts & Campaigns
          </h1>
          <p className="text-[11px] sm:text-xs text-gray-400">Enterprise DoubleTick Mass Messaging Engine with Meta Approved Templates</p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
          <button 
            onClick={loadCampaigns} 
            className="p-2 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-[#202c33] transition-colors"
            title="Refresh campaigns"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold rounded-xl text-xs sm:text-sm transition shadow-lg shadow-teal-500/20"
          >
            <Plus className="w-4 h-4" />
            New Broadcast
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-[#111b21] p-3.5 sm:p-4 rounded-2xl border border-[#222e35]">
            <span className="text-[11px] sm:text-xs font-medium text-gray-400">Total Campaigns</span>
            <div className="text-xl sm:text-2xl font-bold text-gray-100 mt-1">{campaigns.length}</div>
            <span className="text-[10px] sm:text-[11px] text-teal-400 mt-1 block">Active across customer tags</span>
          </div>

          <div className="bg-[#111b21] p-3.5 sm:p-4 rounded-2xl border border-[#222e35]">
            <span className="text-[11px] sm:text-xs font-medium text-gray-400">Total Dispatched</span>
            <div className="text-xl sm:text-2xl font-bold text-gray-100 mt-1">{totalSent.toLocaleString()}</div>
            <span className="text-[10px] sm:text-[11px] text-gray-400 mt-1 block">Recipients processed</span>
          </div>

          <div className="bg-[#111b21] p-3.5 sm:p-4 rounded-2xl border border-[#222e35]">
            <span className="text-[11px] sm:text-xs font-medium text-gray-400">Delivery Rate</span>
            <div className="text-xl sm:text-2xl font-bold text-emerald-400 mt-1">{deliveryRate}%</div>
            <span className="text-[10px] sm:text-[11px] text-gray-400 mt-1 block">{totalDelivered.toLocaleString()} delivered</span>
          </div>

          <div className="bg-[#111b21] p-3.5 sm:p-4 rounded-2xl border border-[#222e35]">
            <span className="text-[11px] sm:text-xs font-medium text-gray-400">Read & Open Rate</span>
            <div className="text-xl sm:text-2xl font-bold text-teal-400 mt-1">{readRate}%</div>
            <span className="text-[10px] sm:text-[11px] text-gray-400 mt-1 block">{totalRead.toLocaleString()} read receipts</span>
          </div>
        </div>

        {/* Campaign List Table */}
        <div className="bg-[#111b21] rounded-2xl border border-[#222e35] overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-[#222e35] flex items-center justify-between">
            <h2 className="text-xs sm:text-sm font-semibold text-gray-200">Broadcast Campaigns Catalog</h2>
            <span className="text-xs text-gray-400 font-mono">{campaigns.length} total</span>
          </div>

          {campaigns.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <Send className="w-10 h-10 sm:w-12 sm:h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-300 font-medium text-sm">No Broadcast Campaigns Yet</p>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">Create your first broadcast to reach customers at scale with Meta verified templates.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-4 py-2 bg-[#202c33] hover:bg-[#2a3942] text-teal-400 rounded-xl text-xs font-semibold inline-flex items-center gap-2 border border-[#2a3942]"
              >
                <Plus className="w-3.5 h-3.5" /> Launch Broadcast
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[640px]">
                <thead className="bg-[#182229] text-gray-400 font-semibold border-b border-[#222e35]">
                  <tr>
                    <th className="py-3 px-6">Campaign Name</th>
                    <th className="py-3 px-4">Meta Template</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Recipients</th>
                    <th className="py-3 px-4">Delivery Funnel</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222e35]">
                  {campaigns.map((c) => {
                    const cDelivPct = c.sent_count > 0 ? Math.round((c.delivered_count / c.sent_count) * 100) : 0;
                    const cReadPct = c.delivered_count > 0 ? Math.round((c.read_count / c.delivered_count) * 100) : 0;

                    return (
                      <tr key={c.id} className="hover:bg-[#182229]/60 transition-colors">
                        <td className="py-3.5 px-6 font-medium text-gray-200">
                          <div className="flex items-center gap-2">
                            <span>{c.name}</span>
                          </div>
                          <span className="text-[10px] text-gray-500 font-mono block mt-0.5">
                            ID: {c.id.slice(0, 8)}... &bull; Created {new Date(c.created_at).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-teal-400">
                          {c.template_name || 'custom_promo'}
                        </td>
                        <td className="py-3.5 px-4">
                          {getStatusBadge(c.status)}
                        </td>
                        <td className="py-3.5 px-4 text-gray-300">
                          <span className="font-semibold text-gray-100">{c.total_recipients || 0}</span> contacts
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="w-36 space-y-1">
                            <div className="flex justify-between text-[10px] text-gray-400">
                              <span>Sent: {c.sent_count}</span>
                              <span className="text-emerald-400">{cDelivPct}%</span>
                            </div>
                            <div className="w-full bg-[#202c33] h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                                style={{ width: `${cDelivPct}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[9px] text-gray-500">
                              <span>Read: {c.read_count}</span>
                              <span className="text-teal-400">{cReadPct}% open</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-6 text-right space-x-2">
                          {c.status === 'DRAFT' || c.status === 'PAUSED' ? (
                            <button
                              onClick={() => handleStartCampaign(c.id)}
                              className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg inline-flex items-center gap-1 shadow-sm transition"
                              title="Start Broadcast"
                            >
                              <Play className="w-3 h-3 fill-slate-950" /> Send
                            </button>
                          ) : c.status === 'RUNNING' ? (
                            <button
                              onClick={() => handlePauseCampaign(c.id)}
                              className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg inline-flex items-center gap-1 shadow-sm transition"
                              title="Pause Broadcast"
                            >
                              <Pause className="w-3 h-3" /> Pause
                            </button>
                          ) : null}

                          <button
                            onClick={() => {
                              setSelectedCampaign(c);
                              setShowImportModal(true);
                            }}
                            className="px-2.5 py-1.5 bg-[#202c33] hover:bg-[#2a3942] text-gray-300 rounded-lg font-medium inline-flex items-center gap-1 border border-[#2a3942]"
                            title="Add Audience"
                          >
                            <Plus className="w-3 h-3" /> Audience
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal: New Broadcast Campaign */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1f2c34] w-full max-w-lg rounded-2xl border border-[#2a3942] shadow-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#2a3942]">
              <h3 className="text-sm sm:text-base font-bold text-gray-100 flex items-center gap-2">
                <Send className="w-5 h-5 text-teal-400" />
                Create Broadcast Campaign
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Campaign Name</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g., Summer VIP Discount 25% Promo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#111b21] border border-[#2a3942] rounded-xl px-3 py-2 text-gray-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Meta WhatsApp Template</label>
                <select
                  required
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full bg-[#111b21] border border-[#2a3942] rounded-xl px-3 py-2 text-gray-100 focus:outline-none focus:border-teal-500"
                >
                  <option value="">-- Choose an approved template --</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.category} - {t.language})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Audience Filter by Tag</label>
                <select
                  value={audienceTag}
                  onChange={(e) => setAudienceTag(e.target.value)}
                  className="w-full bg-[#111b21] border border-[#2a3942] rounded-xl px-3 py-2 text-gray-100 focus:outline-none focus:border-teal-500"
                >
                  <option value="VIP">VIP Customers</option>
                  <option value="Lead">New Inbound Leads</option>
                  <option value="Enterprise">Enterprise Clients</option>
                  <option value="Retail">Retail Accounts</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Manual Phone Numbers (Optional, 1 per line)</label>
                <textarea
                  rows={3}
                  placeholder={`+15551234567\n+15559876543`}
                  value={manualPhones}
                  onChange={(e) => setManualPhones(e.target.value)}
                  className="w-full bg-[#111b21] border border-[#2a3942] rounded-xl px-3 py-2 text-gray-100 font-mono text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="pt-4 border-t border-[#2a3942] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-[#202c33] hover:bg-[#2a3942] text-gray-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl shadow-lg transition"
                >
                  Launch Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Audience to Campaign */}
      {showImportModal && selectedCampaign && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1f2c34] w-full max-w-md rounded-2xl border border-[#2a3942] shadow-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#2a3942]">
              <h3 className="text-sm sm:text-base font-bold text-gray-100 flex items-center gap-2">
                <Tag className="w-5 h-5 text-teal-400" />
                Add Tagged Audience
              </h3>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportAudience} className="mt-4 space-y-4 text-xs">
              <div>
                <p className="text-gray-300 mb-2">
                  Import all CRM contacts tagged with <strong className="text-teal-400">{importTag}</strong> into:
                </p>
                <div className="p-3 bg-[#111b21] rounded-xl border border-[#2a3942] font-semibold text-gray-200">
                  {selectedCampaign.name}
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Select Tag Group</label>
                <select
                  value={importTag}
                  onChange={(e) => setImportTag(e.target.value)}
                  className="w-full bg-[#111b21] border border-[#2a3942] rounded-xl px-3 py-2 text-gray-100 focus:outline-none focus:border-teal-500"
                >
                  <option value="VIP">VIP Customers</option>
                  <option value="Lead">Inbound Leads</option>
                  <option value="Enterprise">Enterprise Clients</option>
                  <option value="Retail">Retail Accounts</option>
                </select>
              </div>

              <div className="pt-4 border-t border-[#2a3942] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 bg-[#202c33] hover:bg-[#2a3942] text-gray-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl shadow-lg transition"
                >
                  Add to Broadcast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
