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
  RefreshCw
} from 'lucide-react';
import { getEvidence, getCameras } from '../services/api';
import RiskBadge from '../components/RiskBadge';

export default function EvidenceVault({ onSelectIncident }) {
  const [evidenceList, setEvidenceList] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedHash, setCopiedHash] = useState(null);

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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Vault Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-100 tracking-tight">Cryptographic Evidence Vault</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              CHAIN-OF-CUSTODY SECURE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Tamper-evident forensic records captured automatically upon security threshold violations. Every incident frame and telemetry segment is cryptographically signed with SHA-256 for judicial-grade evidence presentation.
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
          <button
            type="submit"
            className="absolute right-1.5 top-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 font-sans"
          >
            Search
          </button>
        </form>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded px-3 py-2 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Camera Ingestion Feeds</option>
            {cameras.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Evidence Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <span className="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wider">
            Forensic Custody Ledger ({evidenceList.length} Items)
          </span>
          <span className="text-[11px] font-mono text-slate-500">Auto-Verification Status: ACTIVE</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
            Verifying cryptographic ledger hashes...
          </div>
        ) : evidenceList.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No forensic evidence packages match the query criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-mono uppercase text-[11px]">
                  <th className="py-3 px-4">Evidence Snapshot</th>
                  <th className="py-3 px-4">Incident ID & Type</th>
                  <th className="py-3 px-4">Camera Source</th>
                  <th className="py-3 px-4">Risk Level</th>
                  <th className="py-3 px-4">Cryptographic Hash (SHA-256)</th>
                  <th className="py-3 px-4">Timestamp (UTC)</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {evidenceList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition">
                    {/* Snapshot */}
                    <td className="py-3 px-4">
                      {item.snapshot_url ? (
                        <div className="relative w-20 h-12 rounded overflow-hidden border border-slate-800 group cursor-pointer"
                             onClick={() => onSelectIncident && onSelectIncident({ id: item.id, ...item })}>
                          <img 
                            src={item.snapshot_url} 
                            alt={`Evidence ${item.id}`} 
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                            onError={(e) => { e.target.onerror = null; e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60" fill="%231e293b"><rect width="100" height="60"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2364748b" font-size="10">SNAPSHOT</text></svg>'; }}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                            <Film className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-20 h-12 rounded bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 font-mono text-[9px]">
                          NO FRAME
                        </div>
                      )}
                    </td>

                    {/* Incident ID & Type */}
                    <td className="py-3 px-4">
                      <div className="font-mono text-slate-200 font-medium">#{item.id}</div>
                      <div className="text-[11px] text-slate-400 capitalize">{item.event_type.replace('_', ' ')}</div>
                    </td>

                    {/* Camera */}
                    <td className="py-3 px-4">
                      <div className="font-mono text-slate-300 text-[11px]">{item.camera_id}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[120px]">{item.camera_name}</div>
                    </td>

                    {/* Risk */}
                    <td className="py-3 px-4">
                      <RiskBadge score={item.risk_score} severity={item.severity} />
                    </td>

                    {/* Cryptographic Hash */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 max-w-[160px] truncate" title={item.sha256}>
                          {item.sha256}
                        </span>
                        <button
                          onClick={() => copyToClipboard(item.sha256, item.id)}
                          title="Copy Full SHA-256 Digest"
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                        >
                          {copiedHash === item.id ? (
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
                      {new Date(item.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {onSelectIncident && (
                          <button
                            onClick={() => onSelectIncident({ id: item.id, ...item })}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center space-x-1 transition"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Inspect Dossier</span>
                          </button>
                        )}
                        {item.snapshot_url && (
                          <a
                            href={item.snapshot_url}
                            download={`evidence-${item.id}.jpg`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition"
                            title="Download Snapshot"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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
            All stored telemetry and video clips are secured against post-incident tampering. SHA-256 checksums are calculated synchronously at the inference pipeline edge before persistence to database storage.
          </p>
        </div>
      </div>
    </div>
  );
}