import React from 'react';
import { ShieldAlert, AlertTriangle, Info } from 'lucide-react';

export default function RiskBadge({ score, severity }) {
  let bg = "bg-blue-900/40 text-blue-300 border-blue-600/50";
  let Icon = Info;
  let pulse = "";

  if (severity === "Critical") {
    bg = "bg-red-950/70 text-red-400 border-red-500/80";
    Icon = ShieldAlert;
    pulse = "animate-pulse shadow-lg shadow-red-500/20";
  } else if (severity === "High") {
    bg = "bg-amber-950/70 text-amber-400 border-amber-500/80";
    Icon = AlertTriangle;
  } else if (severity === "Medium") {
    bg = "bg-yellow-950/60 text-yellow-300 border-yellow-500/60";
    Icon = AlertTriangle;
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-semibold tracking-wider ${bg} ${pulse}`}>
      <Icon className="w-3.5 h-3.5" />
      <span>{severity?.toUpperCase()}</span>
      {score != null ? (
        <>
          <span className="opacity-60">|</span>
          <span className="font-mono">{score}/100</span>
        </>
      ) : null}
    </div>
  );
}