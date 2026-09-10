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
  RefreshCw,
  Sliders,
  Shield,
  Sparkles
} from 'lucide-react';
import { testCameraConnection, createCamera } from '../services/api';

const PROFILE_TEMPLATES = {
  'Border Fence Monitoring': {
    sector: 'Sector Alpha',
    alert_threshold: 60,
    modules: {
      intrusion: true,
      loitering: true,
      direction: true,
      group: true,
      animal_filter: true,
      anpr: false,
      small_arms: false,
      day_night: true
    }
  },
  'Checkpoint Monitoring': {
    sector: 'Checkpost Bravo',
    alert_threshold: 50,
    modules: {
      intrusion: true,
      loitering: true,
      direction: true,
      group: true,
      animal_filter: true,
      anpr: true,
      small_arms: false,
      day_night: true
    }
  },
  'Vehicle Inspection': {
    sector: 'Inspection Lane 1',
    alert_threshold: 40,
    modules: {
      intrusion: false,
      loitering: false,
      direction: true,
      group: false,
      animal_filter: false,
      anpr: true,
      small_arms: false,
      day_night: true
    }
  },
  'Sensitive Sector': {
    sector: 'Sector Charlie Restricted',
    alert_threshold: 40,
    modules: {
      intrusion: true,
      loitering: true,
      direction: true,
      group: true,
      animal_filter: true,
      anpr: true,
      small_arms: false,
      day_night: true
    }
  },
  'Custom': {
    sector: 'Sector Custom',
    alert_threshold: 60,
    modules: {
      intrusion: true,
      loitering: true,
      direction: true,
      group: true,
      animal_filter: true,
      anpr: true,
      small_arms: false,
      day_night: true
    }
  }
};

