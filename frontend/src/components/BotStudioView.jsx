import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Play, 
  Power, 
  Plus, 
  MessageSquare, 
  GitBranch, 
  UserCheck, 
  CornerDownRight, 
  Send, 
  RotateCcw,
  Sparkles,
  Layers,
  ChevronRight,
  ListFilter,
  HelpCircle,
  Clock,
  Globe,
  Sliders,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
  Trash2,
  Smartphone,
  Eye,
  Check,
  Menu,
  ChevronLeft
} from 'lucide-react';
import { api } from '../services/api';

// DoubleTick 9 Official Node Types & Configs
const NODE_TYPES = [
  { type: 'send_message', label: 'Send Message', icon: MessageSquare, color: 'from-blue-600 to-cyan-500', border: 'border-blue-500/40', text: 'text-blue-400' },
  { type: 'interactive_buttons', label: 'Interactive Buttons', icon: Sliders, color: 'from-emerald-600 to-teal-500', border: 'border-emerald-500/40', text: 'text-emerald-400' },
  { type: 'interactive_list', label: 'Interactive List', icon: ListFilter, color: 'from-purple-600 to-indigo-500', border: 'border-purple-500/40', text: 'text-purple-400' },
  { type: 'user_input', label: 'Ask Question / Input', icon: HelpCircle, color: 'from-amber-600 to-orange-500', border: 'border-amber-500/40', text: 'text-amber-400' },
  { type: 'condition', label: 'Condition Branch', icon: GitBranch, color: 'from-cyan-600 to-blue-500', border: 'border-cyan-500/40', text: 'text-cyan-400' },
  { type: 'webhook_action', label: 'Webhook Action', icon: Globe, color: 'from-orange-600 to-rose-500', border: 'border-orange-500/40', text: 'text-orange-400' },
  { type: 'delay', label: 'Delay', icon: Clock, color: 'from-gray-600 to-slate-500', border: 'border-gray-500/40', text: 'text-gray-400' },
  { type: 'handoff', label: 'Human Handoff', icon: UserCheck, color: 'from-rose-600 to-pink-500', border: 'border-rose-500/40', text: 'text-rose-400' },
];

