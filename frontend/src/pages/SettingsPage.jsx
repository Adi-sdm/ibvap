import React, { useEffect, useState } from 'react';
import { 
  Settings, 
  Play, 
  Square, 
  Server, 
  Brain, 
  Shield, 
  FileText,
  Sliders,
  HardDrive,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  RotateCcw
} from 'lucide-react';
import { 
  startDemo, 
  stopDemo, 
  getAuditLog, 
  getSensitivity, 
  updateSensitivity 
} from '../services/api';

export default function SettingsPage({ systemMode, onRefresh }) {
  const [auditLog, setAuditLog] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [sensitivity, setSensitivity] = useState({
    detection_conf: 0.25,
    loitering_seconds: 8.0,
    running_threshold: 0.02,
    anomaly_sensitivity: 0.75
  });
  const [initialSensitivity, setInitialSensitivity] = useState(null);
  const [savingSens, setSavingSens] = useState(false);
  const [sensFeedback, setSensFeedback] = useState(null);

  useEffect(() => {
    loadAudit();
    loadSensitivity();
  }, []);

  const loadAudit = () => {
    setLoadingAudit(true);
    getAuditLog()
      .then(setAuditLog)
      .catch(() => {})
      .finally(() => setLoadingAudit(false));
  };

  const loadSensitivity = () => {
    getSensitivity()
      .then(res => {
        if (res) {
          setSensitivity(res);
          setInitialSensitivity(res);
        }
      })
      .catch(() => {});
  };

  const handleSaveSensitivity = async (e) => {
    e.preventDefault();
    setSavingSens(true);
    try {
      await updateSensitivity({
        detection_conf: parseFloat(sensitivity.detection_conf),
        loitering_seconds: parseFloat(sensitivity.loitering_seconds),
        running_threshold: parseFloat(sensitivity.running_threshold),
        anomaly_sensitivity: parseFloat(sensitivity.anomaly_sensitivity)
      });
      setSensFeedback({ type: 'success', text: 'Inference sensitivity parameters synced successfully' });
      setInitialSensitivity({ ...sensitivity });
      setTimeout(() => setSensFeedback(null), 3000);
    } catch {
      setSensFeedback({ type: 'error', text: 'Failed to update sensitivity configuration' });
    } finally {
      setSavingSens(false);
    }
  };

  const handleResetSensitivity = () => {
    const defaults = {
      detection_conf: 0.25,
      loitering_seconds: 8.0,
      running_threshold: 0.02,
      anomaly_sensitivity: 0.75
    };
    setSensitivity(defaults);
  };

  const handleDemoToggle = async () => {
    if (systemMode === 'demo') {
      if (window.confirm("Switch to Live Surveillance Mode? Synthetically generated demo feeds and incidents will be stopped.")) {
        await stopDemo();
        if (onRefresh) onRefresh();
      }
    } else {
      if (window.confirm("Engage Border Surveillance Simulation Mode? Pre-recorded scenarios will be played for operational demonstration.")) {
        await startDemo();
        if (onRefresh) onRefresh();
      }
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Settings className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-100 tracking-tight">Platform Configuration & Compliance Audits</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              SECURE ADMIN Post
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Configure neural inference heuristics, operational modes, cryptographic storage retention rules, and verify tamper-proof audit trails.
          </p>
        </div>

        {/* Mode Indicator */}
        <div className="flex items-center space-x-3 bg-slate-950 px-3.5 py-2 rounded-lg border border-slate-800 shrink-0">
          <div>
            <div className="text-[10px] font-mono text-slate-500 uppercase">Operational Status</div>
            <div className="text-xs font-mono font-bold text-emerald-400 uppercase">
              {systemMode === 'demo' ? 'DEMO SIMULATION' : 'LIVE SURVEILLANCE'}
            </div>
          </div>
          <div className="h-6 w-px bg-slate-800"></div>
          <div>
            <div className="text-[10px] font-mono text-slate-500 uppercase">Compliance</div>
            <div className="text-xs font-mono font-bold text-slate-200">ISO 27037</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: AI Heuristic & Sensitivity Tuning */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-slate-100">AI Inference Sensitivity Tuning</h3>
            </div>
            <span className="text-[10px] font-mono text-slate-500">DYNAMIC RE-INDEXING</span>
          </div>

          <form onSubmit={handleSaveSensitivity} className="space-y-4">
            {/* Detection Confidence Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label className="text-slate-300 font-medium">YOLO Detection Confidence Threshold</label>
                <span className="font-mono text-emerald-400 font-bold">{((sensitivity.detection_conf || 0.25) * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.90"
                step="0.05"
                value={sensitivity.detection_conf || 0.25}
                onChange={e => setSensitivity({ ...sensitivity, detection_conf: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500 bg-slate-950 cursor-pointer h-1.5 rounded-lg"
              />
              <p className="text-[10px] text-slate-500">Lower values capture distant silhouettes; higher values suppress noise.</p>
            </div>

            {/* Loitering Duration */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label className="text-slate-300 font-medium">Restricted Zone Loitering Threshold</label>
                <span className="font-mono text-amber-400 font-bold">{sensitivity.loitering_seconds || 8} seconds</span>
              </div>
              <input
                type="range"
                min="3"
                max="60"
                step="1"
                value={sensitivity.loitering_seconds || 8}
                onChange={e => setSensitivity({ ...sensitivity, loitering_seconds: parseFloat(e.target.value) })}
                className="w-full accent-amber-500 bg-slate-950 cursor-pointer h-1.5 rounded-lg"
              />
              <p className="text-[10px] text-slate-500">Duration in seconds a target can loiter before triggering perimeter escalation.</p>
            </div>

            {/* Running Threshold */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label className="text-slate-300 font-medium">Velocity Displacement Threshold (Running)</label>
                <span className="font-mono text-rose-400 font-bold">{((sensitivity.running_threshold || 0.02) * 1000).toFixed(1)} normalized</span>
              </div>
              <input
                type="range"
                min="0.005"
                max="0.08"
                step="0.005"
                value={sensitivity.running_threshold || 0.02}
                onChange={e => setSensitivity({ ...sensitivity, running_threshold: parseFloat(e.target.value) })}
                className="w-full accent-rose-500 bg-slate-950 cursor-pointer h-1.5 rounded-lg"
              />
              <p className="text-[10px] text-slate-500">Relative frame displacement speed flagged as evasive / rapid movement.</p>
            </div>

            {/* Anomaly Sensitivity */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label className="text-slate-300 font-medium">Heuristic Anomaly Sensitivity</label>
                <span className="font-mono text-purple-400 font-bold">{((sensitivity.anomaly_sensitivity || 0.75) * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.20"
                max="1.0"
                step="0.05"
                value={sensitivity.anomaly_sensitivity || 0.75}
                onChange={e => setSensitivity({ ...sensitivity, anomaly_sensitivity: parseFloat(e.target.value) })}
                className="w-full accent-purple-500 bg-slate-950 cursor-pointer h-1.5 rounded-lg"
              />
              <p className="text-[10px] text-slate-500">Behavioral deviation sensitivity for direction changes and luggage drops.</p>
            </div>

            {/* Feedback alert */}
            {sensFeedback && (
              <div className={`p-2.5 rounded text-xs font-mono flex items-center space-x-2 ${
                sensFeedback.type === 'success' 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              }`}>
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{sensFeedback.text}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleResetSensitivity}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium transition flex items-center space-x-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Defaults</span>
              </button>

              <button
                type="submit"
                disabled={savingSens}
                className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
              >
                {savingSens ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Apply Sensitivity Config</span>
              </button>
            </div>
          </form>
        </div>

        {/* Section 2: Storage & Operational Controls */}
        <div className="space-y-6">
          {/* Operational Simulation Control */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-slate-100">Surveillance Operation Mode</h3>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                systemMode === 'demo' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/10 text-emerald-400'
              }`}>
                {systemMode}
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Switch between continuous live border CCTV monitoring and pre-packaged simulation scenarios (Border Intrusion, Thermal Loitering, and Vehicle Checkpoint).
            </p>

            <div className="pt-1">
              <button 
                onClick={handleDemoToggle}
                className={`w-full py-2.5 rounded text-xs font-bold font-mono transition flex items-center justify-center space-x-2 shadow-sm ${
                  systemMode === 'demo' 
                    ? 'bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 border border-rose-500/40' 
                    : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40'
                }`}
              >
                {systemMode === 'demo' ? (
                  <>
                    <Square className="w-4 h-4 fill-current" />
                    <span>STOP SIMULATION // ENGAGE LIVE INGESTION</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>LAUNCH SIH DEMO SCENARIOS SIMULATION</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Forensic Retention & Cryptographic Policy */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-slate-100">Digital Forensics & Evidence Policy</h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-400">ENCRYPTION ACTIVE</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Integrity Signature:</span>
                <span className="font-mono text-emerald-400 font-semibold">SHA-256 (Synchronous Edge Signing)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Automated Evidence Retention:</span>
                <span className="font-mono text-slate-200">90 Days (Military Archival Standard)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Video Evidence Ring Buffer:</span>
                <span className="font-mono text-cyan-400">Pre-event 5s + Post-event 10s Clip</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Legal Admissibility Protocol:</span>
                <span className="font-mono text-slate-200">ISO/IEC 27037 Forensics Compliant</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: System Audit Trail Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-mono font-semibold text-slate-200 uppercase tracking-wider">
              Operator Actions & System Audit Trail ({auditLog.length})
            </span>
          </div>
          <button 
            onClick={loadAudit} 
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            title="Refresh Audit Log"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto max-h-72">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950/80 border-b border-slate-800 sticky top-0 font-mono text-[11px] text-slate-400 uppercase">
              <tr>
                <th className="py-2.5 px-4">Timestamp (UTC)</th>
                <th className="py-2.5 px-4">Operational Action</th>
                <th className="py-2.5 px-4">Target Entity</th>
                <th className="py-2.5 px-4">Operator Callsign</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {auditLog.map((log, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition">
                  <td className="py-2 px-4 font-mono text-slate-400 text-[11px]">
                    {new Date(log.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                  </td>
                  <td className="py-2 px-4 font-semibold text-slate-200">{log.action}</td>
                  <td className="py-2 px-4 font-mono text-slate-400 text-[11px]">{log.target}</td>
                  <td className="py-2 px-4">
                    <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-emerald-400">
                      {log.user || 'OP-01'}
                    </span>
                  </td>
                </tr>
              ))}
              {auditLog.length === 0 && !loadingAudit && (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-slate-500 font-mono text-xs">
                    No operator modification events logged in current session.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
