import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Key, 
  Phone, 
  Shield, 
  Webhook, 
  Copy, 
  Check, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Play, 
  Globe, 
  Lock, 
  Info,
  Server,
  Sparkles,
  Save,
  Radio
} from 'lucide-react';
import { api } from '../services/api';

export default function SettingsView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  // Form State
  const [form, setForm] = useState({
    whatsapp_phone_number_id: '',
    whatsapp_business_account_id: '',
    whatsapp_api_token: '',
    whatsapp_verify_token: 'openmausbot_crm_verify_token_secure',
    whatsapp_app_secret: '',
    whatsapp_simulate_outbound: true,
    webhook_callback_url: ''
  });

  // Simulator State
  const [simPhone, setSimPhone] = useState('+14155552671');
  const [simName, setSimName] = useState('Alex Rivera');
  const [simText, setSimText] = useState('Hi, I need help with my enterprise order');
  const [simLoading, setSimLoading] = useState(false);
  const [simSuccess, setSimSuccess] = useState(false);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await api.getMetaSettings();
      setForm({
        whatsapp_phone_number_id: data.whatsapp_phone_number_id || '',
        whatsapp_business_account_id: data.whatsapp_business_account_id || '',
        whatsapp_api_token: data.masked_api_token || '',
        whatsapp_verify_token: data.whatsapp_verify_token || 'openmausbot_crm_verify_token_secure',
        whatsapp_app_secret: data.masked_app_secret || '',
        whatsapp_simulate_outbound: data.whatsapp_simulate_outbound ?? true,
        webhook_callback_url: data.webhook_callback_url || `${window.location.protocol}//${window.location.hostname}:8000/api/webhooks/whatsapp/`
      });
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleCopy = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setStatusMessage(null);
      const res = await api.updateMetaSettings(form);
      setStatusMessage({ type: 'success', text: 'Settings successfully saved to backend environment!' });
      // Update form with updated values
      setForm(prev => ({
        ...prev,
        whatsapp_api_token: res.masked_api_token || prev.whatsapp_api_token,
        whatsapp_app_secret: res.masked_app_secret || prev.whatsapp_app_secret,
        whatsapp_phone_number_id: res.whatsapp_phone_number_id,
        whatsapp_business_account_id: res.whatsapp_business_account_id,
        whatsapp_verify_token: res.whatsapp_verify_token,
        whatsapp_simulate_outbound: res.whatsapp_simulate_outbound
      }));
    } catch (err) {
      setStatusMessage({ type: 'error', text: `Failed to save settings: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      const res = await api.testMetaConnection({
        whatsapp_phone_number_id: form.whatsapp_phone_number_id,
        whatsapp_api_token: form.whatsapp_api_token
      });
      setTestResult({
        success: true,
        verifiedName: res.verified_name || 'Verified Business',
        displayPhone: res.display_phone_number || form.whatsapp_phone_number_id,
        qualityRating: res.quality_rating || 'GREEN',
        id: res.id
      });
    } catch (err) {
      setTestResult({
        success: false,
        error: err.message
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSimulateWebhook = async (e) => {
    e.preventDefault();
    try {
      setSimLoading(true);
      setSimSuccess(false);
      await api.simulateIncomingWebhook(simPhone, simName, simText);
      setSimSuccess(true);
      setTimeout(() => setSimSuccess(false), 4000);
    } catch (err) {
      alert(`Simulation failed: ${err.message}`);
    } finally {
      setSimLoading(false);
    }
  };

  // Derive suggested public webhook URL based on current host
  const defaultCallbackUrl = `${window.location.protocol}//${window.location.hostname}:8000/api/webhooks/whatsapp/`;
  const currentCallbackUrl = form.webhook_callback_url || defaultCallbackUrl;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0c1317] overflow-y-auto text-gray-200">
      {/* Top Header */}
      <div className="p-4 sm:h-16 sm:px-6 border-b border-[#222e35] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#111b21] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-gray-100 flex items-center gap-2">
              Meta WhatsApp API & Webhook Settings
            </h1>
            <p className="text-[11px] sm:text-xs text-gray-400">
              Configure your real Meta Cloud API credentials, phone number, and webhook callback URL
            </p>
          </div>
        </div>

        <button
          onClick={loadSettings}
          className="p-2 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-[#202c33] transition self-end sm:self-auto"
          title="Reload Settings"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main Settings Container */}
      <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto w-full">
        {statusMessage && (
          <div className={`p-4 rounded-xl text-xs flex items-center gap-2 border ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {statusMessage.text}
          </div>
        )}

        {/* 1. Meta Webhook Setup Card (Directly answers "where is the api webhook page") */}
        <div className="bg-[#111b21] border border-[#222e35] rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-[#222e35] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Webhook className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                  Meta WhatsApp Webhook Configuration
                </h2>
                <p className="text-xs text-gray-400">
                  Provide these credentials in your Meta for Developers Portal to receive live WhatsApp messages
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Webhook Endpoint Active
            </span>
          </div>

          <div className="p-5 space-y-4">
            {/* Callback URL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  Webhook Callback URL (Meta Developers Portal)
                </label>
                <span className="text-[10px] text-gray-400">Method: POST & GET</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={currentCallbackUrl}
                  className="w-full bg-[#182229] border border-[#2a3942] rounded-xl px-3.5 py-2.5 text-xs font-mono text-teal-300 focus:outline-none select-all"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(currentCallbackUrl, 'callback')}
                  className="px-3.5 py-2.5 bg-[#202c33] hover:bg-[#2a3942] text-gray-200 text-xs font-semibold rounded-xl border border-[#2a3942] transition flex items-center gap-1.5 shrink-0"
                >
                  {copiedField === 'callback' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">
                * Note: Meta requires an <strong>HTTPS</strong> URL. If running locally or on a VPS without SSL, route via a reverse proxy, Cloudflare Tunnel, or Tailscale Funnel.
              </p>
            </div>

            {/* Verify Token */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  Verify Token (hub.verify_token)
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={form.whatsapp_verify_token}
                  onChange={(e) => setForm({ ...form, whatsapp_verify_token: e.target.value })}
                  placeholder="openmausbot_crm_verify_token_secure"
                  className="w-full bg-[#182229] border border-[#2a3942] rounded-xl px-3.5 py-2.5 text-xs font-mono text-gray-100 focus:outline-none focus:border-teal-500"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(form.whatsapp_verify_token, 'verify_token')}
                  className="px-3.5 py-2.5 bg-[#202c33] hover:bg-[#2a3942] text-gray-200 text-xs font-semibold rounded-xl border border-[#2a3942] transition flex items-center gap-1.5 shrink-0"
                >
                  {copiedField === 'verify_token' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Required Webhook Fields */}
            <div className="p-3.5 bg-[#182229] rounded-xl border border-[#2a3942]">
              <span className="text-[11px] font-bold text-gray-200 block mb-1">
                Required Subscribed Webhook Fields in Meta Dashboard:
              </span>
              <div className="flex flex-wrap gap-2 mt-1.5">
                <span className="text-[11px] bg-teal-500/10 text-teal-300 border border-teal-500/30 px-2.5 py-1 rounded-lg font-mono">
                  messages (Required for inbound chats)
                </span>
                <span className="text-[11px] bg-blue-500/10 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-lg font-mono">
                  message_deliveries (Status: DELIVERED)
                </span>
                <span className="text-[11px] bg-purple-500/10 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-lg font-mono">
                  message_reads (Blue ticks: READ)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Connect Actual Meta WhatsApp Number & Credentials Form */}
        <form onSubmit={handleSave} className="bg-[#111b21] border border-[#222e35] rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-[#222e35] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                  Connect Your Actual Meta Phone Number & Credentials
                </h2>
                <p className="text-xs text-gray-400">
                  Obtain these from your Meta Developer Dashboard &rarr; WhatsApp &rarr; API Setup
                </p>
              </div>
            </div>

            <a
              href="https://developers.facebook.com/apps/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 font-semibold transition"
            >
              Meta Portal <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="p-5 space-y-4">
            {/* Phone Number ID & WABA ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Meta Phone Number ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 104829104928102"
                  value={form.whatsapp_phone_number_id}
                  onChange={(e) => setForm({ ...form, whatsapp_phone_number_id: e.target.value })}
                  className="w-full bg-[#182229] border border-[#2a3942] rounded-xl px-3.5 py-2 text-xs font-mono text-gray-100 focus:outline-none focus:border-teal-500"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  From: WhatsApp &rarr; API Setup &rarr; Step 1: Phone number ID
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  WhatsApp Business Account ID (WABA ID)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 102938475610293"
                  value={form.whatsapp_business_account_id}
                  onChange={(e) => setForm({ ...form, whatsapp_business_account_id: e.target.value })}
                  className="w-full bg-[#182229] border border-[#2a3942] rounded-xl px-3.5 py-2 text-xs font-mono text-gray-100 focus:outline-none focus:border-teal-500"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  From: WhatsApp &rarr; API Setup &rarr; WhatsApp Business Account ID
                </span>
              </div>
            </div>

            {/* Permanent Access Token */}
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">
                Permanent Access Token (System User Token) *
              </label>
              <input
                type="password"
                placeholder="EAAG... (Paste permanent System User access token)"
                value={form.whatsapp_api_token}
                onChange={(e) => setForm({ ...form, whatsapp_api_token: e.target.value })}
                className="w-full bg-[#182229] border border-[#2a3942] rounded-xl px-3.5 py-2 text-xs font-mono text-gray-100 focus:outline-none focus:border-teal-500"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">
                Generate in Business Manager &rarr; System Users with <code>whatsapp_business_messaging</code> & <code>whatsapp_business_management</code> scopes.
              </span>
            </div>

            {/* App Secret */}
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">
                Meta App Secret (for X-Hub-Signature-256 Webhook Security)
              </label>
              <input
                type="password"
                placeholder="Paste App Secret from App Settings &rarr; Basic"
                value={form.whatsapp_app_secret}
                onChange={(e) => setForm({ ...form, whatsapp_app_secret: e.target.value })}
                className="w-full bg-[#182229] border border-[#2a3942] rounded-xl px-3.5 py-2 text-xs font-mono text-gray-100 focus:outline-none focus:border-teal-500"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">
                Used to cryptographically verify HMAC-SHA256 signatures on incoming Meta Webhooks.
              </span>
            </div>

            {/* Mode: Live Outbound vs Local Simulation */}
            <div className="p-4 bg-[#182229] rounded-xl border border-[#2a3942] space-y-3">
              <span className="text-xs font-bold text-gray-200 block">
                Outbound Message Dispatch Mode:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  form.whatsapp_simulate_outbound
                    ? 'bg-teal-500/10 border-teal-500/40 text-teal-200'
                    : 'bg-[#111b21] border-[#222e35] text-gray-400 hover:border-gray-600'
                }`}>
                  <input
                    type="radio"
                    name="dispatchMode"
                    checked={form.whatsapp_simulate_outbound}
                    onChange={() => setForm({ ...form, whatsapp_simulate_outbound: true })}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-bold text-xs block text-gray-100">Local Simulation Mode (Free)</span>
                    <span className="text-[11px] text-gray-400 mt-0.5 block">
                      Simulates outbound message delivery instantly inside the CRM without consuming Meta Cloud API tier quotas.
                    </span>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  !form.whatsapp_simulate_outbound
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                    : 'bg-[#111b21] border-[#222e35] text-gray-400 hover:border-gray-600'
                }`}>
                  <input
                    type="radio"
                    name="dispatchMode"
                    checked={!form.whatsapp_simulate_outbound}
                    onChange={() => setForm({ ...form, whatsapp_simulate_outbound: false })}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-bold text-xs block text-gray-100">Live Meta Cloud API Mode</span>
                    <span className="text-[11px] text-gray-400 mt-0.5 block">
                      Dispatches live WhatsApp messages directly through Meta Graph API to real handset phone numbers.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Test Connection Result Box */}
            {testResult && (
              <div className={`p-4 rounded-xl text-xs border ${
                testResult.success 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                {testResult.success ? (
                  <div>
                    <div className="font-bold flex items-center gap-1.5 mb-1 text-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Meta API Connection Verified!
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 font-mono text-[11px]">
                      <div>Verified Name: <strong className="text-white">{testResult.verifiedName}</strong></div>
                      <div>Display Phone: <strong className="text-white">{testResult.displayPhone}</strong></div>
                      <div>Quality Rating: <strong className="text-emerald-400">{testResult.qualityRating}</strong></div>
                      <div>Phone ID: <strong className="text-white">{testResult.id}</strong></div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="font-bold flex items-center gap-1.5 mb-1 text-rose-200">
                      <AlertCircle className="w-4 h-4 text-rose-400" /> Meta API Connection Failed
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-rose-300">{testResult.error}</p>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing || !form.whatsapp_phone_number_id}
                className="w-full sm:w-auto px-4 py-2.5 bg-[#202c33] hover:bg-[#2a3942] disabled:opacity-50 text-gray-200 text-xs font-semibold rounded-xl border border-[#2a3942] transition flex items-center justify-center gap-2"
              >
                {testing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying with Meta...
                  </>
                ) : (
                  <>
                    <Radio className="w-3.5 h-3.5 text-teal-400" /> Test Meta Connection
                  </>
                )}
              </button>

              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-6 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Meta Configuration'}
              </button>
            </div>
          </div>
        </form>

        {/* 3. In-App Webhook Simulator & Pipeline Diagnostics */}
        <div className="bg-[#111b21] border border-[#222e35] rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-[#222e35] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                  Live Inbound Webhook Simulator
                </h2>
                <p className="text-xs text-gray-400">
                  Simulate an incoming WhatsApp customer message to test your webhooks, Bot Studio, and inbox instantly
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSimulateWebhook} className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Customer Phone Number
                </label>
                <input
                  type="text"
                  required
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  className="w-full bg-[#182229] border border-[#2a3942] rounded-xl px-3.5 py-2 text-xs font-mono text-gray-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Sender Name
                </label>
                <input
                  type="text"
                  required
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                  className="w-full bg-[#182229] border border-[#2a3942] rounded-xl px-3.5 py-2 text-xs text-gray-100 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">
                Inbound Message Content
              </label>
              <textarea
                rows="2"
                required
                value={simText}
                onChange={(e) => setSimText(e.target.value)}
                className="w-full bg-[#182229] border border-[#2a3942] rounded-xl p-3 text-xs text-gray-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            {simSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Simulated webhook dispatched and ingested! Check the <strong>Chats</strong> tab to see the incoming message.
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={simLoading}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                {simLoading ? 'Simulating...' : 'Dispatch Inbound Webhook'}
              </button>
            </div>
          </form>
        </div>

        {/* 4. Step-by-Step Meta Connection Guide */}
        <div className="bg-[#111b21] border border-[#222e35] rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
            <Info className="w-4 h-4 text-teal-400" />
            Quick 4-Step Meta Onboarding Checklist
          </h3>
          <ol className="text-xs text-gray-300 space-y-2 list-decimal list-inside leading-relaxed">
            <li>
              Log into <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-teal-400 hover:underline">developers.facebook.com</a> and choose your Meta Business App with WhatsApp product enabled.
            </li>
            <li>
              In <strong>WhatsApp &rarr; Configuration &rarr; Webhook</strong>, click <strong>Edit</strong>. Paste your <strong>Callback URL</strong> and <strong>Verify Token</strong> from above, then click <strong>Verify and save</strong>.
            </li>
            <li>
              Under <strong>Webhook fields</strong>, click <strong>Manage</strong> and toggle subscription on for <code>messages</code>, <code>message_deliveries</code>, and <code>message_reads</code>.
            </li>
            <li>
              In <strong>Meta Business Manager &rarr; System Users</strong>, generate a <strong>Permanent Access Token</strong> with <code>whatsapp_business_messaging</code> scope. Copy that token and paste it into the <strong>Permanent Access Token</strong> field above, then click <strong>Save Meta Configuration</strong>.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
