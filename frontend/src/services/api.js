const API_BASE = '/api';

export const api = {
  // Stats
  getStats: async () => {
    const res = await fetch(`${API_BASE}/stats/`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  // Conversations
  getConversations: async (status = 'ALL', search = '') => {
    const params = new URLSearchParams();
    if (status && status !== 'ALL') params.append('status', status);
    if (search) params.append('search', search);
    const res = await fetch(`${API_BASE}/conversations/?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch conversations');
    return res.json();
  },

  getConversation: async (id) => {
    const res = await fetch(`${API_BASE}/conversations/${id}/`);
    if (!res.ok) throw new Error('Failed to fetch conversation details');
    return res.json();
  },

  markConversationRead: async (id) => {
    const res = await fetch(`${API_BASE}/conversations/${id}/mark-read/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error('Failed to mark conversation read');
    return res.json();
  },

  // Messages
  getMessages: async (conversationId) => {
    const res = await fetch(`${API_BASE}/messages/?conversation_id=${conversationId}`);
    if (!res.ok) throw new Error('Failed to fetch messages');
    return res.json();
  },

  sendMessage: async (payload) => {
    const res = await fetch(`${API_BASE}/messages/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
  },

  // Approval Queue
  getApprovals: async (resolved = false) => {
    const res = await fetch(`${API_BASE}/approvals/?resolved=${resolved}`);
    if (!res.ok) throw new Error('Failed to fetch approvals');
    return res.json();
  },

  approveMessage: async (approvalId, editedText = null, approvedBy = 'Agent') => {
    const res = await fetch(`${API_BASE}/approvals/${approvalId}/approve/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ edited_text: editedText, approved_by: approvedBy })
    });
    if (!res.ok) throw new Error('Failed to approve message');
    return res.json();
  },

  rejectMessage: async (approvalId, rejectionReason) => {
    const res = await fetch(`${API_BASE}/approvals/${approvalId}/reject/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejection_reason: rejectionReason })
    });
    if (!res.ok) throw new Error('Failed to reject message');
    return res.json();
  },

  // Templates
  getTemplates: async () => {
    const res = await fetch(`${API_BASE}/templates/`);
    if (!res.ok) throw new Error('Failed to fetch templates');
    return res.json();
  },

  // Contacts
  getContacts: async () => {
    const res = await fetch(`${API_BASE}/contacts/`);
    if (!res.ok) throw new Error('Failed to fetch contacts');
    return res.json();
  },

  // Webhook Simulation (for live demo & QA without ngrok)
  simulateIncomingWebhook: async (phoneNumber, senderName, messageText) => {
    const res = await fetch(`${API_BASE}/webhooks/whatsapp/simulate/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone_number: phoneNumber,
        sender_name: senderName,
        message_text: messageText
      })
    });
    if (!res.ok) throw new Error('Failed to simulate webhook');
    return res.json();
  }
};
