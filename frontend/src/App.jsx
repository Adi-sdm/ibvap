import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CommandCenter from './pages/CommandCenter';
import CamerasPage from './pages/CamerasPage';
import Incidents from './pages/Incidents';
import EvidenceVault from './pages/EvidenceVault';
import AIAnalysis from './pages/AIAnalysis';
import Analytics from './pages/Analytics';
import VehicleIntel from './pages/VehicleIntel';
import GISMap from './pages/GISMap';
import SettingsPage from './pages/SettingsPage';
import EventReplayModal from './components/EventReplayModal';
import AddCameraWizard from './components/AddCameraWizard';
import { getCameras, getSystemMode, getSystemStats, connectWebSocket, getEvents, getSystemStatus, initializeSystem } from './services/api';
import { ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const [cameras, setCameras] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [systemMode, setSystemMode] = useState('live');
  const [systemStatus, setSystemStatus] = useState({ initialized: true, emergency_mode: false });
  const [stats, setStats] = useState({ total_cameras: 0, active_cameras: 0, total_incidents: 0, active_incidents: 0, total_tracks: 0, total_anpr: 0 });
  const [wsConnected, setWsConnected] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showAddWizard, setShowAddWizard] = useState(false);
  const [initializing, setInitializing] = useState(false);

  const getActiveTab = (pathname) => {
    if (pathname.startsWith('/cameras')) return 'cameras';
    if (pathname.startsWith('/incidents')) return 'incidents';
    if (pathname.startsWith('/evidence')) return 'evidence_vault';
    if (pathname.startsWith('/ai-analysis')) return 'ai_analysis';
    if (pathname.startsWith('/vehicles')) return 'vehicle_intel';
    if (pathname.startsWith('/gis')) return 'gis_map';
    if (pathname.startsWith('/analytics')) return 'analytics';
    if (pathname.startsWith('/settings')) return 'settings';
    return 'command_center';
  };

  const activeTab = getActiveTab(location.pathname);

  const loadData = async () => {
    try {
      const [cams, modeRes, statsRes, eventsRes, statusRes] = await Promise.all([
        getCameras(),
        getSystemMode(),
        getSystemStats(),
        getEvents(0, 30),
        getSystemStatus().catch(() => ({ initialized: true, emergency_mode: false }))
      ]);
      setCameras(cams || []);
      setSystemMode(modeRes?.mode || 'live');
      setStats(statsRes || {});
      setIncidents(eventsRes?.items || []);
      if (statusRes) setSystemStatus(statusRes);
    } catch (err) {
      console.error("Failed to load platform telemetry:", err);
    }
  };

  const handleInitialize = async () => {
    setInitializing(true);
    try {
      await initializeSystem();
      await loadData();
    } catch (err) {
      console.error("Initialization failed:", err);
    } finally {
      setInitializing(false);
    }
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('ibvap_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    loadData();

    const disconnect = connectWebSocket((msg) => {
      if (msg.type === 'WS_CONNECTED') setWsConnected(true);
      else if (msg.type === 'WS_DISCONNECTED') setWsConnected(false);
      else if (msg.type === 'INCIDENT_ALERT' && msg.incident) {
        setIncidents(prev => [msg.incident, ...prev]);
        getSystemStats().then(s => setStats(s || {})); // refresh live stats
      } else if (msg.type === 'EMERGENCY_MODE_TOGGLED') {
        loadData();
      }
    });

    return () => disconnect();
  }, []);

  const unreadCount = stats.active_incidents ?? incidents.filter(i => (i.status === 'NEW' || !i.status) && (i.severity === 'Critical' || i.severity === 'High')).length;

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 antialiased selection:bg-emerald-500 selection:text-black">
      {/* Ambient Blurred Light Orbs Layer for Glass Command */}
      <div className="ambient-glow-layer pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="ambient-orb-1" />
        <div className="ambient-orb-2" />
        <div className="ambient-orb-3" />
      </div>
      {/* Left Navigation Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={(tabId) => {
          const tabToPath = {
            command_center: '/command-center',
            cameras: '/cameras',
            incidents: '/incidents',
            evidence_vault: '/evidence',
            ai_analysis: '/ai-analysis',
            vehicle_intel: '/vehicles',
            gis_map: '/gis',
            analytics: '/analytics',
            settings: '/settings'
          };
          if (tabToPath[tabId]) navigate(tabToPath[tabId]);
        }} 
        wsConnected={wsConnected} 
        systemMode={systemMode} 
        unreadCount={unreadCount} 
      />

      {/* Main Operational Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header 
          activeTab={activeTab} 
          stats={stats} 
          systemMode={systemMode} 
          onRefresh={loadData} 
          onAddCamera={() => setShowAddWizard(true)} 
        />

        {/* Emergency Surveillance Mode Banner */}
        {systemStatus?.emergency_mode && (
          <div className="bg-red-950/80 border-b border-red-500/50 py-2 px-6 flex items-center justify-between z-20 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span className="font-mono text-xs font-bold tracking-widest text-red-200 uppercase">
                EMERGENCY SURVEILLANCE MODE ACTIVE // THREAT ESCALATION PROTOCOL ENABLED
              </span>
            </div>
            <span className="text-[10px] font-mono text-red-400">High-Frequency Telemetry Ingestion Active</span>
          </div>
        )}

        {/* Dynamic Center Stage */}
        <main className="flex-1 overflow-y-auto bg-slate-950 relative z-10">
          {!systemStatus?.initialized ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-xs font-mono font-bold tracking-widest text-emerald-400 uppercase">IBVAP // SIH26187</div>
                  <h2 className="text-xl font-bold tracking-tight text-white mt-1">System Initialization Required</h2>
                  <p className="text-sm text-slate-400 mt-2">
                    Platform is awaiting deployment configuration. No preloaded operational entities exist. Initialize to begin provisioning cameras and sectors.
                  </p>
                </div>
                <button
                  onClick={handleInitialize}
                  disabled={initializing}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm tracking-wide transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  {initializing ? "Initializing System..." : "Initialize System Deployment"}
                </button>
              </div>
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<Navigate to="/command-center" replace />} />
              <Route path="/command-center" element={
                <CommandCenter 
                  stats={stats} 
                  cameras={cameras} 
                  incidents={incidents} 
                  onSelectIncident={setSelectedIncident} 
                />
              } />
              <Route path="/cameras" element={
                <CamerasPage 
                  cameras={cameras} 
                  onRefresh={loadData} 
                />
              } />
              <Route path="/cameras/:cameraId" element={
                <CamerasPage 
                  cameras={cameras} 
                  onRefresh={loadData} 
                />
              } />
              <Route path="/incidents" element={
                <Incidents 
                  onSelectIncident={setSelectedIncident} 
                />
              } />
              <Route path="/incidents/:incidentId" element={
                <Incidents 
                  onSelectIncident={setSelectedIncident} 
                />
              } />
              <Route path="/evidence" element={
                <EvidenceVault 
                  onSelectIncident={setSelectedIncident} 
                />
              } />
              <Route path="/evidence/:evidenceId" element={
                <EvidenceVault 
                  onSelectIncident={setSelectedIncident} 
                />
              } />
              <Route path="/ai-analysis" element={<AIAnalysis />} />
              <Route path="/vehicles" element={<VehicleIntel />} />
              <Route path="/gis" element={
                <GISMap 
                  cameras={cameras} 
                  incidents={incidents} 
                  onNavigateToCameras={(camId) => {
                    navigate(camId ? `/cameras/${camId}` : '/cameras');
                  }} 
                />
              } />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings/*" element={
                <SettingsPage 
                  systemMode={systemMode} 
                  onRefresh={loadData} 
                />
              } />
              <Route path="*" element={<Navigate to="/command-center" replace />} />
            </Routes>
          )}
        </main>
      </div>

      {/* Event Replay Modal */}
      {selectedIncident && (
        <EventReplayModal 
          event={selectedIncident} 
          onClose={() => {
            setSelectedIncident(null);
            loadData();
          }} 
        />
      )}

      {/* Global Add Ingestion Source Wizard */}
      {showAddWizard && (
        <AddCameraWizard 
          onClose={() => setShowAddWizard(false)} 
          onComplete={() => {
            setShowAddWizard(false);
            loadData();
          }} 
        />
      )}
    </div>
  );
}