import React, { useState, useEffect } from 'react';
import { 
  Car, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Search, 
  Eye, 
  ArrowRight, 
  Compass, 
  Filter, 
  Clock, 
  Layers,
  X,
  FileCheck,
  Zap
} from 'lucide-react';
import { 
  getAuthorizedVehicles, 
  createAuthorizedVehicle, 
  deleteAuthorizedVehicle, 
  getANPR,
  verifyVehicleIntel,
  getVehicleHandoff,
  getVehicleCorridors,
  getCameras
} from '../services/api';

export default function VehicleIntel() {
  const [vehicles, setVehicles] = useState([]);
  const [anprLogs, setAnprLogs] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [corridors, setCorridors] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('Registry');
  const [searchFilter, setSearchFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form State
  const [formPlate, setFormPlate] = useState('');
  const [formOwner, setFormOwner] = useState('');
  const [formDept, setFormDept] = useState('Border Security Force');
  const [formType, setFormType] = useState('SUV');
  const [formColor, setFormColor] = useState('WHITE');
  const [formSectors, setFormSectors] = useState('');
  const [formStatus, setFormStatus] = useState('ACTIVE');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const fetchData = async () => {
    try {
      const [vRes, aRes, cRes, corRes] = await Promise.all([
        getAuthorizedVehicles().catch(() => []),
        getANPR(0, 30).catch(() => ({ items: [] })),
        getCameras().catch(() => []),
        getVehicleCorridors().catch(() => [])
      ]);
      setVehicles(vRes || []);
      setAnprLogs(aRes?.items || []);
      setCameras(cRes || []);
      setCorridors(corRes || []);
    } catch (err) {
      console.error("Failed to load vehicle intelligence:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    if (!formPlate.trim() || !formOwner.trim()) return;
    setSubmitting(true);
    try {
      await createAuthorizedVehicle({
        plate: formPlate.trim().toUpperCase(),
        owner_name: formOwner.trim(),
        department: formDept,
        vehicle_type: formType,
        authorized_color: formColor,
        authorized_sectors: formSectors,
        status: formStatus,
        notes: formNotes
      });
      setShowAddModal(false);
      setFormPlate('');
      setFormOwner('');
      setFormNotes('');
      fetchData();
    } catch (err) {
      console.error("Failed to save vehicle:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (plate) => {
    if (!window.confirm(`Delete ${plate} from authorized registry?`)) return;
    try {
      await deleteAuthorizedVehicle(plate);
      fetchData();
    } catch (err) {
      console.error("Failed to delete vehicle:", err);
    }
  };

  const handleQuickVerify = async (plate) => {
    try {
      const res = await verifyVehicleIntel(plate, 'WHITE', 'All Sectors');
      setTestResult(res);
    } catch (err) {
      console.error("Verify test failed:", err);
    }
  };

  const filteredVehicles = vehicles.filter(v => 
    v.plate.toLowerCase().includes(searchFilter.toLowerCase()) ||
    v.owner_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    v.department.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const watchlistCount = vehicles.filter(v => v.status === 'WATCHLIST' || v.status === 'FLAGGED').length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Car className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-100 tracking-tight">
              Vehicle Intelligence & ANPR Registry
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold">
              BSF AUTOMATED ACCESS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automated license plate recognition (ANPR), dominant body-color cross-check, attribute mismatch alerts, and predictive camera handoff.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Register Vehicle</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Authorized Fleet</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{vehicles.length}</div>
          <span className="text-[10px] text-slate-500 font-mono">Cleared Access</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Watchlist Entities</span>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-1">{watchlistCount}</div>
          <span className="text-[10px] text-slate-500 font-mono">High-Priority Intercept</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">ANPR Detections</span>
          <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">{anprLogs.length}</div>
          <span className="text-[10px] text-slate-500 font-mono">Plate OCR Captures</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Cross-Camera Handoff</span>
          <div className={`text-2xl font-bold font-mono mt-1 ${cameras.length >= 2 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {cameras.length >= 2 ? 'ONLINE' : 'STANDBY'}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {cameras.length >= 2 ? `${corridors.length} Corridors Active` : 'Requires ≥2 Calibrated Nodes'}
          </span>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('Registry')}
          className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
            activeSubTab === 'Registry' 
              ? 'bg-slate-800 text-cyan-400 border border-slate-700' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Authorized Registry ({vehicles.length})
        </button>

        <button
          onClick={() => setActiveSubTab('ANPR')}
          className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
            activeSubTab === 'ANPR' 
              ? 'bg-slate-800 text-cyan-400 border border-slate-700' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Live Optical Plate Log ({anprLogs.length})
        </button>

        <button
          onClick={() => setActiveSubTab('Handoff')}
          className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
            activeSubTab === 'Handoff' 
              ? 'bg-slate-800 text-cyan-400 border border-slate-700' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Predictive Cross-Camera Corridor
        </button>
      </div>

      {/* SUB-TAB: REGISTRY TABLE */}
      {activeSubTab === 'Registry' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden space-y-3 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by license plate, owner, or unit..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 pl-9 pr-3 py-1.5 rounded text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Showing {filteredVehicles.length} of {vehicles.length} entries
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-[10px] font-mono text-slate-400 uppercase border-b border-slate-800">
                <tr>
                  <th className="p-3">License Plate</th>
                  <th className="p-3">Owner / Unit</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Reg. Color</th>
                  <th className="p-3">Authorized Sectors</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredVehicles.map((v) => (
                  <tr key={v.plate} className="hover:bg-slate-800/40 transition">
                    <td className="p-3 font-mono font-bold text-white flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-cyan-300">
                        {v.plate}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-200">{v.owner_name}</div>
                      <div className="text-[10px] text-slate-400">{v.department}</div>
                    </td>
                    <td className="p-3 font-mono text-slate-300">{v.vehicle_type}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono bg-slate-950 border border-slate-800">
                        <span 
                          className="w-2.5 h-2.5 rounded-full border border-slate-600" 
                          style={{ backgroundColor: v.authorized_color?.toLowerCase() || '#ffffff' }} 
                        />
                        {v.authorized_color}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400 text-[11px]">{v.authorized_sectors}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        v.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                        (v.status === 'WATCHLIST' || v.status === 'FLAGGED') ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                        'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => handleQuickVerify(v.plate)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-mono transition"
                      >
                        Verify
                      </button>
                      <button
                        onClick={() => handleDelete(v.plate)}
                        className="px-2 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded text-[11px] font-mono transition"
                      >
                        <Trash2 className="w-3 h-3 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Quick Verification Output Display */}
          {testResult && (
            <div className="mt-4 p-3 rounded bg-slate-950 border border-cyan-500/40 text-xs font-mono space-y-1">
              <div className="flex items-center justify-between text-cyan-300 font-bold">
                <span>Verification Result for [{testResult.plate}]:</span>
                <span className={`px-2 py-0.5 rounded border ${testResult.is_authorized ? 'bg-emerald-950 text-emerald-400 border-emerald-500' : 'bg-rose-950 text-rose-400 border-rose-500'}`}>
                  {testResult.status} (Score: {testResult.risk_score})
                </span>
              </div>
              <p className="text-slate-300">{testResult.reason}</p>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB: LIVE OPTICAL ANPR LOG */}
      {activeSubTab === 'ANPR' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
            <span className="font-mono font-bold text-white uppercase">Captured License Plate OCR Records</span>
            <span className="font-mono text-emerald-400">EasyOCR Engine Active</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {anprLogs.map((log) => (
              <div key={log.id} className="p-3 bg-slate-950 border border-slate-800 rounded space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-cyan-300 font-bold text-sm">
                    {log.plate}
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    {new Date(log.timestamp * 1000).toLocaleTimeString()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400">
                  <div>Cam: <span className="text-slate-200">{log.camera_id}</span></div>
                  <div>Type: <span className="text-slate-200">{log.vehicle_type}</span></div>
                  <div>Confidence: <span className="text-emerald-400">{Math.round(log.confidence * 100)}%</span></div>
                  <div>Status: <span className="text-amber-400">{log.verification_required ? 'Flagged' : 'Normal'}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB: PREDICTIVE HANDOFF */}
      {activeSubTab === 'Handoff' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4 text-xs font-mono">
          <div className="flex items-center space-x-2 text-white font-bold text-sm pb-2 border-b border-slate-800">
            <Compass className="w-4 h-4 text-cyan-400" />
            <span>Cross-Camera Handoff & Trajectory Prediction Matrix</span>
          </div>
          <p className="text-slate-400 leading-relaxed text-xs font-sans">
            IBVAP correlates multi-camera vehicle sightings along border roads. When a target is detected traveling along a perimeter route, downstream cameras are automatically primed with target features and expected arrival ETA based on real GPS spatial coordinates.
          </p>

          {corridors.length === 0 ? (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-8 text-center space-y-3 font-mono">
              <Compass className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider">No Active Cross-Camera Corridors</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed font-sans">
                Predictive corridor handoff and transit estimation require at least 2 spatially calibrated surveillance cameras with GPS coordinates. Currently {cameras.length} camera(s) registered in the platform.
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-slate-950 border border-slate-800 text-[11px] text-amber-400 font-mono">
                STATUS: STANDBY (AWAITING MULTI-NODE CALIBRATION)
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {corridors.map((c) => (
                <div key={c.corridor_id} className="p-4 bg-slate-950 rounded border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{c.name}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px]">
                      CORRELATION {Math.round(c.correlation_confidence * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 text-slate-300">
                    <div className="p-2 bg-slate-900 border border-slate-800 rounded text-center">
                      <div className="text-[10px] text-slate-500">ORIGIN</div>
                      <div className="font-bold text-cyan-400">{c.origin_name || c.origin_camera}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                    <div className="p-2 bg-slate-900 border border-slate-800 rounded text-center">
                      <div className="text-[10px] text-slate-500">PREDICTED DOWNSTREAM</div>
                      <div className="font-bold text-emerald-400">{c.destination_name || c.destination_camera}</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Geodesic Distance: <span className="text-white font-bold">{c.distance_meters}m</span> • Est. Transit: <span className="text-emerald-400 font-bold">~{c.estimated_transit_seconds}s</span> at 40 km/h
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Registration Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
                <Car className="w-4 h-4 text-cyan-400" />
                Register Vehicle in Access Registry
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddVehicle} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">License Plate</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DL01AB1234"
                    value={formPlate}
                    onChange={(e) => setFormPlate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded text-white font-mono uppercase focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Owner / Squad</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Patrol Squad Delta"
                    value={formOwner}
                    onChange={(e) => setFormOwner(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Vehicle Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded text-white focus:border-cyan-500 focus:outline-none font-mono"
                  >
                    <option value="SUV">Patrol SUV</option>
                    <option value="Jeep">Armored Jeep</option>
                    <option value="Truck">Heavy Supply Truck</option>
                    <option value="Ambulance">Medical Ambulance</option>
                    <option value="Motorcycle">Border Motorcycle</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Registered Body Color</label>
                  <select
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded text-white focus:border-cyan-500 focus:outline-none font-mono"
                  >
                    <option value="WHITE">White</option>
                    <option value="GREEN">Olive Green</option>
                    <option value="BLACK">Black</option>
                    <option value="SILVER/GRAY">Silver / Gray</option>
                    <option value="RED">Red</option>
                    <option value="BLUE">Navy Blue</option>
                    <option value="YELLOW">Yellow</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Authorized Sectors</label>
                <input
                  type="text"
                  placeholder="e.g. Sector North, Sector South (or leave blank for All Sectors)"
                  value={formSectors}
                  onChange={(e) => setFormSectors(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Access Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded text-white focus:border-cyan-500 focus:outline-none font-mono"
                >
                  <option value="ACTIVE">ACTIVE (Clear Passage)</option>
                  <option value="WATCHLIST">WATCHLIST (Immediate Intercept)</option>
                  <option value="FLAGGED">FLAGGED (Secondary Inspection)</option>
                  <option value="EXPIRED">EXPIRED (Denied Entry)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Notes / Security Dossier</label>
                <textarea
                  rows={2}
                  placeholder="Operational context or watchlist notes..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 px-3 py-1.5 rounded text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold font-mono transition shadow"
                >
                  {submitting ? 'Saving...' : 'Register Entity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
