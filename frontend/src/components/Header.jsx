import React from 'react';
import { Shield, AlertCircle, Radio, Eye, Plus, RefreshCw } from 'lucide-react';

export default function Header({ activeTab, stats = {}, systemMode = 'live', onRefresh, onAddCamera }) {
  const activeIncidents = stats.active_incidents || 0;

  let threatLevel = 'NORMAL';
  let threatColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  let threatDot = 'bg-emerald-500';

  if (activeIncidents >= 8) {
    threatLevel = 'CRITICAL';
    threatColor = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    threatDot = 'bg-rose-500 animate-ping';
  } else if (activeIncidents >= 4) {
    threatLevel = 'HIGH';
    threatColor = 'bg-orange-500/10 text-orange-400 border-orange-500/30';
    threatDot = 'bg-orange-500';
  } else if (activeIncidents >= 2) {
    threatLevel = 'ELEVATED';
    threatColor = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    threatDot = 'bg-amber-500';
  }

  const tabLabels = {
    command_center: 'Command Center',
    cameras: 'Camera Surveillance Fleet',
    incidents: 'Incident Investigation & Response',
    evidence_vault: 'Forensic Evidence Vault',
    ai_analysis: 'Explainable AI Decision Analytics',
    analytics: 'Operational Telemetry & Trends',
    settings: 'Platform Configuration & Audits'
  };

  return (
    <header className="h-16 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 flex items-center justify-between z-20 shrink-0 select-none">
      {/* Breadcrumb & Context */}
      <div className="flex items-center space-x-3">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
            <span>SECTOR NORTH // 01-ALPHA</span>
            <span>/</span>
            <span className="text-slate-300 font-semibold uppercase">{activeTab.replace('_', ' ')}</span>
          </div>
          <h1 className="text-base font-semibold text-slate-100 tracking-tight">
            {tabLabels[activeTab] || 'Surveillance Command'}
          </h1>
        </div>
      </div>

      {/* Threat Level & Controls */}
      <div className="flex items-center space-x-4">
        {/* Threat Level Pill */}
        <div className={`flex items-center space-x-2 px-3 py-1.5 rounded border text-xs font-mono font-semibold ${threatColor}`}>
          <span className="relative flex h-2 w-2">
            <span className={`relative inline-flex rounded-full h-2 w-2 ${threatDot}`}></span>
          </span>
          <span>DEFENSE STATUS: {threatLevel}</span>
        </div>

        {/* Quick Refresh */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            title="Refresh Telemetry"
            className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Add Camera Quick Button */}
        {onAddCamera && (
          <button
            onClick={onAddCamera}
            className="flex items-center space-x-2 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Ingestion Source</span>
          </button>
        )}
      </div>
    </header>
  );
}