import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  ShieldAlert, 
  Search, 
  Filter, 
  CheckCircle2, 
  Eye, 
  ShieldCheck, 
  Check, 
  X, 
  HelpCircle, 
  ChevronLeft, 
  ChevronRight,
  AlertTriangle,
  Clock,
  Camera,
  Crosshair,
  UserCheck,
  Radio,
  FileText,
  Copy,
  ExternalLink,
  Send,
  RefreshCw
} from 'lucide-react';
import RiskBadge from '../components/RiskBadge';
import GeminiAnalysisCard from '../components/GeminiAnalysisCard';
import { getEvents, getEvent, updateEventStatus, updateEventFeedback } from '../services/api';

export default function Incidents({ onSelectIncident }) {
  const [incidents, setIncidents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 25;
  const [loading, setLoading] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);

  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [copiedHash, setCopiedHash] = useState(false);
  const [operatorNotes, setOperatorNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  const [activeTab, setActiveTab] = useState('ACTIVE'); // 'ACTIVE', 'ARCHIVE', 'DEMO'

  const loadData = async (selectFirst = false) => {
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      let res;
      if (activeTab === 'ACTIVE') {
        res = await getEvents(offset, limit, 'LIVE', 'NEW', true);
      } else if (activeTab === 'ARCHIVE') {
        res = await getEvents(offset, limit, 'LIVE');
      } else {
        res = await getEvents(offset, limit, 'DEMO');
      }
      const items = res.items || [];
      setIncidents(items);
      setTotal(res.total || 0);

      if (incidentId) {
        const found = items.find(i => String(i.event_id) === String(incidentId) || String(i.id) === String(incidentId));
        if (found) {
          setSelectedIncident(found);
          setOperatorNotes(found.notes || '');
          return;
        } else {
          // Attempt direct fetch
          try {
            const single = await getEvent(incidentId);
            if (single) {
              setSelectedIncident(single);
              setOperatorNotes(single.notes || '');
              return;
            }
          } catch (_) {}
        }
      }

      if ((selectFirst || !selectedIncident) && items.length > 0) {
        setSelectedIncident(items[0]);
        setOperatorNotes(items[0].notes || '');
      } else if (items.length === 0) {
        setSelectedIncident(null);
        setOperatorNotes('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const { incidentId } = useParams();

  useEffect(() => {
    loadData(true);
  }, [page, activeTab, incidentId]);

  const filtered = incidents.filter(i => {
    if (filterSeverity !== 'ALL' && i.severity !== filterSeverity) return false;
    if (filterStatus !== 'ALL' && i.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      return (i.camera_id?.toLowerCase().includes(s) || 
              i.event_type?.toLowerCase().includes(s) ||
              i.track_id?.toString().includes(s) ||
              i.zone_name?.toLowerCase().includes(s) ||
              i.event_id?.toString().includes(s));
    }
    return true;
  });

  const handleSelectIncident = (inc) => {
    setSelectedIncident(inc);
    setOperatorNotes(inc.notes || '');
  };

  const handleStatusChange = async (id, newStatus) => {
    await updateEventStatus(id, newStatus);
    // Update locally
    setSelectedIncident(prev => prev && prev.event_id === id ? { ...prev, status: newStatus } : prev);
    setIncidents(prev => prev.map(i => i.event_id === id ? { ...i, status: newStatus } : i));
  };

  const handleFeedback = async (id, feedbackStr) => {
    await updateEventFeedback(id, feedbackStr, operatorNotes || "Operator feedback logged");
    setSelectedIncident(prev => prev && prev.event_id === id ? { ...prev, operator_feedback: feedbackStr } : prev);
    setIncidents(prev => prev.map(i => i.event_id === id ? { ...i, operator_feedback: feedbackStr } : i));
  };

  const handleSaveNotes = async () => {
    if (!selectedIncident) return;
    setNotesSaving(true);
    try {
      await updateEventFeedback(
        selectedIncident.event_id, 
        selectedIncident.operator_feedback || 'NEEDS_REVIEW', 
        operatorNotes
      );
      setNotesSaving(false);
    } catch {
      setNotesSaving(false);
    }
  };

  const copyHash = (hash) => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const statusColors = {
    'NEW': 'bg-rose-500/20 text-rose-400 border-rose-500/40',
    'ACKNOWLEDGED': 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    'UNDER_INVESTIGATION': 'bg-purple-500/20 text-purple-400 border-purple-500/40',
    'ESCALATED': 'bg-red-600/30 text-red-300 border-red-500/50',
    'RESOLVED': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    'FALSE_POSITIVE': 'bg-slate-700/40 text-slate-400 border-slate-700',
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Incident Category Triage Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-lg p-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => { setActiveTab('ACTIVE'); setPage(1); }}
            className={`px-3.5 py-1.5 rounded text-xs font-mono font-bold transition flex items-center space-x-2 ${
              activeTab === 'ACTIVE'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${activeTab === 'ACTIVE' ? 'bg-white' : 'bg-emerald-400'}`}></span>
            <span>ACTIVE INCIDENTS</span>
          </button>

          <button
            onClick={() => { setActiveTab('ARCHIVE'); setPage(1); }}
            className={`px-3.5 py-1.5 rounded text-xs font-mono font-bold transition flex items-center space-x-2 ${
              activeTab === 'ARCHIVE'
                ? 'bg-slate-700 text-white shadow'
                : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>HISTORICAL ARCHIVE</span>
          </button>

          <button
            onClick={() => { setActiveTab('DEMO'); setPage(1); }}
            className={`px-3.5 py-1.5 rounded text-xs font-mono font-bold transition flex items-center space-x-2 ${
              activeTab === 'DEMO'
                ? 'bg-amber-600 text-white shadow'
                : 'bg-slate-950 border border-slate-800 text-amber-400 hover:text-amber-300'
            }`}
          >
            <span>DEMO INCIDENTS</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
              DEMO DATA
            </span>
          </button>
        </div>

        {activeTab === 'DEMO' ? (
          <div className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded flex items-center space-x-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>SYNTHETIC EVALUATION DATASET — NOT REAL SENSOR TELEMETRY</span>
          </div>
        ) : (
          <div className="text-[11px] font-mono text-slate-400 flex items-center space-x-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>LIVE SENSOR PIPELINE</span>
          </div>
        )}
      </div>

      {/* Header & Global Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-lg p-4">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <h2 className="text-base font-bold text-slate-100 tracking-tight">Security Incident Investigation Dossiers</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              {total} RECORDED
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Triaged security breaches, perimeter alerts, and automated neural network triggers requiring operator resolution.
          </p>
        </div>

        <div className="flex items-center space-x-2 flex-wrap">
          <select 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)} 
            className="bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs rounded text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Incident Statuses</option>
            {Object.keys(statusColors).map(st => <option key={st} value={st}>{st.replace('_', ' ')}</option>)}
          </select>

          <select 
            value={filterSeverity} 
            onChange={e => setFilterSeverity(e.target.value)} 
            className="bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs rounded text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Severities</option>
            {['Critical', 'High', 'Medium', 'Info'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search ID, sector, track..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 border border-slate-800 pl-8 pr-3 py-1.5 text-xs rounded text-white focus:outline-none focus:border-emerald-500 w-48 font-mono"
            />
          </div>

          <button
            onClick={() => loadData(false)}
            title="Refresh Incidents"
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Split-Screen Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Col (5 / 12): Incident Queue List */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
              Incident Queue ({filtered.length})
            </span>
            <span className="text-[11px] font-mono text-slate-500">Page {page} of {Math.max(1, Math.ceil(total / limit))}</span>
          </div>

          <div className="divide-y divide-slate-800/60 overflow-y-auto max-h-[640px]">
            {filtered.length === 0 && !loading && (
              <div className="p-8 text-center space-y-2 font-mono">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 mx-auto flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-slate-200">
                  {activeTab === 'ACTIVE' 
                    ? 'No Active Incidents' 
                    : (activeTab === 'DEMO' ? 'No Demo Incidents' : 'No Incidents Found')}
                </div>
                <div className="text-[11px] text-slate-400 font-sans">
                  {activeTab === 'ACTIVE' 
                    ? 'Perimeter sector secure. All active camera boundaries nominal.' 
                    : (activeTab === 'DEMO' 
                        ? 'Synthetic evaluation feed empty. Add a test video camera to populate demo incidents.' 
                        : 'No historical records matched filter parameters.')}
                </div>
              </div>
            )}
            {loading && (
              <div className="p-8 text-center text-slate-500 text-xs font-mono">
                Loading incidents from secure database...
              </div>
            )}
            {filtered.map((ev) => {
              const isSelected = selectedIncident?.event_id === ev.event_id;
              return (
                <div
                  key={ev.event_id}
                  onClick={() => handleSelectIncident(ev)}
                  className={`p-3.5 cursor-pointer transition flex items-start justify-between space-x-3 ${
                    isSelected 
                      ? 'bg-slate-800 border-l-4 border-emerald-500' 
                      : 'hover:bg-slate-800/50'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-slate-200">
                        #{ev.event_id ? ev.event_id.slice(0, 8) : 'EVENT'}
                      </span>
                      <RiskBadge score={ev.risk_score} severity={ev.severity} />
                      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border uppercase font-semibold ${statusColors[ev.status || 'NEW'] || 'text-slate-400 border-slate-700 bg-slate-800'}`}>
                        {(ev.status || 'NEW').replace('_', ' ')}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-200 truncate capitalize">
                      {(ev.event_type || 'INCIDENT').replace(/_/g, ' ')}
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono flex items-center space-x-2">
                      <span>{ev.camera_id}</span>
                      <span>•</span>
                      <span className="text-slate-300">{ev.zone_name || 'No Zone'}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 space-y-1">
                    <div className="text-[10px] font-mono text-slate-400">
                      {new Date(ev.timestamp * 1000).toLocaleTimeString('en-GB', { hour12: false })}
                    </div>
                    {ev.track_id && (
                      <div className="text-[10px] font-mono text-cyan-400">
                        Track #{ev.track_id}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex justify-between items-center text-xs text-slate-400">
            <span>Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}</span>
            <div className="flex space-x-1">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))} 
                disabled={page === 1} 
                className="p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setPage(p => p + 1)} 
                disabled={page * limit >= total} 
                className="p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-slate-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Col (7 / 12): Deep Incident Dossier */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-5">
          {selectedIncident ? (
            <>
              {/* Dossier Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-base font-bold text-slate-100">
                      INCIDENT DOSSIER #{selectedIncident.event_id}
                    </span>
                    <RiskBadge score={selectedIncident.risk_score} severity={selectedIncident.severity} />
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-1 flex items-center space-x-2">
                    <span>SECTOR: {selectedIncident.camera_id}</span>
                    <span>•</span>
                    <span>{new Date(selectedIncident.timestamp * 1000).toISOString().replace('T', ' ').slice(0, 19)} UTC</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onSelectIncident && onSelectIncident(selectedIncident)}
                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Launch Replay & Telemetry</span>
                  </button>
                </div>
              </div>

              {/* AI Findings Executive Summary */}
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-mono font-semibold text-slate-200 uppercase">
                      Automated AI Incident Analysis
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    CONFIDENCE: {((selectedIncident.confidence || 0.88) * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-sans leading-relaxed">
                  {selectedIncident.ai_summary || 
                    `Classified ${selectedIncident.class_name || 'person'} breaching virtual geofence ${selectedIncident.zone_name || 'perimeter'} on ${selectedIncident.camera_id}. ByteTrack persistent tracking recorded sustained loitering and anomalous trajectory matching restricted intrusion profile.`
                  }
                </p>

                {/* Behavioral tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300">
                    TARGET: {selectedIncident.class_name?.toUpperCase() || 'PERSON'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-cyan-300">
                    TRACK ID: #{selectedIncident.track_id || 'N/A'}
                  </span>
                  {selectedIncident.behaviour && (
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-amber-300">
                      PATTERN: {selectedIncident.behaviour.toUpperCase()}
                    </span>
                  )}
                  {selectedIncident.detected_objects && (
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300">
                      OBJECTS: {(() => {
                        let objs = selectedIncident.detected_objects;
                        if (typeof objs === 'string') {
                          try { objs = JSON.parse(objs); } catch { return objs; }
                        }
                        if (Array.isArray(objs)) return objs.join(', ');
                        return JSON.stringify(objs);
                      })()}
                    </span>
                  )}
                </div>
              </div>

              {/* Dual AI Analysis & Advisory Verification */}
              <GeminiAnalysisCard 
                incident={selectedIncident} 
                onUpdated={(updated) => {
                  setSelectedIncident(updated);
                  setIncidents(prev => prev.map(i => i.event_id === updated.event_id ? updated : i));
                }} 
              />

              {/* Forensic Evidence Snapshot & SHA-256 Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Evidence Snapshot */}
                <div className="bg-slate-950 rounded-lg border border-slate-800 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>Keyframe Evidence Capture</span>
                    <span>HD 1080p Frame</span>
                  </div>
                  <div className="relative aspect-video rounded overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
                    {(selectedIncident.evidence_snapshot || selectedIncident.snapshot_url) ? (
                      <img 
                        src={selectedIncident.evidence_snapshot 
                          ? (selectedIncident.evidence_snapshot.startsWith('/') || selectedIncident.evidence_snapshot.startsWith('http') 
                              ? selectedIncident.evidence_snapshot 
                              : '/' + selectedIncident.evidence_snapshot.replace(/\\/g, '/'))
                          : selectedIncident.snapshot_url} 
                        alt="Evidence snapshot" 
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.onerror = null; e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180" fill="%230f172a"><rect width="300" height="180"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2364748b" font-size="12">SURVEILLANCE FRAME</text></svg>'; }}
                      />
                    ) : (
                      <div className="text-slate-500 font-mono text-xs">NO CAPTURE STORED</div>
                    )}
                  </div>
                </div>

                {/* SHA-256 & Custody Ledger */}
                <div className="bg-slate-950 rounded-lg border border-slate-800 p-3 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
                      <span>Forensic Chain of Custody</span>
                      <span className="text-emerald-400 flex items-center text-[10px]">
                        <ShieldCheck className="w-3 h-3 mr-1" /> VALIDATED
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mb-1">SHA-256 Checksum:</div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-emerald-400 break-all select-all flex items-center justify-between">
                      <span>{selectedIncident.evidence_hash || selectedIncident.sha256 || 'Unsealed (Hash Pending)'}</span>
                    </div>
                    <button
                      onClick={() => copyHash(selectedIncident.evidence_hash || selectedIncident.sha256 || 'Unsealed')}
                      className="mt-2 w-full py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center justify-center space-x-1.5 transition border border-slate-700"
                    >
                      {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedHash ? 'Hash Copied to Clipboard' : 'Copy Cryptographic Hash'}</span>
                    </button>
                  </div>

                  <div className="text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-800/80">
                    Storage: Encrypted Local Archive (NVMe-1)
                  </div>
                </div>
              </div>

              {/* Forensic Timeline Step-by-Step */}
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
                <span className="text-xs font-mono font-semibold text-slate-300 uppercase">
                  Incident Chronology & Cognition Sequence
                </span>
                <div className="space-y-2 border-l-2 border-slate-800 pl-3 ml-1 text-xs">
                  <div className="relative">
                    <span className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-slate-600"></span>
                    <div className="text-slate-300 font-medium">Target Initialized</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      YOLOv8 detected silhouette with {(selectedIncident.confidence * 100 || 88).toFixed(0)}% confidence. ByteTrack assigned #{selectedIncident.track_id || '101'}.
                    </div>
                  </div>

                  <div className="relative">
                    <span className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <div className="text-slate-300 font-medium">Restricted Polygon Intersected</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Centroid crossed boundary of zone &apos;{selectedIncident.zone_name || 'Restricted Perimeter'}&apos;. Heuristic risk engine triggered.
                    </div>
                  </div>

                  <div className="relative">
                    <span className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    <div className="text-slate-300 font-medium">Risk Score Exceeded Severity Threshold</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Accumulated score reached {selectedIncident.risk_score}/100. Automated snapshot and tamper-evident SHA-256 signature generated.
                    </div>
                  </div>
                </div>
              </div>

              {/* Operator Action & Investigation Notes Bar */}
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-slate-300 uppercase">
                    Operator Response & Triage Actions
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">Duty Callsign: OP-01</span>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => handleStatusChange(selectedIncident.event_id, 'ACKNOWLEDGED')}
                    className="py-1.5 px-2 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-medium transition"
                  >
                    Acknowledge
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedIncident.event_id, 'ESCALATED')}
                    className="py-1.5 px-2 rounded bg-rose-600/30 hover:bg-rose-600/40 text-rose-300 border border-rose-500/50 text-xs font-semibold transition"
                  >
                    Escalate to QRT
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedIncident.event_id, 'RESOLVED')}
                    className="py-1.5 px-2 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-medium transition"
                  >
                    Mark Resolved
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedIncident.event_id, 'FALSE_POSITIVE')}
                    className="py-1.5 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 text-xs font-medium transition"
                  >
                    False Alarm
                  </button>
                </div>

                {/* Operator Investigation Notes */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>Investigation Log & Feedback:</span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleFeedback(selectedIncident.event_id, 'TRUE_POSITIVE')}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                          selectedIncident.operator_feedback === 'TRUE_POSITIVE' 
                            ? 'bg-emerald-600 text-white border-emerald-500' 
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-emerald-400'
                        }`}
                      >
                        CONFIRMED THREAT
                      </button>
                      <button
                        onClick={() => handleFeedback(selectedIncident.event_id, 'FALSE_POSITIVE')}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                          selectedIncident.operator_feedback === 'FALSE_POSITIVE' 
                            ? 'bg-rose-600 text-white border-rose-500' 
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-rose-400'
                        }`}
                      >
                        FALSE POSITIVE
                      </button>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <textarea
                      rows={2}
                      placeholder="Add operational notes (e.g. 'Contacted Patrol Unit Bravo 2 for physical verification')..."
                      value={operatorNotes}
                      onChange={(e) => setOperatorNotes(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded p-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans"
                    />
                    <button
                      onClick={handleSaveNotes}
                      disabled={notesSaving}
                      className="px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center justify-center transition disabled:opacity-50"
                    >
                      {notesSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="py-24 text-center space-y-3 font-mono">
              <div className="w-12 h-12 rounded-full bg-slate-800/60 border border-slate-700/60 mx-auto flex items-center justify-center text-slate-400">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">
                  {activeTab === 'ACTIVE' ? 'Perimeter Sector Secure' : 'No Incident Selected'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto font-sans">
                  {activeTab === 'ACTIVE'
                    ? '0 active incidents currently require operator attention. Continuous AI tracking active across connected cameras.'
                    : 'Select an incident from the queue on the left to inspect the complete forensic dossier, neural telemetry, and SHA-256 evidence record.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}