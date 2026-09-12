import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Copy, 
  Check, 
  RefreshCw, 
  Layers, 
  Eye, 
  HelpCircle,
  Cpu,
  ArrowRight,
  Activity
} from 'lucide-react';

export default function SituationAssessmentModal({ assessmentData, onClose, onRefresh, loading }) {
  const [copied, setCopied] = useState(false);

  if (!assessmentData && !loading) return null;

  if (loading && !assessmentData) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-sky-500/40 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-sky-500 border-t-transparent animate-spin mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Synthesizing Tactical Assessment</h3>
            <p className="text-xs text-slate-400 font-mono">Gathering multi-camera feeds, incident transitions & telemetry for Gemini multimodal reasoning...</p>
          </div>
        </div>
      </div>
    );
  }

  const data = assessmentData.assessment || assessmentData;
  const posture = data.posture || 'DEFENSIVE_STABLE';
  const threatLevel = data.threat_level || 'NORMAL';
  const execSummary = data.executive_summary || 'Perimeter telemetry synthesized.';
  const concerns = data.primary_concerns || [];
  const patterns = data.cross_camera_patterns || [];
  const directives = data.recommended_directives || [];
  const epistemicTags = data.epistemic_tags || [];
  const modelUsed = data.model_used || assessmentData.model || 'gemini-2.5-flash';
  const latency = assessmentData.latency_ms || 0;

  const getThreatBadge = (level) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'HIGH':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'ELEVATED':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
  };

  const getTagBadge = (tag) => {
    switch (tag) {
      case 'OBSERVED':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'INFERRED':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      case 'UNCERTAIN':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'VERIFICATION REQUIRED':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      default:
        return 'bg-slate-700/50 text-slate-300 border-slate-600';
    }
  };

  const copyDirectives = () => {
    const text = directives.map((d, i) => `${i + 1}. ${d}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  AI Whole-Perimeter Situation Assessment
                </h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border uppercase ${getThreatBadge(threatLevel)}`}>
                  {threatLevel} THREAT
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  {posture.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400">
                {assessmentData.id || 'Current SitRep'} • Evaluated via {modelUsed} ({latency}ms)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Executive Summary */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-sky-400 uppercase tracking-wider">
              <Activity className="w-3.5 h-3.5" />
              <span>Executive Situational Synthesis</span>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">
              {execSummary}
            </p>
          </div>

          {/* Operational Concerns & Patterns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Primary Concerns */}
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-rose-400 uppercase tracking-wider">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Primary Operational Concerns</span>
              </div>
              <ul className="space-y-2">
                {concerns.length === 0 ? (
                  <li className="text-xs text-slate-500 font-mono">No critical threats identified.</li>
                ) : (
                  concerns.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                      <span>{c}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Cross-Camera Patterns */}
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-amber-400 uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5" />
                <span>Cross-Camera Correlations</span>
              </div>
              <ul className="space-y-2">
                {patterns.length === 0 ? (
                  <li className="text-xs text-slate-500 font-mono">No cross-sector correlations observed.</li>
                ) : (
                  patterns.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                      <span>{p}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          {/* Recommended Directives */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-emerald-400 uppercase tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Recommended Operator Directives</span>
              </div>
              <button
                onClick={copyDirectives}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy Directives'}</span>
              </button>
            </div>
            <div className="space-y-2">
              {directives.map((d, i) => (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/70 text-xs text-slate-200 font-mono">
                  <span className="w-5 h-5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed mt-0.5">{d}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Epistemic Truthfulness Ledger */}
          {epistemicTags.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Epistemic Truthfulness Ledger</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  (Distinguishes observed telemetry from inferred assessments)
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {epistemicTags.map((et, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800/60 text-xs">
                    <span className="text-slate-300 font-mono">{et.statement}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border uppercase shrink-0 ${getTagBadge(et.tag)}`}>
                      {et.tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-500">
            Advisory decision support only. Field actions require human authorization.
          </span>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium font-mono flex items-center gap-2 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Synthesizing...' : 'Re-Assess Situation'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold font-mono transition"
            >
              Acknowledge & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
