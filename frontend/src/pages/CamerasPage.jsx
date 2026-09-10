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
  Cpu
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
  stopCamera 
} from '../services/api';
import AddCameraWizard from '../components/AddCameraWizard';
import ZoneDrawer from '../components/ZoneDrawer';
import RiskBadge from '../components/RiskBadge';

export default function CamerasPage({ cameras = [], onRefresh }) {
  const [selectedCam, setSelectedCam] = useState(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [showAddWizard, setShowAddWizard] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [showZoneDrawer, setShowZoneDrawer] = useState(false);
  const [camZones, setCamZones] = useState([]);
  const [camEvents, setCamEvents] = useState([]);
  const [camANPR, setCamANPR] = useState([]);
  const [camEvidence, setCamEvidence] = useState([]);
  const [pipelineActionRunning, setPipelineActionRunning] = useState(false);

  // Auto-select first camera if none selected
  useEffect(() => {
    if (cameras.length > 0 && !selectedCam) {
      setSelectedCam(cameras[0]);
    } else if (selectedCam) {
      const found = cameras.find(c => c.camera_id === selectedCam.camera_id);
      if (found) setSelectedCam(found);
    }
  }, [cameras]);

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

  const handleDelete = async () => {
    if (window.confirm(`Permanently remove camera feed '${selectedCam.name}' (${selectedCam.camera_id})?`)) {
      await deleteCamera(selectedCam.camera_id);
      setSelectedCam(null);
      if (onRefresh) onRefresh();
    }
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

  const handleStop = async () => {
    setPipelineActionRunning(true);
    try {
      await stopCamera(selectedCam.camera_id);
      if (onRefresh) onRefresh();
    } finally {
      setPipelineActionRunning(false);
    }
  };

  const TABS = [
    { id: 'Overview', label: 'Overview', icon: Activity },
    { id: 'Live', label: 'Live Stream', icon: Camera },
    { id: 'AI', label: 'AI Inference', icon: Brain },
    { id: 'Zones', label: 'Virtual Zones', icon: Map },
    { id: 'Alerts', label: 'Alerts', icon: AlertOctagon },
    { id: 'ANPR', label: 'ANPR', icon: ScanLine },
    { id: 'Evidence', label: 'Forensic Vault', icon: FileVideo },
    { id: 'Health', label: 'Health Telemetry', icon: HeartPulse },
    { id: 'Settings', label: 'Settings', icon: Settings },
  ];

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
            const isActive = cam.status === 'active';
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
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-slate-600'}`} />
                </div>
                <div className="truncate flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-100 truncate">{cam.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-800">
                      {cam.fps || 30} FPS
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">{cam.camera_id}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">{cam.location || 'Unassigned Sector'}</div>
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
            {/* Header with Camera Status & Controls */}
            <div className="p-5 border-b border-slate-800 bg-slate-950/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <h1 className="text-base font-bold text-white tracking-tight">{selectedCam.name}</h1>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                      selectedCam.status === 'active' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {selectedCam.status === 'active' ? 'PROCESSING LIVE' : 'STOPPED'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-1 flex items-center space-x-2">
                    <span>ID: {selectedCam.camera_id}</span>
                    <span>•</span>
                    <span>{selectedCam.location || 'Tactical Sector'}</span>
                    <span>•</span>
                    <span className="text-emerald-400">{selectedCam.fps || 30} FPS TARGET</span>
                  </div>
                </div>

                {/* Pipeline Controls */}
                <div className="flex items-center space-x-2 shrink-0">
                  {selectedCam.status === 'active' ? (
                    <button 
                      onClick={handleStop} 
                      disabled={pipelineActionRunning}
                      className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded text-xs font-mono font-semibold transition flex items-center space-x-1.5 disabled:opacity-50"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Halt Pipeline</span>
                    </button>
                  ) : (
                    <button 
                      onClick={handleStart} 
                      disabled={pipelineActionRunning}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start Pipeline</span>
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
                      <div className="text-[10px] font-mono text-slate-500 uppercase">Operational Status</div>
                      <div className="text-sm font-bold text-white mt-1 capitalize">{selectedCam.status}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Auto-Recovery Active</div>
                    </div>
                    <div className="bg-slate-950 p-3.5 rounded border border-slate-800">
                      <div className="text-[10px] font-mono text-slate-500 uppercase">Frame Resolution</div>
                      <div className="text-sm font-bold font-mono text-emerald-400 mt-1">{selectedCam.resolution || '1280x720'}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Normalized 640 Ingestion</div>
                    </div>
                    <div className="bg-slate-950 p-3.5 rounded border border-slate-800">
                      <div className="text-[10px] font-mono text-slate-500 uppercase">Target FPS Rate</div>
                      <div className="text-sm font-bold font-mono text-cyan-400 mt-1">{selectedCam.fps || 30} FPS</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Real-Time Ingestion</div>
                    </div>
                    <div className="bg-slate-950 p-3.5 rounded border border-slate-800">
                      <div className="text-[10px] font-mono text-slate-500 uppercase">Security Sector</div>
                      <div className="text-sm font-bold text-white mt-1 truncate">{selectedCam.location || 'Command HQ'}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Geofence Group 1</div>
                    </div>
                  </div>

                  {/* Active AI Stack Strip */}
                  <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-slate-300 uppercase">
                        Active Deep Neural Pipelines Bound to this Source
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400">EDGE PIPELINE RUNNING</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-3 bg-slate-900 rounded border border-slate-800/80">
                        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
                          <Brain className="w-3.5 h-3.5 text-emerald-400" />
                          <span>YOLOv8 Detection</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">Multi-class silhouette analysis, carried luggage proximity.</p>
                      </div>

                      <div className="p-3 bg-slate-900 rounded border border-slate-800/80">
                        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
                          <Activity className="w-3.5 h-3.5 text-cyan-400" />
                          <span>ByteTrack Tracking</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">Kalman-filtered trajectory preservation across occlusions.</p>
                      </div>

                      <div className="p-3 bg-slate-900 rounded border border-slate-800/80">
                        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
                          <ScanLine className="w-3.5 h-3.5 text-amber-400" />
                          <span>ANPR OCR Engine</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">Plate extraction and vehicle checkpoint validation.</p>
                      </div>
                    </div>
                  </div>

                  {/* Feed Source URL Details */}
                  <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Ingestion Stream Ingress Endpoint</span>
                    <div className="font-mono text-xs text-emerald-400 break-all p-2 rounded bg-slate-900 border border-slate-800">
                      {selectedCam.rtsp_url}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: LIVE STREAM */}
              {activeTab === 'Live' && (
                <div className="space-y-4">
                  <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
                    <img 
                      src={getCameraStreamUrl(selectedCam.camera_id)} 
                      alt="Live Stream" 
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340" fill="%230f172a"><rect width="600" height="340"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2364748b" font-family="monospace" font-size="14">STREAM OFFLINE OR INITIALIZING</text></svg>';
                      }}
                    />
                    <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur px-2.5 py-1 rounded text-xs text-white font-mono flex items-center space-x-2 border border-slate-800">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                      <span className="font-bold">LIVE TELEMETRY FEED</span>
                    </div>

                    <div className="absolute bottom-3 right-3 bg-slate-950/80 backdrop-blur px-2.5 py-1 rounded text-[11px] text-slate-300 font-mono border border-slate-800">
                      AI Ingestion: <span className="text-emerald-400">ACTIVE</span> • FPS: <span className="text-cyan-400">{selectedCam.fps || 30}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: AI INFERENCE */}
              {activeTab === 'AI' && (
                <div className="space-y-4">
                  <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-3">
                    <h3 className="text-xs font-mono font-semibold text-slate-200 uppercase flex items-center space-x-2">
                      <Brain className="w-4 h-4 text-emerald-400" />
                      <span>Camera AI Parameter Configuration</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-slate-900 rounded border border-slate-800">
                        <div className="font-semibold text-slate-200">Confidence Threshold</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">Minimum neural prediction confidence: 0.50</div>
                      </div>
                      <div className="p-3 bg-slate-900 rounded border border-slate-800">
                        <div className="font-semibold text-slate-200">IoU Association Threshold</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">ByteTrack Hungarian matching IoU: 0.45</div>
                      </div>
                      <div className="p-3 bg-slate-900 rounded border border-slate-800">
                        <div className="font-semibold text-slate-200">Loitering Threshold</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">Zone dwell duration trigger: 15.0 seconds</div>
                      </div>
                      <div className="p-3 bg-slate-900 rounded border border-slate-800">
                        <div className="font-semibold text-slate-200">Speed Anomaly Limit</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">Running detection velocity: &gt; 15.0 px/sec</div>
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
                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-800">
                      <img src={getCameraStreamUrl(selectedCam.camera_id)} className="w-full h-full object-contain" alt="Stream" />
                      <ZoneDrawer 
                        cameraId={selectedCam.camera_id} 
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
                              <div>
                                <span className="text-xs text-white font-semibold">{z.name}</span>
                                <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase">
                                  {z.zone_type}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-slate-400">
                                {z.coordinates?.length || 0} Polygon Vertices
                              </span>
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
                              <span className="font-mono text-slate-300 font-bold">#{e.event_id}</span>
                              <RiskBadge score={e.risk_score} severity={e.severity} />
                              <span className="text-slate-200 capitalize font-medium">{e.event_type.replace('_', ' ')}</span>
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
                              {a.plate_number || 'UNKNOWN'}
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
                    Forensic Evidence Clips & Checksums ({camEvidence.length})
                  </span>
                  {camEvidence.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs font-mono bg-slate-950 rounded border border-slate-800">
                      No forensic packages stored for this camera.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {camEvidence.map(ev => (
                        <div key={ev.id} className="p-3 bg-slate-950 rounded border border-slate-800 flex items-center justify-between text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-slate-300 font-bold">Evidence #{ev.id}</span>
                              <RiskBadge score={ev.risk_score} severity={ev.severity} />
                            </div>
                            <div className="font-mono text-[10px] text-emerald-400 truncate max-w-sm">
                              SHA-256: {ev.sha256}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(ev.timestamp).toLocaleString()}
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

      {showAddWizard && (
        <AddCameraWizard 
          onClose={() => setShowAddWizard(false)} 
          onComplete={() => { 
            setShowAddWizard(false); 
            if (onRefresh) onRefresh(); 
          }} 
        />
      )}
    </div>
  );
}