export default function AddCameraWizard({ onClose, onComplete }) {
  const [step, setStep] = useState(1);
  const [sourceType, setSourceType] = useState('webcam');
  const [rtspUrl, setRtspUrl] = useState('0');
  const [name, setName] = useState('HQ Command Post Camera');
  const [sector, setSector] = useState('Sector Alpha');
  const [location, setLocation] = useState('HQ Tactical Command Post');
  const [profile, setProfile] = useState('Border Fence Monitoring');
  const [alertThreshold, setAlertThreshold] = useState(60);
  const [geminiEnabled, setGeminiEnabled] = useState(true);
  const [enabledModules, setEnabledModules] = useState(PROFILE_TEMPLATES['Border Fence Monitoring'].modules);

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
      defaultLoc: 'HQ Tactical Command Post',
      defaultProfile: 'Border Fence Monitoring'
    },
    {
      id: 'border_intrusion',
      title: 'Border Intrusion Scenario',
      desc: 'Simulated high-risk border fence crossing (demo video)',
      url: 'demo/videos/border_intrusion.mp4',
      defaultName: 'Sector Alpha - Fence 04',
      defaultLoc: 'North Border Line',
      defaultProfile: 'Border Fence Monitoring'
    },
    {
      id: 'night_movement',
      title: 'Night Movement & Loitering',
      desc: 'Low-light thermal sector loitering detection clip',
      url: 'demo/videos/night_movement.mp4',
      defaultName: 'Sector Bravo - Thermal Post',
      defaultLoc: 'East Valley Outpost',
      defaultProfile: 'Sensitive Sector'
    },
    {
      id: 'vehicle_checkpoint',
      title: 'Vehicle Checkpost & ANPR',
      desc: 'Road checkpoint monitoring with vehicle and ANPR recognition',
      url: 'demo/videos/vehicle_checkpoint.mp4',
      defaultName: 'Checkpost Bravo Gate 1',
      defaultLoc: 'Main Highway Ingress',
      defaultProfile: 'Checkpoint Monitoring'
    }
  ];

  const handleSelectPreset = (p) => {
    setSourceType(p.id);
    setRtspUrl(p.url);
    setName(p.defaultName);
    setLocation(p.defaultLoc);
    if (p.defaultProfile) {
      handleProfileChange(p.defaultProfile);
    }
    setTestError('');
  };

  const handleProfileChange = (newProfile) => {
    setProfile(newProfile);
    const tmpl = PROFILE_TEMPLATES[newProfile];
    if (tmpl) {
      setSector(tmpl.sector);
      setAlertThreshold(tmpl.alert_threshold);
      setEnabledModules({ ...tmpl.modules });
    }
  };

  const handleModuleToggle = (key) => {
    if (key === 'small_arms') return; // Cannot enable missing model
    setEnabledModules(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
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
        sector: sector,
        profile: profile,
        alert_threshold: alertThreshold,
        gemini_enabled: geminiEnabled,
        enabled_modules: enabledModules,
        fps: testResult?.fps || 20.0
      });
      setStep(5);
    } catch (err) {
      alert("Failed to create camera source");
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-800 flex justify-between items-center bg-slate-950/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight uppercase font-mono">
                Deploy Surveillance Feed
              </h2>
              <p className="text-[11px] text-slate-400">Connect camera source & configure autonomous AI mission profile</p>
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
        <div className="p-6 overflow-y-auto flex-1">
          {/* STEP 1: Source */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Step 1: Ingestion Source</h3>
                  <p className="text-xs text-slate-400">Select standard test feed, integrated webcam, or RTSP IP camera.</p>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  STEP 1 OF 4
                </span>
              </div>

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

              <div className="pt-2">
                <label className="block text-xs font-mono font-medium text-slate-400 mb-1.5">
                  RTSP Stream URL / Webcam Index / File:
                </label>
                <div className="flex items-center space-x-2">
                  <input 
                    type="text" 
                    value={rtspUrl}
                    onChange={e => setRtspUrl(e.target.value)}
                    placeholder="rtsp://admin:pass@192.168.1.50:554/live or 0"
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => { setRtspUrl('0'); setName('Local Webcam'); setLocation('HQ Command Post'); }}
                    className="px-2.5 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono shrink-0"
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
                      <span>Validating Stream Connection...</span>
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

          {/* STEP 2: Preview */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Step 2: Stream Handshake</h3>
                  <p className="text-xs text-slate-400">Stream decoded successfully. Inspect live test frame below.</p>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  STEP 2 OF 4
                </span>
              </div>
              
              <div className="aspect-video bg-black rounded-lg border border-slate-800 overflow-hidden relative flex items-center justify-center">
                {testResult?.preview_frame ? (
                  <img src={`data:image/jpeg;base64,${testResult.preview_frame}`} alt="Preview Frame" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-slate-500 font-mono text-xs">Waiting for video stream...</div>
                )}
                <div className="absolute bottom-2 left-2 bg-slate-950/80 backdrop-blur px-2.5 py-1 rounded text-[11px] text-slate-200 font-mono border border-slate-800">
                  Resolution: <span className="text-emerald-400">{testResult?.width}x{testResult?.height}</span> • Detected: <span className="text-cyan-400">{testResult?.fps} FPS</span>
                </div>
              </div>

              <div className="flex justify-between pt-3 border-t border-slate-800">
                <button 
                  onClick={() => setStep(1)} 
                  className="px-3.5 py-2 bg-slate-800 text-slate-300 rounded text-xs transition flex items-center gap-1.5 hover:bg-slate-700 border border-slate-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button 
                  onClick={() => setStep(3)} 
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                >
                  <span>Configure AI Mission Profile</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Mission Profile & Modular AI */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Step 3: Surveillance Profile & AI Modules</h3>
                  <p className="text-xs text-slate-400">Configure autonomous perception parameters and security matrix.</p>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  STEP 3 OF 4
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Camera Callsign / Name</label>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="e.g. Sector Alpha Gate 01" 
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded text-xs text-white focus:outline-none focus:border-emerald-500 font-sans" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Deployment Sector</label>
                  <input 
                    type="text" 
                    value={sector} 
                    onChange={e => setSector(e.target.value)} 
                    placeholder="e.g. Sector Alpha" 
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded text-xs text-white focus:outline-none focus:border-emerald-500 font-sans" 
                  />
                </div>
              </div>

              {/* Surveillance Profile Selector */}
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Surveillance Profile Preset</label>
                <select
                  value={profile}
                  onChange={e => handleProfileChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 px-3 py-2 rounded text-xs text-white focus:outline-none focus:border-emerald-500 font-sans"
                >
                  {Object.keys(PROFILE_TEMPLATES).map(pName => (
                    <option key={pName} value={pName}>{pName}</option>
                  ))}
                </select>
              </div>

              {/* Modular AI Checkbox Matrix */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                <span className="text-[11px] font-mono text-slate-300 font-semibold uppercase tracking-wider block mb-2">
                  Active Modular AI Capabilities
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'intrusion', label: 'Intrusion Detection' },
                    { id: 'loitering', label: 'Loitering / Dwell Tracking' },
                    { id: 'direction', label: 'Direction & Velocity Anomaly' },
                    { id: 'group', label: 'Group Movement Analysis' },
                    { id: 'animal_filter', label: 'Animal Activity Filter' },
                    { id: 'anpr', label: 'Automatic Number Plate (ANPR)' },
                    { id: 'day_night', label: 'Day / Night Luminance Adapt' },
                    { id: 'small_arms', label: 'Weapon / Small Arms Detection', unavailable: true }
                  ].map(mod => (
                    <label 
                      key={mod.id} 
                      className={`flex items-center gap-2 p-1.5 rounded border transition cursor-pointer ${
                        mod.unavailable 
                          ? 'bg-amber-950/20 border-amber-800/40 text-slate-400 cursor-not-allowed'
                          : enabledModules[mod.id] 
                            ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-200' 
                            : 'bg-slate-900/40 border-slate-800/50 text-slate-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={mod.unavailable ? false : !!enabledModules[mod.id]}
                        disabled={mod.unavailable}
                        onChange={() => handleModuleToggle(mod.id)}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                      />
                      <span className="text-[11px] font-sans flex-1">{mod.label}</span>
                      {mod.unavailable && (
                        <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          MODEL UNAVAILABLE
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Threshold & Gemini */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                    <span>Alert Threshold:</span>
                    <span className="text-emerald-400 font-bold">{alertThreshold} / 100</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="90"
                    value={alertThreshold}
                    onChange={e => setAlertThreshold(parseInt(e.target.value))}
                    className="w-full accent-emerald-500 h-1 bg-slate-800 rounded appearance-none cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-950/60 rounded border border-slate-800">
                  <div>
                    <span className="text-xs font-semibold text-slate-300 block">Gemini Advisory</span>
                    <span className="text-[10px] text-slate-500">Secondary verification</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={geminiEnabled}
                    onChange={e => setGeminiEnabled(e.target.checked)}
                    className="rounded border-slate-700 text-sky-500 focus:ring-0 w-4 h-4 cursor-pointer"
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
                  <h3 className="text-sm font-semibold text-white">Step 4: Final Verification</h3>
                  <p className="text-xs text-slate-400">Review deployment parameters before launching inference pipeline.</p>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  STEP 4 OF 4
                </span>
              </div>

              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2 text-xs font-sans">
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500 font-mono">Tactical Name:</span>
                  <span className="text-white font-bold">{name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500 font-mono">Sector:</span>
                  <span className="text-white">{sector}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500 font-mono">Mission Profile:</span>
                  <span className="text-emerald-400 font-semibold">{profile}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500 font-mono">Alert Threshold:</span>
                  <span className="text-amber-400 font-mono">{alertThreshold} / 100</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/80">
                  <span className="text-slate-500 font-mono">Gemini Secondary Layer:</span>
                  <span className={geminiEnabled ? "text-sky-400 font-mono" : "text-slate-500 font-mono"}>
                    {geminiEnabled ? "Enabled (Advisory)" : "Disabled"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500 font-mono">Stream URL:</span>
                  <span className="text-slate-300 font-mono truncate max-w-[280px]" title={rtspUrl}>{rtspUrl}</span>
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
                      <span>Binding Inference Engine...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Activate & Start Feed</span>
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
                  The feed is now active with profile <span className="text-emerald-400 font-semibold">{profile}</span>. Frame annotations and alarms are running in real time.
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
