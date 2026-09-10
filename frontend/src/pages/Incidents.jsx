import React, { useState, useEffect } from 'react';
import { ShieldAlert, Search, Filter, CheckCircle2, Eye, ShieldCheck, Check, X, HelpCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import RiskBadge from '../components/RiskBadge';
import { getEvents, updateEventStatus, updateEventFeedback } from '../services/api';

export default function Incidents({ onSelectIncident }) {
  const [incidents, setIncidents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 25;
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const loadData = async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      const res = await getEvents(offset, limit);
      setIncidents(res.items || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page]); // Re-fetch on page change

  const filtered = incidents.filter(i => {
    if (filterSeverity !== 'ALL' && i.severity !== filterSeverity) return false;
    if (filterStatus !== 'ALL' && i.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      return (i.camera_id?.toLowerCase().includes(s) || 
              i.event_type?.toLowerCase().includes(s) ||
              i.track_id?.toString().includes(s) ||
              i.zone_name?.toLowerCase().includes(s));
    }
    return true;
  });

  const handleStatusChange = async (id, newStatus) => {
    await updateEventStatus(id, newStatus);
    loadData();
  };

  const handleFeedback = async (id, feedbackStr) => {
    await updateEventFeedback(id, feedbackStr, "Reviewed from table");
    loadData();
  };

  const statusColors = {
    'NEW': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
    'ACKNOWLEDGED': 'bg-amber-500/20 text-amber-400 border-amber-500/50',
    'UNDER_INVESTIGATION': 'bg-purple-500/20 text-purple-400 border-purple-500/50',
    'ESCALATED': 'bg-red-500/20 text-red-400 border-red-500/50',
    'RESOLVED': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
    'FALSE_POSITIVE': 'bg-slate-500/20 text-slate-400 border-slate-500/50',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            Perimeter Security Incidents
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-slate-900 border border-slate-700 px-2 py-1 text-xs rounded text-slate-300">
            <option value="ALL">All Status</option>
            {Object.keys(statusColors).map(st => <option key={st} value={st}>{st}</option>)}
          </select>

          <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} className="bg-slate-900 border border-slate-700 px-2 py-1 text-xs rounded text-slate-300">
            <option value="ALL">All Severities</option>
            {['Critical', 'High', 'Medium', 'Info'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search ID, zone, track..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-700 pl-8 pr-3 py-1 text-xs rounded text-white focus:outline-none focus:border-cyan-500 w-48"
            />
          </div>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="bg-slate-900/80 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider">
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Severity</th>
              <th className="py-3 px-4">Event Type / Target</th>
              <th className="py-3 px-4">Location</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Feedback</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.map((ev) => (
              <tr key={ev.event_id} className="hover:bg-slate-800/40 transition">
                <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                  {new Date(ev.timestamp * 1000).toLocaleString()}
                </td>
                <td className="py-3 px-4">
                  <RiskBadge score={ev.risk_score} severity={ev.severity} />
                </td>
                <td className="py-3 px-4">
                  <div className="font-bold text-white">{ev.event_type}</div>
                  <div className="text-[11px] text-cyan-300 font-mono">#{ev.track_id || 'N/A'} ({ev.class_name || 'unknown'})</div>
                </td>
                <td className="py-3 px-4">
                  <div className="text-slate-200">{ev.camera_id}</div>
                  <div className="text-[11px] text-amber-300 font-mono">{ev.zone_name || 'Unknown Zone'}</div>
                </td>
                <td className="py-3 px-4">
                  <select 
                    value={ev.status || 'NEW'} 
                    onChange={(e) => handleStatusChange(ev.event_id, e.target.value)}
                    className={`text-[10px] font-bold px-2 py-1 rounded border appearance-none cursor-pointer outline-none ${statusColors[ev.status || 'NEW']}`}
                  >
                    {Object.keys(statusColors).map(st => <option key={st} value={st} className="bg-slate-900 text-white">{st}</option>)}
                  </select>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-1">
                    <button onClick={() => handleFeedback(ev.event_id, 'TRUE_POSITIVE')} className={`p-1 rounded transition ${ev.operator_feedback === 'TRUE_POSITIVE' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-emerald-400'}`} title="True Positive"><Check className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleFeedback(ev.event_id, 'FALSE_POSITIVE')} className={`p-1 rounded transition ${ev.operator_feedback === 'FALSE_POSITIVE' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-red-400'}`} title="False Positive"><X className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleFeedback(ev.event_id, 'NEEDS_REVIEW')} className={`p-1 rounded transition ${ev.operator_feedback === 'NEEDS_REVIEW' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-amber-400'}`} title="Needs Review"><HelpCircle className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => onSelectIncident(ev)}
                    className="px-2.5 py-1 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-700/50 rounded font-medium transition inline-flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> Replay
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan="7" className="py-8 text-center text-slate-500">
                  No incidents matching criteria.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan="7" className="py-8 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            )}
          </tbody>
        </table>
        
        {/* Pagination */}
        <div className="p-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <div>
            Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 bg-slate-800 rounded disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setPage(p => p + 1)} disabled={page * limit >= total} className="p-1 bg-slate-800 rounded disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}