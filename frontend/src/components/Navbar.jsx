import { Shield, LayoutDashboard, Camera, AlertTriangle, BarChart3, Settings, Wifi, WifiOff } from 'lucide-react';

const TABS = [
  { id: 'command_center', label: 'Command Center', icon: LayoutDashboard },
  { id: 'cameras', label: 'Cameras', icon: Camera },
  { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Navbar({ activeTab, onTabChange, wsConnected, systemMode, unreadCount }) {
  return (
    <nav className="bg-slate-900 border-b border-slate-800 px-4 py-2">
      <div className="flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-cyan-400" />
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide">IBVAP</h1>
            <p className="text-[10px] text-slate-500 -mt-1">Border Video Analytics</p>
          </div>
        </div>
        
        {/* Center: Tabs */}
        <div className="flex items-center gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors relative ${
                activeTab === tab.id
                  ? 'bg-cyan-500/10 text-cyan-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden lg:inline">{tab.label}</span>
              {tab.id === 'incidents' && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
        
        {/* Right: Status */}
        <div className="flex items-center gap-3">
          {systemMode === 'demo' && (
            <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded text-xs font-bold animate-pulse">
              ⚠ DEMO MODE
            </span>
          )}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
            wsConnected ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {wsConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {wsConnected ? 'LIVE' : 'OFFLINE'}
          </div>
        </div>
      </div>
    </nav>
  );
}