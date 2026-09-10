import React, { useEffect, useState } from 'react';
import { 
  Settings, 
  Play, 
  Square, 
  Server, 
  Brain, 
  Shield, 
  FileText,
  Sliders,
  HardDrive,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  RotateCcw,
  Sparkles,
  Key,
  Trash2,
  Cpu,
  Clock,
  Check,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  startDemo, 
  stopDemo, 
  getAuditLog, 
  getSystemSettings, 
  updateSystemSettings,
  getGeminiStatus,
  updateGeminiConfig,
  testGeminiConnection,
  toggleGemini,
  clearGeminiCredentials,
  getAIModels
} from '../services/api';

export default function SettingsPage({ systemMode, onRefresh }) {
  const [auditLog, setAuditLog] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [models, setModels] = useState([]);

  // System Settings state
  const [settings, setSettings] = useState({
    detection_conf: 0.25,
    loitering_seconds: 8.0,
    running_threshold: 0.02,
    anomaly_sensitivity: 0.75,
    alert_threshold: 60,
    evidence_retention_days: 30,
    gemini_model: 'gemini-2.0-flash',
    gemini_low_conf_threshold: 0.45,
    gemini_auto_trigger: true,
    cooldown_seconds: 15
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState(null);

  // Gemini state
  const [geminiStatus, setGeminiStatus] = useState({
    configured: false,
    model: 'gemini-2.0-flash',
    enabled: true,
    masked_key: null,
    status: 'UNCONFIGURED'
  });
  const [newKey, setNewKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash');
  const [customModel, setCustomModel] = useState('');
  const [testingGemini, setTestingGemini] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [savingGemini, setSavingGemini] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [cfg, gStatus, mList, aLog] = await Promise.all([
        getSystemSettings(),
        getGeminiStatus(),
        getAIModels(),
        getAuditLog()
      ]);
      if (cfg) {
        setSettings(cfg);
        setSelectedModel(cfg.gemini_model || 'gemini-2.0-flash');
      }
      if (gStatus) {
        setGeminiStatus(gStatus);
        if (gStatus.model) setSelectedModel(gStatus.model);
      }
      if (mList) setModels(mList);
      if (aLog) setAuditLog(aLog);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsFeedback(null);
    try {
      const updated = await updateSystemSettings({
        detection_conf: parseFloat(settings.detection_conf),
        loitering_seconds: parseFloat(settings.loitering_seconds),
        running_threshold: parseFloat(settings.running_threshold),
        anomaly_sensitivity: parseFloat(settings.anomaly_sensitivity),
        alert_threshold: parseInt(settings.alert_threshold),
        evidence_retention_days: parseInt(settings.evidence_retention_days),
        gemini_model: selectedModel === 'custom' ? customModel : selectedModel,
        gemini_low_conf_threshold: parseFloat(settings.gemini_low_conf_threshold),
        cooldown_seconds: parseInt(settings.cooldown_seconds)
      });
      setSettings(updated);
      setSettingsFeedback({ type: 'success', text: 'Operational parameters persisted and applied dynamically.' });
      setTimeout(() => setSettingsFeedback(null), 3000);
    } catch (err) {
      setSettingsFeedback({ type: 'error', text: 'Failed to update settings: ' + err.message });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveGeminiKey = async (e) => {
    e.preventDefault();
    if (!newKey && selectedModel === geminiStatus.model) return;
    setSavingGemini(true);
    try {
      const targetModel = selectedModel === 'custom' ? (customModel || 'gemini-2.0-flash') : selectedModel;
      const res = await updateGeminiConfig({
        api_key: newKey || undefined,
        model: targetModel,
        enabled: true
      });
      setGeminiStatus(res);
      setNewKey('');
      setTestResult({ success: true, message: 'Gemini configuration securely stored in vault.' });
      setTimeout(() => setTestResult(null), 4000);
    } catch (err) {
      alert("Failed to save Gemini configuration: " + err.message);
    } finally {
      setSavingGemini(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingGemini(true);
    setTestResult(null);
    try {
      const targetModel = selectedModel === 'custom' ? customModel : selectedModel;
      const res = await testGeminiConnection({
        api_key: newKey || undefined,
        model: targetModel || undefined
      });
      setTestResult(res);
    } catch (err) {
      setTestResult({ success: false, message: 'Connection test failed: ' + err.message });
    } finally {
      setTestingGemini(false);
    }
  };

  const handleToggleGemini = async () => {
    try {
      const res = await toggleGemini();
      setGeminiStatus(prev => ({
        ...prev,
        enabled: res.enabled,
        status: res.enabled ? (prev.configured ? 'READY' : 'UNCONFIGURED') : 'DISABLED'
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearKey = async () => {
    if (window.confirm("Remove Gemini API Key from secure vault? System will operate strictly in Local AI Perception mode.")) {
      await clearGeminiCredentials();
      loadAll();
    }
  };

  const handleDemoToggle = async () => {
    if (systemMode === 'demo') {
      if (window.confirm("Switch to Live Mode? Synthetic demo feeds and events will be halted.")) {
        await stopDemo();
        if (onRefresh) onRefresh();
      }
    } else {
      if (window.confirm("Launch Demo Mode? Automated border surveillance scenarios will be ingested.")) {
        await startDemo();
        if (onRefresh) onRefresh();
      }
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Settings Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Settings className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-100 tracking-tight font-mono">Platform Configuration & Intelligence</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
              SYSTEM v2.5 ENTERPRISE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Configuration-driven surveillance mission parameters. All adjustments persist in the kernel and hot-reload into active camera pipelines without restarting the application.
          </p>
        </div>

        {/* Demo Mode Toggle Button */}
        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={handleDemoToggle}
            className={`px-4 py-2 rounded text-xs font-semibold flex items-center space-x-2 transition border shadow-sm ${
              systemMode === 'demo'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {systemMode === 'demo' ? <Square className="w-3.5 h-3.5 fill-current text-amber-400" /> : <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />}
            <span>{systemMode === 'demo' ? 'Deactivate Demo Feeds' : 'Launch Simulation Mode'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 / 12): Gemini Intelligence & Platform Parameters */}
        <div className="lg:col-span-7 space-y-6">
          {/* SECTION 1: SECURE GEMINI ADVISORY INTELLIGENCE */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                  Gemini Assisted Analysis (Secondary Advisory Layer)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold border ${
                  geminiStatus.status === 'READY' 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                    : geminiStatus.status === 'DISABLED'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {geminiStatus.status}
                </span>
                <button
                  onClick={handleToggleGemini}
                  className={`text-[10px] font-mono px-2.5 py-0.5 rounded transition ${
                    geminiStatus.enabled 
                      ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {geminiStatus.enabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Google Gemini multimodal vision acts as an asynchronous secondary reasoning engine for low-confidence anomalies and operator consultations. Local AI perception remains the real-time primary loop.
            </p>

            {/* Key Status & Form */}
            <form onSubmit={handleSaveGeminiKey} className="space-y-3.5 bg-slate-950 p-4 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-slate-400">Vault Credential Status:</span>
                {geminiStatus.configured ? (
                  <span className="font-mono text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Masked: <code className="bg-slate-900 px-1.5 py-0.5 rounded">{geminiStatus.masked_key}</code>
                  </span>
                ) : (
                  <span className="font-mono text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> No API Key Configured (Local-Only)
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Update Gemini API Key:
                </label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    placeholder={geminiStatus.configured ? "Enter new key to rotate credentials..." : "Enter Google Generative AI API Key (AIzaSy...)"}
                    value={newKey}
                    onChange={e => setNewKey(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 pr-10 pl-3 py-2 rounded text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                  Keys are stored outside public database tables and never returned in plaintext.
                </span>
              </div>

              {/* Vision Model Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Vision Model Selection</label>
                  <select
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 px-3 py-1.5 rounded text-xs text-white focus:outline-none focus:border-sky-500 font-sans"
                  >
                    <option value="gemini-2.0-flash">gemini-2.0-flash (Recommended)</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                    <option value="custom">Custom Model Name...</option>
                  </select>
                </div>

                {selectedModel === 'custom' && (
                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Custom Model Identifier</label>
                    <input
                      type="text"
                      placeholder="e.g. gemini-2.5-flash"
                      value={customModel}
                      onChange={e => setCustomModel(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 px-3 py-1.5 rounded text-xs text-white font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingGemini}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium transition flex items-center gap-1.5 border border-slate-700"
                  >
                    <RefreshCw className={`w-3 h-3 ${testingGemini ? 'animate-spin' : ''}`} />
                    <span>{testingGemini ? 'Testing Latency...' : 'Test Connection'}</span>
                  </button>

                  {geminiStatus.configured && (
                    <button
                      type="button"
                      onClick={handleClearKey}
                      className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded text-xs font-medium transition flex items-center gap-1 border border-rose-500/30"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Purge Key</span>
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={savingGemini || (!newKey && selectedModel === geminiStatus.model)}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded text-xs font-semibold transition flex items-center gap-1.5 shadow"
                >
                  <Save className="w-3 h-3" />
                  <span>{savingGemini ? 'Updating...' : 'Save Credentials'}</span>
                </button>
              </div>

              {testResult && (
                <div className={`p-2.5 rounded text-xs font-mono flex items-center gap-2 ${
                  testResult.success 
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' 
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                }`}>
                  {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </form>
          </div>

          {/* SECTION 2: DYNAMIC PLATFORM SURVEILLANCE PARAMETERS */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                  Global Surveillance & Sensitivity Parameters
                </h3>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs font-mono">
              <div className="space-y-1.5">
                <div className="flex justify-between text-slate-300">
                  <span>Detection Confidence Threshold:</span>
                  <span className="text-emerald-400 font-bold">{Math.round(settings.detection_conf * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.80"
                  step="0.05"
                  value={settings.detection_conf}
                  onChange={e => setSettings({ ...settings, detection_conf: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500 h-1 bg-slate-800 rounded appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-slate-300">
                  <span>Loitering Dwell Trigger Duration:</span>
                  <span className="text-emerald-400 font-bold">{settings.loitering_seconds}s</span>
                </div>
                <input
                  type="range"
                  min="3.0"
                  max="30.0"
                  step="1.0"
                  value={settings.loitering_seconds}
                  onChange={e => setSettings({ ...settings, loitering_seconds: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500 h-1 bg-slate-800 rounded appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-slate-300">
                  <span>Global Incident Alert Threshold:</span>
                  <span className="text-amber-400 font-bold">{settings.alert_threshold} / 100</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="90"
                  step="5"
                  value={settings.alert_threshold}
                  onChange={e => setSettings({ ...settings, alert_threshold: parseInt(e.target.value) })}
                  className="w-full accent-amber-500 h-1 bg-slate-800 rounded appearance-none cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-slate-400 mb-1">Evidence Retention (Days)</label>
                  <input
                    type="number"
                    min="7"
                    max="365"
                    value={settings.evidence_retention_days}
                    onChange={e => setSettings({ ...settings, evidence_retention_days: parseInt(e.target.value) || 30 })}
                    className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Request Cooldown (Seconds)</label>
                  <input
                    type="number"
                    min="5"
                    max="60"
                    value={settings.cooldown_seconds}
                    onChange={e => setSettings({ ...settings, cooldown_seconds: parseInt(e.target.value) || 15 })}
                    className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                {settingsFeedback && (
                  <span className={`text-xs ${settingsFeedback.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {settingsFeedback.text}
                  </span>
                )}
                {!settingsFeedback && <span className="text-[10px] text-slate-500">Applies immediately to all feeds.</span>}

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-semibold transition flex items-center gap-1.5 shadow"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingSettings ? 'Saving...' : 'Save Configuration'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column (5 / 12): AI Model Truthfulness & Audit Trail */}
        <div className="lg:col-span-5 space-y-6">
          {/* SECTION 3: AI MODEL TRUTHFULNESS & REGISTRY */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                  AI Model Registry & Status
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-400 font-sans leading-relaxed">
              Model weight files verified directly against disk storage. No simulated detections are generated for missing models.
            </p>

            <div className="space-y-2.5">
              {models.map(m => (
                <div key={m.name} className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-bold text-slate-200">{m.name}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold border ${
                      m.status === 'READY' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}>
                      {m.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans">{m.description}</p>
                  {m.filename && (
                    <span className="font-mono text-[10px] text-slate-500 mt-1 block">
                      Target file: models/{m.filename}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 4: AUDIT LOG */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                  System Audit Trail
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500">LIVE EVENTS</span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto font-mono text-xs">
              {auditLog.slice(0, 8).map(log => (
                <div key={log.id} className="p-2.5 bg-slate-950 rounded border border-slate-800/80">
                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                    <span className="font-semibold text-emerald-400">{log.action}</span>
                    <span>{new Date(log.timestamp * 1000).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-slate-300 text-[11px] mt-1 font-sans">{log.details || log.entity_type}</div>
                </div>
              ))}
              {auditLog.length === 0 && (
                <div className="text-center text-slate-500 py-6 text-xs font-mono">
                  Audit trail records logged on action events.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
