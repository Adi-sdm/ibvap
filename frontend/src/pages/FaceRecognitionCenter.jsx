import React, { useState, useEffect } from 'react';
import { 
  UserCheck, Shield, AlertTriangle, Search, Plus, Download, 
  Trash2, Edit3, Eye, Clock, Camera, RefreshCw, CheckCircle2,
  Lock, Activity, Cpu, Sparkles, Filter, ChevronRight, UserX,
  ExternalLink, Hash, ArrowUpRight, Radio, HelpCircle, FileText,
  UserPlus, ShieldAlert, Check, X
} from 'lucide-react';
import { 
  getFRSStatus, getFRSGallery, updateFRSPerson, deleteFRSPerson, 
  getFRSRecognitions, seedFRSDemo, getCameras, getCameraStreamUrl,
  getFRSUnknownCandidates, promoteFRSUnknownCandidate, deleteFRSUnknownCandidate,
  getFRSCapabilities
} from '../services/api';
import FaceEnrollmentModal from '../components/FaceEnrollmentModal';
import IdentityProfileModal from '../components/IdentityProfileModal';

export default function FaceRecognitionCenter({ systemMode = 'live' }) {
  const [activeTab, setActiveTab] = useState('gallery'); // 'gallery' | 'unknowns' | 'watchlist' | 'history' | 'feed' | 'status'
  const [gallery, setGallery] = useState([]);
  const [unknownCandidates, setUnknownCandidates] = useState([]);
  const [recognitions, setRecognitions] = useState([]);
  const [statusTelemetry, setStatusTelemetry] = useState(null);
  const [capabilities, setCapabilities] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [unknownStatusFilter, setUnknownStatusFilter] = useState('ALL');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');

  // Modals state
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editPerson, setEditPerson] = useState(null);

  // Unknown Promotion Modal state
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [candidateToPromote, setCandidateToPromote] = useState(null);
  const [promoteForm, setPromoteForm] = useState({
    name: '',
    rank: 'Inspector',
    designation: 'Perimeter Security Lead',
    organization: 'Border Security Force',
    category: 'OPERATIONAL',
    status: 'ACTIVE',
    notes: '',
    operator: 'Supervisor OP-01'
  });
  const [promoting, setPromoting] = useState(false);

  // Operation feedback
  const [feedback, setFeedback] = useState(null);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const modeParam = systemMode === 'demo' ? 'DEMO' : 'LIVE';
      const [galRes, unkRes, recRes, statRes, capRes, camsRes] = await Promise.all([
        getFRSGallery(null, null, searchQuery || null, modeParam).catch(() => []),
        getFRSUnknownCandidates({ data_mode: modeParam, search: searchQuery || null }).catch(() => ({ items: [] })),
        getFRSRecognitions({ data_mode: modeParam, limit: 50 }).catch(() => ({ items: [] })),
        getFRSStatus().catch(() => null),
        getFRSCapabilities().catch(() => null),
        getCameras().catch(() => [])
      ]);
      setGallery(galRes || []);
      setUnknownCandidates(unkRes?.items || []);
      setRecognitions(recRes?.items || []);
      setStatusTelemetry(statRes);
      setCapabilities(capRes);
      setCameras(camsRes || []);
    } catch (err) {
      console.error('Failed to load FRS telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
    const interval = setInterval(() => {
      const modeParam = systemMode === 'demo' ? 'DEMO' : 'LIVE';
      getFRSRecognitions({ data_mode: modeParam, limit: 50 })
        .then(res => setRecognitions(res?.items || []))
        .catch(() => {});
      getFRSStatus()
        .then(res => setStatusTelemetry(res))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [systemMode, searchQuery]);

  const showFeedback = (msg, isError = false) => {
    setFeedback({ msg, isError });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleToggleWatchlist = async (person) => {
    const isWl = person.category === 'WATCHLIST' || person.status === 'WATCHLIST';
    const newCategory = isWl ? 'OPERATIONAL' : 'WATCHLIST';
    const newStatus = isWl ? 'ACTIVE' : 'WATCHLIST';
    try {
      await updateFRSPerson(person.person_id, { category: newCategory, status: newStatus }, 'Supervisor OP-01');
      showFeedback(`Updated watchlist classification for ${person.name}.`);
      loadAllData();
    } catch (err) {
      showFeedback(err.message, true);
    }
  };

  const handleDelete = async (person) => {
    if (!window.confirm(`PERMANENT DELETION: Confirm removing ${person.name} (${person.person_id}) and encrypted biometric templates? This action will be audited.`)) {
      return;
    }
    try {
      await deleteFRSPerson(person.person_id, 'Administrator OP-01');
      showFeedback(`Personnel ${person.name} deleted and audit record created.`);
      loadAllData();
    } catch (err) {
      showFeedback(err.message, true);
    }
  };

  const handleDeleteUnknown = async (candidate) => {
    if (!window.confirm(`PERMANENT DELETION: Confirm purging anonymous candidate ${candidate.candidate_id}? This action will be audited.`)) {
      return;
    }
    try {
      await deleteFRSUnknownCandidate(candidate.candidate_id, 'Administrator OP-01');
      showFeedback(`Anonymous candidate ${candidate.candidate_id} purged.`);
      loadAllData();
    } catch (err) {
      showFeedback(err.message, true);
    }
  };

  const handleOpenPromote = (candidate) => {
    setCandidateToPromote(candidate);
    setPromoteForm({
      name: '',
      rank: 'Inspector',
      designation: 'Security Lead',
      organization: 'Border Security Force',
      category: 'OPERATIONAL',
      status: 'ACTIVE',
      notes: `Promoted from anonymous candidate ${candidate.candidate_id}. Observed across cameras.`,
      operator: 'Supervisor OP-01'
    });
    setPromoteModalOpen(true);
  };

  const handleExecutePromotion = async (e) => {
    e.preventDefault();
    if (!candidateToPromote || !promoteForm.name.trim()) {
      alert('Personnel full name is required.');
      return;
    }
    setPromoting(true);
    try {
      const res = await promoteFRSUnknownCandidate(candidateToPromote.candidate_id, promoteForm);
      showFeedback(`Candidate ${candidateToPromote.candidate_id} successfully promoted to enrolled identity ${res.person_id} (${res.name}).`);
      setPromoteModalOpen(false);
      setCandidateToPromote(null);
      loadAllData();
    } catch (err) {
      alert('Promotion failed: ' + err.message);
    } finally {
      setPromoting(false);
    }
  };

  const handleSeedDemo = async () => {
    try {
      const res = await seedFRSDemo();
      showFeedback(`Demo fleet initialized: ${res.count || 0} synthetic identities added.`);
      loadAllData();
    } catch (err) {
      showFeedback(err.message, true);
    }
  };

  // Filtered lists
  const filteredGallery = gallery.filter(p => {
    if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    return true;
  });

  const filteredUnknowns = unknownCandidates.filter(u => {
    if (unknownStatusFilter !== 'ALL' && u.status !== unknownStatusFilter) return false;
    return true;
  });

  const watchlistItems = gallery.filter(p => p.category === 'WATCHLIST' || p.status === 'WATCHLIST');

  const filteredHistory = recognitions.filter(r => {
    if (historyStatusFilter !== 'ALL' && r.status !== historyStatusFilter) return false;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      
      {/* Top Tactical Command Header */}
      <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-wide font-mono uppercase">
                Face Recognition Center
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {systemMode === 'demo' ? 'DEMO ENGINE' : 'LIVE FLEET'}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                {gallery.length} PROFILES ENROLLED
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                {unknownCandidates.length} UNKNOWN CANDIDATES
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              SIH26187 // Continuous Live YuNet + SFace Biometric Pipeline with Unknown Person Memory
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-3">
          {systemMode === 'demo' && (
            <button
              onClick={handleSeedDemo}
              className="px-3.5 py-2 rounded-xl border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-mono font-bold transition flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              Seed Demo Fleet
            </button>
          )}

          <button
            onClick={() => setEnrollModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono font-bold text-xs tracking-wide transition shadow-lg shadow-emerald-500/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Enroll Person
          </button>
        </div>
      </div>

      {/* Operation Alert Notification */}
      {feedback && (
        <div className={`mx-6 mt-3 p-3 rounded-xl border text-xs font-mono flex items-center gap-2 transition ${
          feedback.isError 
            ? 'bg-rose-950/70 border-rose-500/50 text-rose-200' 
            : 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
        }`}>
          {feedback.isError ? <AlertTriangle className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Navigation Sub-Tabs Bar */}
      <div className="flex items-center justify-between px-6 border-b border-slate-800 bg-slate-900/40 font-mono text-xs">
        <div className="flex items-center gap-6 overflow-x-auto">
          {[
            { id: 'gallery', label: `Enrolled Personnel (${gallery.length})` },
            { id: 'unknowns', label: `Unknown Person Memory (${unknownCandidates.length})` },
            { id: 'watchlist', label: `Watchlist Roster (${watchlistItems.length})`, badge: watchlistItems.length > 0 ? watchlistItems.length : null },
            { id: 'history', label: `Recognition Audit History (${recognitions.length})` },
            { id: 'feed', label: 'Camera Recognition Feed' },
            { id: 'status', label: 'Model Diagnostics & Capabilities' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3.5 border-b-2 font-bold transition flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-emerald-400 text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold animate-pulse">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={loadAllData}
          className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition shrink-0"
          title="Refresh Registry"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      {/* Main Tab View Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ================================================================= */}
        {/* TAB 1: ENROLLED PERSONNEL GALLERY */}
        {/* ================================================================= */}
        {activeTab === 'gallery' && (
          <div className="space-y-6">
            {/* Filter Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/50 border border-slate-800">
              <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search personnel by name, ID, or unit..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="text-slate-500">Category:</span>
                {['ALL', 'OPERATIONAL', 'SECURITY', 'VISITOR', 'VIP', 'WATCHLIST'].map(c => (
                  <button
                    key={c}
                    onClick={() => setCategoryFilter(c)}
                    className={`px-2.5 py-1 rounded-lg border transition ${
                      categoryFilter === c
                        ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300 font-bold'
                        : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Personnel Grid */}
            {filteredGallery.length === 0 ? (
              <div className="py-20 text-center space-y-4 bg-slate-900/30 rounded-2xl border border-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">No Personnel Enrolled</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {systemMode === 'demo' 
                      ? 'Click "Seed Demo Fleet" above or use the enrollment wizard to register identities.'
                      : 'Enroll authorized patrol officers and security staff to begin live facial identification.'}
                  </p>
                </div>
                <button
                  onClick={() => setEnrollModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-mono font-bold transition shadow-lg shadow-emerald-500/20"
                >
                  Enroll First Personnel
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredGallery.map(person => (
                  <div
                    key={person.person_id}
                    className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-4 shadow-lg group relative overflow-hidden"
                  >
                    <div className="flex items-start gap-4">
                      {person.photo_path ? (
                        <img
                          src={`/evidence/${person.photo_path}`}
                          alt={person.name}
                          className="w-16 h-16 rounded-xl object-cover border border-slate-700 shadow-md shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                          <UserCheck className="w-8 h-8" />
                        </div>
                      )}

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono text-slate-500">{person.person_id}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            person.category === 'WATCHLIST' || person.status === 'WATCHLIST'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {person.category}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white truncate">{person.name}</h4>
                        <p className="text-xs text-slate-400 truncate">{person.rank} // {person.designation}</p>
                        <p className="text-[11px] text-slate-500 truncate">{person.organization}</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Quality: <b>{person.quality_score}%</b></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Lock className="w-3 h-3 text-purple-400" />
                        <span className="text-purple-300">Fernet Encrypted</span>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        onClick={() => {
                          setSelectedPersonId(person.person_id);
                          setProfileModalOpen(true);
                        }}
                        className="flex-1 py-1.5 rounded-lg border border-slate-700 hover:border-emerald-500/50 bg-slate-800/60 hover:bg-slate-800 text-xs font-mono text-slate-300 hover:text-white transition flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        Dossier
                      </button>

                      <button
                        onClick={() => handleToggleWatchlist(person)}
                        className={`p-1.5 rounded-lg border transition ${
                          person.category === 'WATCHLIST'
                            ? 'border-rose-500/50 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                            : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:text-rose-400 hover:border-rose-500/40'
                        }`}
                        title={person.category === 'WATCHLIST' ? 'Remove from Watchlist' : 'Add to Watchlist'}
                      >
                        <Shield className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDelete(person)}
                        className="p-1.5 rounded-lg border border-slate-800 bg-slate-800/40 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition"
                        title="Purge Identity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: ANONYMOUS UNKNOWN CANDIDATES ROSTER (LAYER 2 MEMORY) */}
        {/* ================================================================= */}
        {activeTab === 'unknowns' && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/50 border border-slate-800">
              <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search unknown candidates by ID or camera..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-slate-500">Status:</span>
                {['ALL', 'ACTIVE', 'PROMOTED'].map(st => (
                  <button
                    key={st}
                    onClick={() => setUnknownStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg border transition ${
                      unknownStatusFilter === st
                        ? 'border-cyan-500/50 bg-cyan-500/20 text-cyan-300 font-bold'
                        : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Unknown Candidates Grid */}
            {filteredUnknowns.length === 0 ? (
              <div className="py-20 text-center space-y-4 bg-slate-900/30 rounded-2xl border border-slate-800 font-mono">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                  <UserX className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">No Unknown Candidates Recorded</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    When un-enrolled persons appear in live camera feeds, their face templates are securely indexed here for anonymous re-identification without guessing identity.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredUnknowns.map(cand => (
                  <div
                    key={cand.candidate_id}
                    className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-cyan-500/30 transition flex flex-col justify-between space-y-4 shadow-lg group relative overflow-hidden font-mono"
                  >
                    <div className="flex items-start gap-4">
                      {cand.best_snapshot_path ? (
                        <img
                          src={`/evidence/${cand.best_snapshot_path}`}
                          alt={cand.candidate_id}
                          className="w-16 h-16 rounded-xl object-cover border border-cyan-500/30 shadow-md shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                          <UserX className="w-8 h-8 text-cyan-400" />
                        </div>
                      )}

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-cyan-400">{cand.candidate_id}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            cand.status === 'PROMOTED'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          }`}>
                            {cand.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Sightings: <b className="text-white">{cand.sighting_count}</b>
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Last Cam: <b className="text-sky-300">{cand.last_camera_id || 'N/A'}</b>
                        </p>
                        <p className="text-[10px] text-slate-500 truncate">
                          Best Quality: {cand.best_quality_score}%
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>First: {new Date(cand.first_seen * 1000).toLocaleTimeString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Lock className="w-3 h-3 text-purple-400" />
                        <span className="text-purple-300">Fernet Encrypted</span>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      {cand.status !== 'PROMOTED' ? (
                        <button
                          onClick={() => handleOpenPromote(cand)}
                          className="flex-1 py-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs text-emerald-300 font-bold transition flex items-center justify-center gap-1.5"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Promote
                        </button>
                      ) : (
                        <div className="flex-1 py-1.5 rounded-lg bg-slate-800 text-[11px] text-slate-400 text-center">
                          Enrolled: {cand.promoted_to_person_id}
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setSelectedPersonId(cand.candidate_id);
                          setProfileModalOpen(true);
                        }}
                        className="py-1.5 px-3 rounded-lg border border-slate-700 hover:border-cyan-500/50 bg-slate-800 text-xs text-slate-300 hover:text-white transition flex items-center gap-1"
                        title="View Cross-Camera Journey"
                      >
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                        Journey
                      </button>

                      <button
                        onClick={() => handleDeleteUnknown(cand)}
                        className="p-1.5 rounded-lg border border-slate-800 bg-slate-800/40 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition"
                        title="Purge Candidate"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: WATCHLIST ROSTER */}
        {/* ================================================================= */}
        {activeTab === 'watchlist' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 flex items-start gap-3 font-mono">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-rose-400 uppercase">
                  HIGH-PRIORITY WATCHLIST ROSTER // ZERO-TOLERANCE PERIMETER PROTOCOL
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Any positive match of enrolled targets below instantly triggers Critical Incident escalation, dispatch alerts, and evidence keyframe sealing.
                </p>
              </div>
            </div>

            {watchlistItems.length === 0 ? (
              <div className="py-20 text-center space-y-4 bg-slate-900/30 rounded-2xl border border-slate-800 font-mono">
                <Shield className="w-10 h-10 text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-white">No Active Watchlist Targets</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Flag personnel from the Enrolled Gallery or enroll new high-risk targets with category "WATCHLIST".
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {watchlistItems.map(person => (
                  <div
                    key={person.person_id}
                    className="p-5 rounded-2xl bg-slate-900/80 border-2 border-rose-500/40 flex flex-col justify-between space-y-4 shadow-xl font-mono"
                  >
                    <div className="flex items-start gap-4">
                      {person.photo_path ? (
                        <img
                          src={`/evidence/${person.photo_path}`}
                          alt={person.name}
                          className="w-16 h-16 rounded-xl object-cover border-2 border-rose-500 shadow-md shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-slate-800 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                          <AlertTriangle className="w-8 h-8" />
                        </div>
                      )}

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">{person.person_id}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                            WATCHLIST
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white truncate">{person.name}</h4>
                        <p className="text-xs text-rose-300 truncate">{person.rank} // {person.designation}</p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-300">
                      {person.notes || 'High-risk target flagged for perimeter interception.'}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => {
                          setSelectedPersonId(person.person_id);
                          setProfileModalOpen(true);
                        }}
                        className="flex-1 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs text-slate-300 hover:text-white transition flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5 text-rose-400" />
                        Dossier
                      </button>
                      <button
                        onClick={() => handleToggleWatchlist(person)}
                        className="px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/20 text-rose-300 text-xs font-bold transition hover:bg-rose-500/30"
                      >
                        De-escalate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: RECOGNITION AUDIT HISTORY */}
        {/* ================================================================= */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/50 border border-slate-800 font-mono text-xs">
              <span className="text-slate-400">FILTER BY STATUS:</span>
              <div className="flex items-center gap-2">
                {['ALL', 'MATCH', 'UNKNOWN', 'UNCERTAIN'].map(st => (
                  <button
                    key={st}
                    onClick={() => setHistoryStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg border transition ${
                      historyStatusFilter === st
                        ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300 font-bold'
                        : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="py-20 text-center space-y-3 bg-slate-900/30 rounded-2xl border border-slate-800 font-mono text-xs text-slate-500">
                No biometric recognition events recorded yet.
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-900/70 border border-slate-800 overflow-hidden shadow-xl font-mono text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 text-[11px]">
                    <tr>
                      <th className="p-3">Snapshot</th>
                      <th className="p-3">Time</th>
                      <th className="p-3">Camera / Track</th>
                      <th className="p-3">Subject / Identity</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Situation</th>
                      <th className="p-3">Seal</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredHistory.map(r => (
                      <tr key={r.recognition_id} className="hover:bg-slate-800/30 transition">
                        <td className="p-3">
                          {r.snapshot_path ? (
                            <img src={`/evidence/${r.snapshot_path}`} alt="Face" className="w-10 h-10 rounded-lg object-cover border border-slate-700" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500">
                              <Camera className="w-5 h-5" />
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-slate-300">{new Date(r.timestamp * 1000).toLocaleTimeString()}</td>
                        <td className="p-3">
                          <div className="font-bold text-sky-400">{r.camera_id}</div>
                          <div className="text-[10px] text-slate-500">Track #{r.track_id}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-white">{r.person_name}</div>
                          <div className="text-[10px] text-slate-400">{r.candidate_id || r.person_id || 'Unregistered'}</div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.status === 'MATCH'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : r.status === 'UNCERTAIN'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {r.status} ({Math.round(r.confidence * 100)}%)
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.situation === 'UNSAFE'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : r.situation === 'ATTENTION'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            {r.situation || 'SAFE'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 text-[10px] truncate max-w-[100px]" title={r.sha256_hash}>
                          {r.sha256_hash ? r.sha256_hash.slice(0, 10) + '...' : 'N/A'}
                        </td>
                        <td className="p-3 text-right">
                          {(r.person_id || r.candidate_id) && (
                            <button
                              onClick={() => {
                                setSelectedPersonId(r.person_id || r.candidate_id);
                                setProfileModalOpen(true);
                              }}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 hover:text-white"
                            >
                              Timeline
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 5: CAMERA RECOGNITION FEED */}
        {/* ================================================================= */}
        {activeTab === 'feed' && (
          <div className="space-y-6">
            <div className="text-xs font-mono text-slate-400 uppercase">
              TACTICAL LIVE CAMERA BIOMETRIC FEEDS ({cameras.length} Active Feeds)
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {cameras.slice(0, 4).map(cam => (
                <div key={cam.camera_id} className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl flex flex-col">
                  <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      <span className="font-bold text-white">{cam.name}</span>
                      <span className="text-slate-500">[{cam.camera_id}]</span>
                    </div>
                    <span className="text-emerald-400 font-bold">FRS ACTIVE</span>
                  </div>

                  <div className="relative aspect-video bg-black">
                    <img
                      src={getCameraStreamUrl(cam.camera_id, true)}
                      alt={cam.name}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="p-3 bg-slate-950/70 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                    <span>Profile: <b>{cam.profile}</b></span>
                    <span>Sector: <b>{cam.sector}</b></span>
                    <span>FPS: <b>{cam.fps || 20}</b></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 6: MODEL DIAGNOSTICS & AI CAPABILITIES */}
        {/* ================================================================= */}
        {activeTab === 'status' && (
          <div className="space-y-6 max-w-5xl font-mono">
            <div className="text-xs text-slate-400 uppercase">
              BIOMETRIC HARDWARE & INFERENCE ENGINE TELEMETRY
            </div>

            {statusTelemetry && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Detector Panel */}
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-bold uppercase">Face Detector</span>
                    <span className="px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {statusTelemetry.detector.status}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white">{statusTelemetry.detector.name}</div>
                  <div className="space-y-1.5 text-slate-400 text-[11px]">
                    <div className="flex justify-between"><span>Backend:</span><span className="text-white">{statusTelemetry.detector.backend}</span></div>
                    <div className="flex justify-between"><span>Binary Size:</span><span className="text-white">{statusTelemetry.detector.size_kb} KB</span></div>
                  </div>
                </div>

                {/* Recognizer Panel */}
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-bold uppercase">Feature Recognizer</span>
                    <span className="px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {statusTelemetry.recognizer.status}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white">{statusTelemetry.recognizer.name}</div>
                  <div className="space-y-1.5 text-slate-400 text-[11px]">
                    <div className="flex justify-between"><span>Output:</span><span className="text-white">128-D L2 Cosine</span></div>
                    <div className="flex justify-between"><span>Binary Size:</span><span className="text-white">{statusTelemetry.recognizer.size_mb} MB</span></div>
                  </div>
                </div>

                {/* Unknown Memory Telemetry */}
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-bold uppercase">Unknown Memory</span>
                    <span className="px-2 py-0.5 rounded font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      ACTIVE
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white">Anonymous Face Index</div>
                  <div className="space-y-1.5 text-slate-400 text-[11px]">
                    <div className="flex justify-between"><span>Total Candidates:</span><span className="text-white">{statusTelemetry.unknown_memory?.total_candidates || 0}</span></div>
                    <div className="flex justify-between"><span>Encryption:</span><span className="text-purple-300">Fernet At Rest</span></div>
                    <div className="flex justify-between"><span>Retention:</span><span className="text-slate-300">30 Days Default</span></div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Capability Center Matrix */}
            <div className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                  AI CAPABILITY CENTER DIAGNOSTIC MATRIX (13 Subsystems)
                </span>
                <span className="text-[11px] text-emerald-400">TRUTHFUL VERIFIED STATUS</span>
              </div>

              {capabilities && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.entries(capabilities).map(([key, cap]) => {
                    const isAvail = cap.status === 'AVAILABLE';
                    return (
                      <div
                        key={key}
                        className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2 ${
                          isAvail
                            ? 'bg-slate-900/60 border-slate-800'
                            : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{cap.name}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isAvail
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {cap.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">{cap.details}</div>
                        <div className="text-[10px] text-slate-500 flex justify-between border-t border-slate-800/60 pt-1.5">
                          <span>Backend:</span>
                          <span className="text-slate-300">{cap.backend}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Promotion Modal Overlay */}
      {promoteModalOpen && candidateToPromote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-lg bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden font-mono">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Promote Unknown Candidate to Enrolled Identity
                </h3>
              </div>
              <button onClick={() => setPromoteModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecutePromotion} className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-3">
                {candidateToPromote.best_snapshot_path ? (
                  <img src={`/evidence/${candidateToPromote.best_snapshot_path}`} alt="Face" className="w-12 h-12 rounded-lg object-cover border border-cyan-500/40" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500">
                    <UserX className="w-6 h-6 text-cyan-400" />
                  </div>
                )}
                <div>
                  <div className="text-xs font-bold text-cyan-300">{candidateToPromote.candidate_id}</div>
                  <div className="text-[11px] text-slate-400">Sightings: {candidateToPromote.sighting_count} // Best Quality: {candidateToPromote.best_quality_score}%</div>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Full Personnel Name *</label>
                <input
                  type="text"
                  required
                  value={promoteForm.name}
                  onChange={(e) => setPromoteForm({ ...promoteForm, name: e.target.value })}
                  placeholder="e.g. Inspector Alok Sen or Ramesh Kumar"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Rank / Title</label>
                  <select
                    value={promoteForm.rank}
                    onChange={(e) => setPromoteForm({ ...promoteForm, rank: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  >
                    {['Inspector', 'Sub-Inspector', 'Havildar', 'Constable', 'Captain', 'Major', 'Civilian Specialist', 'Contractor', 'Visitor'].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Category</label>
                  <select
                    value={promoteForm.category}
                    onChange={(e) => setPromoteForm({ ...promoteForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  >
                    {['OPERATIONAL', 'SECURITY', 'VISITOR', 'VIP', 'CONTRACTOR', 'WATCHLIST'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Unit / Organization</label>
                <input
                  type="text"
                  value={promoteForm.organization}
                  onChange={(e) => setPromoteForm({ ...promoteForm, organization: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Operational Remarks</label>
                <textarea
                  rows={2}
                  value={promoteForm.notes}
                  onChange={(e) => setPromoteForm({ ...promoteForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPromoteModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={promoting}
                  className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold tracking-wide transition shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {promoting ? 'Promoting...' : 'Confirm Promotion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Existing Modals */}
      <FaceEnrollmentModal
        isOpen={enrollModalOpen}
        onClose={() => setEnrollModalOpen(false)}
        onEnrolled={() => {
          setEnrollModalOpen(false);
          showFeedback('Personnel enrolled successfully.');
          loadAllData();
        }}
        systemMode={systemMode}
      />

      <IdentityProfileModal
        personId={selectedPersonId}
        isOpen={profileModalOpen}
        onClose={() => {
          setProfileModalOpen(false);
          setSelectedPersonId(null);
        }}
        onPromoteCandidate={(cand) => {
          setProfileModalOpen(false);
          handleOpenPromote(cand);
        }}
        operator="Chief Surveillance Officer"
      />
    </div>
  );
}
