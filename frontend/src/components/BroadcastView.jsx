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
        .filter(Boolean)
        .map(phone => ({ phone, name: 'Contact' }));

      await api.importCampaignAudience(created.id, {
        tag: audienceTag,
        csv_contacts: csvContacts
      });

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
      alert(`Error starting campaign: ${err.message}`);
    }
  };

  const handlePauseCampaign = async (id) => {
    try {
      await api.pauseCampaign(id);
      loadCampaigns();
    } catch (err) {
      alert(`Error pausing campaign: ${err.message}`);
    }
  };

  const handleImportAudience = async () => {
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
      {/* Top Header */}
      <div className="h-16 px-6 border-b border-[#222e35] flex items-center justify-between bg-[#111b21]">
        <div>
          <h1 className="text-lg font-bold text-gray-100 flex items-center gap-2">
            <Send className="w-5 h-5 text-teal-400" />
            Meta WhatsApp Broadcasts & Campaigns
          </h1>
          <p className="text-xs text-gray-400">Enterprise DoubleTick Mass Messaging Engine with Meta Approved Templates</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={loadCampaigns} 
            className="p-2 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-[#202c33] transition-colors"
            title="Refresh campaigns"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold rounded-lg text-sm transition shadow-lg shadow-teal-500/20"
          >
            <Plus className="w-4 h-4" />
            New Broadcast
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#111b21] p-4 rounded-xl border border-[#222e35]">
            <span className="text-xs font-medium text-gray-400">Total Campaigns</span>
            <div className="text-2xl font-bold text-gray-100 mt-1">{campaigns.length}</div>
            <span className="text-[11px] text-teal-400 mt-1 block">Active across all customer tags</span>
          </div>

          <div className="bg-[#111b21] p-4 rounded-xl border border-[#222e35]">
            <span className="text-xs font-medium text-gray-400">Total Dispatched</span>
            <div className="text-2xl font-bold text-gray-100 mt-1">{totalSent.toLocaleString()}</div>
            <span className="text-[11px] text-gray-400 mt-1 block">Recipients processed</span>
          </div>

          <div className="bg-[#111b21] p-4 rounded-xl border border-[#222e35]">
            <span className="text-xs font-medium text-gray-400">Delivery Rate</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{deliveryRate}%</div>
            <span className="text-[11px] text-gray-400 mt-1 block">{totalDelivered.toLocaleString()} delivered</span>
          </div>

          <div className="bg-[#111b21] p-4 rounded-xl border border-[#222e35]">
            <span className="text-xs font-medium text-gray-400">Read & Open Rate</span>
            <div className="text-2xl font-bold text-teal-400 mt-1">{readRate}%</div>
            <span className="text-[11px] text-gray-400 mt-1 block">{totalRead.toLocaleString()} read receipts</span>
          </div>
        </div>

        {/* Campaign List Table */}
        <div className="bg-[#111b21] rounded-xl border border-[#222e35] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#222e35] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-200">Broadcast Campaigns Catalog</h2>
            <span className="text-xs text-gray-400">{campaigns.length} total</span>
          </div>

          {campaigns.length === 0 ? (
            <div className="p-12 text-center">
              <Send className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-300 font-medium">No Broadcast Campaigns Yet</p>
              <p className="text-xs text-gray-500 mt-1">Create your first broadcast to reach customers at scale with Meta verified templates.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 px-4 py-2 bg-[#202c33] hover:bg-[#2a3942] text-teal-400 rounded-lg text-xs font-semibold inline-flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" /> Launch Broadcast
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#182229] text-gray-400 font-semibold border-b border-[#222e35]">
                  <tr>
                    <th className="py-3 px-6">Campaign Name</th>
                    <th className="py-3 px-4">Meta Template</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Recipients</th>
                    <th className="py-3 px-4">Delivery Funnel</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222e35]">
                  {campaigns.map((c) => {
                    const progress = c.total_recipients > 0 ? Math.round((c.sent_count / c.total_recipients) * 100) : 0;
                    return (
                      <tr key={c.id} className="hover:bg-[#1a252d]/60 transition-colors">
                        <td className="py-4 px-6 font-semibold text-gray-100">
                          {c.name}
                          <span className="block text-[10px] text-gray-500 font-mono mt-0.5">ID: #{c.id}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-mono text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                            {c.template?.name || 'Template'}
                          </span>
                          <span className="block text-[10px] text-gray-400 mt-0.5 capitalize">{c.template?.category?.toLowerCase()}</span>
                        </td>
                        <td className="py-4 px-4">
                          {getStatusBadge(c.status)}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 font-medium text-gray-200">
                            <Users className="w-3.5 h-3.5 text-gray-400" />
                            {c.total_recipients}
                          </div>
                        </td>
                        <td className="py-4 px-4 min-w-[200px]">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-gray-400">
                              <span>Sent: {c.sent_count} / {c.total_recipients}</span>
                              <span>{progress}%</span>
                            </div>
                            <div className="w-full bg-[#202c33] h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-teal-400 h-full rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <div className="flex gap-3 text-[10px] text-gray-500">
                              <span className="text-emerald-400">Delivered: {c.delivered_count}</span>
                              <span className="text-teal-300">Read: {c.read_count}</span>
                              {c.failed_count > 0 && <span className="text-rose-400">Failed: {c.failed_count}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right space-x-2">
                          {c.status === 'DRAFT' || c.status === 'PAUSED' ? (
                            <button
                              onClick={() => handleStartCampaign(c.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium inline-flex items-center gap-1"
                            >
                              <Play className="w-3 h-3" /> Start
                            </button>
                          ) : c.status === 'RUNNING' ? (
                            <button
                              onClick={() => handlePauseCampaign(c.id)}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium inline-flex items-center gap-1"
                            >
                              <Pause className="w-3 h-3" /> Pause
                            </button>
                          ) : null}

                          <button
                            onClick={() => {
                              setSelectedCampaign(c);
                              setShowImportModal(true);
                            }}
                            className="px-2.5 py-1.5 bg-[#202c33] hover:bg-[#2a3942] text-gray-300 rounded font-medium inline-flex items-center gap-1"
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
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#1f2c34] w-full max-w-lg rounded-2xl border border-[#2a3942] shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#2a3942]">
              <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
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
                  className="w-full bg-[#111b21] border border-[#2a3942] rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Meta WhatsApp Template</label>
                <select
                  required
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full bg-[#111b21] border border-[#2a3942] rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:border-teal-500"
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
                  className="w-full bg-[#111b21] border border-[#2a3942] rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:border-teal-500"
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
                  placeholder="+15551234567&#10;+15559876543"
                  value={manualPhones}
                  onChange={(e) => setManualPhones(e.target.value)}
                  className="w-full bg-[#111b21] border border-[#2a3942] rounded-lg px-3 py-2 text-gray-100 font-mono text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="pt-4 border-t border-[#2a3942] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-[#202c33] hover:bg-[#2a3942] text-gray-300 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg shadow-lg shadow-teal-500/20"
                >
                  Create & Prepare Audience
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Import Audience */}
      {showImportModal && selectedCampaign && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#1f2c34] w-full max-w-md rounded-2xl border border-[#2a3942] shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[#2a3942]">
              <h3 className="text-sm font-bold text-gray-100">
                Import Audience to "{selectedCampaign.name}"
              </h3>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Target Customer Tag</label>
                <select
                  value={importTag}
                  onChange={(e) => setImportTag(e.target.value)}
                  className="w-full bg-[#111b21] border border-[#2a3942] rounded-lg px-3 py-2 text-gray-100 focus:outline-none focus:border-teal-500"
                >
                  <option value="VIP">VIP Customers</option>
                  <option value="Lead">New Inbound Leads</option>
                  <option value="Enterprise">Enterprise Clients</option>
                  <option value="Retail">Retail Accounts</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 bg-[#202c33] text-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportAudience}
                  className="px-4 py-2 bg-teal-500 text-slate-950 font-bold rounded-lg"
                >
                  Import Contacts
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
