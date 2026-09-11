import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Camera, 
  Eye, 
  Radio, 
  Activity, 
  Clock, 
  Play, 
  CheckCircle, 
  ChevronRight, 
  AlertTriangle,
  Layers,
  Search,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { getCameraStreamUrl, updateEventStatus, getActivityTimeline } from '../services/api';
import RiskBadge from '../components/RiskBadge';
import LiveAIAnalysisCard from '../components/LiveAIAnalysisCard';

export default function CommandCenter({ stats, cameras = [], incidents = [], onSelectIncident, onNavigateToCameras, onRefresh }) {
  const [timeline, setTimeline] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [activeAiCamId, setActiveAiCamId] = useState(null);

  // Fetch real-time activity timeline
  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const data = await getActivityTimeline(15);
        setTimeline(data || []);
      } catch (err) {
        console.error("Timeline error:", err);
      }
    };
    fetchTimeline();
    const interval = setInterval(fetchTimeline, 4000);
    return () => clearInterval(interval);
  }, []);

  // Determine highest priority incident requiring attention
  const priorityIncident = incidents.find(i => (i.severity === 'Critical' || i.severity === 'High') && i.status === 'NEW') || incidents[0] || null;

  const handleQuickAcknowledge = async (eventId, e) => {
    e.stopPropagation();
    try {
      await updateEventStatus(eventId, 'ACKNOWLEDGED');
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Ack error:", err);
    }
  };

  const systemHealth = cameras.length > 0 ? (stats.active_cameras === stats.total_cameras ? 'OPTIMAL' : 'DEGRADED') : 'NOMINAL';
  const healthColor = systemHealth === 'OPTIMAL' ? 'text-emerald-400' : (systemHealth === 'DEGRADED' ? 'text-amber-400' : 'text-slate-400');

  return (
    <div className="p-6 space-y-6 max-w-[1800px] mx-auto">
      {/* Top Operational Metrics Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Connected Cameras */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-lg flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Connected Cameras</div>
            <div className="text-2xl font-bold font-mono text-slate-100 mt-1">
              {stats.active_cameras || 0} <span className="text-slate-500 text-sm font-normal">/ {stats.total_cameras || 0}</span>
            </div>
            <div className="text-[11px] text-emerald-400 font-mono mt-0.5 flex items-center space-x-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Ingestion Active</span>
            </div>
          </div>
          <div className="p-2.5 rounded bg-slate-800/80 border border-slate-700/50 text-slate-300">
            <Camera className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2: Active Incidents */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-lg flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Active Incidents</div>
            <div className="text-2xl font-bold font-mono text-slate-100 mt-1">
              {stats.active_incidents || 0}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              {stats.total_incidents || 0} Total Logged
            </div>
          </div>
          <div className={`p-2.5 rounded border ${stats.active_incidents > 0 ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-slate-800/80 border-slate-700/50 text-slate-300'}`}>
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3: Objects Currently Tracked */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-lg flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Objects Currently Tracked</div>
            <div className="text-2xl font-bold font-mono text-slate-100 mt-1">
              {stats.total_tracks || 0}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              ByteTrack Persistent IDs
            </div>
          </div>
          <div className="p-2.5 rounded bg-slate-800/80 border border-slate-700/50 text-slate-300">
            <Eye className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4: System Health */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-lg flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">System Health</div>
            <div className={`text-2xl font-bold font-mono mt-1 ${healthColor}`}>
              {systemHealth}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              Inference Subsystem 20 FPS
            </div>
          </div>
          <div className="p-2.5 rounded bg-slate-800/80 border border-slate-700/50 text-slate-300">
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Section: Priority Incident Feed ("What requires attention right now?") */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Priority Incident + Live Activity Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Priority Incident Feed Banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                </span>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                  PRIORITY INCIDENT FEED // IMMEDIATE ATTENTION REQUIRED
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">REAL-TIME OPERATOR QUEUE</span>
            </div>

            <div className="p-6">
              {priorityIncident ? (
                <div className="space-y-5">
                  {/* Alert Header */}
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800">
                    <div>
                      <div className="flex items-center space-x-3 mb-1">
                        <RiskBadge score={priorityIncident.risk_score} severity={priorityIncident.severity} />
                        <span className="text-xs font-mono text-slate-400">
                          ID: #{priorityIncident.event_id ? priorityIncident.event_id.slice(-6).toUpperCase() : 'IBV-2042'}
                        </span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          STATUS: {priorityIncident.status}
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-slate-100 tracking-tight">
                        {(priorityIncident.event_type || 'INCIDENT').replace(/_/g, ' ')}
                      </h2>
                    </div>

                    <div className="text-right font-mono text-xs text-slate-400">
                      <div>CAMERA: <span className="text-slate-200 font-semibold">{priorityIncident.camera_id}</span></div>
                      <div className="text-slate-500 mt-0.5">
                        TIME: {new Date(priorityIncident.timestamp * 1000).toLocaleTimeString('en-GB', { hour12: false })}
                      </div>
                    </div>
                  </div>

                  {/* AI Scene Synthesis & Telemetry Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">AI Summary</span>
                      <p className="text-slate-200 font-medium leading-relaxed">
                        {priorityIncident.ai_summary || "Person detected moving towards restricted perimeter boundary."}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">Target Behaviour</span>
                      <span className="inline-block font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {priorityIncident.behaviour || "Running"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">Detected Objects</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {(() => {
                          let objs = priorityIncident.detected_objects;
                          if (typeof objs === 'string') {
                            try { objs = JSON.parse(objs); } catch { objs = [objs]; }
                          }
                          if (Array.isArray(objs) && objs.length > 0) {
                            return objs.map((obj, i) => (
                              <span key={i} className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                {typeof obj === 'string' ? obj : JSON.stringify(obj)}
                              </span>
                            ));
                          }
                          return (
                            <span className="font-mono text-[11px] text-slate-400">{priorityIncident.class_name || "person"}</span>
                          );
                        })()}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">Risk Assessment</span>
                      <div className="text-lg font-bold font-mono text-rose-400">
                        {priorityIncident.risk_score} <span className="text-xs text-slate-500">/ 100</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => onSelectIncident(priorityIncident)}
                        className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold border border-slate-700 transition flex items-center space-x-2"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>View Incident Dossier</span>
                      </button>

                      <button
                        onClick={() => onSelectIncident(priorityIncident)}
                        className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold border border-slate-700 transition flex items-center space-x-2"
                      >
                        <Play className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Replay Evidence Clip</span>
                      </button>
                    </div>

                    {priorityIncident.status === 'NEW' && (
                      <button
                        onClick={(e) => handleQuickAcknowledge(priorityIncident.event_id, e)}
                        className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center space-x-2 shadow-sm"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Acknowledge Incident</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 mx-auto flex items-center justify-center text-emerald-400">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">All Sectors Nominal</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      Zero active security anomalies detected. Continuous AI border surveillance and ByteTrack persistence monitoring are operational.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live Activity Timeline: System Cognition Steps */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 mb-4">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                  LIVE ACTIVITY TIMELINE // COGNITION SEQUENCE
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-500">REAL-TIME INGESTION LOG</span>
            </div>

            <div className="space-y-3">
              {timeline.length > 0 ? (
                timeline.slice(0, 5).map((item, idx) => (
                  <div key={item.id || idx} className="flex items-start space-x-3 text-xs p-2.5 rounded bg-slate-950/40 border border-slate-800/60 font-mono">
                    <span className="text-slate-500 shrink-0">
                      {new Date(item.timestamp * 1000).toLocaleTimeString('en-GB', { hour12: false })}
                    </span>
                    <div className="shrink-0">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        item.stage === 'INCIDENT_CREATED' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                        item.stage === 'BEHAVIOUR_ANALYZED' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        item.stage === 'EVIDENCE_STORED' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {item.stage.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <span className="text-slate-200 font-semibold">{item.title}</span>
                      <p className="text-slate-400 text-[11px] font-sans truncate mt-0.5">{item.description}</p>
                    </div>
                    <span className="text-slate-500 text-[10px] shrink-0">{item.camera_id}</span>
                  </div>
                ))
              ) : (
                <div className="space-y-2 text-xs font-mono text-slate-400">
                  <div className="flex items-center space-x-3 p-2 rounded bg-slate-950/40 border border-slate-800/40">
                    <span className="text-slate-500">18:42:01</span>
                    <span className="text-emerald-400 font-semibold">DETECTION STARTED</span>
                    <span className="text-slate-300">YOLOv8 inference active on Sector North 01</span>
                  </div>
                  <div className="flex items-center space-x-3 p-2 rounded bg-slate-950/40 border border-slate-800/40">
                    <span className="text-slate-500">18:42:04</span>
                    <span className="text-cyan-400 font-semibold">TRACKING ESTABLISHED</span>
                    <span className="text-slate-300">ByteTrack assigned persistent ID #104</span>
                  </div>
                  <div className="flex items-center space-x-3 p-2 rounded bg-slate-950/40 border border-slate-800/40">
                    <span className="text-slate-500">18:42:08</span>
                    <span className="text-amber-400 font-semibold">BEHAVIOUR ANALYZED</span>
                    <span className="text-slate-300">Displacement velocity: Running vector towards border fence</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Surveillance Grid */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center space-x-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
                  SURVEILLANCE SECTOR GRID
                </h3>
              </div>
              {onNavigateToCameras && (
                <button
                  onClick={onNavigateToCameras}
                  className="text-xs text-slate-400 hover:text-slate-200 font-mono flex items-center space-x-1"
                >
                  <span>ALL FEEDS</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Cameras stream previews */}
            <div className="space-y-3">
              {cameras.length > 0 ? (
                cameras.slice(0, 2).map((cam) => (
                  <div key={cam.camera_id} className="relative rounded bg-black border border-slate-800 overflow-hidden aspect-video group">
                    <img 
                      src={getCameraStreamUrl(cam.camera_id)} 
                      alt={cam.name}
                      className="w-full h-full object-contain"
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs hidden">
                      Ingestion Standby
                    </div>
                    <div className="absolute top-2 left-2 bg-slate-900/90 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-mono text-slate-200 flex items-center space-x-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <span>{cam.name}</span>
                    </div>
                    
                    {/* Hover AI Analysis Trigger */}
                    <div className="absolute top-2 right-2 opacity-90 group-hover:opacity-100 transition">
                      <button
                        type="button"
                        onClick={() => setActiveAiCamId(cam.camera_id)}
                        className="px-2 py-0.5 bg-cyan-600/90 hover:bg-cyan-500 text-white rounded text-[10px] font-mono font-bold flex items-center gap-1 shadow"
                      >
                        <Sparkles className="w-3 h-3" />
                        AI Analysis
                      </button>
                    </div>

                    <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400">
                      LIVE MJPEG
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-500 text-xs font-mono border border-dashed border-slate-800 rounded">
                  No active cameras configured.
                  <br />
                  Use "+ Add Ingestion Source" above.
                </div>
              )}
            </div>

            {/* Modal Live AI Perception HUD */}
            {activeAiCamId && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="w-full max-w-2xl">
                  <LiveAIAnalysisCard 
                    cameraId={activeAiCamId} 
                    onClose={() => setActiveAiCamId(null)} 
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

