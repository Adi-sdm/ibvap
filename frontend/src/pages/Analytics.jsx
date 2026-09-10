import React, { useEffect, useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  ShieldAlert, 
  Activity, 
  Calendar, 
  PieChart as PieIcon,
  RefreshCw
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { getEvents, getSystemStats } from '../services/api';

export default function Analytics() {
  const [incidents, setIncidents] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      getEvents(0, 500),
      getSystemStats()
    ]).then(([res, s]) => {
      setIncidents(res.items || []);
      setStats(s || {});
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-500 text-xs font-mono">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
        Aggregating operational surveillance telemetry...
      </div>
    );
  }

  const hourBuckets = {};
  const cameraBuckets = {};
  const typeBuckets = {};
  
  let criticals = 0, highs = 0, mediums = 0, infos = 0;

  incidents.forEach(ev => {
    // Hour
    const d = new Date(ev.timestamp * 1000);
    const h = `${d.getHours().toString().padStart(2, '0')}:00`;
    hourBuckets[h] = (hourBuckets[h] || 0) + 1;

    // Camera
    cameraBuckets[ev.camera_id] = (cameraBuckets[ev.camera_id] || 0) + 1;

    // Type
    const t = ev.event_type || 'UNKNOWN';
    typeBuckets[t] = (typeBuckets[t] || 0) + 1;

    // Severity
    if (ev.severity === 'Critical') criticals++;
    else if (ev.severity === 'High') highs++;
    else if (ev.severity === 'Medium') mediums++;
    else infos++;
  });

  const hourlyData = Object.keys(hourBuckets).sort().map(h => ({ hour: h, count: hourBuckets[h] }));
  const cameraData = Object.keys(cameraBuckets).map(c => ({ name: c, count: cameraBuckets[c] }));
  const typeData = Object.keys(typeBuckets).map(t => ({ name: t.replace('_', ' '), value: typeBuckets[t] }));
  
  const severityData = [
    { name: 'Critical', value: criticals, color: '#f43f5e' },
    { name: 'High', value: highs, color: '#f97316' },
    { name: 'Medium', value: mediums, color: '#eab308' },
    { name: 'Info', value: infos, color: '#06b6d4' }
  ].filter(d => d.value > 0);

  const COLORS = ['#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#f43f5e', '#3b82f6'];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-100 tracking-tight">Surveillance Analytics & Operational Trends</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              REAL-TIME AGGREGATION
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Longitudinal trend analysis across perimeter sectors, temporal breach concentration, and neural event type distributions.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium flex items-center space-x-2 transition self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {/* Top Stat Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-[10px] font-mono text-slate-500 uppercase">Total Logged Incidents</div>
          <div className="text-xl font-bold font-mono text-slate-100 mt-1">{incidents.length}</div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">Archive Volume: 100% Retained</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-[10px] font-mono text-slate-500 uppercase">Critical Threats</div>
          <div className="text-xl font-bold font-mono text-rose-400 mt-1">{criticals}</div>
          <div className="text-[10px] text-rose-500 mt-0.5 font-mono">Immediate Response Required</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-[10px] font-mono text-slate-500 uppercase">Active Monitored Cameras</div>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-1">{stats.active_cameras || 0} / {stats.total_cameras || 0}</div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">Fleet Ingestion Status</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-[10px] font-mono text-slate-500 uppercase">Track Trajectories</div>
          <div className="text-xl font-bold font-mono text-cyan-400 mt-1">{stats.total_tracks || 0}</div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">ByteTrack Persistent Targets</div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incidents by Hour */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-mono font-semibold text-slate-200 uppercase">
              Temporal Activity Distribution (24-Hour Cycle)
            </h3>
            <span className="text-[10px] font-mono text-slate-500">UTC CLOCK</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData.length > 0 ? hourlyData : [{ hour: '12:00', count: 0 }]}>
                <XAxis dataKey="hour" stroke="#64748b" fontSize={10} fontVariant="mono" />
                <YAxis stroke="#64748b" fontSize={10} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', fontSize: 11, borderRadius: 6 }} />
                <Bar dataKey="count" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Severity Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-mono font-semibold text-slate-200 uppercase">
              Incident Severity Classification
            </h3>
            <span className="text-[10px] font-mono text-slate-500">DEFCON TRIAGE</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={severityData.length > 0 ? severityData : [{ name: 'None', value: 1, color: '#334155' }]} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={60} 
                  outerRadius={90} 
                  paddingAngle={4} 
                  dataKey="value"
                >
                  {severityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', fontSize: 11, borderRadius: 6 }} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detections per Camera */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-mono font-semibold text-slate-200 uppercase">
              Incident Density Across Surveillance Sectors
            </h3>
            <span className="text-[10px] font-mono text-slate-500">CAMERA INGRESS</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cameraData.length > 0 ? cameraData : [{ name: 'cam-01', count: 0 }]} layout="vertical">
                <XAxis type="number" stroke="#64748b" fontSize={10} allowDecimals={false} />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={90} />
                <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', fontSize: 11, borderRadius: 6 }} />
                <Bar dataKey="count" fill="#06b6d4" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Event Types Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-mono font-semibold text-slate-200 uppercase">
              Heuristic Trigger Type Proportions
            </h3>
            <span className="text-[10px] font-mono text-slate-500">BEHAVIORAL TAXONOMY</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={typeData.length > 0 ? typeData : [{ name: 'Perimeter Breach', value: 1 }]} 
                  cx="50%" 
                  cy="50%" 
                  outerRadius={90} 
                  dataKey="value"
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', fontSize: 11, borderRadius: 6 }} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}