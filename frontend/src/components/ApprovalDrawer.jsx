import React, { useState } from 'react';
import { 
  X, 
  ShieldAlert, 
  Sparkles, 
  Check, 
  XCircle, 
  Edit3, 
  UserCheck, 
  AlertTriangle,
  History,
  Send
} from 'lucide-react';

export default function ApprovalDrawer({ 
  isOpen, 
  onClose, 
  approvals, 
  onApprove, 
  onReject,
  activeConversationId,
  onSelectConversation
}) {
  const [editingId, setEditingId] = useState(null);
  const [editedTextMap, setEditedTextMap] = useState({});
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [tab, setTab] = useState('pending'); // 'pending' | 'history'

  if (!isOpen) return null;

  const handleEditText = (id, text) => {
    setEditingId(id);
    setEditedTextMap(prev => ({ ...prev, [id]: text }));
  };

  const handleConfirmApprove = async (approval) => {
    setProcessingId(approval.id);
    try {
      const finalText = editedTextMap[approval.id] !== undefined 
        ? editedTextMap[approval.id] 
        : approval.suggested_response;
      await onApprove(approval.id, finalText);
      setEditingId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async (approvalId) => {
    if (!rejectReason.trim()) return;
    setProcessingId(approvalId);
    try {
      await onReject(approvalId, rejectReason);
      setRejectingId(null);
      setRejectReason('');
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const getRiskColor = (score) => {
    if (score >= 0.85) return 'text-rose-400 bg-rose-950/70 border-rose-800';
    if (score >= 0.6) return 'text-amber-400 bg-amber-950/70 border-amber-800';
    return 'text-emerald-400 bg-emerald-950/70 border-emerald-800';
  };

  const pendingApprovals = approvals.filter(a => !a.is_resolved);
  const resolvedApprovals = approvals.filter(a => a.is_resolved);

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-[#111b21] border-l border-[#222e35] shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 bg-[#202c33] border-b border-[#222e35] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
              AI Approval Queue
              {pendingApprovals.length > 0 && (
                <span className="text-xs bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full">
                  {pendingApprovals.length} pending
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-400">Human-in-the-Loop Bot Guardrails</p>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-[#2a3942]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#222e35] bg-[#182229] px-4">
        <button
          onClick={() => setTab('pending')}
          className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            tab === 'pending'
              ? 'border-amber-400 text-amber-300'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Pending Approvals ({pendingApprovals.length})
        </button>
        <button
          onClick={() => setTab('history')}
          className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            tab === 'history'
              ? 'border-teal-400 text-teal-300'
              : 'border-transparent text-gray-400 hover:text-gray-300'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Audit History ({resolvedApprovals.length})
        </button>
      </div>

      {/* Body List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'pending' ? (
          pendingApprovals.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Check className="w-12 h-12 text-teal-400 mx-auto mb-3 opacity-60" />
              <p className="font-medium text-sm">All clear! No pending approvals.</p>
              <p className="text-xs text-gray-500 mt-1">High-risk inbound customer messages will automatically appear here for agent verification.</p>
            </div>
          ) : (
            pendingApprovals.map((item) => {
              const isProcessing = processingId === item.id;
              const isRejecting = rejectingId === item.id;
              const textValue = editedTextMap[item.id] !== undefined ? editedTextMap[item.id] : item.suggested_response;

              return (
                <div 
                  key={item.id}
                  className="bg-[#202c33] border border-[#2a3942] rounded-xl p-4 shadow-lg space-y-3 relative group"
                >
                  {/* Item Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-100 text-sm">
                          {item.contact_name || item.contact_phone}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">
                          {item.contact_phone}
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-400 font-mono mt-0.5 inline-block">
                        Intent: <strong className="text-gray-200">{item.intent}</strong>
                      </span>
                    </div>

                    {/* Risk Badge */}
                    <div className={`px-2 py-1 rounded-md border text-xs font-mono font-bold flex items-center gap-1 ${getRiskColor(item.risk_score)}`}>
                      <AlertTriangle className="w-3 h-3" />
                      {(item.risk_score * 100).toFixed(0)}% Risk
                    </div>
                  </div>

                  {/* AI Suggested Response Box */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-gray-300">
                      <span className="flex items-center gap-1 font-medium text-amber-300">
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Draft Preview:
                      </span>
                      <button
                        onClick={() => handleEditText(item.id, textValue)}
                        className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-0.5"
                      >
                        <Edit3 className="w-3 h-3" />
                        Edit before sending
                      </button>
                    </div>

                    <textarea
                      value={textValue}
                      onChange={(e) => handleEditText(item.id, e.target.value)}
                      rows={4}
                      className="w-full bg-[#111b21] text-xs text-gray-100 p-2.5 rounded-lg border border-[#2a3942] focus:outline-none focus:ring-1 focus:ring-amber-500 leading-relaxed font-sans resize-none"
                    />
                  </div>

                  {/* Rejection Input (if open) */}
                  {isRejecting && (
                    <div className="bg-[#1a1215] border border-rose-900/60 p-2.5 rounded-lg space-y-2 animate-in fade-in duration-150">
                      <span className="text-xs font-semibold text-rose-300">Reason for rejection:</span>
                      <input
                        type="text"
                        placeholder="e.g. Inaccurate refund terms or needs phone call"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="w-full bg-[#111b21] text-xs text-gray-100 p-2 rounded border border-rose-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setRejectingId(null)}
                          className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleConfirmReject(item.id)}
                          disabled={!rejectReason.trim() || isProcessing}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded"
                        >
                          Confirm Rejection
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {!isRejecting && (
                    <div className="flex items-center justify-between pt-1 gap-2 border-t border-[#2a3942]/60">
                      <button
                        onClick={() => setRejectingId(item.id)}
                        disabled={isProcessing}
                        className="px-3 py-1.5 bg-[#2a3942] hover:bg-rose-950/50 hover:text-rose-300 text-gray-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        Reject Draft
                      </button>

                      <button
                        onClick={() => handleConfirmApprove(item)}
                        disabled={isProcessing}
                        className="flex-1 py-1.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.98]"
                      >
                        <Send className="w-3.5 h-3.5 fill-slate-950" />
                        1-Click Approve & Send
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : (
          resolvedApprovals.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-sm">No historical approvals yet.</p>
            </div>
          ) : (
            resolvedApprovals.map((item) => (
              <div 
                key={item.id}
                className="bg-[#182229] border border-[#222e35] rounded-xl p-3.5 text-xs space-y-2 opacity-80 hover:opacity-100 transition-opacity"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-200">
                    {item.contact_name || item.contact_phone}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    item.approved_by 
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' 
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}>
                    {item.approved_by ? `Approved by ${item.approved_by}` : 'Rejected'}
                  </span>
                </div>
                <p className="text-gray-300 line-clamp-2 bg-[#111b21] p-2 rounded border border-[#222e35]">
                  {item.suggested_response}
                </p>
                {item.rejection_reason && (
                  <p className="text-rose-400 text-[11px]">
                    Reason: {item.rejection_reason}
                  </p>
                )}
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