export default function BotStudioView() {
  const [flows, setFlows] = useState([]);
  const [activeFlow, setActiveFlow] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Responsive Drawer Visibility States
  const [showSimulator, setShowSimulator] = useState(false);
  const [showMobileFlows, setShowMobileFlows] = useState(false);
  const [showMobileInspector, setShowMobileInspector] = useState(false);

  // Live Simulator State
  const [simMessages, setSimMessages] = useState([]);
  const [simInput, setSimInput] = useState('');
  const [simCurrentNodeId, setSimCurrentNodeId] = useState('start');
  const [simContactAttrs, setSimContactAttrs] = useState({ tier: 'gold', company: 'Acme Corp' });
  const [simInteractiveWidget, setSimInteractiveWidget] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Load flows from backend
  const loadFlows = async () => {
    try {
      setLoading(true);
      const data = await api.getBotFlows();
      const list = data.results || data || [];
      setFlows(list);
      if (list.length > 0 && !activeFlow) {
        selectFlow(list[0]);
      }
    } catch (err) {
      console.error('Error fetching flows:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectFlow = (flow) => {
    setActiveFlow(flow);
    setShowMobileFlows(false);
    if (flow.nodes && flow.nodes.length > 0) {
      setSelectedNode(flow.nodes[0]);
      resetSimulator(flow);
    } else {
      setSelectedNode(null);
    }
  };

  useEffect(() => {
    loadFlows();
  }, []);

  const handleToggleFlow = async (flowId) => {
    try {
      const res = await api.toggleBotFlow(flowId);
      setFlows(prev => prev.map(f => f.id === flowId ? { ...f, is_active: res.is_active } : f));
      if (activeFlow?.id === flowId) {
        setActiveFlow(prev => ({ ...prev, is_active: res.is_active }));
      }
    } catch (err) {
      alert(`Failed to toggle flow: ${err.message}`);
    }
  };

  // Node Inspector Editing
  const updateSelectedNodeField = (field, value) => {
    if (!selectedNode || !activeFlow) return;
    const updated = { ...selectedNode, [field]: value };
    setSelectedNode(updated);

    const updatedNodes = activeFlow.nodes.map(n => n.id === updated.id ? updated : n);
    setActiveFlow({ ...activeFlow, nodes: updatedNodes });
  };

  // Add new Node to Active Flow
  const handleAddNode = (nodeType) => {
    if (!activeFlow) return;
    const newId = `node_${Date.now().toString().slice(-5)}`;
    let newNode = {
      id: newId,
      type: nodeType,
      label: `New ${nodeType.replace('_', ' ')}`,
      content: '',
      target_node_id: null
    };

    if (nodeType === 'send_message') {
      newNode.content = 'Hello {{name}}! How can we assist you today?';
    } else if (nodeType === 'interactive_buttons') {
      newNode.content = 'Please choose one of the options below:';
      newNode.buttons = [
        { id: 'btn_1', title: 'Option 1', target_node_id: null },
        { id: 'btn_2', title: 'Option 2', target_node_id: null }
      ];
    } else if (nodeType === 'interactive_list') {
      newNode.content = 'Explore our catalog of services:';
      newNode.button_text = 'Select Service';
      newNode.sections = [
        {
          title: 'Departments',
          rows: [
            { id: 'row_support', title: 'Support & Billing', description: 'Customer service queries' },
            { id: 'row_sales', title: 'Enterprise Sales', description: 'Talk to our sales executives' }
          ]
        }
      ];
    } else if (nodeType === 'user_input') {
      newNode.content = 'What is your work email address?';
      newNode.validation_type = 'email';
      newNode.validation_error = 'Please enter a valid work email address.';
      newNode.attribute_name = 'work_email';
    } else if (nodeType === 'condition') {
      newNode.field = 'tier';
      newNode.operator = 'equals';
      newNode.value = 'gold';
      newNode.branch_a_target = null;
      newNode.branch_b_target = null;
    } else if (nodeType === 'webhook_action') {
      newNode.url = 'https://api.crm.example.com/sync-lead';
      newNode.method = 'POST';
    } else if (nodeType === 'delay') {
      newNode.delay_seconds = 5;
    } else if (nodeType === 'handoff') {
      newNode.content = 'Connecting you to our senior support specialists right now...';
      newNode.escalate_status = 'OPEN';
    }

    const updatedNodes = [...(activeFlow.nodes || []), newNode];
    const updatedFlow = { ...activeFlow, nodes: updatedNodes };
    setActiveFlow(updatedFlow);
    setSelectedNode(newNode);
    setShowMobileInspector(true);
  };

  // Delete Node
  const handleDeleteNode = (nodeId) => {
    if (!activeFlow) return;
    const updatedNodes = activeFlow.nodes.filter(n => n.id !== nodeId);
    const updatedEdges = (activeFlow.edges || []).filter(e => e.source !== nodeId && e.target !== nodeId);
    setActiveFlow({ ...activeFlow, nodes: updatedNodes, edges: updatedEdges });
    if (selectedNode?.id === nodeId) {
      setSelectedNode(updatedNodes[0] || null);
    }
  };

  // Save Flow to API
  const handleSaveFlow = async () => {
    if (!activeFlow) return;
    try {
      setSaving(true);
      await api.updateBotFlow(activeFlow.id, {
        name: activeFlow.name,
        trigger_type: activeFlow.trigger_type,
        trigger_keywords: activeFlow.trigger_keywords,
        nodes: activeFlow.nodes,
        edges: activeFlow.edges,
        is_active: activeFlow.is_active
      });
      alert('DoubleTick Bot Studio flow saved successfully!');
      loadFlows();
    } catch (err) {
      alert(`Error saving flow: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Create New Flow
  const handleCreateNewFlow = async () => {
    const name = prompt('Enter a name for the new DoubleTick Flow:');
    if (!name?.trim()) return;
    try {
      const initialNodes = [
        {
          id: 'start_node',
          type: 'send_message',
          label: 'Welcome Greeting',
          content: 'Hello {{name}}! Welcome to DoubleTick WhatsApp Assistant.'
        }
      ];
      const newFlow = await api.createBotFlow({
        name: name.trim(),
        trigger_type: 'KEYWORD',
        trigger_keywords: ['hello', 'hi'],
        nodes: initialNodes,
        edges: [],
        is_active: true
      });
      setFlows(prev => [...prev, newFlow]);
      selectFlow(newFlow);
    } catch (err) {
      alert(`Failed to create flow: ${err.message}`);
    }
  };

  // Simulator Engine
  const resetSimulator = (flow = activeFlow) => {
    if (!flow || !flow.nodes || flow.nodes.length === 0) return;
    const firstNode = flow.nodes[0];
    setSimCurrentNodeId(firstNode.id);
    setSimInteractiveWidget(null);
    setSimMessages([
      {
        sender: 'bot',
        text: renderTemplateText(firstNode.content || 'Hello! Welcome.', simContactAttrs),
        node: firstNode.type
      }
    ]);

    if (firstNode.type === 'interactive_buttons' || firstNode.type === 'menu') {
      setSimInteractiveWidget({
        type: 'button',
        options: firstNode.buttons || firstNode.options || []
      });
    } else if (firstNode.type === 'interactive_list') {
      setSimInteractiveWidget({
        type: 'list',
        sections: firstNode.sections || []
      });
    }
  };

  const renderTemplateText = (text, attrs = {}) => {
    if (!text) return '';
    let rendered = text.replace(/{{name}}/g, 'Alex Johnson');
    rendered = rendered.replace(/{{phone}}/g, '+14155550199');
    Object.entries(attrs).forEach(([k, v]) => {
      rendered = rendered.replace(new RegExp(`{{${k}}}`, 'g'), v);
      rendered = rendered.replace(new RegExp(`{{custom_attributes.${k}}}`, 'g'), v);
    });
    return rendered;
  };

  const handleSimulateSubmit = async (messageOverride = null) => {
    const textToSend = messageOverride !== null ? messageOverride : simInput.trim();
    if (!textToSend && textToSend !== '') return;

    if (textToSend) {
      setSimMessages(prev => [...prev, { sender: 'user', text: textToSend }]);
    }
    setSimInput('');
    setSimInteractiveWidget(null);
    setIsSimulating(true);

    try {
      const res = await api.testRunBotFlow(activeFlow.id, {
        message: textToSend,
        current_node_id: simCurrentNodeId,
        contact: {
          name: 'Alex Johnson',
          phone: '+14155550199',
          custom_attributes: simContactAttrs
        }
      });

      if (res.updated_attributes && Object.keys(res.updated_attributes).length > 0) {
        setSimContactAttrs(prev => ({ ...prev, ...res.updated_attributes }));
      }

      if (res.response_text) {
        setSimMessages(prev => [...prev, {
          sender: 'bot',
          text: res.response_text,
          node: res.current_node?.type
        }]);
      }

      if (res.interactive_type === 'button') {
        setSimInteractiveWidget({
          type: 'button',
          options: res.interactive_payload || []
        });
      } else if (res.interactive_type === 'list') {
        setSimInteractiveWidget({
          type: 'list',
          sections: res.interactive_payload || []
        });
      }

      if (res.next_node_id) {
        setSimCurrentNodeId(res.next_node_id);
      }
    } catch (err) {
      setSimMessages(prev => [...prev, { sender: 'system', text: `Simulation error: ${err.message}` }]);
    } finally {
      setIsSimulating(false);
    }
  };

  // Node Inspector Component (reusable for desktop & mobile drawer)
  const renderNodeInspector = () => {
    if (!selectedNode) return null;
    return (
      <div className="flex flex-col h-full bg-[#111b21] text-xs">
        <div className="h-14 px-4 border-b border-[#222e35] flex items-center justify-between shrink-0 bg-[#162127]">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-teal-400" />
            <span className="font-bold text-xs text-gray-100">Step Inspector</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-gray-400">{selectedNode.id}</span>
            <button
              onClick={() => setShowMobileInspector(false)}
              className="lg:hidden p-1 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Step Label
            </label>
            <input
              type="text"
              value={selectedNode.label || ''}
              onChange={(e) => updateSelectedNodeField('label', e.target.value)}
              className="w-full bg-[#182229] border border-[#2a3942] rounded-xl px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Content Field */}
          {selectedNode.type !== 'condition' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Message / Prompt Content
                </label>
                <div className="flex gap-1">
                  {['name', 'phone', 'company', 'tier'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => updateSelectedNodeField('content', (selectedNode.content || '') + ` {{${tag}}}`)}
                      className="text-[9px] bg-[#182229] border border-[#2a3942] text-teal-400 px-1.5 py-0.5 rounded font-mono hover:bg-[#202c33]"
                    >
                      +&#123;&#123;{tag}&#125;&#125;
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows="4"
                value={selectedNode.content || ''}
                onChange={(e) => updateSelectedNodeField('content', e.target.value)}
                className="w-full bg-[#182229] border border-[#2a3942] rounded-xl p-3 text-xs text-gray-100 focus:outline-none focus:border-teal-500 leading-relaxed"
              />
            </div>
          )}

          {/* Target Node Connector */}
          {selectedNode.type !== 'condition' && (
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Next Step Connection
              </label>
              <select
                value={selectedNode.target_node_id || ''}
                onChange={(e) => updateSelectedNodeField('target_node_id', e.target.value || null)}
                className="w-full bg-[#182229] border border-[#2a3942] rounded-xl px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-teal-500 font-mono"
              >
                <option value="">-- None (End of Flow) --</option>
                {(activeFlow?.nodes || [])
                  .filter(n => n.id !== selectedNode.id)
                  .map(n => (
                    <option key={n.id} value={n.id}>
                      {n.label || n.type} ({n.id})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Condition Specific Config */}
          {selectedNode.type === 'condition' && (
            <div className="space-y-3 pt-2 border-t border-[#222e35]">
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block">
                Branch Evaluation Rules
              </span>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Attribute or Field</label>
                <input
                  type="text"
                  placeholder="tier, company, message_text"
                  value={selectedNode.field || ''}
                  onChange={(e) => updateSelectedNodeField('field', e.target.value)}
                  className="w-full bg-[#182229] border border-[#2a3942] rounded-xl px-3 py-1.5 text-xs text-gray-100 font-mono focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Operator</label>
                  <select
                    value={selectedNode.operator || 'equals'}
                    onChange={(e) => updateSelectedNodeField('operator', e.target.value)}
                    className="w-full bg-[#182229] border border-[#2a3942] rounded-xl px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-teal-500"
                  >
                    <option value="equals">equals</option>
                    <option value="not_equals">not equals</option>
                    <option value="contains">contains</option>
                    <option value="greater_than">&gt; greater than</option>
                    <option value="less_than">&lt; less than</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Value</label>
                  <input
                    type="text"
                    placeholder="e.g. gold"
                    value={selectedNode.value || ''}
                    onChange={(e) => updateSelectedNodeField('value', e.target.value)}
                    className="w-full bg-[#182229] border border-[#2a3942] rounded-xl px-3 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-emerald-400 font-semibold block mb-1">&#10003; Branch A (If True)</label>
                <select
                  value={selectedNode.branch_a_target || ''}
                  onChange={(e) => updateSelectedNodeField('branch_a_target', e.target.value || null)}
                  className="w-full bg-[#182229] border border-[#2a3942] rounded-xl px-3 py-2 text-xs text-gray-100 font-mono focus:outline-none focus:border-teal-500"
                >
                  <option value="">-- None --</option>
                  {(activeFlow?.nodes || []).filter(n => n.id !== selectedNode.id).map(n => (
                    <option key={n.id} value={n.id}>{n.label || n.type} ({n.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-rose-400 font-semibold block mb-1">&#10007; Branch B (If False)</label>
                <select
                  value={selectedNode.branch_b_target || ''}
                  onChange={(e) => updateSelectedNodeField('branch_b_target', e.target.value || null)}
                  className="w-full bg-[#182229] border border-[#2a3942] rounded-xl px-3 py-2 text-xs text-gray-100 font-mono focus:outline-none focus:border-teal-500"
                >
                  <option value="">-- None --</option>
                  {(activeFlow?.nodes || []).filter(n => n.id !== selectedNode.id).map(n => (
                    <option key={n.id} value={n.id}>{n.label || n.type} ({n.id})</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* User Input Config */}
          {selectedNode.type === 'user_input' && (
            <div className="space-y-3 pt-2 border-t border-[#222e35]">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                Input & Validation Rules
              </span>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Validation Type</label>
                <select
                  value={selectedNode.validation_type || 'text'}
                  onChange={(e) => updateSelectedNodeField('validation_type', e.target.value)}
                  className="w-full bg-[#182229] border border-[#2a3942] rounded-xl px-3 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-teal-500"
                >
                  <option value="text">Any Text</option>
                  <option value="email">Email Address</option>
                  <option value="phone">Phone Number</option>
                  <option value="number">Numeric</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Save to Attribute Key</label>
                <input
                  type="text"
                  placeholder="e.g. work_email"
                  value={selectedNode.attribute_name || ''}
                  onChange={(e) => updateSelectedNodeField('attribute_name', e.target.value)}
                  className="w-full bg-[#182229] border border-[#2a3942] rounded-xl px-3 py-1.5 text-xs text-teal-400 font-mono focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Validation Error Message</label>
                <input
                  type="text"
                  placeholder="Please enter a valid format..."
                  value={selectedNode.validation_error || ''}
                  onChange={(e) => updateSelectedNodeField('validation_error', e.target.value)}
                  className="w-full bg-[#182229] border border-[#2a3942] rounded-xl px-3 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>
          )}

          {/* Interactive Buttons Config */}
          {selectedNode.type === 'interactive_buttons' && (
            <div className="space-y-3 pt-2 border-t border-[#222e35]">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                Quick Reply Buttons (Max 3)
              </span>
              {(selectedNode.buttons || []).map((btn, bIdx) => (
                <div key={bIdx} className="bg-[#182229] p-2.5 rounded-xl border border-[#2a3942] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-300">Button #{bIdx + 1}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newBtns = selectedNode.buttons.filter((_, i) => i !== bIdx);
                        updateSelectedNodeField('buttons', newBtns);
                      }}
                      className="text-gray-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Button Title"
                    value={btn.title || ''}
                    onChange={(e) => {
                      const newBtns = [...selectedNode.buttons];
                      newBtns[bIdx] = { ...newBtns[bIdx], title: e.target.value };
                      updateSelectedNodeField('buttons', newBtns);
                    }}
                    className="w-full bg-[#111b21] border border-[#2a3942] rounded-lg px-2.5 py-1 text-xs text-gray-100"
                  />
                  <select
                    value={btn.target_node_id || ''}
                    onChange={(e) => {
                      const newBtns = [...selectedNode.buttons];
                      newBtns[bIdx] = { ...newBtns[bIdx], target_node_id: e.target.value || null };
                      updateSelectedNodeField('buttons', newBtns);
                    }}
                    className="w-full bg-[#111b21] border border-[#2a3942] rounded-lg px-2 py-1 text-[11px] text-teal-400 font-mono"
                  >
                    <option value="">-- Target Step --</option>
                    {(activeFlow?.nodes || []).filter(n => n.id !== selectedNode.id).map(n => (
                      <option key={n.id} value={n.id}>{n.label || n.type} ({n.id})</option>
                    ))}
                  </select>
                </div>
              ))}

              {(selectedNode.buttons || []).length < 3 && (
                <button
                  type="button"
                  onClick={() => {
                    const newBtns = [...(selectedNode.buttons || []), { id: `btn_${Date.now()}`, title: `Option ${(selectedNode.buttons || []).length + 1}`, target_node_id: null }];
                    updateSelectedNodeField('buttons', newBtns);
                  }}
                  className="w-full py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Button
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#222e35] bg-[#162127] flex items-center justify-between">
          <button
            onClick={() => handleDeleteNode(selectedNode.id)}
            className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs transition"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
          <button
            onClick={() => setShowMobileInspector(false)}
            className="lg:hidden px-4 py-1.5 bg-teal-500 text-slate-950 font-bold rounded-lg text-xs shadow"
          >
            Done
          </button>
        </div>
      </div>
    );
  };

  // Simulator Panel Component (reusable for desktop & mobile)
  const renderSimulatorPanel = (isMobile = false) => {
    return (
      <div className={`flex flex-col h-full bg-[#111b21] ${isMobile ? 'w-full' : 'w-80'} text-xs shrink-0 shadow-2xl`}>
        {/* Phone Header */}
        <div className="h-14 px-4 bg-[#202c33] border-b border-[#222e35] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-xs">
              WA
            </div>
            <div>
              <span className="text-xs font-bold text-gray-100 flex items-center gap-1">
                DoubleTick Bot <Check className="w-3 h-3 text-teal-400" />
              </span>
              <span className="text-[10px] text-emerald-400 block font-mono">online simulator</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => resetSimulator()}
              className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#182229] rounded-lg transition"
              title="Reset Simulator"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowSimulator(false)}
              className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#182229] rounded-lg transition"
              title="Close Simulator"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Simulated WhatsApp Chat Timeline */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0c1317]">
          {simMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm ${
                  msg.sender === 'user'
                    ? 'bg-teal-600 text-white rounded-tr-none'
                    : 'bg-[#202c33] text-gray-200 rounded-tl-none border border-[#2a3942]'
                }`}
              >
                {msg.text}
              </div>
              <span className="text-[9px] text-gray-500 mt-1 px-1 font-mono">
                {msg.sender === 'user' ? 'Customer' : 'Bot Engine'}
              </span>
            </div>
          ))}

          {/* Interactive Widgets inside Chat */}
          {simInteractiveWidget?.type === 'button' && (
            <div className="pt-2 space-y-1.5 max-w-[85%]">
              <span className="text-[10px] text-teal-400 font-semibold uppercase tracking-wider block">
                Click Quick Reply:
              </span>
              {simInteractiveWidget.options.map((opt, oIdx) => (
                <button
                  key={oIdx}
                  onClick={() => handleSimulateSubmit(opt.title || opt.label || opt.id)}
                  className="w-full py-2 px-3 bg-[#202c33] hover:bg-teal-500 hover:text-slate-950 text-teal-300 font-semibold rounded-xl border border-teal-500/30 text-xs transition shadow-sm"
                >
                  {opt.title || opt.label}
                </button>
              ))}
            </div>
          )}

          {simInteractiveWidget?.type === 'list' && (
            <div className="pt-2 space-y-1.5 max-w-[85%]">
              <span className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider block">
                Select Menu Option:
              </span>
              {(simInteractiveWidget.sections || []).flatMap(s => s.rows || []).map((row, rIdx) => (
                <button
                  key={rIdx}
                  onClick={() => handleSimulateSubmit(row.title || row.id)}
                  className="w-full text-left py-2 px-3 bg-[#202c33] hover:bg-purple-600 hover:text-white text-gray-200 rounded-xl border border-[#2a3942] text-xs transition shadow-sm"
                >
                  <span className="font-semibold block">{row.title}</span>
                  {row.description && <span className="text-[10px] text-gray-400">{row.description}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Live Contact Attribute Inspector */}
        <div className="p-2.5 bg-[#182229]/80 border-t border-[#222e35] text-[10px] shrink-0">
          <span className="text-gray-400 font-mono block mb-1 font-semibold">Contact Attributes:</span>
          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
            {Object.entries(simContactAttrs).map(([k, v]) => (
              <span key={k} className="bg-[#111b21] px-1.5 py-0.5 rounded border border-[#2a3942] text-teal-300 font-mono">
                {k}: {String(v)}
              </span>
            ))}
          </div>
        </div>

        {/* Simulator Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSimulateSubmit();
          }}
          className="p-3 border-t border-[#222e35] bg-[#111b21] flex gap-2 shrink-0"
        >
          <input
            type="text"
            placeholder="Test reply (e.g. sales, email)..."
            value={simInput}
            onChange={(e) => setSimInput(e.target.value)}
            disabled={isSimulating}
            className="flex-1 bg-[#182229] border border-[#2a3942] rounded-xl px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-teal-500"
          />
          <button
            type="submit"
            disabled={isSimulating || !simInput.trim()}
            className="px-3 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 rounded-xl transition font-bold"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    );
  };

  // Flows Directory Content (reusable)
  const renderFlowsList = () => (
    <div className="flex flex-col h-full bg-[#111b21] text-xs">
      <div className="p-4 border-b border-[#222e35] flex items-center justify-between shrink-0 bg-[#162127]">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-teal-400" />
          <span className="font-bold text-xs text-gray-100 uppercase tracking-wider">Flows Directory</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCreateNewFlow}
            className="p-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/30 transition flex items-center gap-1 text-[11px]"
            title="Create New Flow"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
          <button
            onClick={() => setShowMobileFlows(false)}
            className="lg:hidden p-1.5 text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {flows.map(f => (
          <div
            key={f.id}
            onClick={() => selectFlow(f)}
            className={`p-3 rounded-xl cursor-pointer border transition-all ${
              activeFlow?.id === f.id
                ? 'bg-[#202c33] border-teal-500/50 shadow-sm'
                : 'bg-[#182229]/60 border-[#222e35] hover:bg-[#1a252d]'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="overflow-hidden pr-2">
                <h4 className="text-xs font-semibold text-gray-100 truncate">{f.name}</h4>
                <span className="text-[10px] text-teal-400 font-mono mt-0.5 block">
                  {f.trigger_type}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleFlow(f.id);
                }}
                className={`p-1 rounded-md text-xs transition shrink-0 ${
                  f.is_active 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-gray-700/30 text-gray-400 border border-gray-600/30'
                }`}
                title={f.is_active ? 'Active Flow' : 'Disabled Flow'}
              >
                <Power className="w-3 h-3" />
              </button>
            </div>

            {f.trigger_keywords?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {f.trigger_keywords.slice(0, 3).map((kw, i) => (
                  <span key={i} className="text-[9px] bg-[#111b21] px-1.5 py-0.5 rounded text-gray-400 font-mono">
                    {kw}
                  </span>
                ))}
                {f.trigger_keywords.length > 3 && (
                  <span className="text-[9px] text-gray-500">+{f.trigger_keywords.length - 3}</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex h-full bg-[#0c1317] overflow-hidden text-gray-200 relative">
      {/* 1. Desktop Left Flows Directory Sidebar (>= 1024px) */}
      <div className="hidden lg:flex w-64 bg-[#111b21] border-r border-[#222e35] flex-col shrink-0">
        {renderFlowsList()}
      </div>

      {/* Mobile Left Flows Slide-Over Drawer (< 1024px) */}
      {showMobileFlows && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/80 flex">
          <div className="w-72 max-w-[85vw] h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {renderFlowsList()}
          </div>
          <div className="flex-1" onClick={() => setShowMobileFlows(false)}></div>
        </div>
      )}

      {/* 2. Visual Flow Builder Canvas */}
      <div className="flex-1 flex flex-col border-r border-[#222e35] bg-[#0c1317] overflow-hidden">
        {/* Canvas Header & Action Bar */}
        <div className="p-3 sm:px-6 sm:h-14 border-b border-[#222e35] bg-[#111b21] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            {/* Mobile Flows Drawer Button */}
            <button
              onClick={() => setShowMobileFlows(true)}
              className="lg:hidden p-1.5 rounded-lg bg-[#182229] border border-[#2a3942] text-teal-400 hover:text-white"
              title="Open Flows Directory"
            >
              <Menu className="w-4 h-4" />
            </button>

            <Layers className="w-4 h-4 text-teal-400 shrink-0" />
            <span className="text-xs font-bold text-gray-100 truncate max-w-[140px] sm:max-w-none">
              {activeFlow?.name || 'No Flow Selected'}
            </span>

            {activeFlow?.is_active ? (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-semibold border border-emerald-500/20 flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="hidden sm:inline">Production</span> Active
              </span>
            ) : (
              <span className="text-[10px] bg-gray-700/20 text-gray-400 px-2 py-0.5 rounded-full font-semibold border border-gray-600/20 shrink-0">
                Draft
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Mobile Step Inspector Trigger */}
            {selectedNode && (
              <button
                onClick={() => setShowMobileInspector(true)}
                className="lg:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Edit Step</span>
              </button>
            )}

            {/* Simulator Toggle */}
            <button
              onClick={() => setShowSimulator(!showSimulator)}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                showSimulator 
                  ? 'bg-teal-500/10 text-teal-400 border-teal-500/30'
                  : 'bg-[#182229] text-gray-300 border-[#2a3942]'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{showSimulator ? 'Close Test' : 'Test Flow'}</span>
            </button>

            <button
              disabled={saving}
              onClick={handleSaveFlow}
              className="flex items-center gap-1 px-3 sm:px-4 py-1.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-xl shadow-sm transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </div>

        {/* DoubleTick Node Types Palette */}
        <div className="px-3 sm:px-6 py-2 bg-[#111b21]/70 border-b border-[#222e35] flex items-center gap-2 overflow-x-auto shrink-0 no-scrollbar touch-pan-x">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mr-1 flex items-center gap-1 shrink-0">
            <Plus className="w-3 h-3 text-teal-400" /> Add Step:
          </span>
          {NODE_TYPES.map(nt => {
            const Icon = nt.icon;
            return (
              <button
                key={nt.type}
                onClick={() => handleAddNode(nt.type)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#182229] hover:bg-[#202c33] border border-[#2a3942] text-[11px] text-gray-200 transition shrink-0 hover:border-teal-500/40"
              >
                <Icon className={`w-3 h-3 ${nt.text}`} />
                <span>{nt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Flow Canvas Area */}
        <div className="flex-1 overflow-auto p-4 sm:p-8 bg-[radial-gradient(#202c33_1px,transparent_1px)] [background-size:20px_20px]">
          {activeFlow?.nodes?.length ? (
            <div className="max-w-2xl mx-auto space-y-6">
              {activeFlow.nodes.map((node, idx) => {
                const nodeMeta = NODE_TYPES.find(n => n.type === node.type) || NODE_TYPES[0];
                const Icon = nodeMeta.icon;
                const isSelected = selectedNode?.id === node.id;

                return (
                  <div key={node.id} className="relative group">
                    {/* SVG Connector Wire between Steps */}
                    {idx > 0 && (
                      <div className="w-0.5 h-6 bg-gradient-to-b from-teal-500/50 to-teal-500/20 mx-auto -mt-6 mb-0"></div>
                    )}

                    {/* Node Card */}
                    <div
                      onClick={() => {
                        setSelectedNode(node);
                        if (window.innerWidth < 1024) {
                          setShowMobileInspector(true);
                        }
                      }}
                      className={`rounded-2xl border transition-all cursor-pointer overflow-hidden shadow-lg ${
                        isSelected
                          ? 'bg-[#182229] border-teal-500 ring-2 ring-teal-500/20 shadow-teal-500/10'
                          : 'bg-[#111b21] border-[#222e35] hover:border-[#2a3942]'
                      }`}
                    >
                      {/* Node Header Strip */}
                      <div className={`px-4 py-2.5 bg-gradient-to-r ${nodeMeta.color} text-white flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <span className="text-xs font-bold tracking-wide">
                            {node.label || nodeMeta.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono bg-black/20 px-1.5 py-0.5 rounded">
                            {node.id}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNode(node.id);
                            }}
                            className="p-1 rounded hover:bg-black/30 text-white/80 hover:text-white transition"
                            title="Delete Node"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Node Card Body */}
                      <div className="p-4 space-y-2">
                        {node.content && (
                          <p className="text-xs text-gray-300 whitespace-pre-line leading-relaxed">
                            {node.content}
                          </p>
                        )}

                        {/* Interactive Buttons Preview */}
                        {(node.type === 'interactive_buttons' || node.buttons) && (
                          <div className="pt-2 flex flex-wrap gap-1.5">
                            {(node.buttons || []).map((btn, bIdx) => (
                              <span key={bIdx} className="text-[11px] bg-teal-500/10 border border-teal-500/30 text-teal-300 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1">
                                <Sliders className="w-2.5 h-2.5" />
                                {btn.title}
                                {btn.target_node_id && (
                                  <span className="text-[9px] text-gray-400 font-mono">&rarr; {btn.target_node_id}</span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Interactive List Preview */}
                        {node.type === 'interactive_list' && (
                          <div className="pt-2 space-y-1">
                            {(node.sections || []).map((sec, sIdx) => (
                              <div key={sIdx} className="bg-[#182229] p-2 rounded-lg border border-[#2a3942]/60 text-xs">
                                <span className="font-semibold text-purple-300 block">{sec.title}</span>
                                <div className="mt-1 space-y-1 pl-2">
                                  {(sec.rows || []).map((r, rIdx) => (
                                    <div key={rIdx} className="text-[11px] text-gray-300 flex items-center justify-between">
                                      <span>&bull; {r.title}</span>
                                      {r.target_node_id && (
                                        <span className="text-[9px] text-gray-500 font-mono">&rarr; {r.target_node_id}</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* User Input Preview */}
                        {node.type === 'user_input' && (
                          <div className="pt-2 flex items-center justify-between text-xs bg-[#182229] p-2 rounded-lg border border-[#2a3942]/60">
                            <span className="text-amber-400 font-mono">Expects: {node.validation_type || 'text'}</span>
                            <span className="text-teal-400 font-mono">Saves to: {node.attribute_name || 'custom_attributes'}</span>
                          </div>
                        )}

                        {/* Condition Branch Preview */}
                        {node.type === 'condition' && (
                          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                              <span className="font-bold block">&#10003; IF: {node.field} {node.operator} &quot;{node.value}&quot;</span>
                              <span className="text-[9px] text-gray-400 font-mono">&rarr; {node.branch_a_target || 'End'}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
                              <span className="font-bold block">&#10007; ELSE:</span>
                              <span className="text-[9px] text-gray-400 font-mono">&rarr; {node.branch_b_target || 'End'}</span>
                            </div>
                          </div>
                        )}

                        {/* Webhook Preview */}
                        {node.type === 'webhook_action' && (
                          <div className="pt-2 text-[11px] font-mono text-orange-400 bg-[#182229] p-2 rounded-lg border border-[#2a3942]">
                            HTTP {node.method || 'POST'} {node.url}
                          </div>
                        )}

                        {/* Delay Preview */}
                        {node.type === 'delay' && (
                          <div className="pt-1 text-[11px] text-gray-400 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-teal-400" /> Wait {node.delay_seconds || 5} seconds
                          </div>
                        )}

                        {/* Target Wire */}
                        {node.target_node_id && (
                          <div className="pt-2 text-[10px] text-teal-400 font-mono flex items-center gap-1">
                            <CornerDownRight className="w-3 h-3" /> Connects to: <strong>{node.target_node_id}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs">
              <Bot className="w-10 h-10 mb-2 text-gray-600" />
              Select a flow or click &quot;+ Add Step&quot; to begin building.
            </div>
          )}
        </div>
      </div>

      {/* 3. Desktop Step Inspector Drawer (>= 1024px) */}
      {selectedNode && (
        <div className="hidden lg:flex w-80 bg-[#111b21] border-r border-[#222e35] flex-col shrink-0">
          {renderNodeInspector()}
        </div>
      )}

      {/* Mobile Step Inspector Bottom Sheet (< 1024px) */}
      {selectedNode && showMobileInspector && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/80 flex flex-col justify-end">
          <div className="flex-1" onClick={() => setShowMobileInspector(false)}></div>
          <div className="h-[80vh] w-full rounded-t-3xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
            {renderNodeInspector()}
          </div>
        </div>
      )}

      {/* 4. Desktop Live WhatsApp Simulator Panel (>= 1280px) */}
      {showSimulator && (
        <div className="hidden xl:flex w-80 bg-[#111b21] flex-col shrink-0 animate-fade-in border-l border-[#222e35]">
          {renderSimulatorPanel(false)}
        </div>
      )}

      {/* Mobile / Tablet Live WhatsApp Simulator Overlay (< 1280px) */}
      {showSimulator && (
        <div className="xl:hidden fixed inset-0 z-50 bg-black/85 flex justify-end">
          <div className="w-full sm:w-96 h-full shadow-2xl animate-in slide-in-from-right duration-200">
            {renderSimulatorPanel(true)}
          </div>
        </div>
      )}
    </div>
  );
}
