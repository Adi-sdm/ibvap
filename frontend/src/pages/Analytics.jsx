import React, { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { getEvents } from '../services/api';

export default function Analytics() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEvents(0, 500).then(res => {
      setIncidents(res.items || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-12 text-center text-slate-400">Loading analytics...</div>;
  }

  if (incidents.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <BarChart3 className="w-16 h-16 text-slate-700 mx-auto" />
          <h2 className="text-xl font-bold text-white">No analytics data yet</h2>
          <p className="text-slate-400 text-sm">Add cameras and start monitoring to see insights here.</p>
        </div>
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
  const typeData = Object.keys(typeBuckets).map(t => ({ name: t, value: typeBuckets[t] }));
  
  const severityData = [
    { name: 'Critical', value: criticals, color: '#EF4444' },
    { name: 'High', value: highs, color: '#F59E0B' },
    { name: 'Medium', value: mediums, color: '#EAB308' },
    { name: 'Info', value: infos, color: '#38BDF8' }
  ].filter(d => d.value > 0);

  const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-cyan-400" />
          Analytics & Insights
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900/80 p-5 rounded-xl border border-slate-800 space-y-4">
          <h3 className="font-bold text-sm text-white">Incidents by Hour</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <XAxis dataKey="hour" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155' }} />
                <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900/80 p-5 rounded-xl border border-slate-800 space-y-4">
          <h3 className="font-bold text-sm text-white">Severity Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={severityData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                  {severityData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155' }} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900/80 p-5 rounded-xl border border-slate-800 space-y-4">
          <h3 className="font-bold text-sm text-white">Detections per Camera</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cameraData} layout="vertical">
                <XAxis type="number" stroke="#64748B" fontSize={11} allowDecimals={false} />
                <YAxis dataKey="name" type="category" stroke="#64748B" fontSize={11} width={80} />
                <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155' }} />
                <Bar dataKey="count" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900/80 p-5 rounded-xl border border-slate-800 space-y-4">
          <h3 className="font-bold text-sm text-white">Event Types Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={typeData} cx="50%" cy="50%" outerRadius={90} dataKey="value">
                  {typeData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155' }} />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}