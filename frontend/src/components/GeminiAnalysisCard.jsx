import React, { useState } from 'react';
import { Sparkles, ShieldCheck, AlertTriangle, RefreshCw, Eye, Info, Clock, CheckCircle2 } from 'lucide-react';
import { consultGemini } from '../services/api';

export default function GeminiAnalysisCard({ incident, onUpdated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!incident) return null;

  const localPerception = {
    class_name: incident.class_name || 'person',
    confidence: incident.confidence ? Math.round(incident.confidence * 100) : 0,
    track_id: incident.track_id,
    behaviour: incident.behaviour || 'Normal',
    risk_score: incident.risk_score || 0,
    zone_name: incident.zone_name || 'Perimeter',
    explainability: Array.isArray(incident.explainability) ? incident.explainability : []
  };

  let geminiData = incident.gemini_analysis || null;
  if (typeof geminiData === 'string') {
    try { geminiData = JSON.parse(geminiData); } catch { geminiData = null; }
  }
  const geminiStatus = incident.gemini_status || (geminiData ? 'COMPLETED' : 'NONE');

  const handleConsult = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await consultGemini(incident.event_id);
      if (res && onUpdated) {
        onUpdated({
          ...incident,
          gemini_analysis: res,
          gemini_status: res.status || 'COMPLETED'
        });
      }
    } catch (err) {
      setError(err.message || 'Consultation request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
      {/* Header Bar */}
      <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Dual AI Analysis & Verification
          </span>
        </div>
        <div className="flex items-center gap-2">
          {geminiStatus === 'COMPLETED' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3" /> VERIFIED ADVISORY
            </span>
          )}
          {geminiStatus === 'OFFLINE' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              LOCAL ONLY
            </span>
          )}
          {geminiStatus === 'PENDING' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <RefreshCw className="w-3 h-3 animate-spin" /> ANALYZING
            </span>
          )}
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Pane: LOCAL AI PERCEPTION */}
        <div className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800/60 pb-2">
              <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                LOCAL AI PERCEPTION
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
                YOLOv8 + ByteTrack
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-3">
              <div className="bg-slate-900/60 p-2 rounded border border-slate-800/50">
                <span className="text-[10px] text-slate-500 block">TARGET CLASS</span>
                <span className="font-semibold text-slate-200 capitalize">{localPerception.class_name}</span>
                {localPerception.track_id && (
                  <span className="text-emerald-400 ml-1">#{localPerception.track_id}</span>
                )}
              </div>
              <div className="bg-slate-900/60 p-2 rounded border border-slate-800/50">
                <span className="text-[10px] text-slate-500 block">DETECTION CONF</span>
                <span className="font-semibold text-slate-200">{localPerception.confidence}%</span>
              </div>
              <div className="bg-slate-900/60 p-2 rounded border border-slate-800/50">
                <span className="text-[10px] text-slate-500 block">CLASSIFIED BEHAVIOUR</span>
                <span className="font-semibold text-amber-400">{localPerception.behaviour}</span>
              </div>
              <div className="bg-slate-900/60 p-2 rounded border border-slate-800/50">
                <span className="text-[10px] text-slate-500 block">LOCAL RISK SCORE</span>
                <span className={`font-bold ${localPerception.risk_score >= 70 ? 'text-rose-400' : 'text-amber-400'}`}>
                  {localPerception.risk_score} / 100
                </span>
              </div>
            </div>

            {localPerception.explainability.length > 0 && (
              <div className="mb-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                  Triggered Heuristic Rules
                </span>
                <div className="space-y-1">
                  {localPerception.explainability.map((rule, idx) => (
                    <div key={idx} className="text-[11px] font-mono text-slate-400 bg-slate-900/50 px-2 py-0.5 rounded border border-slate-800/40">
                      • {rule}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-400 font-mono mt-2 pt-2 border-t border-slate-800/40">
            Real-time edge perception engine operating autonomously.
          </div>
        </div>

        {/* Right Pane: GEMINI ASSISTED ANALYSIS */}
        <div className="bg-slate-950/40 border border-slate-800/80 rounded-lg p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-800/60 pb-2">
              <span className="text-[11px] font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                GEMINI ASSISTED ANALYSIS
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded">
                {geminiData?.model || 'Multimodal Vision'}
              </span>
            </div>

            {geminiData && geminiStatus === 'COMPLETED' ? (
              <div className="space-y-2.5 text-xs">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                    Situational Assessment
                  </span>
                  <p className="text-slate-200 leading-relaxed font-sans mt-0.5">
                    {geminiData.situational_assessment || 'Snapshot evaluated.'}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                    Ambiguity & Lighting Analysis
                  </span>
                  <p className="text-slate-400 text-[11px] font-sans mt-0.5">
                    {geminiData.ambiguity_explanation || 'No visual anomalies reported.'}
                  </p>
                </div>

                <div className="bg-sky-950/30 border border-sky-800/40 rounded p-2">
                  <span className="text-[10px] font-mono font-semibold text-sky-400 uppercase tracking-wider block">
                    Recommended Operator Response (SOP)
                  </span>
                  <p className="text-sky-200 text-xs font-sans mt-0.5">
                    {geminiData.recommended_operator_response || 'Follow standard perimeter patrol procedure.'}
                  </p>
                </div>

                {Array.isArray(geminiData.threat_indicators) && geminiData.threat_indicators.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {geminiData.threat_indicators.map((t, idx) => (
                      <span key={idx} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center">
                <Info className="w-7 h-7 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 mb-1">
                  {geminiStatus === 'OFFLINE'
                    ? 'Gemini API is offline or unconfigured. Operating strictly in LOCAL ONLY mode.'
                    : 'Secondary advisory reasoning has not been executed for this incident.'}
                </p>
                <p className="text-[11px] text-slate-400 mb-3">
                  Operator may consult Gemini on-demand for secondary scene interpretation.
                </p>
                <button
                  onClick={handleConsult}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-medium transition shadow"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  {loading ? 'Consulting Gemini Vision...' : 'Consult Gemini Vision'}
                </button>
                {error && <p className="text-rose-400 text-xs mt-2">{error}</p>}
              </div>
            )}
          </div>

          <div className="text-[10px] text-slate-400 font-mono mt-3 pt-2 border-t border-slate-800/40 italic">
            Advisory intelligence only. Operational dispatch decisions remain under operator control.
          </div>
        </div>
      </div>
    </div>
  );
}
