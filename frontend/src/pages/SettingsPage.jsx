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
  EyeOff, 
  Sun, 
  Moon, 
  Monitor, 
  Palette,
  Download,
  Upload,
  AlertOctagon,
  Terminal,
  ShieldAlert,
  Database,
  Activity
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
  getAIModels,
  getSystemReadiness,
  exportConfiguration,
  importConfiguration,
  getConfigHistory,
  resetToClean,
  initializeSystem
} from '../services/api';
import PrivilegedActionModal from '../components/PrivilegedActionModal';

export default function SettingsPage({ systemMode, onRefresh }) {
  const [activeTab, setActiveTab] = useState('readiness'); // 'readiness', 'surveillance', 'backup', 'audit'
  const [auditLog, setAuditLog] = useState([]);
  const [configHistory, setConfigHistory] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [models, setModels] = useState([]);
  const [privilegedModal, setPrivilegedModal] = useState(null);

  // System Readiness state
  const [readiness, setReadiness] = useState(null);
  const [loadingReadiness, setLoadingReadiness] = useState(false);

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

  // Theme state
  const [theme, setTheme] = useState(() => localStorage.getItem('ibvap_theme') || 'glass');

  // Backup & Import state
  const [importJsonText, setImportJsonText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState(null);

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('ibvap_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    loadReadiness();
    try {
      const [cfg, gStatus, mList, aLog, cHist] = await Promise.all([
        getSystemSettings().catch(() => null),
        getGeminiStatus().catch(() => null),
        getAIModels().catch(() => []),
        getAuditLog().catch(() => []),
        getConfigHistory().catch(() => [])
      ]);
      if (cfg && !cfg.detail) {
        setSettings(prev => ({ ...prev, ...cfg }));
        if (cfg.gemini_model) setSelectedModel(cfg.gemini_model);
      }
      if (gStatus && !gStatus.detail) {
        setGeminiStatus(gStatus);
        if (gStatus.model) setSelectedModel(gStatus.model);
      }
      if (Array.isArray(mList)) setModels(mList);
      if (Array.isArray(aLog)) setAuditLog(aLog);
      if (Array.isArray(cHist)) setConfigHistory(cHist);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  const loadReadiness = async () => {
    setLoadingReadiness(true);
    try {
      const res = await getSystemReadiness();
      setReadiness(res);
    } catch (err) {
      console.error("Readiness check error:", err);
    } finally {
      setLoadingReadiness(false);
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
      loadAll();
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
      loadReadiness();
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
      loadReadiness();
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearKey = () => {
    setPrivilegedModal({
      actionName: "Purge Gemini Cloud AI Credentials",
      description: "Purging vault credentials removes cloud secondary reasoning. System will operate exclusively in local edge AI perception mode.",
      entityType: "SECURITY",
      entityId: "GEMINI_CREDENTIALS",
      onConfirm: async () => {
        await clearGeminiCredentials();
        loadAll();
      }
    });
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

  const handleExportConfig = async () => {
    try {
      const cfg = await exportConfiguration();
      const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ibvap_config_export_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to export configuration: " + err.message);
    }
  };

  const handleImportFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setImportJsonText(event.target.result);
    };
    reader.readAsText(file);
  };

  const handleTriggerImport = () => {
    if (!importJsonText.trim()) {
      alert("Please select a valid configuration JSON file or paste JSON content.");
      return;
    }
    let parsed = null;
    try {
      parsed = JSON.parse(importJsonText);
    } catch (e) {
      alert("Invalid JSON format: " + e.message);
      return;
    }

    setPrivilegedModal({
      actionName: "Restore Platform Configuration",
      description: "Importing external configuration will restore operational parameters and sectors. An automated SQLite snapshot backup will be created prior to applying changes.",
      entityType: "CONFIG_IMPORT",
      entityId: "SYSTEM_CONFIG",
      onConfirm: async () => {
        setImporting(true);
        setImportMessage(null);
        try {
          const res = await importConfiguration(parsed);
          setImportMessage({ type: 'success', text: `Configuration successfully imported: ${res.applied_count || 0} parameters restored. Backup saved: ${res.backup_path || 'OK'}` });
          loadAll();
          if (onRefresh) onRefresh();
        } catch (err) {
          setImportMessage({ type: 'error', text: 'Import failed: ' + err.message });
        } finally {
          setImporting(false);
        }
      }
    });
  };

  const handleResetToClean = () => {
    setPrivilegedModal({
      actionName: "Reset Platform to Clean Operational State",
      description: "DANGER: This action halts all active video pipelines, decommissions active cameras, and wipes operational zones, sectors, vehicles, and personnel records. An automated database backup will be created first.",
      entityType: "SYSTEM_FACTORY_RESET",
      entityId: "IBVAP_CORE",
      onConfirm: async (auth) => {
        try {
          const res = await resetToClean({
            passcode: auth.passcode,
            justification: auth.justification,
            officer_name: auth.officer_name || 'Senior Watch Officer'
          });
          alert(`System reset complete. Pre-reset backup stored at:\n${res.backup_file}\n\nThe system is now in clean uninitialized state.`);
          window.location.reload();
        } catch (err) {
          alert("Clean reset failed: " + err.message);
        }
      }
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Settings Header */}
      <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Settings className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-100 tracking-tight font-mono">Platform Configuration & Intelligence</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
              SYSTEM v2.5 ENTERPRISE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Clean deployment architecture, hardware readiness diagnostics, cryptographic integrity, and live hot-reloading surveillance parameters.
          </p>
        </div>

        {/* Demo Mode Toggle Button */}
        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={handleDemoToggle}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition border shadow-sm ${
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

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('readiness')}
          className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold flex items-center space-x-2 transition ${
            activeTab === 'readiness'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Deployment Readiness Diagnostic</span>
          {readiness && (
            <span className={`px-1.5 py-0.2 rounded text-[10px] ml-1 font-bold ${
              readiness.overall === 'SYSTEM READY' 
                ? 'bg-emerald-500/20 text-emerald-300' 
                : readiness.overall === 'INITIALIZATION REQUIRED'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-rose-500/20 text-rose-300'
            }`}>
              {readiness.overall}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('surveillance')}
          className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold flex items-center space-x-2 transition ${
            activeTab === 'surveillance'
              ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Surveillance & AI Parameters</span>
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold flex items-center space-x-2 transition ${
            activeTab === 'backup'
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          <span>Backup, Clean Reset & Appearance</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold flex items-center space-x-2 transition ${
            activeTab === 'audit'
              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30 shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Audit Trail & Config History</span>
        </button>
      </div>

      {/* TAB 1: DEPLOYMENT READINESS DIAGNOSTIC */}
      {activeTab === 'readiness' && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center space-x-3">
                  <h3 className="text-base font-mono font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2">
                    <ShieldCheckIcon className="w-5 h-5 text-emerald-400" />
                    Subsystem Deployment Readiness Assessment
                  </h3>
                  {readiness && (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold tracking-wide border ${
                      readiness.overall === 'SYSTEM READY'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : readiness.overall === 'INITIALIZATION REQUIRED'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    }`}>
                      {readiness.overall}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  10-point hardware and software architectural integrity verification for SIH26187 defence evaluation standards.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadReadiness}
                  disabled={loadingReadiness}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono font-medium transition flex items-center gap-2 border border-slate-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingReadiness ? 'animate-spin' : ''}`} />
                  <span>{loadingReadiness ? 'Evaluating...' : 'Run Diagnostics'}</span>
                </button>
              </div>
            </div>

            {/* Subsystem Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {readiness?.subsystems && (Array.isArray(readiness.subsystems) ? readiness.subsystems : Object.values(readiness.subsystems)).map((item, idx) => {
                const isReady = item.status === 'READY' || item.status === 'ONLINE' || item.status === 'OPERATIONAL' || item.status === 'SECURE';
                const isWarning = item.status === 'INITIALIZATION REQUIRED' || item.status === 'UNCONFIGURED' || item.status === 'UNCONFIGURED (LOCAL ONLY)' || item.status === 'NO CAMERAS CONFIGURED';
                return (
                  <div key={item.name || idx} className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 flex flex-col justify-between space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className={`w-2.5 h-2.5 rounded-full ${
                          isReady ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' :
                          isWarning ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]' :
                          'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                        }`} />
                        <span className="font-mono text-xs font-bold text-slate-200">{item.name}</span>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                        isReady ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                        isWarning ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                        'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                      {item.detail || item.details}
                    </p>
                  </div>
                );
              })}
            </div>

            {(!readiness || loadingReadiness) && (
              <div className="text-center py-10 text-slate-500 text-xs font-mono">
                Running subsystem readiness sweep...
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SURVEILLANCE & AI PARAMETERS */}
      {activeTab === 'surveillance' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (7 / 12): Gemini Intelligence & Platform Parameters */}
          <div className="lg:col-span-7 space-y-6">
            {/* SECTION 1: SECURE GEMINI ADVISORY INTELLIGENCE */}
            <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                    Gemini Multimodal Advisory Layer
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
                Google Gemini multimodal vision acts as an asynchronous secondary reasoning engine for low-confidence anomalies and operator consultations. Local edge AI (YOLO + ByteTrack) remains the real-time deterministic primary loop.
              </p>

              {/* Key Status & Form */}
              <form onSubmit={handleSaveGeminiKey} className="space-y-3.5 bg-slate-950/70 p-4 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-400">Vault Credential Status:</span>
                  {geminiStatus.configured ? (
                    <span className="font-mono text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Masked: <code className="bg-slate-900 px-1.5 py-0.5 rounded">{geminiStatus.masked_key}</code>
                    </span>
                  ) : (
                    <span className="font-mono text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> No API Key Configured (Edge-Only Mode)
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
                    Keys are stored securely in local vault configuration and never returned in plaintext.
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
            <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                    Surveillance & Sensitivity Thresholds
                  </h3>
                </div>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-4 text-xs font-mono">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-slate-300">
                    <span>Detection Confidence Threshold:</span>
                    <span className="text-emerald-400 font-bold">{Math.round(((settings?.detection_conf) ?? 0.25) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="0.80"
                    step="0.05"
                    value={settings?.detection_conf ?? 0.25}
                    onChange={e => setSettings({ ...settings, detection_conf: parseFloat(e.target.value) })}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded appearance-none cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-slate-300">
                    <span>Loitering Dwell Trigger Duration:</span>
                    <span className="text-emerald-400 font-bold">{settings?.loitering_seconds ?? 8.0}s</span>
                  </div>
                  <input
                    type="range"
                    min="3.0"
                    max="30.0"
                    step="1.0"
                    value={settings?.loitering_seconds ?? 8.0}
                    onChange={e => setSettings({ ...settings, loitering_seconds: parseFloat(e.target.value) })}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded appearance-none cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-slate-300">
                    <span>Global Incident Alert Threshold:</span>
                    <span className="text-amber-400 font-bold">{settings?.alert_threshold ?? 60} / 100</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="90"
                    step="5"
                    value={settings?.alert_threshold ?? 60}
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
                      value={settings?.evidence_retention_days ?? 30}
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
                      value={settings?.cooldown_seconds ?? 15}
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
                  {!settingsFeedback && <span className="text-[10px] text-slate-500">Persists in SQLite and applies across all feeds immediately.</span>}

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

          {/* Right Column (5 / 12): AI Model Registry */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                    AI Model Weight Verification
                  </h3>
                </div>
              </div>

              <p className="text-xs text-slate-400 font-sans leading-relaxed">
                Model weight files verified directly against local disk storage. Missing weights report honestly and never trigger simulated detections.
              </p>

              <div className="space-y-2.5">
                {(Array.isArray(models) ? models : []).map(m => (
                  <div key={m.name || Math.random()} className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 text-xs">
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
          </div>
        </div>
      )}

      {/* TAB 3: BACKUP, CLEAN RESET & APPEARANCE */}
      {activeTab === 'backup' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (7 / 12): Backup & Restore */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                    Platform Configuration Backup & Export
                  </h3>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Export current platform parameters, operational sectors, and non-sensitive configurations as a clean, standardized JSON document for disaster recovery or multi-site replication.
              </p>
              <button
                onClick={handleExportConfig}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-semibold transition flex items-center gap-2 shadow"
              >
                <Download className="w-4 h-4" />
                <span>Export Configuration (JSON)</span>
              </button>
            </div>

            <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Upload className="w-4 h-4 text-sky-400" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                    Configuration Restore & Import
                  </h3>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Restore platform configuration from a previously exported backup file. An automated SQLite snapshot is created prior to restoring. Requires supervisor authentication.
              </p>

              <div className="space-y-3">
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFileSelect}
                  className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                />

                <textarea
                  placeholder="Or paste configuration JSON content here..."
                  value={importJsonText}
                  onChange={e => setImportJsonText(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                />

                <div className="flex items-center justify-between">
                  <button
                    onClick={handleTriggerImport}
                    disabled={importing || !importJsonText.trim()}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg text-xs font-mono font-semibold transition flex items-center gap-2 shadow"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{importing ? 'Restoring...' : 'Authenticate & Restore Configuration'}</span>
                  </button>
                </div>

                {importMessage && (
                  <div className={`p-3 rounded-lg text-xs font-mono flex items-center gap-2 ${
                    importMessage.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                  }`}>
                    {importMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                    <span>{importMessage.text}</span>
                  </div>
                )}
              </div>
            </div>

            {/* DANGER ZONE: RESET TO CLEAN OPERATIONAL STATE */}
            <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center space-x-2">
                <AlertOctagon className="w-5 h-5 text-rose-400" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-rose-300">
                  Danger Zone: Clean Operational State Reset
                </h3>
              </div>
              <p className="text-xs text-rose-300/80 leading-relaxed font-sans">
                Permanently decommissions all active cameras, halts running ingestion pipelines, clears operational zones and sectors, and returns the platform to the initial zero-preloaded-data state.
                <strong> Automated SQLite snapshot backup will be created in the database folder before proceeding.</strong>
              </p>
              <button
                onClick={handleResetToClean}
                className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-200 rounded-lg text-xs font-mono font-semibold transition flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Privileged Reset to Clean State</span>
              </button>
            </div>
          </div>

          {/* Right Column (5 / 12): Theme & Visual Customization */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Palette className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                    Operations Console Theme
                  </h3>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => handleThemeChange('glass')}
                  className={`p-3 rounded-lg border text-center transition flex flex-col items-center gap-1.5 ${
                    theme === 'glass' 
                      ? 'bg-slate-800 border-cyan-500 text-cyan-300 font-bold shadow' 
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Glass Command</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`p-3 rounded-lg border text-center transition flex flex-col items-center gap-1.5 ${
                    theme === 'dark' 
                      ? 'bg-slate-800 border-cyan-500 text-cyan-300 font-bold shadow' 
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Moon className="w-4 h-4" />
                  <span>Tactical Dark</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`p-3 rounded-lg border text-center transition flex flex-col items-center gap-1.5 ${
                    theme === 'light' 
                      ? 'bg-slate-800 border-cyan-500 text-cyan-300 font-bold shadow' 
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sun className="w-4 h-4" />
                  <span>Clean Light</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleThemeChange('system')}
                  className={`p-3 rounded-lg border text-center transition flex flex-col items-center gap-1.5 ${
                    theme === 'system' 
                      ? 'bg-slate-800 border-cyan-500 text-cyan-300 font-bold shadow' 
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                  <span>System</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 font-sans">
                True glassmorphism with ambient blurred light diffusion. Surveillance feeds and evidence imagery remain strictly blur-free (`filter: none !important`).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT TRAIL & CONFIG HISTORY */}
      {activeTab === 'audit' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (6 / 12): System Audit Log */}
          <div className="lg:col-span-6 space-y-4 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                  Platform Action Audit Log
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500">IMMUTABLE ARCHIVE</span>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto font-mono text-xs">
              {(Array.isArray(auditLog) ? auditLog : []).slice(0, 30).map(log => (
                <div key={log.id || Math.random()} className="p-2.5 bg-slate-950/70 rounded-lg border border-slate-800/80">
                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                    <span className="font-semibold text-emerald-400">{log.action}</span>
                    <span>{log.timestamp ? new Date(log.timestamp * 1000).toLocaleString() : 'Recent'}</span>
                  </div>
                  <div className="text-slate-300 text-[11px] mt-1 font-sans">{log.details || log.entity_type}</div>
                  {log.officer_name && (
                    <div className="text-[10px] text-slate-500 mt-1">Officer: {log.officer_name}</div>
                  )}
                </div>
              ))}
              {(!Array.isArray(auditLog) || auditLog.length === 0) && (
                <div className="text-center text-slate-500 py-6 text-xs font-mono">
                  Audit trail records logged on operational action events.
                </div>
              )}
            </div>
          </div>

          {/* Right Column (6 / 12): Configuration & Maintenance History */}
          <div className="lg:col-span-6 space-y-4 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                  Configuration & Maintenance History
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-500">VERSIONED EVENTS</span>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto font-mono text-xs">
              {(Array.isArray(configHistory) ? configHistory : []).slice(0, 30).map(item => (
                <div key={item.id || Math.random()} className="p-2.5 bg-slate-950/70 rounded-lg border border-slate-800/80">
                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                    <span className="font-semibold text-purple-400">{item.action}</span>
                    <span>{item.timestamp ? new Date(item.timestamp * 1000).toLocaleString() : 'Recent'}</span>
                  </div>
                  <div className="text-slate-300 text-[11px] mt-1 font-sans">{item.details}</div>
                  {item.officer && (
                    <div className="text-[10px] text-slate-500 mt-1">Officer: {item.officer}</div>
                  )}
                </div>
              ))}
              {(!Array.isArray(configHistory) || configHistory.length === 0) && (
                <div className="text-center text-slate-500 py-6 text-xs font-mono">
                  No configuration modifications recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Privileged Action Modal */}
      {privilegedModal && (
        <PrivilegedActionModal
          isOpen={true}
          actionName={privilegedModal.actionName}
          description={privilegedModal.description}
          entityType={privilegedModal.entityType}
          entityId={privilegedModal.entityId}
          onConfirm={privilegedModal.onConfirm}
          onClose={() => setPrivilegedModal(null)}
        />
      )}
    </div>
  );
}

function ShieldCheckIcon(props) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  );
}
