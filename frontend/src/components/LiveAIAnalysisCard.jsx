import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Brain, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Eye, 
  ShieldAlert, 
  X, 
  Compass, 
  Zap,
  Info,
  Layers
} from 'lucide-react';
import { getCameraActivityAnalysis, consultGemini, getEvents } from '../services/api';

export default function LiveAIAnalysisCard({ cameraId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [geminiConsulting, setGeminiConsulting] = useState(false);
  const [geminiResult, setGeminiResult] = useState(null);
  const [geminiError, setGeminiError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchAnalysis = async () => {
      try {
        const res = await getCameraActivityAnalysis(cameraId);
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch live activity analysis", err);
      }
    };

    fetchAnalysis();
    const interval = setInterval(fetchAnalysis, 1500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [cameraId]);

  const handleRequestGemini = async () => {
    setGeminiConsulting(true);
    setGeminiError(null);
    setGeminiResult(null);
    try {
      // Find latest event for this camera to consult Gemini
      const eventsRes = await getEvents(0, 10);
      const camEvent = (eventsRes?.items || []).find(e => e.camera_id === cameraId);
      if (!camEvent) {
        setGeminiError("No recent security event found on this camera for secondary verification.");
        setGeminiConsulting(false);
        return;
      }
      const res = await consultGemini(camEvent.event_id);
      if (res && res.gemini_analysis) {
        setGeminiResult(res.gemini_analysis);
      } else {
        setGeminiError(res?.error || "Gemini advisory key not configured or cooldown active.");
      }
    } catch (err) {
      setGeminiError(err.message || "Failed to query Gemini advisory layer.");
    } finally {
      setGeminiConsulting(false);
    }
  };

  const getFramingColor = (framing) => {
    switch (framing) {
      case 'FULL_BODY':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'UPPER_BODY':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'FACE_CLOSE_RANGE':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'WIDE_SCENE':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'PARTIAL_BODY':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      default:
        return 'bg-slate-700/40 text-slate-300 border-slate-600';
    }
  };

  const tracks = data?.tracks || [];

  return (
    <div className="bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 rounded-lg shadow-2xl p-4 text-xs font-mono max-h-[580px] overflow-y-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center space-x-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
          </span>
          <span className="font-bold text-slate-200 tracking-wider uppercase text-[11px]">
            Live AI Perception & Framing HUD
          </span>
        </div>
        <button 
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Framing Overview Bar */}
      <div className="bg-slate-950/80 border border-slate-800 rounded p-2.5 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Eye className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-400">Camera View Framing:</span>
        </div>
        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border uppercase ${getFramingColor(data?.framing_overview)}`}>
          {data?.framing_overview || 'EVALUATING...'}
        </span>
      </div>

      {/* Active Tracks List */}
      {tracks.length > 0 ? (
        <div className="space-y-3">
          {tracks.map((track) => (
            <div 
              key={track.track_id} 
              className={`p-3 rounded border transition ${
                track.in_restricted 
                  ? 'bg-rose-950/40 border-rose-600/60' 
                  : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              {/* Target Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white">
                    Track #{track.track_id}
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px] uppercase">
                    {track.class_name}
                  </span>
                  <span className="text-[10px] text-emerald-400">
                    {Math.round(track.confidence * 100)}% Conf
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${
                  track.behaviour === 'Running' 
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50' 
                    : (track.behaviour === 'Loitering' ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-slate-800 text-slate-300 border-slate-700')
                }`}>
                  {track.behaviour}
                </span>
              </div>

              {/* Kinematic Telemetry */}
              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300 mb-2.5 bg-slate-900/60 p-2 rounded">
                <div>
                  <span className="text-slate-500">Dwell Duration: </span>
                  <span className="text-cyan-300 font-bold">{track.dwell_time}s</span>
                </div>
                <div>
                  <span className="text-slate-500">Velocity Norm: </span>
                  <span className="text-cyan-300 font-bold">{track.speed_norm}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Vector: </span>
                  <span className="text-slate-200">{track.direction}</span>
                </div>
                <div>
                  <span className="text-slate-500">Framing: </span>
                  <span className="text-slate-200 font-semibold">{track.framing}</span>
                </div>
                <div>
                  <span className="text-slate-500">Est. Posture: </span>
                  <span className="text-slate-200 font-semibold">{track.posture}</span>
                </div>
              </div>

              {/* Truthful Evidence Classification Badges */}
              <div className="space-y-1.5 text-[10px]">
                {/* OBSERVED */}
                <div className="flex items-start gap-1.5">
                  <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded text-[9px] font-bold flex-shrink-0">
                    OBSERVED
                  </span>
                  <span className="text-slate-400">
                    {track.evidence_tags?.observed?.join(' • ')}
                  </span>
                </div>

                {/* INFERRED */}
                <div className="flex items-start gap-1.5">
                  <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded text-[9px] font-bold flex-shrink-0">
                    INFERRED
                  </span>
                  <span className="text-slate-400">
                    {track.evidence_tags?.inferred?.join(' • ')}
                  </span>
                </div>

                {/* UNAVAILABLE (Truthful AI Guarantee) */}
                <div className="flex items-start gap-1.5">
                  <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded text-[9px] font-bold flex-shrink-0">
                    UNAVAILABLE
                  </span>
                  <span className="text-slate-500">
                    {track.evidence_tags?.unavailable?.join(' • ')}
                  </span>
                </div>

                {/* INSUFFICIENT EVIDENCE (if any) */}
                {track.evidence_tags?.insufficient_evidence?.length > 0 && (
                  <div className="flex items-start gap-1.5">
                    <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[9px] font-bold flex-shrink-0">
                      INSUFFICIENT
                    </span>
                    <span className="text-amber-400">
                      {track.evidence_tags.insufficient_evidence.join(' • ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 bg-slate-950/60 rounded border border-slate-800 text-center space-y-1">
          <div className="text-slate-400 font-semibold">Scene Clean — No Active Targets</div>
          <div className="text-[10px] text-slate-600">
            ByteTrack algorithm awaiting movement above confidence threshold (0.25)
          </div>
        </div>
      )}

      {/* Secondary Non-Blocking Gemini Advisory Layer */}
      <div className="pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-bold text-slate-300 text-[11px]">
              Secondary Gemini Vision Advisory
            </span>
          </div>
          <button 
            type="button"
            onClick={handleRequestGemini}
            disabled={geminiConsulting}
            className="px-2.5 py-1 bg-amber-600/80 hover:bg-amber-500 disabled:opacity-40 text-white font-bold rounded text-[10px] flex items-center gap-1 transition"
          >
            {geminiConsulting ? 'Consulting...' : 'Request Advisory'}
          </button>
        </div>

        {geminiResult && (
          <div className="bg-amber-950/30 border border-amber-500/40 p-2.5 rounded text-[11px] text-amber-200 space-y-1">
            <div className="font-bold text-amber-300 flex items-center justify-between">
              <span>Gemini Advisory Assessment:</span>
              <span className="text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/40">
                Threat: {geminiResult.threat_level || 'EVALUATED'}
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[10px]">
              {geminiResult.reasoning || JSON.stringify(geminiResult)}
            </p>
          </div>
        )}

        {geminiError && (
          <div className="bg-slate-950 border border-slate-800 p-2 rounded text-[10px] text-slate-400 flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <span>{geminiError}</span>
          </div>
        )}
      </div>

      {/* Truthfulness Footer Banner */}
      <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-500 flex items-center justify-between">
        <span>Skeletal Model: Not Configured</span>
        <span>Arms Model: Not Loaded</span>
      </div>
    </div>
  );
}
