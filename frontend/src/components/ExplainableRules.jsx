import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function ExplainableRules({ rules }) {
  if (!rules || rules.length === 0) {
    return <div className="text-xs text-slate-400 italic">No specific heuristic rules triggered.</div>;
  }

  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Audited Heuristic Breakdown:</div>
      <div className="space-y-1">
        {rules.map((rule, idx) => (
          <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-200 bg-slate-900/60 px-2 py-1 rounded border border-slate-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
            <span>{rule}</span>
          </div>
        ))}
      </div>
    </div>
  );
}