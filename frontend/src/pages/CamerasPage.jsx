import React, { useState, useEffect } from 'react';
import { Camera, Plus, Trash2, Edit, Activity, Brain, Map, AlertOctagon, ScanLine, FileVideo, HeartPulse, Settings } from 'lucide-react';
import { getCameraStreamUrl, getCameraHealth, getEvents, getANPR, getZones, deleteCamera, startCamera, stopCamera } from '../services/api';
import AddCameraWizard from '../components/AddCameraWizard';
import ZoneDrawer from '../components/ZoneDrawer';

export default function CamerasPage({ cameras, onRefresh }) {
  const [selectedCam, setSelectedCam] = useState(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [showAddWizard, setShowAddWizard] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [showZoneDrawer, setShowZoneDrawer] = useState(false);
  const [camZones, setCamZones] = useState([]);

  useEffect(() => {
    if (selectedCam && activeTab === 'Health') {
      getCameraHealth(selectedCam.camera_id).then(setHealthData).catch(() => setHealthData(null));
    }
    if (selectedCam && activeTab === 'Zones') {
      getZones(selectedCam.camera_id).then(z => setCamZones(z)).catch(() => setCamZones([]));
    }
  }, [selectedCam, activeTab]);

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this camera?")) {
      await deleteCamera(selectedCam.camera_id);
      setSelectedCam(null);
      onRefresh();
    }
  };

  const handleStart = async () => {
    await startCamera(selectedCam.camera_id);
    onRefresh();
  };

  const handleStop = async () => {
    await stopCamera(selectedCam.camera_id);
    onRefresh();
  };

  const TABS = ['Overview', 'Live', 'AI', 'Zones', 'Alerts', 'ANPR', 'Evidence', 'Health', 'Settings'];

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="font-bold text-white flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Cameras
          </h2>
          <button onClick={() => setShowAddWizard(true)} className="p-1.5 bg-cyan-600 hover:bg-cyan-500 rounded text-white transition">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {cameras.map(cam => (
            <button
              key={cam.camera_id}
              onClick={() => { setSelectedCam(cam); setActiveTab('Overview'); }}
              className={`w-full text-left p-3 rounded-lg text-sm transition flex items-center gap-3 ${
                selectedCam?.camera_id === cam.camera_id ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-800/50' : 'text-slate-300 hover:bg-slate-800 border border-transparent'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${cam.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <div className="truncate flex-1">
                <div className="font-semibold">{cam.name}</div>
                <div className="text-[10px] text-slate-500 truncate">{cam.location}</div>
              </div>
            </button>
          ))}
          {cameras.length === 0 && (
            <div className="p-4 text-center text-xs text-slate-500">No cameras configured.</div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950">
        {selectedCam ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-slate-800">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-white">{selectedCam.name}</h1>
                  <p className="text-slate-400 text-sm font-mono">{selectedCam.camera_id}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleStart} className="px-3 py-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 rounded border border-emerald-700/50 text-sm transition">Start Pipeline</button>
                  <button onClick={handleStop} className="px-3 py-1.5 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded border border-red-700/50 text-sm transition">Stop Pipeline</button>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {TABS.map(t => (
                  <button 
                    key={t}
                    onClick={() => setActiveTab(t)}
                    className={`px-3 py-1.5 rounded-md text-sm transition ${activeTab === t ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'Overview' && (
                <div className="space-y-4 max-w-2xl">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900 p-4 rounded border border-slate-800">
                      <div className="text-xs text-slate-500 mb-1">Status</div>
                      <div className="font-bold text-white capitalize">{selectedCam.status}</div>
                    </div>
                    <div className="bg-slate-900 p-4 rounded border border-slate-800">
                      <div className="text-xs text-slate-500 mb-1">Resolution</div>
                      <div className="font-bold text-white">{selectedCam.resolution || 'Unknown'}</div>
                    </div>
                    <div className="bg-slate-900 p-4 rounded border border-slate-800">
                      <div className="text-xs text-slate-500 mb-1">FPS Target</div>
                      <div className="font-bold text-white">{selectedCam.fps || 30}</div>
                    </div>
                    <div className="bg-slate-900 p-4 rounded border border-slate-800">
                      <div className="text-xs text-slate-500 mb-1">Location</div>
                      <div className="font-bold text-white">{selectedCam.location || 'Not set'}</div>
                    </div>
                    <div className="bg-slate-900 p-4 rounded border border-slate-800">
                      <div className="text-xs text-slate-500 mb-1">Created At</div>
                      <div className="font-bold text-white">{selectedCam.created_at ? new Date(selectedCam.created_at).toLocaleString() : 'Unknown'}</div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'Live' && (
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-800 max-w-4xl max-h-[70vh]">
                  <img 
                    src={getCameraStreamUrl(selectedCam.camera_id)} 
                    alt="Live Stream" 
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-4 left-4 bg-black/60 px-2 py-1 rounded text-xs text-white font-mono flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    LIVE
                  </div>
                </div>
              )}

              {activeTab === 'AI' && (
                <div className="space-y-4 max-w-2xl">
                  <h3 className="font-bold text-white flex items-center gap-2"><Brain className="w-5 h-5 text-purple-400" /> Active Models</h3>
                  <div className="bg-slate-900 p-4 rounded border border-slate-800 space-y-3">
                    <div>
                      <div className="font-bold text-emerald-400">General Detector</div>
                      <div className="text-sm text-slate-300">YOLOv8n (Classes: person, car, truck, bus, motorcycle, bicycle)</div>
                    </div>
                    <div className="border-t border-slate-800 pt-3">
                      <div className="font-bold text-slate-500">Small-Arms Detector</div>
                      <div className="text-sm text-slate-500">NOT AVAILABLE</div>
                    </div>
                    <div className="border-t border-slate-800 pt-3">
                      <div className="font-bold text-blue-400">ANPR Engine</div>
                      <div className="text-sm text-slate-300">EasyOCR</div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'Zones' && (
                <div className="space-y-4 max-w-4xl relative">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-white flex items-center gap-2"><Map className="w-5 h-5 text-cyan-400" /> Defined Zones</h3>
                    <button onClick={() => setShowZoneDrawer(true)} className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-sm transition">
                      + Draw New Zone
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
                          getZones(selectedCam.camera_id).then(setCamZones);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="bg-slate-900 rounded border border-slate-800 p-4">
                      {camZones.length > 0 ? (
                        <ul className="space-y-2">
                          {camZones.map(z => (
                            <li key={z.zone_id} className="flex justify-between items-center p-2 bg-slate-950 rounded border border-slate-800">
                              <span className="text-sm text-white font-semibold">{z.name} ({z.zone_type})</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-slate-500 text-sm">No zones defined.</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'Health' && (
                <div className="space-y-4 max-w-2xl">
                  <h3 className="font-bold text-white flex items-center gap-2"><HeartPulse className="w-5 h-5 text-red-400" /> Pipeline Health Telemetry</h3>
                  <div className="bg-slate-900 p-4 rounded border border-slate-800">
                    <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">
                      {healthData ? JSON.stringify(healthData, null, 2) : 'Loading health data...'}
                    </pre>
                  </div>
                </div>
              )}

              {activeTab === 'Settings' && (
                <div className="space-y-6 max-w-2xl">
                  <div className="bg-slate-900 p-6 rounded border border-slate-800 space-y-4">
                    <h3 className="font-bold text-white flex items-center gap-2"><Settings className="w-5 h-5 text-slate-400" /> Camera Configuration</h3>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">RTSP URL / Source</label>
                      <input type="text" readOnly value={selectedCam.rtsp_url} className="w-full bg-slate-950 border border-slate-700 p-2 rounded text-slate-300 text-sm" />
                    </div>
                    <div className="pt-4 border-t border-slate-800">
                      <h4 className="text-sm font-bold text-red-400 mb-2">Danger Zone</h4>
                      <button onClick={handleDelete} className="px-4 py-2 bg-red-900/50 hover:bg-red-900 text-red-300 rounded text-sm transition flex items-center gap-2">
                        <Trash2 className="w-4 h-4" /> Delete Camera
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Placeholders for Alerts, ANPR, Evidence */}
              {['Alerts', 'ANPR', 'Evidence'].includes(activeTab) && (
                <div className="text-slate-500 text-sm">
                  {activeTab} view filtered to {selectedCam.name} (Data loaded here...)
                </div>
              )}

            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 flex-col gap-4">
            <Camera className="w-12 h-12 opacity-20" />
            <p>Select a camera from the sidebar or add a new one.</p>
          </div>
        )}
      </div>

      {showAddWizard && <AddCameraWizard onClose={() => setShowAddWizard(false)} onComplete={() => { setShowAddWizard(false); onRefresh(); }} />}
    </div>
  );
}
