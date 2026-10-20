import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Upload, 
  Search, 
  Tag, 
  MessageSquare, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  Layers, 
  Send, 
  Building, 
  Phone, 
  Mail, 
  Plus, 
  FileText, 
  RefreshCw,
  Sparkles,
  Users2
} from 'lucide-react';
import { api } from '../services/api';

export default function ContactsView({ onOpenChat }) {
  const [activeTab, setActiveTab] = useState('contacts'); // 'contacts' | 'groups'
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('ALL');

  // Modals
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [contactForm, setContactForm] = useState({
    name: '',
    phone_number: '',
    email: '',
    tags: '',
    customAttributes: [{ key: '', value: '' }]
  });

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importStatus, setImportStatus] = useState(null);

  // Group Broadcast Modal
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);
  const [groupMessageText, setGroupMessageText] = useState('');
  const [isSendingGroupMsg, setIsSendingGroupMsg] = useState(false);

  // Load Contacts
  const loadContacts = async () => {
    try {
      setLoading(true);
      const data = await api.getContacts(searchQuery, selectedTag);
      setContacts(data.results || data || []);
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load Groups
  const loadGroups = async () => {
    try {
      const data = await api.getGroups();
      setGroups(data.results || data || []);
    } catch (err) {
      console.error('Failed to load groups:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'contacts') {
      loadContacts();
    } else {
      loadGroups();
    }
  }, [activeTab, selectedTag]);

  // Handle Search submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadContacts();
  };

  // Open Edit Modal
  const handleEditContact = (c) => {
    setEditingContact(c);
    const attrs = c.custom_attributes || c.metadata || {};
    const attrPairs = Object.entries(attrs).map(([key, value]) => ({ key, value: String(value) }));
    setContactForm({
      name: c.name || '',
      phone_number: c.phone_number || '',
      email: c.email || '',
      tags: Array.isArray(c.tags) ? c.tags.join(', ') : (c.tags || ''),
      customAttributes: attrPairs.length > 0 ? attrPairs : [{ key: '', value: '' }]
    });
    setIsContactModalOpen(true);
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingContact(null);
    setContactForm({
      name: '',
      phone_number: '',
      email: '',
      tags: '',
      customAttributes: [{ key: 'company', value: '' }, { key: 'tier', value: '' }]
    });
    setIsContactModalOpen(true);
  };

  // Save Contact (Create or Edit)
  const handleSaveContact = async (e) => {
    e.preventDefault();
    if (!contactForm.phone_number.trim()) {
      alert('Phone number is required');
      return;
    }

    const customAttrs = {};
    contactForm.customAttributes.forEach(({ key, value }) => {
      if (key.trim()) {
        customAttrs[key.trim()] = value.trim();
      }
    });

    const parsedTags = contactForm.tags
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    const payload = {
      name: contactForm.name.trim(),
      phone_number: contactForm.phone_number.trim(),
      email: contactForm.email.trim(),
      tags: parsedTags,
      custom_attributes: customAttrs,
      metadata: customAttrs
    };

    try {
      if (editingContact) {
        await api.updateContact(editingContact.id, payload);
      } else {
        await api.createContact(payload);
      }
      setIsContactModalOpen(false);
      loadContacts();
    } catch (err) {
      alert(`Error saving contact: ${err.message}`);
    }
  };

  // Delete Contact
  const handleDeleteContact = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete contact "${name || id}"?`)) return;
    try {
      await api.deleteContact(id);
      loadContacts();
    } catch (err) {
      alert(`Failed to delete contact: ${err.message}`);
    }
  };

  // CSV Importer
  const handleImportCSV = async () => {
    if (!csvText.trim()) return;
    try {
      setLoading(true);
      const res = await api.importContactsCSV(csvText);
      setImportStatus(res);
      loadContacts();
      setTimeout(() => {
        setIsImportModalOpen(false);
        setImportStatus(null);
        setCsvText('');
      }, 2000);
    } catch (err) {
      alert(`CSV Import failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Group Broadcast
  const handleSendGroupMessage = async (e) => {
    e.preventDefault();
    if (!groupMessageText.trim() || !activeGroup) return;
    try {
      setIsSendingGroupMsg(true);
      await api.sendGroupMessage(activeGroup.id, groupMessageText.trim());
      alert(`Message successfully broadcasted to group "${activeGroup.name}"!`);
      setIsGroupModalOpen(false);
      setGroupMessageText('');
    } catch (err) {
      alert(`Broadcast failed: ${err.message}`);
    } finally {
      setIsSendingGroupMsg(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0c1317] overflow-hidden text-gray-200">
      {/* Top Header - Fully Responsive */}
      <div className="p-4 sm:h-16 sm:px-6 border-b border-[#222e35] bg-[#111b21] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-gray-100 flex items-center gap-2">
              DoubleTick Contacts CRM
            </h1>
            <p className="text-[11px] sm:text-xs text-gray-400 line-clamp-1">
              WhatsApp profiles, custom attributes, tags & business groups
            </p>
          </div>
        </div>

        {/* Tab Switcher & Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex bg-[#182229] p-1 rounded-xl border border-[#222e35]">
            <button
              onClick={() => setActiveTab('contacts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'contacts'
                  ? 'bg-teal-500 text-slate-950 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Contacts ({contacts.length})
            </button>
            <button
              onClick={() => setActiveTab('groups')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'groups'
                  ? 'bg-teal-500 text-slate-950 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Groups ({groups.length})
            </button>
          </div>

          {activeTab === 'contacts' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#182229] hover:bg-[#202c33] text-gray-200 text-xs font-semibold rounded-xl border border-[#2a3942] transition"
              >
                <Upload className="w-3.5 h-3.5 text-teal-400" />
                <span className="hidden sm:inline">Import</span> CSV
              </button>
              <button
                onClick={handleOpenAddModal}
                className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl shadow-sm transition"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tab 1: Contacts Directory */}
      {activeTab === 'contacts' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filter Bar */}
          <div className="p-3 sm:px-6 sm:py-3 border-b border-[#222e35] bg-[#111b21]/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
            {/* Search */}
            <form onSubmit={handleSearchSubmit} className="w-full sm:max-w-md relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name, phone (+1...), email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#182229] border border-[#2a3942] rounded-xl pl-9 pr-4 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-teal-500"
              />
            </form>

            {/* Tag Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x pb-0.5">
              <span className="text-[11px] text-gray-400 font-medium mr-1 flex items-center gap-1 shrink-0">
                <Tag className="w-3 h-3 text-teal-400" /> Filter:
              </span>
              {['ALL', 'vip', 'enterprise', 'lead', 'customer', 'trial'].map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedTag(t)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition shrink-0 ${
                    selectedTag === t
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                      : 'bg-[#182229] text-gray-400 hover:text-gray-200 border border-[#222e35]'
                  }`}
                >
                  #{t}
                </button>
              ))}
            </div>
          </div>

          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:flex flex-1 overflow-auto p-6">
            <div className="bg-[#111b21] border border-[#222e35] rounded-2xl overflow-hidden shadow-sm w-full h-fit">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#222e35] bg-[#182229]/60 text-gray-400 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Phone / WhatsApp</th>
                    <th className="py-3 px-4">Tags</th>
                    <th className="py-3 px-4">Custom Attributes</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222e35]">
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="py-12 text-center text-gray-500">
                        <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2 text-teal-400" />
                        Loading contacts directory...
                      </td>
                    </tr>
                  ) : contacts.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-12 text-center text-gray-500">
                        <Users className="w-8 h-8 mx-auto text-gray-600 mb-2" />
                        No contacts found. Click &quot;Add Contact&quot; or &quot;Import CSV&quot; to populate your DoubleTick CRM.
                      </td>
                    </tr>
                  ) : (
                    contacts.map(c => {
                      const attrs = c.custom_attributes || c.metadata || {};
                      const attrKeys = Object.keys(attrs);
                      const tagsList = Array.isArray(c.tags) ? c.tags : (c.tags ? [c.tags] : []);

                      return (
                        <tr key={c.id} className="hover:bg-[#182229]/50 transition group">
                          {/* Contact Info */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-teal-600 to-emerald-400 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                                {c.name ? c.name.charAt(0).toUpperCase() : '#'}
                              </div>
                              <div>
                                <span className="font-semibold text-gray-100 block">
                                  {c.name || 'Unnamed Contact'}
                                </span>
                                {c.email && (
                                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                    <Mail className="w-2.5 h-2.5 text-gray-500" /> {c.email}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Phone */}
                          <td className="py-3 px-4 font-mono text-teal-300">
                            {c.phone_number}
                          </td>

                          {/* Tags */}
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {tagsList.length > 0 ? (
                                tagsList.map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                      tag.toLowerCase().includes('vip')
                                        ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                        : tag.toLowerCase().includes('enterprise')
                                        ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                                        : 'bg-teal-500/10 text-teal-300 border border-teal-500/20'
                                    }`}
                                  >
                                    #{tag}
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-500 text-[10px] italic">No tags</span>
                              )}
                            </div>
                          </td>

                          {/* Custom Attributes */}
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {attrKeys.length > 0 ? (
                                attrKeys.slice(0, 3).map((k) => (
                                  <span key={k} className="text-[10px] bg-[#182229] border border-[#2a3942] text-gray-300 px-2 py-0.5 rounded">
                                    <span className="text-teal-400 font-mono">{k}:</span> {String(attrs[k])}
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-500 text-[10px] italic">&mdash;</span>
                              )}
                              {attrKeys.length > 3 && (
                                <span className="text-[10px] text-gray-500">+{attrKeys.length - 3} more</span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {onOpenChat && (
                                <button
                                  onClick={() => onOpenChat(c)}
                                  className="p-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/30 transition"
                                  title="Open Chat"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleEditContact(c)}
                                className="p-1.5 rounded-lg bg-gray-700/20 hover:bg-gray-700/40 text-gray-300 border border-gray-600/30 transition"
                                title="Edit Contact"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteContact(c.id, c.name)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition"
                                title="Delete Contact"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Touch Card View (< 768px) */}
          <div className="md:hidden flex-1 overflow-y-auto p-3 space-y-3">
            {loading ? (
              <div className="py-12 text-center text-gray-500 text-xs">
                <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2 text-teal-400" />
                Loading contacts directory...
              </div>
            ) : contacts.length === 0 ? (
              <div className="py-12 text-center text-gray-500 text-xs bg-[#111b21] rounded-2xl border border-[#222e35] p-6">
                <Users className="w-8 h-8 mx-auto text-gray-600 mb-2" />
                No contacts found. Tap &quot;Add&quot; or &quot;Import CSV&quot; to populate.
              </div>
            ) : (
              contacts.map(c => {
                const attrs = c.custom_attributes || c.metadata || {};
                const attrKeys = Object.keys(attrs);
                const tagsList = Array.isArray(c.tags) ? c.tags : (c.tags ? [c.tags] : []);

                return (
                  <div key={c.id} className="bg-[#111b21] border border-[#222e35] rounded-2xl p-4 space-y-3 shadow-sm">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-teal-600 to-emerald-400 text-white font-bold flex items-center justify-center text-sm shadow">
                          {c.name ? c.name.charAt(0).toUpperCase() : '#'}
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-gray-100">{c.name || 'Unnamed Contact'}</h3>
                          <div className="flex items-center gap-1 text-[11px] text-teal-300 font-mono">
                            <Phone className="w-3 h-3 text-teal-400" /> {c.phone_number}
                          </div>
                        </div>
                      </div>

                      {/* Quick Chat Jump */}
                      {onOpenChat && (
                        <button
                          onClick={() => onOpenChat(c)}
                          className="p-2 rounded-xl bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20 active:scale-95 transition"
                          title="Open WhatsApp Chat"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {c.email && (
                      <div className="text-[11px] text-gray-400 flex items-center gap-1.5 pl-1">
                        <Mail className="w-3 h-3 text-gray-500" /> {c.email}
                      </div>
                    )}

                    {/* Tags */}
                    {tagsList.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {tagsList.map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-teal-500/10 text-teal-300 border border-teal-500/20"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Custom Attributes */}
                    {attrKeys.length > 0 && (
                      <div className="pt-2 border-t border-[#222e35] flex flex-wrap gap-1.5">
                        {attrKeys.map((k) => (
                          <span key={k} className="text-[10px] bg-[#182229] border border-[#2a3942] text-gray-300 px-2 py-0.5 rounded font-mono">
                            <strong className="text-teal-400">{k}:</strong> {String(attrs[k])}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div className="pt-2 border-t border-[#222e35] flex items-center justify-end gap-2 text-xs">
                      <button
                        onClick={() => handleEditContact(c)}
                        className="px-3 py-1.5 rounded-lg bg-[#182229] hover:bg-[#202c33] text-gray-300 border border-[#2a3942] flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteContact(c.id, c.name)}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 2: WhatsApp Business Groups */}
      {activeTab === 'groups' && (
        <div className="flex-1 flex flex-col overflow-auto p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                <Users2 className="w-4 h-4 text-teal-400" /> Connected WhatsApp Business Groups
              </h3>
              <p className="text-xs text-gray-400">
                Direct group announcements and broadcast messages to client clusters
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.length === 0 ? (
              <div className="col-span-full py-12 text-center text-gray-500 bg-[#111b21] rounded-2xl border border-[#222e35] p-6">
                <Users2 className="w-8 h-8 mx-auto text-gray-600 mb-2" />
                No WhatsApp Business Groups synced yet.
              </div>
            ) : (
              groups.map(g => (
                <div key={g.id} className="bg-[#111b21] border border-[#222e35] rounded-2xl p-5 flex flex-col justify-between hover:border-teal-500/40 transition shadow-sm">
                  <div>
                    <div className="flex items-start justify-between">
                      <h4 className="font-bold text-sm text-gray-100">{g.name}</h4>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
                        Active
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 block mt-1">
                      {g.group_id}
                    </span>
                    <p className="text-xs text-gray-300 mt-2 line-clamp-2">
                      {g.description || 'WhatsApp Business group channel.'}
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-[#222e35] flex items-center justify-between">
                    <span className="text-xs text-teal-400 font-semibold flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> {g.participants_count} Members
                    </span>
                    <button
                      onClick={() => {
                        setActiveGroup(g);
                        setIsGroupModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
                    >
                      <Send className="w-3 h-3" /> Broadcast
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Contact Modal */}
      {isContactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#111b21] border border-[#222e35] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-[#222e35] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-gray-100">
                  {editingContact ? 'Edit Contact Profile' : 'Add DoubleTick Contact'}
                </h3>
              </div>
              <button onClick={() => setIsContactModalOpen(false)} className="text-gray-400 hover:text-gray-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="p-5 overflow-y-auto space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className="w-full bg-[#182229] border border-[#2a3942] rounded-xl px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider block mb-1">
                    Phone (with country code) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+14155550199"
                    value={contactForm.phone_number}
                    onChange={(e) => setContactForm({ ...contactForm, phone_number: e.target.value })}
                    className="w-full bg-[#182229] border border-[#2a3942] rounded-xl px-3 py-2 text-xs font-mono text-gray-100 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider block mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="john@company.com"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full bg-[#182229] border border-[#2a3942] rounded-xl px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider block mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="vip, enterprise, lead"
                  value={contactForm.tags}
                  onChange={(e) => setContactForm({ ...contactForm, tags: e.target.value })}
                  className="w-full bg-[#182229] border border-[#2a3942] rounded-xl px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Custom Attributes Key-Value Builder */}
              <div className="pt-2 border-t border-[#222e35]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider">
                    Custom CRM Attributes
                  </span>
                  <button
                    type="button"
                    onClick={() => setContactForm({
                      ...contactForm,
                      customAttributes: [...contactForm.customAttributes, { key: '', value: '' }]
                    })}
                    className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-3 h-3" /> Add Attribute
                  </button>
                </div>

                <div className="space-y-2">
                  {contactForm.customAttributes.map((attr, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Key (e.g. company)"
                        value={attr.key}
                        onChange={(e) => {
                          const updated = [...contactForm.customAttributes];
                          updated[idx].key = e.target.value;
                          setContactForm({ ...contactForm, customAttributes: updated });
                        }}
                        className="w-1/2 bg-[#182229] border border-[#2a3942] rounded-xl px-3 py-1.5 text-xs text-teal-300 font-mono focus:outline-none focus:border-teal-500"
                      />
                      <input
                        type="text"
                        placeholder="Value (e.g. Acme Corp)"
                        value={attr.value}
                        onChange={(e) => {
                          const updated = [...contactForm.customAttributes];
                          updated[idx].value = e.target.value;
                          setContactForm({ ...contactForm, customAttributes: updated });
                        }}
                        className="w-1/2 bg-[#182229] border border-[#2a3942] rounded-xl px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-teal-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = contactForm.customAttributes.filter((_, i) => i !== idx);
                          setContactForm({ ...contactForm, customAttributes: updated });
                        }}
                        className="p-1.5 text-gray-500 hover:text-rose-400 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(false)}
                  className="px-4 py-2 bg-[#182229] hover:bg-[#202c33] text-gray-300 text-xs font-semibold rounded-xl border border-[#2a3942] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-xl shadow-sm transition"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Audience Importer Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#111b21] border border-[#222e35] w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-[#222e35] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-gray-100">DoubleTick Bulk Audience Importer</h3>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-gray-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-[#182229] p-3 rounded-xl border border-[#2a3942] text-xs text-gray-300">
                <p className="font-semibold text-teal-300 mb-1">CSV Format Guidelines:</p>
                <p className="text-[11px] text-gray-400">
                  First row must be column headers. Example headers: <br/>
                  <code className="text-teal-400 font-mono">name,phone,email,tags,company,tier,city</code>
                </p>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider block mb-1">
                  Paste Raw CSV Data:
                </label>
                <textarea
                  rows="6"
                  placeholder={`name,phone,email,tags,company\nAlice Smith,+15551234567,alice@company.com,vip,Acme Corp\nBob Jones,+15559876543,bob@co.com,lead,Beta Inc`}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="w-full bg-[#182229] border border-[#2a3942] rounded-xl p-3 text-xs font-mono text-gray-200 focus:outline-none focus:border-teal-500 leading-relaxed"
                />
              </div>

              {importStatus && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Successfully imported! Created: {importStatus.created_count}, Updated: {importStatus.updated_count}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 bg-[#182229] hover:bg-[#202c33] text-gray-300 text-xs font-semibold rounded-xl border border-[#2a3942] transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={loading || !csvText.trim()}
                  onClick={handleImportCSV}
                  className="px-5 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-xl shadow-sm transition"
                >
                  {loading ? 'Processing...' : 'Upload & Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Group Broadcast Modal */}
      {isGroupModalOpen && activeGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#111b21] border border-[#222e35] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-[#222e35] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users2 className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-gray-100">Broadcast to &quot;{activeGroup.name}&quot;</h3>
              </div>
              <button onClick={() => setIsGroupModalOpen(false)} className="text-gray-400 hover:text-gray-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendGroupMessage} className="p-5 space-y-4">
              <div className="text-xs text-gray-400">
                Dispatch message to all <strong className="text-teal-400 font-semibold">{activeGroup.participants_count} members</strong> of this WhatsApp Business Group.
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider block mb-1">
                  Message Content:
                </label>
                <textarea
                  rows="4"
                  required
                  placeholder="Type broadcast message for this group..."
                  value={groupMessageText}
                  onChange={(e) => setGroupMessageText(e.target.value)}
                  className="w-full bg-[#182229] border border-[#2a3942] rounded-xl p-3 text-xs text-gray-100 focus:outline-none focus:border-teal-500 leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="px-4 py-2 bg-[#182229] hover:bg-[#202c33] text-gray-300 text-xs font-semibold rounded-xl border border-[#2a3942] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingGroupMsg || !groupMessageText.trim()}
                  className="px-5 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSendingGroupMsg ? 'Sending...' : 'Send Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
