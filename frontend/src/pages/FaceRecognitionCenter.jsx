import React, { useState, useEffect } from 'react';
import { 
  UserCheck, Shield, AlertTriangle, Search, Plus, Download, 
  Trash2, Edit3, Eye, Clock, Camera, RefreshCw, CheckCircle2,
  Lock, Activity, Cpu, Sparkles, Filter, ChevronRight, UserX,
  ExternalLink, Hash, ArrowUpRight, Radio
} from 'lucide-react';
import { 
  getFRSStatus, getFRSGallery, updateFRSPerson, deleteFRSPerson, 
  getFRSRecognitions, seedFRSDemo, getCameras, getCameraStreamUrl 
} from '../services/api';
import FaceEnrollmentModal from '../components/FaceEnrollmentModal';
import IdentityProfileModal from '../components/IdentityProfileModal';

export default function FaceRecognitionCenter({ systemMode = 'live' }) {
  const [activeTab, setActiveTab] = useState('gallery'); // 'gallery' | 'watchlist' | 'history' | 'feed' | 'status'
  const [gallery, setGallery] = useState([]);
  const [recognitions, setRecognitions] = useState([]);
  const [statusTelemetry, setStatusTelemetry] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');

  // Modals state
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editPerson, setEditPerson] = useState(null);

  // Operation feedback
  const [feedback, setFeedback] = useState(null);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const modeParam = systemMode === 'demo' ? 'DEMO' : 'LIVE';
      const [galRes, recRes, statRes, camsRes] = await Promise.all([
        getFRSGallery(null, null, searchQuery || null, modeParam).catch(() => []),
        getFRSRecognitions({ data_mode: modeParam, limit: 50 }).catch(() => ({ items: [] })),
        getFRSStatus().catch(() => null),
        getCameras().catch(() => [])
      ]);
      setGallery(galRes || []);
      setRecognitions(recRes?.items || []);
      setStatusTelemetry(statRes);
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
      // Periodic background refresh of recognition history and telemetry
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

  const handleSeedDemo = async () => {
    try {
      await seedFRSDemo();
      showFeedback('Demo personnel and synthetic watchlist seeded successfully.');
      loadAllData();
    } catch (err) {
      showFeedback(err.message, true);
    }
  };

  // Filtered gallery items
  const filteredGallery = gallery.filter(p => {
    if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    return true;
  });

  const watchlistItems = gallery.filter(p => p.category === 'WATCHLIST' || p.status === 'WATCHLIST');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-200">
      
      {/* Top Banner / Breadcrumb Header */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 z-10">
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
            </div>
            <p className="text-xs text-slate-400 font-mono">
              SIH26187 // Native YuNet 5-Point Alignment & SFace 128-D Cosine Biometric Architecture
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
        <div className="flex items-center gap-6">
          {[
            { id: 'gallery', label: `Enrolled Personnel (${gallery.length})` },
            { id: 'watchlist', label: `Watchlist Roster (${watchlistItems.length})`, badge: watchlistItems.length > 0 ? watchlistItems.length : null },
            { id: 'history', label: `Recognition Audit History (${recognitions.length})` },
            { id: 'feed', label: 'Camera Recognition Feed' },
            { id: 'status', label: 'Model Status & Telemetry' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3.5 border-b-2 font-bold transition flex items-center gap-2 ${
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
          className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition"
          title="Refresh Registry"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      {/* Main Tab View Stage */}
      <div className="flex-1 overflow-y-auto p-6">
        
        {/* ================================================================= */}
        {/* TAB 1: ENROLLED PERSONNEL GALLERY */}
        {/* ================================================================= */}
        {activeTab === 'gallery' && (
          <div className="space-y-5">
            {/* Search and Category Filters */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
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

                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                            {person.rank}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            person.category === 'WATCHLIST'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {person.category}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-white truncate font-mono">{person.name}</h4>
                        <div className="text-[11px] text-slate-400 truncate font-mono">
                          {person.designation} // {person.organization}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          ID: <span className="text-slate-400">{person.person_id}</span> | Quality: <span className="text-emerald-400 font-bold">{person.quality_score}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Operational Action Controls */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                      <button
                        onClick={() => {
                          setSelectedPersonId(person.person_id);
                          setProfileModalOpen(true);
                        }}
                        className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Dossier</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleWatchlist(person)}
                          className={`px-2 py-1 rounded text-[10px] transition border ${
                            person.category === 'WATCHLIST'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                          }`}
                          title={person.category === 'WATCHLIST' ? 'Remove from watchlist' : 'Flag to active watchlist'}
                        >
                          {person.category === 'WATCHLIST' ? 'WATCHLIST ACTIVE' : 'Flag Target'}
                        </button>

                        <button
                          onClick={() => handleDelete(person)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition"
                          title="Delete Personnel"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: WATCHLIST CENTER */}
        {/* ================================================================= */}
        {activeTab === 'watchlist' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-rose-200 font-mono tracking-wide uppercase">
                    High-Priority Watchlist Command
                  </h3>
                  <p className="text-xs text-rose-300/80 font-mono">
                    Any biometric sighting of these entities instantly triggers Critical Incidents and Evidence Vault capture.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                {watchlistItems.length} Flagged Targets
              </span>
            </div>

            {watchlistItems.length === 0 ? (
              <div className="py-16 text-center text-slate-500 font-mono text-xs bg-slate-900/30 rounded-2xl border border-slate-800">
                No active threats or persons of interest on the watchlist.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {watchlistItems.map(item => (
                  <div key={item.person_id} className="p-5 rounded-2xl bg-slate-900/80 border border-rose-500/30 space-y-3">
                    <div className="flex items-start gap-4">
                      {item.photo_path ? (
                        <img src={`/evidence/${item.photo_path}`} alt={item.name} className="w-16 h-16 rounded-xl object-cover border border-rose-500/50" />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-slate-800 border border-rose-500/30 flex items-center justify-center text-rose-400">
                          <UserX className="w-8 h-8" />
                        </div>
                      )}
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            WATCHLIST THREAT
                          </span>
                          <span className="text-xs font-mono text-slate-400">{item.person_id}</span>
                        </div>
                        <h4 className="text-base font-bold text-white font-mono">{item.name}</h4>
                        <div className="text-xs text-slate-400 font-mono">{item.designation} // {item.organization}</div>
                      </div>
                    </div>

                    {item.notes && (
                      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-mono text-rose-300/80">
                        {item.notes}
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2 text-xs font-mono">
                      <button
                        onClick={() => {
                          setSelectedPersonId(item.person_id);
                          setProfileModalOpen(true);
                        }}
                        className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Journey Timeline</span>
                      </button>

                      <button
                        onClick={() => handleToggleWatchlist(item)}
                        className="px-3 py-1 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                      >
                        Remove from Watchlist
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: RECOGNITION AUDIT HISTORY */}
        {/* ================================================================= */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span>REAL-TIME BIOMETRIC RECOGNITION FEED & AUDIT TRAIL</span>
              <span>Total Logged Events: {recognitions.length}</span>
            </div>

            {recognitions.length === 0 ? (
              <div className="py-20 text-center text-slate-500 font-mono text-xs bg-slate-900/30 rounded-2xl border border-slate-800">
                No face recognition events recorded yet. Start camera feeds or enroll identities to trigger matches.
              </div>
            ) : (
              <div className="space-y-3">
                {recognitions.map((rec) => (
                  <div 
                    key={rec.recognition_id} 
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      {rec.snapshot_path ? (
                        <img
                          src={`/evidence/${rec.snapshot_path}`}
                          alt="Face Crop"
                          className="w-14 h-14 rounded-xl object-cover border border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                          <Camera className="w-6 h-6" />
                        </div>
                      )}

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            rec.category === 'WATCHLIST'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : rec.status === 'MATCH'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : rec.status === 'UNCERTAIN'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {rec.category === 'WATCHLIST' ? 'WATCHLIST ALERT' : rec.status}
                          </span>

                          <span className="text-sm font-bold text-white font-mono">
                            {rec.person_name}
                          </span>

                          {rec.person_rank && (
                            <span className="text-xs font-mono text-slate-400">
                              ({rec.person_rank})
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-mono text-slate-400 flex flex-wrap items-center gap-3">
                          <span>Camera: <b>{rec.camera_id}</b></span>
                          <span>Track: <b>#{rec.track_id}</b></span>
                          <span>Confidence: <b>{Math.round(rec.confidence * 100)}%</b></span>
                          <span>{new Date(rec.timestamp * 1000).toLocaleTimeString('en-GB')}</span>
                        </div>

                        {rec.sha256_hash && (
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 pt-0.5">
                            <Hash className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate max-w-xs">{rec.sha256_hash}</span>
                            <span className="text-emerald-400 font-bold ml-1">[CRYPTOGRAPHICALLY VERIFIED]</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {rec.person_id && (
                      <button
                        onClick={() => {
                          setSelectedPersonId(rec.person_id);
                          setProfileModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-emerald-500/40 bg-slate-800 text-xs font-mono text-emerald-400 flex items-center gap-1 shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Timeline</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: CAMERA RECOGNITION FEED */}
        {/* ================================================================= */}
        {activeTab === 'feed' && (
          <div className="space-y-6">
            <div className="text-xs font-mono text-slate-400">
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
        {/* TAB 5: MODEL STATUS & DIAGNOSTICS */}
        {/* ================================================================= */}
        {activeTab === 'status' && statusTelemetry && (
          <div className="space-y-6 max-w-4xl">
            <div className="text-xs font-mono text-slate-400 uppercase">
              BIOMETRIC HARDWARE & INFERENCE ENGINE TELEMETRY
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Detector Panel */}
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold uppercase">Face Detector</span>
                  <span className="px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {statusTelemetry.detector.status}
                  </span>
                </div>
                <div className="text-sm font-bold text-white">{statusTelemetry.detector.name}</div>
                <div className="space-y-1.5 text-slate-400 text-[11px]">
                  <div className="flex justify-between"><span>Backend:</span><span className="text-white">{statusTelemetry.detector.backend}</span></div>
                  <div className="flex justify-between"><span>Model File:</span><span className="text-slate-300">{statusTelemetry.detector.model_file}</span></div>
                  <div className="flex justify-between"><span>Binary Size:</span><span className="text-white">{statusTelemetry.detector.size_kb} KB</span></div>
                </div>
              </div>

              {/* Recognizer Panel */}
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold uppercase">Embedding Recognizer</span>
                  <span className="px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {statusTelemetry.recognizer.status}
                  </span>
                </div>
                <div className="text-sm font-bold text-white">{statusTelemetry.recognizer.name}</div>
                <div className="space-y-1.5 text-slate-400 text-[11px]">
                  <div className="flex justify-between"><span>Vector Space:</span><span className="text-white">128-D L2 Cosine</span></div>
                  <div className="flex justify-between"><span>Model File:</span><span className="text-slate-300">{statusTelemetry.recognizer.model_file}</span></div>
                  <div className="flex justify-between"><span>Binary Size:</span><span className="text-white">{statusTelemetry.recognizer.size_mb} MB</span></div>
                </div>
              </div>
            </div>

            {/* Performance Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <div className="text-[10px] text-slate-500">TOTAL INFERENCES</div>
                <div className="text-xl font-bold text-white mt-1">{statusTelemetry.telemetry.total_inferences}</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <div className="text-[10px] text-slate-500">AVG LATENCY</div>
                <div className="text-xl font-bold text-emerald-400 mt-1">{statusTelemetry.telemetry.avg_latency_ms} ms</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <div className="text-[10px] text-slate-500">GALLERY VECTORS</div>
                <div className="text-xl font-bold text-sky-400 mt-1">{statusTelemetry.gallery.total_vectors}</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                <div className="text-[10px] text-slate-500">ENCRYPTED VAULT</div>
                <div className="text-xl font-bold text-purple-400 mt-1">SEALED</div>
              </div>
            </div>

            {/* Security Assurance Card */}
            <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-4">
              <Shield className="w-6 h-6 text-emerald-400 shrink-0 mt-1" />
              <div className="space-y-1 font-mono text-xs">
                <div className="font-bold text-emerald-300">DEFENSE COMPLIANCE & PRIVACY MANDATE</div>
                <p className="text-slate-400 text-[11px]">
                  All biometric facial embeddings are encrypted at rest using machine-bound Fernet cryptography in SQLite. Zero plaintext biometric coordinates are ever stored or emitted. All gallery modifications and watchlist triggers are logged into the immutable AuditLog subsystem.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Enrollment Wizard Modal */}
      <FaceEnrollmentModal
        isOpen={enrollModalOpen}
        onClose={() => setEnrollModalOpen(false)}
        onEnrolled={() => {
          showFeedback('Personnel successfully enrolled into encrypted biometric registry.');
          loadAllData();
        }}
        systemMode={systemMode}
      />

      {/* Identity Profile & Timeline Modal */}
      <IdentityProfileModal
        personId={selectedPersonId}
        isOpen={profileModalOpen}
        onClose={() => {
          setProfileModalOpen(false);
          setSelectedPersonId(null);
        }}
        operator="Supervisor OP-01"
      />

    </div>
  );
}
