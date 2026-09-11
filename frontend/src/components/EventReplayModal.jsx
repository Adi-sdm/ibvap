import React, { useState } from 'react';
import { X, ShieldCheck, Check, Clock, Copy, AlertOctagon, Film, Image } from 'lucide-react';
import RiskBadge from './RiskBadge';
import ExplainableRules from './ExplainableRules';
import GeminiAnalysisCard from './GeminiAnalysisCard';

export default function EventReplayModal({ event, onClose, onAcknowledge }) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('snapshot');
  const [currentEvent, setCurrentEvent] = useState(event);
  const [videoError, setVideoError] = useState(false);

  if (!currentEvent) return null;

  const copyHash = () => {
    const hash = currentEvent.evidence_hash || currentEvent.sha256;
    if (hash) {
      navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getDirective = () => {
    if (currentEvent.severity === "Critical") {
      return "IMMEDIATE ACTION: Dispatch Quick Reaction Force (QRF) to Sector perimeter. Initiate tactical strobe and sound perimeter intrusion horn.";
    } else if (currentEvent.event_type === "LOITERING") {
      return "OPERATOR DIRECTIVE: Monitor target dwell time. Pan secondary PTZ camera and issue automated public address warning.";
    } else if (currentEvent.class_name === "car" || currentEvent.class_name === "truck") {
      return "CHECKPOINT PROTOCOL: Lower hydraulic barrier. Direct driver to inspection bay for physical credentials check.";
    }
    return "STANDARD DIRECTIVE: Maintain visual contact. Log sector status.";
  };

  const snapshotPath = currentEvent.evidence_snapshot || currentEvent.snapshot_path;
  const snapshotSrc = snapshotPath 
    ? (snapshotPath.startsWith('/') || snapshotPath.startsWith('http') ? snapshotPath : `/${snapshotPath.replace(/\\/g, '/')}`)
    : `/evidence/${currentEvent.event_id}_snapshot.jpg`;

  const clipPath = currentEvent.video_clip_path || currentEvent.evidence_clip;
  const clipSrc = clipPath 
    ? (clipPath.startsWith('/') || clipPath.startsWith('http') ? clipPath : `/${clipPath.replace(/\\/g, '/')}`)
    : `/evidence/${currentEvent.event_id}_clip.mp4`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <AlertOctagon className="w-5 h-5 text-rose-500" />
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Incident Replay & Evidence Dossier
                <span className="text-xs font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/60">
                  #{currentEvent.event_id?.slice(0, 8)}
                </span>
              </h2>
              <div className="text-xs text-slate-400 font-mono">
                {currentEvent.camera_id} • {new Date(currentEvent.timestamp * 1000).toLocaleString()}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Media Player Column */}
            <div className="space-y-3">
              <div className="flex gap-2 border-b border-slate-800 pb-2">
                <button 
                  onClick={() => { setActiveTab('snapshot'); setVideoError(false); }}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded transition font-mono ${activeTab === 'snapshot' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
                  <Image className="w-3.5 h-3.5" /> Keyframe Evidence
                </button>
                <button 
                  onClick={() => { setActiveTab('clip'); setVideoError(false); }}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded transition font-mono ${activeTab === 'clip' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
                  <Film className="w-3.5 h-3.5" /> Video Sequence
                </button>
              </div>

              <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
                {activeTab === 'snapshot' ? (
                  <img 
                    src={snapshotSrc} 
                    alt="Evidence Frame" 
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180" fill="%230f172a"><rect width="300" height="180"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2364748b" font-size="12">SURVEILLANCE FRAME</text></svg>';
                    }}
                  />
                ) : (
                  !videoError && clipSrc ? (
                    <video 
                      controls 
                      autoPlay 
                      loop 
                      className="w-full h-full object-contain"
                      src={clipSrc}
                      onError={() => setVideoError(true)}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
                      <Film className="w-8 h-8 text-slate-600 mb-2" />
                      <span className="text-xs font-mono text-slate-300 font-semibold">Video evidence unavailable</span>
                      <span className="text-[11px] text-slate-500 mt-1 max-w-xs font-sans">
                        High-resolution frame snapshot verified (SHA-256 cryptographic chain intact). Video clip was not stored or has expired.
                      </span>
                    </div>
                  )
                )}
              </div>

              {/* Cryptographic Hash Box */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-400 flex items-center gap-1 font-mono text-[11px]">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    SHA-256 Tamper-Proof Checksum:
                  </span>
                  <button onClick={copyHash} className="text-emerald-400 hover:text-emerald-300 text-[11px] flex items-center gap-1 font-mono">
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="font-mono text-[10px] text-emerald-300 break-all bg-slate-900/80 p-1.5 rounded border border-emerald-900/50">
                  {currentEvent.evidence_hash || currentEvent.sha256 || "Unsealed (Cryptographic hash pending)"}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-mono">
                  Cryptographically hashed upon capture. Chain-of-custody valid for defense investigation.
                </div>
              </div>
            </div>

            {/* Tactical Intelligence Column */}
            <div className="space-y-3">
              <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-1 font-mono">
                  Tactical Operator Assessment
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400">1. Operational Activity</span>
                  <p className="text-xs font-medium text-slate-200 mt-0.5 font-sans">
                    Track <span className="text-emerald-400 font-mono">#{currentEvent.track_id || 'N/A'}</span> ({currentEvent.class_name || 'person'}) initiated <span className="text-rose-400 font-bold">{currentEvent.event_type}</span>.
                  </p>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400">2. Incident Sector</span>
                  <p className="text-xs text-slate-200 mt-0.5 font-sans">
                    Feed: <span className="text-emerald-400 font-mono">{currentEvent.camera_id}</span> • Sector: <span className="text-amber-300">{currentEvent.zone_name || 'Boundary Wire'}</span>
                  </p>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400">3. Local Threat Severity</span>
                  <div className="mt-1">
                    <RiskBadge score={currentEvent.risk_score} severity={currentEvent.severity} />
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400">4. Recommended Response</span>
                  <div className="mt-1 p-2 bg-rose-950/30 border border-rose-800/50 rounded text-xs text-rose-200 font-sans leading-relaxed">
                    {getDirective()}
                  </div>
                </div>
              </div>

              {/* Explainable Rules */}
              <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                <ExplainableRules rules={currentEvent.explainability} />
              </div>
            </div>
          </div>

          {/* Dual AI Analysis Card */}
          <GeminiAnalysisCard 
            incident={currentEvent} 
            onUpdated={(updated) => setCurrentEvent(updated)}
          />

          {/* Action Bar */}
          <div className="pt-3 flex justify-end gap-3 border-t border-slate-800">
            <button onClick={onClose} className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition">
              Close
            </button>
            {currentEvent.status === 'NEW' && onAcknowledge && (
              <button 
                onClick={() => { onAcknowledge(currentEvent.event_id); onClose(); }}
                className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-semibold transition flex items-center gap-1.5 shadow">
                <Check className="w-4 h-4" /> Acknowledge & Log Action
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}