const API_BASE = '/api';

export const api = {
  // Stats & Analytics
  getStats: async () => {
    const res = await fetch(`${API_BASE}/stats/`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  getAnalytics: async () => {
    const res = await fetch(`${API_BASE}/analytics/`);
    if (!res.ok) throw new Error('Failed to fetch analytics');
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

  updateConversationStatus: async (id, newStatus) => {
    const res = await fetch(`${API_BASE}/conversations/${id}/update-status/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) throw new Error('Failed to update status');
    return res.json();
  },

  addInternalNote: async (conversationId, content, authorAgent = 'Supervisor') => {
    const res = await fetch(`${API_BASE}/conversations/${conversationId}/add-internal-note/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, author_agent: authorAgent })
    });
    if (!res.ok) throw new Error('Failed to add internal note');
    return res.json();
  },

  generateCopilotSuggestion: async (conversationId) => {
    const res = await fetch(`${API_BASE}/conversations/${conversationId}/generate-ai-suggestion/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error('Failed to generate copilot suggestion');
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

  createTemplate: async (payload) => {
    const res = await fetch(`${API_BASE}/templates/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to create template');
    return res.json();
  },

  syncTemplatesWithMeta: async () => {
    const res = await fetch(`${API_BASE}/templates/sync-meta/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error('Failed to sync templates with Meta');
    return res.json();
  },

  // Broadcast Campaigns
  getCampaigns: async () => {
    const res = await fetch(`${API_BASE}/campaigns/`);
    if (!res.ok) throw new Error('Failed to fetch campaigns');
    return res.json();
  },

  createCampaign: async (payload) => {
    const res = await fetch(`${API_BASE}/campaigns/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to create campaign');
    return res.json();
  },

  startCampaign: async (id) => {
    const res = await fetch(`${API_BASE}/campaigns/${id}/start/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error('Failed to start campaign');
    return res.json();
  },

  pauseCampaign: async (id) => {
    const res = await fetch(`${API_BASE}/campaigns/${id}/pause/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error('Failed to pause campaign');
    return res.json();
  },

  importCampaignAudience: async (id, payload) => {
    const res = await fetch(`${API_BASE}/campaigns/${id}/import-audience/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to import audience');
    return res.json();
  },

  // Bot Studio Flows
  getBotFlows: async () => {
    const res = await fetch(`${API_BASE}/bot-flows/`);
    if (!res.ok) throw new Error('Failed to fetch bot flows');
    return res.json();
  },

  createBotFlow: async (payload) => {
    const res = await fetch(`${API_BASE}/bot-flows/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to create bot flow');
    return res.json();
  },

  updateBotFlow: async (id, payload) => {
    const res = await fetch(`${API_BASE}/bot-flows/${id}/`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to update bot flow');
    return res.json();
  },

  toggleBotFlow: async (id) => {
    const res = await fetch(`${API_BASE}/bot-flows/${id}/toggle/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error('Failed to toggle bot flow');
    return res.json();
  },

  testRunBotFlow: async (id, payload) => {
    const res = await fetch(`${API_BASE}/bot-flows/${id}/test-run/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to test run flow');
    return res.json();
  },

  // Canned Responses
  getCannedResponses: async (category = '') => {
    const url = category ? `${API_BASE}/canned-responses/?category=${category}` : `${API_BASE}/canned-responses/`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch canned responses');
    return res.json();
  },

  createCannedResponse: async (payload) => {
    const res = await fetch(`${API_BASE}/canned-responses/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to create canned response');
    return res.json();
  },

  // Contacts
  getContacts: async (search = '') => {
    const url = search ? `${API_BASE}/contacts/?search=${encodeURIComponent(search)}` : `${API_BASE}/contacts/`;
    const res = await fetch(url);
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
