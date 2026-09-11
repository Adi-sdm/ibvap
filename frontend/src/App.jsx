import React, { useState, useEffect } from 'react';
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
import { getCameras, getSystemMode, getSystemStats, connectWebSocket, getEvents } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('command_center');
  const [cameras, setCameras] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [systemMode, setSystemMode] = useState('live');
  const [stats, setStats] = useState({ total_cameras: 0, active_cameras: 0, total_incidents: 0, active_incidents: 0, total_tracks: 0, total_anpr: 0 });
  const [wsConnected, setWsConnected] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showAddWizard, setShowAddWizard] = useState(false);

  const loadData = async () => {
    try {
      const [cams, modeRes, statsRes, eventsRes] = await Promise.all([
        getCameras(),
        getSystemMode(),
        getSystemStats(),
        getEvents(0, 30)
      ]);
      setCameras(cams || []);
      setSystemMode(modeRes?.mode || 'live');
      setStats(statsRes || {});
      setIncidents(eventsRes?.items || []);
    } catch (err) {
      console.error("Failed to load platform telemetry:", err);
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
      }
    });

    return () => disconnect();
  }, []);

  const unreadCount = incidents.filter(i => (i.status === 'NEW' || !i.status) && (i.severity === 'Critical' || i.severity === 'High')).length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 antialiased selection:bg-emerald-500 selection:text-black">
      {/* Left Navigation Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
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

        {/* Dynamic Center Stage */}
        <main className="flex-1 overflow-y-auto bg-slate-950">
          {activeTab === 'command_center' && (
            <CommandCenter 
              stats={stats} 
              cameras={cameras} 
              incidents={incidents} 
              onSelectIncident={setSelectedIncident} 
            />
          )}

          {activeTab === 'cameras' && (
            <CamerasPage 
              cameras={cameras} 
              onRefresh={loadData} 
            />
          )}

          {activeTab === 'incidents' && (
            <Incidents 
              onSelectIncident={setSelectedIncident} 
            />
          )}

          {activeTab === 'evidence_vault' && (
            <EvidenceVault 
              onSelectIncident={setSelectedIncident} 
            />
          )}

          {activeTab === 'ai_analysis' && (
            <AIAnalysis />
          )}

          {activeTab === 'vehicle_intel' && (
            <VehicleIntel />
          )}

          {activeTab === 'gis_map' && (
            <GISMap 
              cameras={cameras} 
              incidents={incidents} 
              onNavigateToCameras={(camId) => {
                setActiveTab('cameras');
              }}
            />
          )}

          {activeTab === 'analytics' && (
            <Analytics />
          )}

          {activeTab === 'settings' && (
            <SettingsPage 
              systemMode={systemMode} 
              onRefresh={loadData} 
            />
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