import React, { useState } from 'react';
import { Camera, X, Play, Check, AlertTriangle, ChevronRight, ChevronLeft } from 'lucide-react';
import { testCameraConnection, createCamera } from '../services/api';

export default function AddCameraWizard({ onClose, onComplete }) {
  const [step, setStep] = useState(1);
  const [rtspUrl, setRtspUrl] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState('');
  
  const [creating, setCreating] = useState(false);

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
        setTestError(res.message || "Connection failed");
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
        name: name || 'New Camera',
        rtsp_url: rtspUrl,
        location: location,
        fps: testResult?.fps || 30
      });
      setStep(5);
    } catch (err) {
      alert("Failed to create camera");
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-xl w-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-cyan-400" />
            Add New Camera
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex">
          {[1, 2, 3, 4, 5].map(s => (
            <div key={s} className={`h-1 flex-1 ${s <= step ? 'bg-cyan-500' : 'bg-slate-800'}`} />
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white">Step 1: Video Source</h3>
              <p className="text-sm text-slate-400">Enter the RTSP URL or absolute local file path for the video feed.</p>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">RTSP URL / Source Path</label>
                <input 
                  type="text" 
                  value={rtspUrl}
                  onChange={e => setRtspUrl(e.target.value)}
                  placeholder="rtsp://admin:pass@192.168.1.100:554/stream or /path/to/video.mp4"
                  className="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              {testError && (
                <div className="p-3 bg-red-900/30 border border-red-800 rounded text-sm text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> {testError}
                </div>
              )}
              <div className="flex justify-end pt-4">
                <button 
                  onClick={handleTest}
                  disabled={!rtspUrl || testing}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg font-medium transition flex items-center gap-2"
                >
                  {testing ? "Connecting..." : "Test Connection"} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white">Step 2: Stream Preview</h3>
              <p className="text-sm text-slate-400">Connection successful. Verify the stream preview.</p>
              
              <div className="aspect-video bg-black rounded-lg border border-slate-700 overflow-hidden relative">
                {testResult?.preview_frame ? (
                  <img src={`data:image/jpeg;base64,${testResult.preview_frame}`} alt="Preview" className="w-full h-full object-contain" />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500">No preview available</div>
                )}
                <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-white font-mono">
                  {testResult?.width}x{testResult?.height} @ {testResult?.fps}fps
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button onClick={() => setStep(1)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg transition flex items-center gap-2 hover:bg-slate-700">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={() => setStep(3)} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition flex items-center gap-2">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white">Step 3: Camera Details</h3>
              <p className="text-sm text-slate-400">Provide identifying information for this camera.</p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Camera Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sector Alpha Gate" className="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded-lg text-white" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Location / Zone (Optional)</label>
                  <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. North Perimeter" className="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded-lg text-white" />
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button onClick={() => setStep(2)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg transition flex items-center gap-2 hover:bg-slate-700">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={() => setStep(4)} disabled={!name} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg font-medium transition flex items-center gap-2">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-white">Step 4: Review</h3>
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Name</span><span className="text-white font-bold">{name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Source</span><span className="text-white truncate max-w-[200px]" title={rtspUrl}>{rtspUrl}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Location</span><span className="text-white">{location || 'None'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Resolution</span><span className="text-emerald-400 font-mono">{testResult?.width}x{testResult?.height}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Target FPS</span><span className="text-cyan-400 font-mono">{testResult?.fps}</span></div>
              </div>

              <div className="flex justify-between pt-4">
                <button onClick={() => setStep(3)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg transition flex items-center gap-2 hover:bg-slate-700">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={handleCreate} disabled={creating} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition flex items-center gap-2">
                  {creating ? "Saving..." : <><Check className="w-4 h-4" /> Finish</>}
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white">Camera Added Successfully</h3>
              <p className="text-sm text-slate-400 max-w-xs mx-auto">The pipeline will begin processing frames and generating telemetry.</p>
              
              <div className="pt-6">
                <button onClick={onComplete} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold transition">
                  Go to Cameras
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
