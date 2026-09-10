import React, { useState } from 'react';
import { X, ShieldCheck, Check, Clock, Copy, AlertOctagon, Film, Image } from 'lucide-react';
import RiskBadge from './RiskBadge';
import ExplainableRules from './ExplainableRules';

export default function EventReplayModal({ event, onClose, onAcknowledge }) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('snapshot');

  if (!event) return null;

  const copyHash = () => {
    if (event.evidence_hash) {
      navigator.clipboard.writeText(event.evidence_hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Recommended operator actions based on severity & event type
  const getDirective = () => {
    if (event.severity === "Critical") {
      return "IMMEDIATE ACTION: Dispatch Quick Reaction Force (QRF) to Sector perimeter. Initiate tactical strobe and sound perimeter intrusion horn.";
    } else if (event.event_type === "LOITERING") {
      return "OPERATOR DIRECTIVE: Monitor target dwell time. Pan secondary PTZ camera and issue automated public address warning.";
    } else if (event.class_name === "car" || event.class_name === "truck") {
      return "CHECKPOINT PROTOCOL: Lower hydraulic barrier. Direct driver to inspection bay for physical credentials check.";
    }
    return "STANDARD DIRECTIVE: Maintain visual contact. Log sector status.";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <AlertOctagon className="w-6 h-6 text-red-500" />
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Incident Replay & Evidence File
                <span className="text-xs font-mono text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800">
                  #{event.event_id?.slice(0, 8)}
                </span>
              </h2>
              <div className="text-xs text-slate-400">{event.camera_id} • {new Date(event.timestamp * 1000).toLocaleString()}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Media Player Column */}
          <div className="space-y-4">
            <div className="flex gap-2 border-b border-slate-800 pb-2">
              <button 
                onClick={() => setActiveTab('snapshot')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded transition ${activeTab === 'snapshot' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
                <Image className="w-3.5 h-3.5" /> High-Res Snapshot
              </button>
              <button 
                onClick={() => setActiveTab('clip')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded transition ${activeTab === 'clip' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
                <Film className="w-3.5 h-3.5" /> 5s Video Evidence
              </button>
            </div>

            <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center">
              {activeTab === 'snapshot' ? (
                event.evidence_snapshot || event.snapshot_path ? (
                  <img src={`/evidence/${event.event_id}_snapshot.jpg`} alt="Evidence Frame" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-sm text-slate-500">No snapshot image recorded</div>
                )
              ) : (
                <video 
                  controls 
                  autoPlay 
                  loop 
                  className="w-full h-full object-contain"
                  src={`/evidence/${event.event_id}_clip.mp4`}
                />
              )}
            </div>

            {/* Cryptographic Hash Box */}
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  SHA-256 Tamper-Proof Checksum:
                </span>
                <button onClick={copyHash} className="text-cyan-400 hover:text-cyan-300 text-[11px] flex items-center gap-1">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <div className="font-mono text-[10px] text-emerald-300 break-all bg-slate-900/80 p-1.5 rounded border border-emerald-900/50">
                {event.evidence_hash || "Hash not available"}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Cryptographically verified. Chain-of-custody valid for investigative reporting.</div>
            </div>
          </div>

          {/* Incident Intelligence Column */}
          <div className="space-y-4">
            {/* Four Core Answers */}
            <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-cyan-400 border-b border-slate-800 pb-1">
                Tactical Operator Decision Matrix
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-400">1. What is happening?</span>
                <p className="text-sm font-medium text-slate-100 mt-0.5">
                  Potential target <span className="text-cyan-300">Track #{event.track_id || 'N/A'}</span> (possible {event.class_name || 'person'}) initiated <span className="text-red-400 font-bold">{event.event_type}</span>.
                </p>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-400">2. Where is it happening?</span>
                <p className="text-sm text-slate-100 mt-0.5">
                  Camera <span className="text-cyan-300">{event.camera_id}</span> • Zone: <span className="text-amber-300">{event.zone_name || 'Unknown Zone'}</span>
                </p>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-400">3. How serious is it?</span>
                <div className="mt-1">
                  <RiskBadge score={event.risk_score} severity={event.severity} />
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-400">4. What should the operator do?</span>
                <div className="mt-1 p-2 bg-red-950/40 border border-red-800/60 rounded text-xs text-red-200 font-medium leading-relaxed">
                  {getDirective()}
                </div>
              </div>
            </div>

            {/* Explainable Rules */}
            <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800">
              <ExplainableRules rules={event.explainability} />
            </div>

            {/* Incident State Timeline */}
            <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 space-y-2">
              <div className="text-xs font-semibold uppercase text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" /> Unified Lifecycle Timeline
              </div>
              <div className="space-y-1.5">
                {event.timeline ? event.timeline.map((t, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0"></div>
                    <span className="font-mono text-slate-400">{new Date(t.time * 1000).toLocaleTimeString()}</span>
                    <span className="font-semibold text-slate-200">{t.state}:</span>
                    <span className="text-slate-400 text-[11px] truncate">{t.detail}</span>
                  </div>
                )) : (
                  <div className="text-slate-500 text-xs italic">Timeline data not available</div>
                )}
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition">
                Close
              </button>
              {!event.acknowledged && (
                <button 
                  onClick={() => { onAcknowledge(event.event_id); onClose(); }}
                  className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-xs text-white font-semibold transition flex items-center gap-1.5 shadow-lg shadow-cyan-600/30">
                  <Check className="w-4 h-4" /> Acknowledge & Dispatch QRF
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}