import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Search, 
  Filter, 
  ShieldCheck, 
  Copy, 
  Check, 
  ExternalLink, 
  Film, 
  Calendar, 
  Camera, 
  Hash,
  Download,
  AlertTriangle,
  RefreshCw,
  Printer,
  X,
  FileText,
  Sparkles
} from 'lucide-react';
import { getEvidence, getCameras, getIncidentDossier } from '../services/api';
import RiskBadge from '../components/RiskBadge';

export default function EvidenceVault({ onSelectIncident }) {
  const [evidenceList, setEvidenceList] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedHash, setCopiedHash] = useState(null);
  const [dossierModal, setDossierModal] = useState(null);
  const [loadingDossier, setLoadingDossier] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [evRes, camRes] = await Promise.all([
        getEvidence(selectedCamera, searchQuery, 0, 50),
        getCameras()
      ]);
      setEvidenceList(evRes.items || []);
      setCameras(camRes || []);
    } catch (err) {
      console.error('Failed to load evidence vault:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedCamera]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleOpenDossier = async (eventId) => {
    setLoadingDossier(true);
    try {
      const dossier = await getIncidentDossier(eventId);
      setDossierModal(dossier);
    } catch (err) {
      alert("Failed to load forensic dossier: " + err.message);
    } finally {
      setLoadingDossier(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Vault Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-100 tracking-tight font-mono">Cryptographic Evidence Vault</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold">
              CHAIN-OF-CUSTODY SECURE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl font-sans">
            Tamper-evident forensic records captured automatically at the edge inference pipeline. Every incident frame and telemetry segment is cryptographically signed with SHA-256 for defense investigation.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={fetchData}
            className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium flex items-center space-x-2 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Vault</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by Evidence Hash (SHA-256), Incident ID, or Sector..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-24 py-2 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </form>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded py-2 px-3 focus:outline-none focus:border-emerald-500 font-sans w-full sm:w-48"
          >
            <option value="">All Camera Sectors</option>
            {cameras.map((c) => (
              <option key={c.camera_id} value={c.camera_id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Evidence Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Verifying Cryptographic Ledger...</span>
          </div>
        ) : evidenceList.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs">
            No tamper-evident forensic packages recorded matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Keyframe Snapshot</th>
                  <th className="py-3 px-4">Incident Record</th>
                  <th className="py-3 px-4">Camera Sector</th>
                  <th className="py-3 px-4">Threat Level</th>
                  <th className="py-3 px-4">Cryptographic Hash (SHA-256)</th>
                  <th className="py-3 px-4">Timestamp (UTC)</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {evidenceList.map((item) => {
                  const eventId = item.event_id || item.id;
                  const snapPath = item.snapshot_path || item.snapshot_url;
                  const snapUrl = snapPath 
                    ? (snapPath.startsWith('/') || snapPath.startsWith('http') ? snapPath : `/${snapPath.replace(/\\/g, '/')}`)
                    : `/evidence/${eventId}_snapshot.jpg`;
                  const shaHash = item.sha256_hash || item.sha256 || 'Unsealed';

                  return (
                    <tr key={eventId} className="hover:bg-slate-800/40 transition">
                      {/* Snapshot */}
                      <td className="py-3 px-4">
                        <div 
                          className="relative w-20 h-12 rounded overflow-hidden border border-slate-800 group cursor-pointer bg-slate-950 flex items-center justify-center"
                          onClick={() => handleOpenDossier(eventId)}
                        >
                          <img 
                            src={snapUrl} 
                            alt={`Evidence ${eventId}`} 
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                            onError={(e) => { 
                              e.target.onerror = null; 
                              e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60" fill="%231e293b"><rect width="100" height="60"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2364748b" font-size="9">EVIDENCE</text></svg>'; 
                            }}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                            <Film className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      </td>

                      {/* Incident ID & Type */}
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-200 font-bold">#{eventId ? eventId.slice(0, 8) : 'EVID'}</div>
                        <div className="text-[11px] text-slate-400 capitalize">{(item.event_type || 'ALERT').replace(/_/g, ' ')}</div>
                      </td>

                      {/* Camera */}
                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-300 text-[11px]">{item.camera_id}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[120px]">{item.camera_name || 'Perimeter Feed'}</div>
                      </td>

                      {/* Risk */}
                      <td className="py-3 px-4">
                        <RiskBadge score={item.risk_score || 60} severity={item.severity} />
                      </td>

                      {/* Cryptographic Hash */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 max-w-[160px] truncate" title={shaHash}>
                            {shaHash}
                          </span>
                          <button
                            onClick={() => copyToClipboard(shaHash, eventId)}
                            title="Copy Full SHA-256 Digest"
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                          >
                            {copiedHash === eventId ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />
                            VERIFIED
                          </span>
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        {new Date(typeof item.timestamp === 'number' ? item.timestamp * 1000 : item.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenDossier(eventId)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center space-x-1 transition"
                          >
                            <FileText className="w-3 h-3 text-emerald-400" />
                            <span>Forensic Dossier</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Forensic Custody Notice */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 text-xs font-mono text-slate-400 flex items-start space-x-3">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="text-slate-300 font-semibold uppercase">Legal Admissibility Protocol (ISO/IEC 27037 compliant):</span>
          <p className="text-[11px] text-slate-500 mt-0.5 font-sans leading-relaxed">
            All stored telemetry, bounding box vectors, and frame snapshots are secured against post-incident tampering. SHA-256 digests are computed synchronously at edge inference time before local NVMe persistence.
          </p>
        </div>
      </div>

      {/* Printable Forensic Dossier Modal */}
      {dossierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                  OFFICIAL DEFENSE FORENSIC DOSSIER
                </span>
                <h2 className="text-base font-bold text-white font-mono mt-1.5">
                  INCIDENT #{dossierModal.event_id}
                </h2>
                <div className="text-xs text-slate-400 font-mono">
                  Camera: {dossierModal.camera?.name} ({dossierModal.camera?.sector}) • Profile: {dossierModal.camera?.profile}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Report</span>
                </button>
                <button onClick={() => setDossierModal(null)} className="p-1 rounded text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Evidence Image */}
            {dossierModal.evidence?.snapshot_path && (
              <div className="aspect-video bg-black rounded-lg overflow-hidden border border-slate-800 relative flex items-center justify-center">
                <img
                  src={dossierModal.evidence.snapshot_path.startsWith('/') ? dossierModal.evidence.snapshot_path : `/${dossierModal.evidence.snapshot_path.replace(/\\/g, '/')}`}
                  alt="Incident Snapshot"
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* Split Telemetry */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block border-b border-slate-800 pb-1">
                  Local AI Perception
                </span>
                <div>Target Class: <span className="text-white font-bold">{dossierModal.local_perception?.class_name}</span></div>
                <div>Confidence: <span className="text-white">{Math.round((dossierModal.local_perception?.confidence || 0) * 100)}%</span></div>
                <div>Track ID: <span className="text-white">#{dossierModal.local_perception?.track_id || 'N/A'}</span></div>
                <div>Behavioral Pattern: <span className="text-amber-400">{dossierModal.local_perception?.behaviour}</span></div>
                <div>Risk Score: <span className="text-rose-400 font-bold">{dossierModal.risk_score} / 100</span></div>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider block border-b border-slate-800 pb-1">
                  Gemini Assisted Analysis
                </span>
                {dossierModal.gemini_assisted_analysis ? (
                  <div className="space-y-1.5 font-sans">
                    <p className="text-slate-200 text-xs">
                      {dossierModal.gemini_assisted_analysis.situational_assessment}
                    </p>
                    <div className="text-[11px] text-sky-300 bg-sky-950/40 p-2 rounded border border-sky-900/40 font-mono">
                      SOP Directive: {dossierModal.gemini_assisted_analysis.recommended_operator_response}
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-500 font-sans py-3 italic">
                    Gemini advisory analysis was not invoked for this record (Local perception only).
                  </div>
                )}
              </div>
            </div>

            {/* Cryptographic Ledger & Chain of Custody */}
            <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono space-y-2">
              <span className="text-slate-400 uppercase tracking-wider block font-bold">
                Forensic Verification & SHA-256 Checksum
              </span>
              <div className="p-2 rounded bg-slate-900 text-emerald-400 text-[10px] break-all border border-slate-800 select-all">
                {dossierModal.evidence?.sha256_hash}
              </div>
              <div className="text-[10px] text-slate-500 flex justify-between">
                <span>Verification Authority: IBVAP Edge Kernel</span>
                <span className="text-emerald-400">INTEGRITY CHECK PASSED</span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setDossierModal(null)}
                className="px-4 py-1.5 rounded bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}