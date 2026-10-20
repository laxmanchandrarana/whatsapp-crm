import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ConversationList from './components/ConversationList';
import ChatTimeline from './components/ChatTimeline';
import ApprovalDrawer from './components/ApprovalDrawer';
import TemplateModal from './components/TemplateModal';
import SimulateWebhookModal from './components/SimulateWebhookModal';
import { api } from './services/api';

export default function App() {
  const [activeView, setActiveView] = useState('chats'); // 'chats' | 'approvals'
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [stats, setStats] = useState({});
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Drawers
  const [isApprovalDrawerOpen, setIsApprovalDrawerOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSimulatorModalOpen, setIsSimulatorModalOpen] = useState(false);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const data = await api.getConversations(statusFilter, searchQuery);
      const list = data.results || data || [];
      setConversations(list);
      
      // If none selected, default to first one
      if (!activeId && list.length > 0) {
        setActiveId(list[0].id);
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
    }
  }, [statusFilter, searchQuery, activeId]);

  // Load active conversation details & messages
  const loadActiveMessages = useCallback(async (id) => {
    if (!id) return;
    try {
      const [convData, msgsData] = await Promise.all([
        api.getConversation(id),
        api.getMessages(id)
      ]);
      setActiveConversation(convData);
      setMessages(msgsData.results || msgsData || []);
    } catch (err) {
      console.error('Error loading active messages:', err);
    }
  }, []);

  // Load approvals
  const loadApprovals = useCallback(async () => {
    try {
      const data = await api.getApprovals();
      const resolvedData = await api.getApprovals(true);
      const pendingList = data.results || data || [];
      const resolvedList = resolvedData.results || resolvedData || [];
      setApprovals([...pendingList, ...resolvedList]);
    } catch (err) {
      console.error('Error loading approvals:', err);
    }
  }, []);

  // Load templates & stats
  const loadInitialData = useCallback(async () => {
    try {
      const [tplData, statsData] = await Promise.all([
        api.getTemplates(),
        api.getStats()
      ]);
      setTemplates(tplData.results || tplData || []);
      setStats(statsData || {});
    } catch (err) {
      console.error('Error loading templates/stats:', err);
    }
  }, []);

  // Polling loop (every 3 seconds for real-time reactivity)
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    loadConversations();
    loadApprovals();

    const interval = setInterval(() => {
      loadConversations();
      loadApprovals();
      if (activeId) {
        loadActiveMessages(activeId);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [loadConversations, loadApprovals, activeId, loadActiveMessages]);

  useEffect(() => {
    if (activeId) {
      loadActiveMessages(activeId);
      api.markConversationRead(activeId).catch(() => {});
    }
  }, [activeId, loadActiveMessages]);

  // Handle select conversation
  const handleSelectConversation = (id) => {
    setActiveId(id);
  };

  // Handle send message
  const handleSendMessage = async (text) => {
    if (!activeId) return;
    const newMsg = await api.sendMessage({
      conversation_id: activeId,
      content: text,
      message_type: 'TEXT'
    });
    setMessages(prev => [...prev, newMsg]);
    loadConversations();
  };

  // Handle send template
  const handleSendTemplate = async (template) => {
    if (!activeId) return;
    const bodyComp = template.components?.find(c => c.type === 'BODY') || {};
    const newMsg = await api.sendMessage({
      conversation_id: activeId,
      message_type: 'TEMPLATE',
      template_name: template.name,
      template_language: template.language,
      content: bodyComp.text || `[Template: ${template.name}]`,
      components: template.components || []
    });
    setMessages(prev => [...prev, newMsg]);
    loadConversations();
  };

  // Handle approve message
  const handleApprove = async (approvalId, editedText) => {
    await api.approveMessage(approvalId, editedText, 'Supervisor Agent');
    loadApprovals();
    loadConversations();
    if (activeId) loadActiveMessages(activeId);
  };

  // Handle reject message
  const handleReject = async (approvalId, reason) => {
    await api.rejectMessage(approvalId, reason);
    loadApprovals();
    loadConversations();
    if (activeId) loadActiveMessages(activeId);
  };

  // Handle simulation
  const handleSimulateSuccess = async (phone, name, text) => {
    const res = await api.simulateIncomingWebhook(phone, name, text);
    await loadConversations();
    await loadApprovals();
    return res;
  };

  const pendingApprovalsCount = approvals.filter(a => !a.is_resolved).length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#111b21] text-gray-100 antialiased font-sans">
      {/* 1. Left Icon Navigation */}
      <Sidebar 
        activeView={activeView}
        setActiveView={(view) => {
          setActiveView(view);
          if (view === 'approvals') {
            setIsApprovalDrawerOpen(true);
          }
        }}
        pendingApprovalsCount={pendingApprovalsCount}
        onOpenSimulator={() => setIsSimulatorModalOpen(true)}
        onOpenTemplates={() => setIsTemplateModalOpen(true)}
        stats={stats}
      />

      {/* 2. Conversations List Pane */}
      <ConversationList 
        conversations={conversations}
        activeId={activeId}
        onSelectConversation={handleSelectConversation}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        pendingApprovalsTotal={pendingApprovalsCount}
      />

      {/* 3. Center Chat Timeline Pane */}
      <ChatTimeline 
        conversation={activeConversation}
        messages={messages}
        onSendMessage={handleSendMessage}
        onOpenTemplates={() => setIsTemplateModalOpen(true)}
        onOpenApprovalDrawer={() => setIsApprovalDrawerOpen(true)}
        onApproveMessage={handleApprove}
        onRejectMessage={handleReject}
      />

      {/* 4. Right Slide-out Drawer: Approval Queue */}
      <ApprovalDrawer 
        isOpen={isApprovalDrawerOpen}
        onClose={() => setIsApprovalDrawerOpen(false)}
        approvals={approvals}
        onApprove={handleApprove}
        onReject={handleReject}
        activeConversationId={activeId}
        onSelectConversation={(id) => {
          setActiveId(id);
          setIsApprovalDrawerOpen(false);
        }}
      />

      {/* 5. Template Picker Modal */}
      <TemplateModal 
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        templates={templates}
        onSendTemplate={handleSendTemplate}
        activeConversation={activeConversation}
      />

      {/* 6. Webhook Simulator Modal (For Live Demos & QA) */}
      <SimulateWebhookModal 
        isOpen={isSimulatorModalOpen}
        onClose={() => setIsSimulatorModalOpen(false)}
        onSimulateSuccess={handleSimulateSuccess}
      />
    </div>
  );
}
