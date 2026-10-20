import React, { useState, useEffect } from 'react';
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
  ChevronRight
} from 'lucide-react';
import { api } from '../services/api';

export default function BotStudioView() {
  const [flows, setFlows] = useState([]);
  const [activeFlow, setActiveFlow] = useState(null);
  const [loading, setLoading] = useState(true);

  // Live Simulator State
  const [simMessages, setSimMessages] = useState([]);
  const [simInput, setSimInput] = useState('');
  const [currentNodeId, setCurrentNodeId] = useState('start');
  const [isSimulating, setIsSimulating] = useState(false);

  const loadFlows = async () => {
    try {
      setLoading(true);
      const data = await api.getBotFlows();
      const list = data.results || data || [];
      setFlows(list);
      if (list.length > 0 && !activeFlow) {
        setActiveFlow(list[0]);
        setCurrentNodeId(list[0].nodes?.[0]?.id || 'start');
      }
    } catch (err) {
      console.error('Error fetching flows:', err);
    } finally {
      setLoading(false);
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

  const handleSimulateMessage = async (e) => {
    e.preventDefault();
    if (!simInput.trim() || !activeFlow) return;

    const userText = simInput.trim();
    setSimMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setSimInput('');
    setIsSimulating(true);

    try {
      const res = await api.testRunBotFlow(activeFlow.id, {
        message: userText,
        current_node_id: currentNodeId
      });

      if (res.response_text) {
        setSimMessages(prev => [...prev, { sender: 'bot', text: res.response_text, node: res.current_node?.type }]);
      }
      if (res.next_node_id) {
        setCurrentNodeId(res.next_node_id);
      }
    } catch (err) {
      setSimMessages(prev => [...prev, { sender: 'system', text: `Error: ${err.message}` }]);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleResetSimulator = () => {
    setSimMessages([]);
    setCurrentNodeId(activeFlow?.nodes?.[0]?.id || 'start');
    if (activeFlow?.nodes?.[0]?.content) {
      setSimMessages([
        { sender: 'bot', text: activeFlow.nodes[0].content, node: activeFlow.nodes[0].type }
      ]);
    }
  };

  useEffect(() => {
    if (activeFlow) {
      handleResetSimulator();
    }
  }, [activeFlow]);

  return (
    <div className="flex-1 flex h-full bg-[#0c1317] overflow-hidden text-gray-200">
      {/* 1. Left Flows Directory */}
      <div className="w-72 bg-[#111b21] border-r border-[#222e35] flex flex-col">
        <div className="p-4 border-b border-[#222e35] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-teal-400" />
            <span className="font-bold text-sm text-gray-100">Bot Studio Flows</span>
          </div>
          <span className="text-[10px] bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded border border-teal-500/20 font-mono">
            {flows.length} flows
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {flows.map(f => (
            <div
              key={f.id}
              onClick={() => setActiveFlow(f)}
              className={`p-3 rounded-xl cursor-pointer border transition-all ${
                activeFlow?.id === f.id
                  ? 'bg-[#202c33] border-teal-500/40 shadow-sm'
                  : 'bg-[#182229]/60 border-[#222e35] hover:bg-[#1a252d]'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-gray-100">{f.name}</h4>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Trigger: <span className="text-gray-300 font-mono">{f.trigger_type}</span>
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleFlow(f.id);
                  }}
                  className={`p-1.5 rounded-lg text-xs font-semibold transition ${
                    f.is_active 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-gray-700/30 text-gray-400 border border-gray-600/30'
                  }`}
                  title={f.is_active ? 'Active (Click to disable)' : 'Inactive (Click to activate)'}
                >
                  <Power className="w-3.5 h-3.5" />
                </button>
              </div>

              {f.trigger_keywords?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {f.trigger_keywords.map((kw, i) => (
                    <span key={i} className="text-[9px] bg-[#111b21] px-1.5 py-0.5 rounded text-gray-400 font-mono">
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 2. Center Visual Node Canvas */}
      <div className="flex-1 flex flex-col border-r border-[#222e35] bg-[#0f171c] overflow-hidden">
        {/* Canvas Toolbar */}
        <div className="h-14 px-6 border-b border-[#222e35] bg-[#111b21] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Layers className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-bold text-gray-100">{activeFlow?.name || 'No Flow Selected'}</span>
            {activeFlow?.is_active && (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-semibold border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Live in Production
              </span>
            )}
          </div>

          <div className="text-xs text-gray-400">
            {activeFlow?.nodes?.length || 0} Nodes &bull; {activeFlow?.edges?.length || 0} Connections
          </div>
        </div>

        {/* Node Graph Visualizer */}
        <div className="flex-1 overflow-auto p-8 bg-[radial-gradient(#202c33_1px,transparent_1px)] [background-size:16px_16px]">
          {activeFlow?.nodes?.length ? (
            <div className="max-w-2xl mx-auto space-y-6">
              {activeFlow.nodes.map((node, idx) => (
                <div key={node.id} className="relative group">
                  {/* Step Connector Line */}
                  {idx > 0 && (
                    <div className="w-0.5 h-6 bg-[#2a3942] mx-auto -mt-6 mb-0"></div>
                  )}

                  <div className={`p-4 rounded-xl border transition-all ${
                    currentNodeId === node.id
                      ? 'bg-[#182229] border-teal-500 shadow-lg shadow-teal-500/10'
                      : 'bg-[#111b21] border-[#222e35] hover:border-[#2a3942]'
                  }`}>
                    {/* Node Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-[#222e35]">
                      <div className="flex items-center gap-2">
                        {node.type === 'message' && <MessageSquare className="w-4 h-4 text-blue-400" />}
                        {node.type === 'menu' && <GitBranch className="w-4 h-4 text-amber-400" />}
                        {node.type === 'handoff' && <UserCheck className="w-4 h-4 text-rose-400" />}
                        <span className="text-xs font-bold text-gray-200 uppercase tracking-wider">{node.type} Node</span>
                      </div>
                      <span className="text-[10px] font-mono text-gray-400">id: {node.id}</span>
                    </div>

                    {/* Node Content */}
                    <div className="mt-3 text-xs text-gray-300 whitespace-pre-line leading-relaxed">
                      {node.content}
                    </div>

                    {/* Menu Options (if applicable) */}
                    {node.options && (
                      <div className="mt-3 pt-3 border-t border-[#222e35] space-y-1.5">
                        <span className="text-[10px] text-gray-400 uppercase font-semibold">User Choices:</span>
                        {node.options.map((opt, oIdx) => (
                          <div key={oIdx} className="flex items-center justify-between text-xs bg-[#182229] px-3 py-1.5 rounded-lg border border-[#2a3942]/60">
                            <span className="text-teal-300 font-medium">"{opt.label}" ({opt.value})</span>
                            <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                              &rarr; {opt.target_node_id}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 text-xs">
              Select or create a flow to visualize its state machine graph.
            </div>
          )}
        </div>
      </div>

      {/* 3. Right Live Flow Simulator */}
      <div className="w-80 bg-[#111b21] flex flex-col">
        {/* Simulator Header */}
        <div className="h-14 px-4 border-b border-[#222e35] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-gray-100">Live Flow Simulator</span>
          </div>
          <button
            onClick={handleResetSimulator}
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#202c33] rounded-lg transition"
            title="Reset simulation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Simulated Chat Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0c1317]">
          {simMessages.length === 0 ? (
            <div className="text-center text-gray-500 text-xs mt-10">
              <Bot className="w-8 h-8 mx-auto text-gray-600 mb-2" />
              Type a greeting like "hello" or "menu" below to simulate WhatsApp customer interaction.
            </div>
          ) : (
            simMessages.map((msg, i) => (
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
            ))
          )}
        </div>

        {/* Simulator Input Bar */}
        <form onSubmit={handleSimulateMessage} className="p-3 border-t border-[#222e35] bg-[#111b21] flex gap-2">
          <input
            type="text"
            placeholder="Type message to test bot..."
            value={simInput}
            onChange={(e) => setSimInput(e.target.value)}
            disabled={isSimulating}
            className="flex-1 bg-[#182229] border border-[#2a3942] rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-teal-500"
          />
          <button
            type="submit"
            disabled={isSimulating || !simInput.trim()}
            className="px-3 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 rounded-lg transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
