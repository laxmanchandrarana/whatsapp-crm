import React, { useState, useEffect, useCallback } from 'react';
import { 
  MessageSquare, 
  ShieldAlert, 
  Send, 
  Bot, 
  BarChart3, 
  Users, 
  Sparkles, 
  FileText, 
  Menu,
  ChevronLeft
} from 'lucide-react';
import Sidebar from './components/Sidebar';
import ConversationList from './components/ConversationList';
import ChatTimeline from './components/ChatTimeline';
import ApprovalDrawer from './components/ApprovalDrawer';
import TemplateModal from './components/TemplateModal';
import SimulateWebhookModal from './components/SimulateWebhookModal';
import BroadcastView from './components/BroadcastView';
import BotStudioView from './components/BotStudioView';
import AnalyticsView from './components/AnalyticsView';
import ContactsView from './components/ContactsView';
import { api } from './services/api';

export default function App() {
  const [activeView, setActiveView] = useState('chats'); // 'chats' | 'approvals' | 'broadcasts' | 'bot_studio' | 'contacts' | 'analytics'
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [stats, setStats] = useState({});
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Mobile Drill-in Navigation State
  const [mobileShowChat, setMobileShowChat] = useState(false);

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

  // Polling loop
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    loadConversations();
    loadApprovals();

    const interval = setInterval(() => {
      loadConversations();
      loadApprovals();
      if (activeId && activeView === 'chats') {
        loadActiveMessages(activeId);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [loadConversations, loadApprovals, activeId, activeView, loadActiveMessages]);

  useEffect(() => {
    if (activeId) {
      loadActiveMessages(activeId);
      api.markConversationRead(activeId).catch(() => {});
    }
  }, [activeId, loadActiveMessages]);

  const handleSelectConversation = (id) => {
    setActiveId(id);
    setMobileShowChat(true);
  };

  const handleOpenChatFromContacts = (contact) => {
    const existing = conversations.find(c => c.contact?.id === contact.id || c.contact?.phone_number === contact.phone_number);
    if (existing) {
      setActiveId(existing.id);
    }
    setActiveView('chats');
    setMobileShowChat(true);
  };

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

  const handleApprove = async (approvalId, editedText) => {
    await api.approveMessage(approvalId, editedText, 'Supervisor Agent');
    loadApprovals();
    loadConversations();
    if (activeId) loadActiveMessages(activeId);
  };

  const handleReject = async (approvalId, reason) => {
    await api.rejectMessage(approvalId, reason);
    loadApprovals();
    loadConversations();
    if (activeId) loadActiveMessages(activeId);
  };

  const handleSimulateSuccess = async (phone, name, text) => {
    const res = await api.simulateIncomingWebhook(phone, name, text);
    await loadConversations();
    await loadApprovals();
    return res;
  };

  const pendingApprovalsCount = approvals.filter(a => !a.is_resolved).length;

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-[#111b21] text-gray-100 antialiased font-sans">
      {/* 1. Mobile Top Navigation Bar (< 768px) */}
      <header className="md:hidden h-14 bg-[#111b21] border-b border-[#222e35] px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow">
            <MessageSquare className="w-4 h-4 fill-white/20" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-gray-100 flex items-center gap-1.5">
              DoubleTick CRM
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            </h1>
            <span className="text-[10px] text-teal-400 font-mono capitalize">
              {activeView.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Quick Mobile Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSimulatorModalOpen(true)}
            className="p-2 rounded-lg bg-[#182229] border border-[#2a3942] text-purple-400 hover:text-purple-300"
            title="Simulate WhatsApp Message"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="p-2 rounded-lg bg-[#182229] border border-[#2a3942] text-gray-300 hover:text-white"
            title="Message Templates"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsApprovalDrawerOpen(true)}
            className="relative p-2 rounded-lg bg-[#182229] border border-[#2a3942] text-amber-400 hover:text-amber-300"
            title="Approvals"
          >
            <ShieldAlert className="w-4 h-4" />
            {pendingApprovalsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center border border-[#111b21]">
                {pendingApprovalsCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* 2. Desktop Left Sidebar Navigation (>= 768px) */}
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

      {/* 3. Main Center Content */}
      <main className="flex-1 flex overflow-hidden pb-14 md:pb-0">
        {activeView === 'broadcasts' ? (
          <BroadcastView templates={templates} />
        ) : activeView === 'bot_studio' ? (
          <BotStudioView />
        ) : activeView === 'contacts' ? (
          <ContactsView onOpenChat={handleOpenChatFromContacts} />
        ) : activeView === 'analytics' ? (
          <AnalyticsView />
        ) : (
          /* Shared Team Inbox & Chats */
          <>
            {/* Mobile View: Either ConversationList OR ChatTimeline */}
            <div className="md:hidden flex-1 flex overflow-hidden">
              {!mobileShowChat ? (
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
              ) : (
                <ChatTimeline 
                  conversation={activeConversation}
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  onOpenTemplates={() => setIsTemplateModalOpen(true)}
                  onOpenApprovalDrawer={() => setIsApprovalDrawerOpen(true)}
                  onApproveMessage={handleApprove}
                  onRejectMessage={handleReject}
                  onBackToConversations={() => setMobileShowChat(false)}
                  onConversationUpdated={() => {
                    loadConversations();
                    if (activeId) loadActiveMessages(activeId);
                  }}
                />
              )}
            </div>

            {/* Desktop View: 2-Pane Side-by-Side */}
            <div className="hidden md:flex flex-1 overflow-hidden">
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

              <ChatTimeline 
                conversation={activeConversation}
                messages={messages}
                onSendMessage={handleSendMessage}
                onOpenTemplates={() => setIsTemplateModalOpen(true)}
                onOpenApprovalDrawer={() => setIsApprovalDrawerOpen(true)}
                onApproveMessage={handleApprove}
                onRejectMessage={handleReject}
                onConversationUpdated={() => {
                  loadConversations();
                  if (activeId) loadActiveMessages(activeId);
                }}
              />
            </div>
          </>
        )}
      </main>

      {/* 4. Mobile Bottom Fixed Navigation Bar (< 768px) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-[#111b21] border-t border-[#222e35] flex items-center justify-around z-30 select-none">
        <button
          onClick={() => {
            setActiveView('chats');
            setMobileShowChat(false);
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition ${
            activeView === 'chats' ? 'text-teal-400' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Chats</span>
        </button>

        <button
          onClick={() => {
            setActiveView('broadcasts');
            setMobileShowChat(false);
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition ${
            activeView === 'broadcasts' ? 'text-teal-400' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Send className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Broadcast</span>
        </button>

        <button
          onClick={() => {
            setActiveView('bot_studio');
            setMobileShowChat(false);
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition ${
            activeView === 'bot_studio' ? 'text-teal-400' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Bot className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Studio</span>
        </button>

        <button
          onClick={() => {
            setActiveView('contacts');
            setMobileShowChat(false);
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition ${
            activeView === 'contacts' ? 'text-teal-400' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Contacts</span>
        </button>

        <button
          onClick={() => {
            setActiveView('analytics');
            setMobileShowChat(false);
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition ${
            activeView === 'analytics' ? 'text-teal-400' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Analytics</span>
        </button>
      </nav>

      {/* 5. Slide-out Drawers & Modals */}
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
          setActiveView('chats');
          setMobileShowChat(true);
        }}
      />

      <TemplateModal 
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        templates={templates}
        onSendTemplate={handleSendTemplate}
        activeConversation={activeConversation}
        onRefreshTemplates={loadInitialData}
      />

      <SimulateWebhookModal 
        isOpen={isSimulatorModalOpen}
        onClose={() => setIsSimulatorModalOpen(false)}
        onSimulateSuccess={handleSimulateSuccess}
      />
    </div>
  );
}
