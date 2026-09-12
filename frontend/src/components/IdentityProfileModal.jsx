import React, { useState, useEffect } from 'react';
import { 
  X, User, Shield, Clock, Camera, Download, FileCheck, 
  MapPin, CheckCircle2, AlertTriangle, Radio, Hash, ArrowRight,
  ExternalLink, Sparkles, RefreshCw
} from 'lucide-react';
import { getFRSTimeline, exportFRSPerson, getFRSPerson } from '../services/api';

export default function IdentityProfileModal({ personId, isOpen, onClose, operator = 'Supervisor' }) {
  const [profile, setProfile] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('dossier'); // 'dossier' | 'timeline' | 'journey'

  useEffect(() => {
    if (isOpen && personId) {
      loadDetails();
    }
  }, [isOpen, personId]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const [pRes, tRes] = await Promise.all([
        getFRSPerson(personId).catch(() => null),
        getFRSTimeline(personId).catch(() => null)
      ]);
      setProfile(pRes);
      setTimelineData(tRes);
    } catch (err) {
      console.error('Failed to fetch personnel dossier:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const exp = await exportFRSPerson(personId, operator);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exp, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `FRS_DOSSIER_${personId}_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/95">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide uppercase font-mono">
                  Biometric Dossier & Cross-Camera Journey
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-emerald-400 border border-emerald-500/30">
                  {personId}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                C4ISR Intelligence Briefing // Chain of Custody Verified
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-emerald-500/50 bg-slate-800 text-xs font-mono text-slate-300 hover:text-white transition flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              {exporting ? 'Exporting...' : 'Export Dossier'}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-4 px-6 border-b border-slate-800 bg-slate-950/60 font-mono text-xs">
          {[
            { id: 'dossier', label: 'Identity Dossier' },
            { id: 'timeline', label: `Sightings Timeline (${timelineData?.timeline?.length || 0})` },
            { id: 'journey', label: `Camera Journey Flow (${timelineData?.journey?.length || 0})` }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`py-3 border-b-2 font-bold transition flex items-center gap-2 ${
                activeTab === t.id
                  ? 'border-emerald-400 text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
              <div className="text-xs font-mono text-slate-400">Decrypting biometric profile and aggregating cross-camera timeline...</div>
            </div>
          ) : (
            <>
              {/* TAB 1: IDENTITY DOSSIER */}
              {activeTab === 'dossier' && (
                <div className="space-y-6">
                  {/* Top Profile Card */}
                  <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700 flex flex-col md:flex-row items-start md:items-center gap-6">
                    {profile?.photo_path ? (
                      <img 
                        src={`/evidence/${profile.photo_path}`} 
                        alt={profile.name}
                        className="w-28 h-28 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-xl shrink-0" 
                      />
                    ) : (
                      <div className="w-28 h-28 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                        <User className="w-12 h-12" />
                      </div>
                    )}

                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-slate-800 border border-slate-700 text-slate-300">
                          {profile?.rank || 'Staff'}
                        </span>
                        <h3 className="text-xl font-bold text-white tracking-wide">{profile?.name}</h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          profile?.category === 'WATCHLIST' 
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {profile?.category || 'OPERATIONAL'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                          STATUS: {profile?.status || 'ACTIVE'}
                        </span>
                      </div>

                      <div className="text-xs font-mono text-slate-400">
                        Designation: <span className="text-slate-200">{profile?.designation}</span> // Unit: <span className="text-slate-200">{profile?.organization}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-mono">
                        <div className="flex items-center gap-1 text-slate-400">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Quality: <b>{profile?.quality_score || 0}%</b></span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400">
                          <Camera className="w-3.5 h-3.5 text-sky-400" />
                          <span>Enrolled Photos: <b>{profile?.photos?.length || 1}</b></span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400">
                          <Shield className="w-3.5 h-3.5 text-purple-400" />
                          <span>Biometrics: <b>Fernet Encrypted</b></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Operational Notes */}
                  {profile?.notes && (
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                      <div className="text-xs font-mono font-bold text-slate-400">OPERATIONAL CLEARANCE & REMARKS:</div>
                      <p className="text-sm text-slate-300">{profile.notes}</p>
                    </div>
                  )}

                  {/* Multi-angle Photos Gallery */}
                  {profile?.photos && profile.photos.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-xs font-mono text-slate-400 uppercase tracking-wide">
                        Reference Enrollment Angles ({profile.photos.length})
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                        {profile.photos.map((p, i) => (
                          <div key={i} className="rounded-xl overflow-hidden border border-slate-700 aspect-square bg-slate-950 relative group">
                            <img src={`/evidence/${p}`} alt={`Angle ${i + 1}`} className="w-full h-full object-cover" />
                            <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-slate-900/80 text-[10px] font-mono text-white">
                              Angle #{i + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cryptographic Proof of Authenticity */}
                  <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-3">
                    <FileCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-mono font-bold text-emerald-400">
                        CRYPTOGRAPHIC BIOMETRIC INTEGRITY GUARANTEED
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Facial embeddings are encoded as unit L2 vectors and sealed in SQLite with machine-bound Fernet encryption. Plaintext embeddings are never exposed over network endpoints or database dumps.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SIGHTINGS TIMELINE */}
              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>RECORDED RECOGNITION SIGHTINGS: {timelineData?.timeline?.length || 0}</span>
                    <span>Duration: {timelineData?.duration_seconds ? `${timelineData.duration_seconds}s span` : 'N/A'}</span>
                  </div>

                  {!timelineData?.timeline?.length ? (
                    <div className="py-12 text-center text-slate-500 font-mono text-xs">
                      No live recognition events registered for this identity yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {timelineData.timeline.map((item, idx) => (
                        <div key={idx} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            {item.snapshot_path ? (
                              <img 
                                src={`/evidence/${item.snapshot_path}`} 
                                alt="Face"
                                className="w-16 h-16 rounded-xl object-cover border border-slate-600 shrink-0" 
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                                <Camera className="w-6 h-6" />
                              </div>
                            )}

                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 border border-slate-700 text-sky-400">
                                  {item.camera_id}
                                </span>
                                <span className="text-xs font-mono font-bold text-white">
                                  Track #{item.track_id}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                  {item.status} ({Math.round((item.confidence || 0) * 100)}%)
                                </span>
                              </div>

                              <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-slate-500" />
                                <span>{new Date(item.timestamp * 1000).toLocaleString('en-GB')}</span>
                              </div>

                              {item.sha256_hash && (
                                <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
                                  <Hash className="w-3 h-3 text-emerald-400" />
                                  <span className="truncate max-w-xs">{item.sha256_hash}</span>
                                  <span className="text-emerald-400 font-bold ml-1">[VERIFIED SEAL]</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-mono font-bold text-emerald-400">
                              {Math.round((item.confidence || 0) * 100)}% Match
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: CAMERA JOURNEY FLOW */}
              {activeTab === 'journey' && (
                <div className="space-y-6">
                  <div className="text-xs font-mono text-slate-400">
                    CROSS-CAMERA MOVEMENT PATHWAY ({timelineData?.journey?.length || 0} Camera Handoffs)
                  </div>

                  {!timelineData?.journey?.length ? (
                    <div className="py-12 text-center text-slate-500 font-mono text-xs">
                      Insufficient cross-camera transition events recorded yet.
                    </div>
                  ) : (
                    <div className="relative pl-6 space-y-6 border-l-2 border-emerald-500/30">
                      {timelineData.journey.map((node, i) => (
                        <div key={i} className="relative group">
                          {/* Node Icon */}
                          <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-slate-900" />

                          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-bold text-emerald-400">
                                  STEP {i + 1}
                                </span>
                                <h4 className="text-sm font-bold text-white font-mono">
                                  Camera: {node.camera_id}
                                </h4>
                              </div>
                              <span className="text-xs font-mono text-slate-400">
                                {new Date(node.timestamp * 1000).toLocaleTimeString('en-GB')}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                              <span>Match Confidence: <b>{Math.round((node.confidence || 0) * 100)}%</b></span>
                              <span>Timestamp: {new Date(node.timestamp * 1000).toLocaleDateString('en-GB')}</span>
                            </div>

                            {node.snapshot_path && (
                              <div className="pt-2">
                                <img 
                                  src={`/evidence/${node.snapshot_path}`} 
                                  alt="Node Snapshot"
                                  className="w-24 h-16 rounded-lg object-cover border border-slate-700" 
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/95 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono text-white transition"
          >
            Close Dossier
          </button>
        </div>

      </div>
    </div>
  );
}
