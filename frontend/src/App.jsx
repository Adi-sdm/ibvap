import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import CommandCenter from './pages/CommandCenter';
import CamerasPage from './pages/CamerasPage';
import Incidents from './pages/Incidents';
import Analytics from './pages/Analytics';
import SettingsPage from './pages/SettingsPage';
import EventReplayModal from './components/EventReplayModal';
import { getCameras, getSystemMode, getSystemStats, connectWebSocket, getEvents } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('command_center');
  const [cameras, setCameras] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [systemMode, setSystemMode] = useState('live');
  const [stats, setStats] = useState({ total_cameras: 0, active_cameras: 0, total_incidents: 0, active_incidents: 0, total_tracks: 0, total_anpr: 0 });
  const [wsConnected, setWsConnected] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);

  const loadData = async () => {
    try {
      const [cams, modeRes, statsRes, eventsRes] = await Promise.all([
        getCameras(),
        getSystemMode(),
        getSystemStats(),
        getEvents(0, 25)
      ]);
      setCameras(cams || []);
      setSystemMode(modeRes.mode || 'live');
      setStats(statsRes || {});
      setIncidents(eventsRes.items || []);
    } catch (err) {
      console.error("Failed to load data:", err);
    }
  };

  useEffect(() => {
    loadData();

    const disconnect = connectWebSocket((msg) => {
      if (msg.type === 'WS_CONNECTED') setWsConnected(true);
      else if (msg.type === 'WS_DISCONNECTED') setWsConnected(false);
      else if (msg.type === 'INCIDENT_ALERT' && msg.incident) {
        setIncidents(prev => [msg.incident, ...prev]);
        getSystemStats().then(s => setStats(s)); // refresh stats
      }
    });

    return () => disconnect();
  }, []);

  const unreadCount = incidents.filter(i => i.status === 'NEW' && (i.severity === 'Critical' || i.severity === 'High')).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      <Navbar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        wsConnected={wsConnected} 
        systemMode={systemMode} 
        unreadCount={unreadCount} 
      />

      <main className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 overflow-y-auto">
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
          {activeTab === 'analytics' && (
            <Analytics />
          )}
          {activeTab === 'settings' && (
            <SettingsPage 
              systemMode={systemMode} 
              onRefresh={loadData} 
            />
          )}
        </div>
      </main>

      {selectedIncident && (
        <EventReplayModal 
          event={selectedIncident} 
          onClose={() => {
            setSelectedIncident(null);
            loadData(); // refresh list to get updated status
          }} 
        />
      )}
    </div>
  );
}