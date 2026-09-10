import React, { useState } from 'react';
import { 
  Camera, 
  X, 
  Play, 
  Check, 
  AlertTriangle, 
  ChevronRight, 
  ChevronLeft,
  Video,
  Radio,
  HardDrive,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { testCameraConnection, createCamera } from '../services/api';

export default function AddCameraWizard({ onClose, onComplete }) {
  const [step, setStep] = useState(1);
  const [sourceType, setSourceType] = useState('webcam'); // 'webcam', 'rtsp', 'file'
  const [rtspUrl, setRtspUrl] = useState('0');
  const [name, setName] = useState('Sector Ops Webcam');
  const [location, setLocation] = useState('HQ Tactical Command Post');
  
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState('');
  const [creating, setCreating] = useState(false);

  const presets = [
    {
      id: 'webcam',
      title: 'Local Webcam (Device 0)',
      desc: 'Connect the primary USB or integrated webcam for live testing',
      url: '0',
      defaultName: 'HQ Tactical Command Webcam',
      defaultLoc: 'HQ Tactical Command Post'
    },
    {
      id: 'border_intrusion',
      title: 'Border Intrusion Scenario',
      desc: 'Simulated high-risk border fence crossing (demo video)',
      url: 'demo/videos/border_intrusion.mp4',
      defaultName: 'Sector Alpha - Fence 04',
      defaultLoc: 'North Border Line'
    },
    {
      id: 'night_movement',
      title: 'Night Movement & Loitering',
      desc: 'Low-light thermal sector loitering detection clip',
      url: 'demo/videos/night_movement.mp4',
      defaultName: 'Sector Bravo - Thermal Post',
      defaultLoc: 'East Valley Outpost'
    },
    {
      id: 'vehicle_checkpoint',
      title: 'Vehicle Checkpost & ANPR',
      desc: 'Road checkpoint monitoring with vehicle and ANPR recognition',
      url: 'demo/videos/vehicle_checkpoint.mp4',
      defaultName: 'Checkpost Bravo Gate 1',
      defaultLoc: 'Main Highway Ingress'
    }
  ];

  const handleSelectPreset = (preset) => {
    setSourceType(preset.id);
    setRtspUrl(preset.url);
    setName(preset.defaultName);
    setLocation(preset.defaultLoc);
    setTestError('');
  };

  const handleTest = async () => {
    if (!rtspUrl) return;
    setTesting(true);
    setTestError('');
    try {
      const res = await testCameraConnection(rtspUrl);
      if (res.success) {
        setTestResult(res);
        setStep(2);
      } else {
        setTestError(res.message || "Connection failed. Please verify the URL or device index.");
      }
    } catch (err) {
      setTestError("Network error or server unreachable");
    } finally {
      setTesting(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createCamera({
        name: name || 'Surveillance Feed',
        rtsp_url: rtspUrl,
        location: location,
        fps: testResult?.fps || 30
      });
      setStep(5);
    } catch (err) {
      alert("Failed to create camera source");
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight uppercase font-mono">
                Add Ingestion Source
              </h2>
              <p className="text-[11px] text-slate-400">Connect RTSP, Webcam, or Local Border Patrol Feeds</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex h-1 bg-slate-800">
          {[1, 2, 3, 4, 5].map(s => (
            <div key={s} className={`flex-1 transition-all duration-300 ${s <= step ? 'bg-emerald-500' : 'bg-slate-800'}`} />
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* STEP 1: Select Source / URL */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Step 1: Select Ingestion Source</h3>
                  <p className="text-xs text-slate-400">Choose a 1-click device preset or enter a custom RTSP / IP stream URL.</p>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  STEP 1 OF 4
                </span>
              </div>

              {/* Source Presets Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {presets.map(p => {
                  const isSelected = rtspUrl === p.url;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectPreset(p)}
                      className={`p-3 rounded-lg border cursor-pointer transition flex flex-col justify-between ${
                        isSelected 
                          ? 'bg-slate-800/90 border-emerald-500 text-white shadow-sm' 
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold">{p.title}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">{p.desc}</p>
                    </div>
                  );
                })}
              </div>

              {/* Custom Input Field */}
              <div className="pt-2">
                <label className="block text-xs font-mono font-medium text-slate-400 mb-1.5">
                  RTSP URL / Device Index / Video Path:
                </label>
                <div className="flex items-center space-x-2">
                  <input 
                    type="text" 
                    value={rtspUrl}
                    onChange={e => setRtspUrl(e.target.value)}
                    placeholder="rtsp://admin:pass@192.168.1.10:554/stream or 0 or demo/videos/clip.mp4"
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => { setRtspUrl('0'); setName('Local Webcam'); setLocation('HQ Tactical Command'); }}
                    className="px-2.5 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono shrink-0"
                    title="Set to Webcam 0"
                  >
                    Set 0
                  </button>
                </div>
              </div>

              {testError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-400 flex items-center gap-2 font-mono">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{testError}</span>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-slate-800">
                <button 
                  onClick={handleTest}
                  disabled={!rtspUrl || testing}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-semibold transition flex items-center gap-2 shadow-sm"
                >
                  {testing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying Feed Connection...</span>
                    </>
                  ) : (
                    <>
                      <span>Test & Verify Feed</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Stream Preview */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Step 2: Verify Video Ingestion</h3>
                  <p className="text-xs text-slate-400">Stream handshake successful. Inspect test frame below.</p>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  STEP 2 OF 4
                </span>
              </div>
              
              <div className="aspect-video bg-black rounded-lg border border-slate-800 overflow-hidden relative flex items-center justify-center">
                {testResult?.preview_frame ? (
                  <img src={`data:image/jpeg;base64,${testResult.preview_frame}`} alt="Preview Frame" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-slate-500 font-mono text-xs">Awaiting preview frame buffer...</div>
                )}
                <div className="absolute bottom-2 left-2 bg-slate-950/80 backdrop-blur px-2.5 py-1 rounded text-[11px] text-slate-200 font-mono border border-slate-800">
                  Resolution: <span className="text-emerald-400">{testResult?.width}x{testResult?.height}</span> • Target: <span className="text-cyan-400">{testResult?.fps} FPS</span>
                </div>
              </div>

              <div className="flex justify-between pt-3 border-t border-slate-800">
                <button 
                  onClick={() => setStep(1)} 
                  className="px-3.5 py-2 bg-slate-800 text-slate-300 rounded text-xs transition flex items-center gap-1.5 hover:bg-slate-700 border border-slate-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back to Sources</span>
                </button>
                <button 
                  onClick={() => setStep(3)} 
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                >
                  <span>Configure Metadata</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Metadata */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Step 3: Sector Information</h3>
                  <p className="text-xs text-slate-400">Assign tactical identification and deployment sector.</p>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  STEP 3 OF 4
                </span>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Camera Tactical Callsign / Name</label>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="e.g. Sector Alpha Gate 01" 
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-xs text-white focus:outline-none focus:border-emerald-500 font-sans" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Deployment Sector / Zone Location</label>
                  <input 
                    type="text" 
                    value={location} 
                    onChange={e => setLocation(e.target.value)} 
                    placeholder="e.g. North Perimeter Fence" 
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-xs text-white focus:outline-none focus:border-emerald-500 font-sans" 
                  />
                </div>
              </div>

              <div className="flex justify-between pt-3 border-t border-slate-800">
                <button 
                  onClick={() => setStep(2)} 
                  className="px-3.5 py-2 bg-slate-800 text-slate-300 rounded text-xs transition flex items-center gap-1.5 hover:bg-slate-700 border border-slate-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button 
                  onClick={() => setStep(4)} 
                  disabled={!name} 
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                >
                  <span>Review Deployment</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Review */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Step 4: Final Deployment Verification</h3>
                  <p className="text-xs text-slate-400">Review parameters before binding to the live inference engine.</p>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  STEP 4 OF 4
                </span>
              </div>

              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2.5 text-xs font-sans">
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500 font-mono">Tactical Name:</span>
                  <span className="text-white font-bold">{name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500 font-mono">Stream Source:</span>
                  <span className="text-emerald-400 font-mono truncate max-w-[280px]" title={rtspUrl}>{rtspUrl}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500 font-mono">Sector Location:</span>
                  <span className="text-white">{location || 'Unassigned'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500 font-mono">Detected Resolution:</span>
                  <span className="text-slate-200 font-mono">{testResult?.width}x{testResult?.height}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500 font-mono">Inference Pipeline:</span>
                  <span className="text-emerald-400 font-mono font-semibold">YOLOv8 + ByteTrack + ANPR Active</span>
                </div>
              </div>

              <div className="flex justify-between pt-3 border-t border-slate-800">
                <button 
                  onClick={() => setStep(3)} 
                  className="px-3.5 py-2 bg-slate-800 text-slate-300 rounded text-xs transition flex items-center gap-1.5 hover:bg-slate-700 border border-slate-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button 
                  onClick={handleCreate} 
                  disabled={creating} 
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-bold transition flex items-center gap-2 shadow-sm"
                >
                  {creating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Binding Pipeline...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm & Activate Feed</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Success */}
          {step === 5 && (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                <Check className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Camera Feed Ingestion Activated</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  The video stream has been registered with the background inference thread. Real-time tracks and alerts will now populate telemetry dashboards.
                </p>
              </div>
              
              <div className="pt-4">
                <button 
                  onClick={onComplete} 
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition shadow-sm"
                >
                  Return to Fleet Overview
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
