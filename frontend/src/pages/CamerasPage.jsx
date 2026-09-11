import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Plus, 
  Trash2, 
  Activity, 
  Brain, 
  Map, 
  AlertOctagon, 
  ScanLine, 
  FileVideo, 
  HeartPulse, 
  Settings,
  Play,
  Square,
  ShieldCheck,
  CheckCircle2,
  Clock,
  RefreshCw,
  ExternalLink,
  Sliders,
  Layers,
  Cpu,
  Sparkles,
  Save,
  Check
} from 'lucide-react';
import { 
  getCameraStreamUrl, 
  getCameraHealth, 
  getEvents, 
  getANPR, 
  getEvidence,
  getZones, 
  deleteCamera, 
  startCamera, 
  stopCamera,
  updateCameraConfig,
  getProfiles
} from '../services/api';
import AddCameraWizard from '../components/AddCameraWizard';
import ZoneDrawer from '../components/ZoneDrawer';
import RiskBadge from '../components/RiskBadge';
import OverlayControls from '../components/OverlayControls';
import LiveAIAnalysisCard from '../components/LiveAIAnalysisCard';
import PrivilegedActionModal from '../components/PrivilegedActionModal';

export default function CamerasPage({ cameras = [], onRefresh }) {
  const [selectedCam, setSelectedCam] = useState(null);
  const [activeTab, setActiveTab] = useState('Live');
  const [showAddWizard, setShowAddWizard] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [showZoneDrawer, setShowZoneDrawer] = useState(false);
  const [showLiveAIAnalysis, setShowLiveAIAnalysis] = useState(false);
  const [camZones, setCamZones] = useState([]);
  const [camEvents, setCamEvents] = useState([]);
  const [camANPR, setCamANPR] = useState([]);
  const [camEvidence, setCamEvidence] = useState([]);
  const [pipelineActionRunning, setPipelineActionRunning] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [profilesCatalog, setProfilesCatalog] = useState([]);
  const [privilegedModal, setPrivilegedModal] = useState(null);

  // Local editable config for selected camera
  const [editProfile, setEditProfile] = useState('Border Fence Monitoring');
  const [editSector, setEditSector] = useState('Sector Alpha');
  const [editThreshold, setEditThreshold] = useState(60);
  const [editGemini, setEditGemini] = useState(true);
  const [editModules, setEditModules] = useState({});

  useEffect(() => {
    getProfiles().then(p => setProfilesCatalog(p || [])).catch(() => {});
  }, []);

  // Auto-select first camera if none selected
  useEffect(() => {
    if (cameras.length > 0 && !selectedCam) {
      setSelectedCam(cameras[0]);
    } else if (selectedCam) {
      const found = cameras.find(c => c.camera_id === selectedCam.camera_id);
      if (found) setSelectedCam(found);
    }
  }, [cameras]);

  // Sync edit state when selected camera changes
  useEffect(() => {
    if (selectedCam) {
      setEditProfile(selectedCam.profile || 'Border Fence Monitoring');
      setEditSector(selectedCam.sector || 'Sector Alpha');
      setEditThreshold(selectedCam.alert_threshold || 60);
      setEditGemini(selectedCam.gemini_enabled !== false);
      
      let mods = selectedCam.enabled_modules;
      if (typeof mods === 'string') {
        try { mods = JSON.parse(mods); } catch { mods = {}; }
      }
      setEditModules(mods || {
        intrusion: true,
        loitering: true,
        direction: true,
        group: true,
        animal_filter: true,
        anpr: true,
        small_arms: false,
        day_night: true
      });
    }
  }, [selectedCam]);

  // Fetch tab-specific data
  useEffect(() => {
    if (!selectedCam) return;

    if (activeTab === 'Health') {
      getCameraHealth(selectedCam.camera_id)
        .then(setHealthData)
        .catch(() => setHealthData(null));
    } else if (activeTab === 'Zones') {
      getZones(selectedCam.camera_id)
        .then(z => setCamZones(z || []))
        .catch(() => setCamZones([]));
    } else if (activeTab === 'Alerts') {
      getEvents(0, 20)
        .then(res => {
          const filtered = (res.items || []).filter(e => e.camera_id === selectedCam.camera_id);
          setCamEvents(filtered);
        })
        .catch(() => setCamEvents([]));
    } else if (activeTab === 'ANPR') {
      getANPR(0, 20)
        .then(res => {
          const filtered = (res.items || []).filter(a => a.camera_id === selectedCam.camera_id);
          setCamANPR(filtered);
        })
        .catch(() => setCamANPR([]));
    } else if (activeTab === 'Evidence') {
      getEvidence(selectedCam.camera_id, '', 0, 20)
        .then(res => setCamEvidence(res.items || []))
        .catch(() => setCamEvidence([]));
    }
  }, [selectedCam, activeTab]);

  const handleOverlayToggle = async (newOverlayConfig) => {
    if (!selectedCam) return;
    try {
      await updateCameraConfig(selectedCam.camera_id, { overlay_config: newOverlayConfig });
      setSelectedCam(prev => ({ ...prev, overlay_config: newOverlayConfig }));
    } catch (err) {
      console.error("Failed to update overlay settings:", err);
    }
  };

  const handleSaveDynamicConfig = async () => {
    if (!selectedCam) return;
    setSavingConfig(true);
    try {
      const updated = await updateCameraConfig(selectedCam.camera_id, {
        profile: editProfile,
        sector: editSector,
        alert_threshold: editThreshold,
        gemini_enabled: editGemini,
        enabled_modules: editModules
      });
      setSelectedCam(updated);
      setShowConfigModal(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert("Failed to update camera configuration: " + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDelete = () => {
    if (!selectedCam) return;
    setPrivilegedModal({
      actionName: `Decommission Camera '${selectedCam.name}'`,
      description: `Permanently removes camera feed ${selectedCam.camera_id} from perimeter topology. Ingestion pipeline, detection loops, and analytics will cease immediately.`,
      entityType: 'CAMERA',
      entityId: selectedCam.camera_id,
      onConfirm: async () => {
        await deleteCamera(selectedCam.camera_id);
        setSelectedCam(null);
        if (onRefresh) onRefresh();
      }
    });
  };

  const handleStart = async () => {
    setPipelineActionRunning(true);
    try {
      await startCamera(selectedCam.camera_id);
      if (onRefresh) onRefresh();
    } finally {
      setPipelineActionRunning(false);
    }
  };

  const handleStop = () => {
    if (!selectedCam) return;
    setPrivilegedModal({
      actionName: `Halt Ingestion Pipeline for '${selectedCam.name}'`,
      description: `Disables real-time surveillance processing for sector ${selectedCam.sector}. Virtual geofences and loitering escalation will be inactive while halted.`,
      entityType: 'CAMERA',
      entityId: selectedCam.camera_id,
      onConfirm: async () => {
        setPipelineActionRunning(true);
        try {
          await stopCamera(selectedCam.camera_id);
          if (onRefresh) onRefresh();
        } finally {
          setPipelineActionRunning(false);
        }
      }
    });
  };

  const TABS = [
    { id: 'Overview', label: 'Overview', icon: Activity },
    { id: 'Live', label: 'Live Stream', icon: Camera },
    { id: 'AI', label: 'AI Inference Profile', icon: Brain },
    { id: 'Zones', label: 'Virtual Zones', icon: Map },
    { id: 'Alerts', label: 'Alerts', icon: AlertOctagon },
    { id: 'ANPR', label: 'ANPR', icon: ScanLine },
    { id: 'Evidence', label: 'Forensic Vault', icon: FileVideo },
    { id: 'Health', label: 'Health Telemetry', icon: HeartPulse },
    { id: 'Settings', label: 'Settings', icon: Settings },
  ];

  let currentOverlay = selectedCam?.overlay_config || {};
  if (typeof currentOverlay === 'string') {
    try { currentOverlay = JSON.parse(currentOverlay); } catch { currentOverlay = {}; }
  }

  return (
    <div className="flex h-full max-w-7xl mx-auto p-6 gap-6 items-start">
      {/* Left Sidebar: Fleet List */}
      <div className="w-80 bg-slate-900 border border-slate-800 rounded-lg flex flex-col shrink-0 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
          <div>
            <div className="flex items-center space-x-2">
              <Camera className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                Surveillance Fleet
              </h2>
            </div>
            <p className="text-[10px] font-mono text-slate-500 mt-0.5">{cameras.length} INGESTION FEEDS</p>
          </div>
          <button 
            onClick={() => setShowAddWizard(true)} 
            className="p-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-white transition shadow-sm"
            title="Add Ingestion Source"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-slate-800/60 overflow-y-auto max-h-[680px]">
          {cameras.map(cam => {
            const isSelected = selectedCam?.camera_id === cam.camera_id;
            const isOnline = cam.status === 'ONLINE';
            return (
              <button
                key={cam.camera_id}
                onClick={() => { setSelectedCam(cam); }}
                className={`w-full text-left p-3.5 transition flex items-start space-x-3 ${
                  isSelected 
                    ? 'bg-slate-800/90 border-l-4 border-emerald-500 shadow-inner' 
                    : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="mt-1">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-slate-600'}`} />
                </div>
                <div className="truncate flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-100 truncate">{cam.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-800">
                      {cam.fps || 20} FPS
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-400 font-mono mt-0.5 truncate">{cam.profile || 'Border Fence'}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">{cam.sector || cam.location || 'Sector Alpha'}</div>
                </div>
              </button>
            );
          })}
          {cameras.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-500 font-mono">
              No cameras ingested yet. Click &apos;+&apos; above to bind a webcam or RTSP feed.
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg flex flex-col overflow-hidden shadow-sm">
        {selectedCam ? (
          <>
            {/* Header with Camera Status & Dynamic Controls */}
            <div className="p-5 border-b border-slate-800 bg-slate-950/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <h1 className="text-base font-bold text-white tracking-tight">{selectedCam.name}</h1>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase font-semibold">
                      {selectedCam.status || 'ONLINE'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30 font-semibold">
                      {selectedCam.profile || 'Border Fence Monitoring'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
                      {selectedCam.sector || 'Sector Alpha'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-1 flex items-center space-x-2">
                    <span>ID: {selectedCam.camera_id}</span>
                    <span>•</span>
                    <span>Alert Threshold: {selectedCam.alert_threshold || 60}/100</span>
                    <span>•</span>
                    <span className="text-emerald-400">{selectedCam.fps || 20} FPS</span>
                  </div>
                </div>

                {/* Pipeline & Profile Config Action Controls */}
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => setShowConfigModal(true)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-mono font-medium transition flex items-center space-x-1.5 shadow-sm"
                  >
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Config AI Profile</span>
                  </button>

                  {selectedCam.status === 'ONLINE' ? (
                    <button 
                      onClick={handleStop} 
                      disabled={pipelineActionRunning}
                      className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded text-xs font-mono font-semibold transition flex items-center space-x-1.5 disabled:opacity-50"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Halt</span>
                    </button>
                  ) : (
                    <button 
                      onClick={handleStart} 
                      disabled={pipelineActionRunning}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start</span>
                    </button>
                  )}
                </div>
              </div>
              
              {/* Navigation Sub-Tabs */}
              <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-slate-800/80">
                {TABS.map(t => {
                  const Icon = t.icon;
                  const isActive = activeTab === t.id;
                  return (
                    <button 
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-medium transition ${
                        isActive 
                          ? 'bg-slate-800 text-white font-semibold border border-slate-700 shadow-sm' 
                          : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab Body */}
            <div className="p-5 overflow-y-auto max-h-[640px]">
              {/* TAB: OVERVIEW */}
              {activeTab === 'Overview' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-950 p-3.5 rounded border border-slate-800">
                      <div className="text-[10px] font-mono text-slate-500 uppercase">Operational Profile</div>
                      <div className="text-sm font-bold text-emerald-400 mt-1 truncate">{selectedCam.profile || 'Border Fence'}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Autonomous Context</div>
                    </div>
                    <div className="bg-slate-950 p-3.5 rounded border border-slate-800">
                      <div className="text-[10px] font-mono text-slate-500 uppercase">Perimeter Sector</div>
                      <div className="text-sm font-bold font-mono text-white mt-1">{selectedCam.sector || 'Sector Alpha'}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Deployment Zone</div>
                    </div>
                    <div className="bg-slate-950 p-3.5 rounded border border-slate-800">
                      <div className="text-[10px] font-mono text-slate-500 uppercase">Alert Threshold</div>
                      <div className="text-sm font-bold font-mono text-amber-400 mt-1">{selectedCam.alert_threshold || 60}/100</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Minimum Dispatch Score</div>
                    </div>
                    <div className="bg-slate-950 p-3.5 rounded border border-slate-800">
                      <div className="text-[10px] font-mono text-slate-500 uppercase">Gemini Advisory</div>
                      <div className="text-sm font-bold text-white mt-1">
                        {selectedCam.gemini_enabled !== false ? 'ENABLED' : 'DISABLED'}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Secondary Verification</div>
                    </div>
                  </div>

                  {/* Active AI Stack Strip */}
                  <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-slate-300 uppercase">
                        AI Perception & Tracking Stack
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400">EDGE PIPELINE RUNNING</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-3 bg-slate-900 rounded border border-slate-800/80">
                        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
                          <Brain className="w-3.5 h-3.5 text-emerald-400" />
                          <span>YOLOv8 Object Detection</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">Target whitelisting, carried baggage proximity, animal filtering.</p>
                      </div>

                      <div className="p-3 bg-slate-900 rounded border border-slate-800/80">
                        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
                          <Activity className="w-3.5 h-3.5 text-cyan-400" />
                          <span>ByteTrack Tracking</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">Foot-point trajectory mapping & loitering dwell tracking.</p>
                      </div>

                      <div className="p-3 bg-slate-900 rounded border border-slate-800/80">
                        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
                          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                          <span>Gemini Secondary Reasoning</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">Advisory scene assessment & ambiguity explanation layer.</p>
                      </div>
                    </div>
                  </div>

                  {/* Feed Source URL Details */}
                  <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Stream Endpoint</span>
                    <div className="font-mono text-xs text-emerald-400 break-all p-2 rounded bg-slate-900 border border-slate-800">
                      {selectedCam.rtsp_url}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: LIVE STREAM WITH FLOATING OVERLAY CONTROLS & AI PERCEPTION */}
              {activeTab === 'Live' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-300 uppercase flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      Live Surveillance Feed // Active Ingestion
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowLiveAIAnalysis(prev => !prev)}
                      className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition flex items-center gap-1.5 shadow-md ${
                        showLiveAIAnalysis 
                          ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse' 
                          : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {showLiveAIAnalysis ? 'STOP AI ANALYSIS' : '⚡ ANALYZE WITH AI'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className={`${showLiveAIAnalysis ? 'lg:col-span-2' : 'lg:col-span-3'} relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center group`}>
                      <img 
                        src={getCameraStreamUrl(selectedCam.camera_id, true)} 
                        alt="Live Stream" 
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340" fill="%230f172a"><rect width="600" height="340"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2364748b" font-family="monospace" font-size="14">CONNECTING TO VIDEO INGESTION PIPELINE...</text></svg>';
                        }}
                      />
                      
                      {/* Top Tactical Badge */}
                      <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur px-2.5 py-1 rounded text-xs text-white font-mono flex items-center space-x-2 border border-slate-800">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-bold">{selectedCam.sector || 'SECTOR'} • {selectedCam.profile || 'PERIMETER'}</span>
                      </div>

                      {/* Interactive HUD Overlay Toolbar */}
                      <OverlayControls 
                        overlayConfig={currentOverlay}
                        onChange={handleOverlayToggle}
                      />
                    </div>

                    {showLiveAIAnalysis && (
                      <div className="lg:col-span-1">
                        <LiveAIAnalysisCard 
                          cameraId={selectedCam.camera_id} 
                          onClose={() => setShowLiveAIAnalysis(false)} 
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: AI INFERENCE PROFILE CONFIGURATION */}
              {activeTab === 'AI' && (
                <div className="space-y-5">
                  <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                      <div>
                        <h3 className="text-xs font-mono font-bold text-white uppercase flex items-center gap-1.5">
                          <Sliders className="w-4 h-4 text-emerald-400" />
                          Dynamic AI Surveillance Parameters
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">Parameters hot-reload into running pipeline in real-time.</p>
                      </div>
                      <button
                        onClick={handleSaveDynamicConfig}
                        disabled={savingConfig}
                        className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition flex items-center gap-1.5 shadow"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{savingConfig ? 'Applying...' : 'Apply Live Changes'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block text-slate-400 font-mono mb-1">Surveillance Profile</label>
                        <select
                          value={editProfile}
                          onChange={e => setEditProfile(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 p-2 rounded text-white focus:outline-none focus:border-emerald-500"
                        >
                          {profilesCatalog.map(p => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 font-mono mb-1">Assigned Sector</label>
                        <input
                          type="text"
                          value={editSector}
                          onChange={e => setEditSector(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 p-2 rounded text-white focus:outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between font-mono text-slate-400 mb-1">
                          <span>Alert Threshold:</span>
                          <span className="text-emerald-400 font-bold">{editThreshold} / 100</span>
                        </div>
                        <input
                          type="range"
                          min="30"
                          max="90"
                          value={editThreshold}
                          onChange={e => setEditThreshold(parseInt(e.target.value))}
                          className="w-full accent-emerald-500 h-1 bg-slate-800 rounded appearance-none cursor-pointer mt-2"
                        />
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-slate-900 rounded border border-slate-800">
                        <div>
                          <span className="font-semibold text-slate-200 block">Gemini Advisory Layer</span>
                          <span className="text-[10px] text-slate-400">Secondary verification on anomalies</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={editGemini}
                          onChange={e => setEditGemini(e.target.checked)}
                          className="rounded border-slate-700 text-sky-500 focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Modular AI Matrix */}
                    <div className="pt-2">
                      <span className="text-xs font-mono font-semibold text-slate-300 uppercase block mb-2">
                        Active Modular AI Subsystems
                      </span>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {[
                          { id: 'intrusion', label: 'Intrusion Detection' },
                          { id: 'loitering', label: 'Loitering / Dwell Tracking' },
                          { id: 'direction', label: 'Direction & Velocity Anomaly' },
                          { id: 'group', label: 'Group Movement Analysis' },
                          { id: 'animal_filter', label: 'Animal Activity Filter' },
                          { id: 'anpr', label: 'License Plate (ANPR)' },
                          { id: 'day_night', label: 'Day / Night Adaptation' },
                          { id: 'small_arms', label: 'Small Arms / Weapon Detection', unavailable: true }
                        ].map(mod => (
                          <label 
                            key={mod.id}
                            className={`flex items-center gap-2 p-2 rounded border transition ${
                              mod.unavailable 
                                ? 'bg-amber-950/20 border-amber-800/40 text-slate-400 cursor-not-allowed'
                                : editModules[mod.id] 
                                  ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-200' 
                                  : 'bg-slate-900/40 border-slate-800/50 text-slate-400'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={mod.unavailable ? false : !!editModules[mod.id]}
                              disabled={mod.unavailable}
                              onChange={() => {
                                if (mod.unavailable) return;
                                setEditModules(prev => ({ ...prev, [mod.id]: !prev[mod.id] }));
                              }}
                              className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                            />
                            <span className="text-[11px] font-sans flex-1">{mod.label}</span>
                            {mod.unavailable && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                MODEL UNAVAILABLE
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: ZONES */}
              {activeTab === 'Zones' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono font-semibold text-slate-300 uppercase">
                      Virtual Polygon Geofences ({camZones.length})
                    </span>
                    <button 
                      onClick={() => setShowZoneDrawer(true)} 
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition shadow-sm"
                    >
                      + Draw New Virtual Zone
                    </button>
                  </div>

                  {showZoneDrawer ? (
                    <div className="relative min-h-[460px] bg-black rounded-lg overflow-hidden border border-slate-800">
                      <ZoneDrawer 
                        cameraId={selectedCam.camera_id} 
                        streamUrl={getCameraStreamUrl(selectedCam.camera_id, false)}
                        existingZones={camZones}
                        onCancel={() => setShowZoneDrawer(false)}
                        onZoneSaved={() => {
                          setShowZoneDrawer(false);
                          getZones(selectedCam.camera_id).then(z => setCamZones(z || []));
                        }}
                      />
                    </div>
                  ) : (
                    <div className="bg-slate-950 rounded border border-slate-800 p-4">
                      {camZones.length > 0 ? (
                        <div className="space-y-2">
                          {camZones.map(z => (
                            <div key={z.zone_id} className="flex justify-between items-center p-3 bg-slate-900 rounded border border-slate-800">
                              <div className="flex items-center gap-3">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: z.color || '#EF4444' }} />
                                <div>
                                  <span className="text-xs text-white font-semibold">{z.name}</span>
                                  <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                                    {z.zone_type}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-[10px] font-mono text-slate-400">
                                  {z.coordinates?.length || z.polygon_coords?.length || 0} Polygon Vertices
                                </span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await deleteZone(z.zone_id);
                                      const updated = await getZones(selectedCam.camera_id);
                                      setCamZones(updated || []);
                                    } catch (e) {
                                      console.error("Failed to delete zone", e);
                                    }
                                  }}
                                  className="px-2 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded text-[11px] font-mono transition"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 text-center text-slate-500 text-xs font-mono">
                          No virtual zones drawn for this camera. Click &apos;+ Draw New Virtual Zone&apos; to define perimeter tripwires.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: ALERTS */}
              {activeTab === 'Alerts' && (
                <div className="space-y-3">
                  <span className="text-xs font-mono font-semibold text-slate-300 uppercase">
                    Recent Incidents on this Camera ({camEvents.length})
                  </span>
                  {camEvents.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs font-mono bg-slate-950 rounded border border-slate-800">
                      No security incidents logged for this camera feed.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {camEvents.map(e => (
                        <div key={e.event_id} className="p-3 bg-slate-950 rounded border border-slate-800 flex items-center justify-between text-xs">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-slate-300 font-bold">#{e.event_id ? e.event_id.slice(0, 8) : 'EVENT'}</span>
                              <RiskBadge score={e.risk_score} severity={e.severity} />
                              <span className="text-slate-200 capitalize font-medium">{(e.event_type || 'INCIDENT').replace(/_/g, ' ')}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1 font-mono">
                              Track #{e.track_id || 'N/A'} • {new Date(e.timestamp * 1000).toLocaleString()}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 uppercase">
                            {e.status || 'NEW'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: ANPR */}
              {activeTab === 'ANPR' && (
                <div className="space-y-3">
                  <span className="text-xs font-mono font-semibold text-slate-300 uppercase">
                    Detected License Plates ({camANPR.length})
                  </span>
                  {camANPR.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs font-mono bg-slate-950 rounded border border-slate-800">
                      No vehicle license plate records logged for this camera.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {camANPR.map((a, idx) => (
                        <div key={idx} className="p-3 bg-slate-950 rounded border border-slate-800 flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-3">
                            <span className="font-mono text-base font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                              {a.plate || a.plate_number || 'UNKNOWN'}
                            </span>
                            <span className="text-slate-400 text-xs">Confidence: {(a.confidence * 100).toFixed(0)}%</span>
                          </div>
                          <span className="font-mono text-[11px] text-slate-500">
                            {new Date(a.timestamp * 1000).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: EVIDENCE */}
              {activeTab === 'Evidence' && (
                <div className="space-y-3">
                  <span className="text-xs font-mono font-semibold text-slate-300 uppercase">
                    Forensic Evidence Vault Checksums ({camEvidence.length})
                  </span>
                  {camEvidence.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs font-mono bg-slate-950 rounded border border-slate-800">
                      No forensic packages stored for this camera.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {camEvidence.map(ev => (
                        <div key={ev.event_id} className="p-3 bg-slate-950 rounded border border-slate-800 flex items-center justify-between text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-slate-300 font-bold">Evidence #{ev.event_id ? ev.event_id.slice(0, 8) : 'EVID'}</span>
                              <RiskBadge score={ev.risk_score || 50} severity={ev.severity} />
                            </div>
                            <div className="font-mono text-[10px] text-emerald-400 truncate max-w-sm">
                              SHA-256: {ev.sha256_hash}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(ev.timestamp * 1000).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: HEALTH */}
              {activeTab === 'Health' && (
                <div className="space-y-4">
                  <span className="text-xs font-mono font-semibold text-slate-300 uppercase">
                    Edge Pipeline Health Telemetry
                  </span>
                  <div className="bg-slate-950 p-4 rounded border border-slate-800 font-mono text-xs">
                    {healthData ? (
                      <pre className="text-emerald-400 whitespace-pre-wrap">
                        {JSON.stringify(healthData, null, 2)}
                      </pre>
                    ) : (
                      <div className="text-slate-500 text-center py-6">
                        Querying camera socket health diagnostic...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: SETTINGS */}
              {activeTab === 'Settings' && (
                <div className="space-y-6">
                  <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-3">
                    <h3 className="text-xs font-mono font-semibold text-slate-200 uppercase">
                      Feed Source Configuration
                    </h3>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">RTSP Stream URL / Device Ingress</label>
                      <input 
                        type="text" 
                        readOnly 
                        value={selectedCam.rtsp_url} 
                        className="w-full bg-slate-900 border border-slate-800 p-2 rounded text-slate-300 text-xs font-mono" 
                      />
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="bg-rose-500/5 border border-rose-500/20 p-4 rounded space-y-3">
                    <h4 className="text-xs font-mono font-bold text-rose-400 uppercase">Decommission Feed</h4>
                    <p className="text-xs text-slate-400">
                      Permanently release this video ingestion channel from the inference pipeline. Associated historical incidents and forensic evidence in the vault will remain preserved.
                    </p>
                    <button 
                      onClick={handleDelete} 
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-medium transition flex items-center space-x-1.5 shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Decommission Camera</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 flex-col gap-3 p-12">
            <Camera className="w-10 h-10 opacity-30 text-slate-400" />
            <p className="text-xs font-mono">Select a camera from the fleet list or add a new ingestion feed.</p>
          </div>
        )}
      </div>

      {/* Floating Modal for AI Profile Configuration */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase">
                Dynamic Camera Profile Config
              </h3>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-mono mb-1">Surveillance Profile</label>
                <select
                  value={editProfile}
                  onChange={e => setEditProfile(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-white"
                >
                  {profilesCatalog.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-mono mb-1">Sector Identifier</label>
                <input
                  type="text"
                  value={editSector}
                  onChange={e => setEditSector(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-white font-mono"
                />
              </div>

              <div>
                <div className="flex justify-between font-mono text-slate-400 mb-1">
                  <span>Incident Alert Threshold:</span>
                  <span className="text-emerald-400 font-bold">{editThreshold} / 100</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="90"
                  value={editThreshold}
                  onChange={e => setEditThreshold(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-800 rounded appearance-none cursor-pointer mt-1"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded border border-slate-800">
                <div>
                  <span className="font-semibold text-slate-200 block">Gemini Advisory Layer</span>
                  <span className="text-[10px] text-slate-400">Enable cloud secondary reasoning</span>
                </div>
                <input
                  type="checkbox"
                  checked={editGemini}
                  onChange={e => setEditGemini(e.target.checked)}
                  className="rounded border-slate-700 text-sky-500 focus:ring-0 w-4 h-4 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDynamicConfig}
                disabled={savingConfig}
                className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow"
              >
                {savingConfig ? 'Hot-Reloading...' : 'Save & Hot-Reload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddWizard && (
        <AddCameraWizard 
          onClose={() => setShowAddWizard(false)} 
          onComplete={() => { 
            setShowAddWizard(false); 
            if (onRefresh) onRefresh(); 
          }} 
        />
      )}

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
