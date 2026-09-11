import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Camera, 
  ShieldAlert, 
  Database, 
  Cpu, 
  BarChart3, 
  Settings, 
  Shield, 
  Radio, 
  AlertTriangle,
  Clock,
  UserCheck,
  Car,
  Map
} from 'lucide-react';

export default function Sidebar({ activeTab, onTabChange, wsConnected, systemMode, unreadCount = 0 }) {
  const [timeStr, setTimeStr] = useState('');
  const [utcStr, setUtcStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('en-GB', { hour12: false }));
      setUtcStr(now.toISOString().slice(11, 19) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'command_center', label: 'Command Center', icon: LayoutDashboard, badge: null },
    { id: 'cameras', label: 'Cameras', icon: Camera, badge: null },
    { id: 'incidents', label: 'Incidents', icon: ShieldAlert, badge: unreadCount > 0 ? unreadCount : null },
    { id: 'evidence_vault', label: 'Evidence Vault', icon: Database, badge: null },
    { id: 'ai_analysis', label: 'AI Analysis', icon: Cpu, badge: null },
    { id: 'vehicle_intel', label: 'Vehicle Intel & ANPR', icon: Car, badge: null },
    { id: 'gis_map', label: 'Tactical GIS Map', icon: Map, badge: null },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, badge: null },
    { id: 'settings', label: 'Settings', icon: Settings, badge: null },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none z-30">
      {/* Brand Header */}
      <div>
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm tracking-wider text-slate-100">IBVAP</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">v2.4</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono tracking-tight">SIH26187 // BORDER DEF</p>
            </div>
          </div>
        </div>

        {/* System Readiness & Mode Ribbon */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${wsConnected ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${wsConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            </span>
            <span className="text-[11px] font-mono text-slate-300">
              {wsConnected ? 'TELEMETRY LIVE' : 'RECONNECTING'}
            </span>
          </div>

          <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
            systemMode === 'demo' 
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}>
            {systemMode}
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-md text-xs font-medium transition-all duration-150 ${
                  isActive 
                    ? 'bg-slate-800 text-white font-semibold shadow-sm border border-slate-700/60' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="bg-rose-500 text-white text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-full shadow-sm">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Operator Callout & Time Footer */}
      <div className="p-3.5 border-t border-slate-800 bg-slate-950/40 space-y-3">
        {/* Operator Profile */}
        <div className="flex items-center space-x-2.5 px-2 py-1.5 rounded bg-slate-900/80 border border-slate-800 text-xs">
          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
            <UserCheck className="w-3.5 h-3.5" />
          </div>
          <div className="overflow-hidden">
            <div className="text-[11px] font-mono font-semibold text-slate-200 truncate">OP-01 // DUTY OFFCR</div>
            <div className="text-[10px] text-slate-400 truncate">HQ Command Post</div>
          </div>
        </div>

        {/* Clocks */}
        <div className="flex items-center justify-between px-2 text-[11px] font-mono text-slate-400">
          <div className="flex items-center space-x-1.5">
            <Clock className="w-3 h-3 text-slate-500" />
            <span className="text-slate-200 font-semibold">{timeStr}</span>
          </div>
          <span className="text-[10px] text-slate-500">{utcStr}</span>
        </div>
      </div>
    </aside>
  );
}