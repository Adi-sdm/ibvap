import React from 'react';
import { Tag, Percent, Route, ShieldAlert, Cpu } from 'lucide-react';

export default function OverlayControls({ overlayConfig = {}, onChange }) {
  const toggles = [
    { key: 'labels', label: 'Labels', icon: Tag },
    { key: 'confidence', label: 'Conf', icon: Percent },
    { key: 'tracks', label: 'Tracks', icon: Route },
    { key: 'zones', label: 'Zones', icon: ShieldAlert },
    { key: 'debug', label: 'Debug', icon: Cpu },
  ];

  const handleToggle = (key) => {
    if (!onChange) return;
    const updated = {
      ...overlayConfig,
      [key]: !overlayConfig[key]
    };
    onChange(updated);
  };

  return (
    <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 bg-slate-950/85 backdrop-blur-md border border-slate-800/80 rounded-lg p-1 shadow-2xl text-[11px] font-mono select-none">
      <span className="text-slate-500 font-medium px-1.5 uppercase text-[9px] tracking-wider border-r border-slate-800/60">
        HUD
      </span>
      {toggles.map(({ key, label, icon: Icon }) => {
        const isActive = overlayConfig[key] !== false;
        return (
          <button
            key={key}
            onClick={() => handleToggle(key)}
            title={`Toggle ${label} overlay`}
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition-all ${
              isActive 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-transparent hover:bg-slate-800'
            }`}
          >
            <Icon className="w-3 h-3" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
