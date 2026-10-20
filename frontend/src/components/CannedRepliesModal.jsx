import React, { useState, useEffect } from 'react';
import { Bookmark, Search, X, Plus, Sparkles, Check } from 'lucide-react';
import { api } from '../services/api';

export default function CannedRepliesModal({ isOpen, onClose, onSelectReply }) {
  const [replies, setReplies] = useState([]);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [shortcut, setShortcut] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const loadReplies = async () => {
    try {
      const data = await api.getCannedResponses();
      setReplies(data.results || data || []);
    } catch (err) {
      console.error('Error fetching canned replies:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadReplies();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = replies.filter(r => 
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.shortcut.toLowerCase().includes(search.toLowerCase()) ||
    r.content.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!shortcut || !title || !content) return;
    try {
      await api.createCannedResponse({
        shortcut: shortcut.startsWith('/') ? shortcut : `/${shortcut}`,
        title,
        content,
        category: 'SUPPORT'
      });
      setShowAddForm(false);
      setShortcut('');
      setTitle('');
      setContent('');
      loadReplies();
    } catch (err) {
      alert(`Error creating canned response: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-[#1f2c34] w-full max-w-lg rounded-2xl border border-[#2a3942] shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[#2a3942] flex items-center justify-between bg-[#111b21]">
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-teal-400" />
            <h3 className="font-bold text-sm text-gray-100">Team Canned Responses & Quick Replies</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Actions */}
        <div className="p-3 border-b border-[#2a3942] flex items-center gap-2 bg-[#182229]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by shortcut (e.g. /greeting, /pricing)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#111b21] border border-[#2a3942] rounded-lg pl-9 pr-3 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-teal-500"
            />
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 bg-[#202c33] hover:bg-[#2a3942] text-teal-400 rounded-lg text-xs font-semibold flex items-center gap-1 border border-[#2a3942]"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>

        {/* New Canned Form */}
        {showAddForm && (
          <form onSubmit={handleCreate} className="p-4 bg-[#111b21] border-b border-[#2a3942] space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Shortcut (e.g. /refund)"
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value)}
                required
                className="bg-[#182229] border border-[#2a3942] rounded px-2.5 py-1.5 text-gray-100"
              />
              <input
                type="text"
                placeholder="Title (e.g. Refund Policy)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="bg-[#182229] border border-[#2a3942] rounded px-2.5 py-1.5 text-gray-100"
              />
            </div>
            <textarea
              rows={2}
              placeholder="Response content to insert into chat..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              className="w-full bg-[#182229] border border-[#2a3942] rounded px-2.5 py-1.5 text-gray-100"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1 bg-[#202c33] text-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-teal-500 text-slate-950 font-bold rounded"
              >
                Save Shortcut
              </button>
            </div>
          </form>
        )}

        {/* Responses List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center text-gray-500 text-xs py-8">
              No canned replies found matching your search.
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  onSelectReply(item.content);
                  onClose();
                }}
                className="p-3 bg-[#111b21] hover:bg-[#202c33] rounded-xl border border-[#2a3942] cursor-pointer transition group"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-teal-500/10 text-teal-400 font-mono text-[10px] font-bold rounded border border-teal-500/20">
                      {item.shortcut}
                    </span>
                    <span className="font-semibold text-xs text-gray-200">{item.title}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 group-hover:text-teal-400 transition flex items-center gap-1">
                    Insert <Check className="w-3 h-3" />
                  </span>
                </div>
                <p className="text-xs text-gray-400 line-clamp-2">{item.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
