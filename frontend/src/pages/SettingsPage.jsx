import React, { useEffect, useState } from 'react';
import { Settings, Play, Square, Server, Brain, Shield, FileText } from 'lucide-react';
import { startDemo, stopDemo, getAuditLog } from '../services/api';

export default function SettingsPage({ systemMode, onRefresh }) {
  const [auditLog, setAuditLog] = useState([]);

  useEffect(() => {
    getAuditLog().then(setAuditLog).catch(() => {});
  }, []);

  const handleDemoToggle = async () => {
    if (systemMode === 'demo') {
      if (window.confirm("Stop demo mode and clear demo data?")) {
        await stopDemo();
        onRefresh();
      }
    } else {
      if (window.confirm("Start demo mode? This will simulate cameras and incidents.")) {
        await startDemo();
        onRefresh();
      }
    }
  };

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
          <Settings className="w-6 h-6 text-slate-400" />
          System Settings
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* System Info */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <Server className="w-5 h-5 text-blue-400" />
            System Information
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Version</span>
              <span className="text-white font-mono">1.0.0-rc1</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Project ID</span>
              <span className="text-white font-mono">SIH26187</span>
            </div>
            <div className="flex justify-between pb-2">
              <span className="text-slate-400">Database</span>
              <span className="text-emerald-400 font-mono">SQLite (Connected)</span>
            </div>
          </div>
        </div>

        {/* Demo Mode */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-amber-400" />
            Simulation & Testing
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            Demo mode generates synthetic video streams and security incidents for testing the dashboard and operator workflows.
          </p>
          <button 
            onClick={handleDemoToggle}
            className={`w-full py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition ${
              systemMode === 'demo' 
                ? 'bg-red-900/50 text-red-400 hover:bg-red-900/80 border border-red-800' 
                : 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/40 border border-amber-600/50'
            }`}
          >
            {systemMode === 'demo' ? <><Square className="w-4 h-4" /> Stop Demo Mode</> : <><Play className="w-4 h-4" /> Start Demo Mode</>}
          </button>
        </div>

        {/* AI Models */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:col-span-2">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-purple-400" />
            AI Models Inventory
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-950 p-4 rounded border border-slate-800">
              <div className="font-bold text-white mb-1">General Detector</div>
              <div className="text-xs text-slate-400 mb-2">YOLOv8 Nano</div>
              <div className="text-xs font-semibold text-emerald-400">AVAILABLE</div>
            </div>
            <div className="bg-slate-950 p-4 rounded border border-slate-800">
              <div className="font-bold text-white mb-1">Small-Arms Detector</div>
              <div className="text-xs text-slate-400 mb-2">Custom YOLOv8</div>
              <div className="text-xs font-semibold text-red-400">NOT AVAILABLE</div>
            </div>
            <div className="bg-slate-950 p-4 rounded border border-slate-800">
              <div className="font-bold text-white mb-1">ANPR Engine</div>
              <div className="text-xs text-slate-400 mb-2">EasyOCR</div>
              <div className="text-xs font-semibold text-emerald-400">AVAILABLE</div>
            </div>
          </div>
        </div>

        {/* Audit Log */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:col-span-2">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-slate-400" />
            System Audit Log
          </h2>
          <div className="overflow-y-auto max-h-64 border border-slate-800 rounded bg-slate-950">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 border-b border-slate-800 sticky top-0">
                <tr>
                  <th className="p-2 text-slate-400">Timestamp</th>
                  <th className="p-2 text-slate-400">Action</th>
                  <th className="p-2 text-slate-400">Target</th>
                  <th className="p-2 text-slate-400">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {auditLog.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/50">
                    <td className="p-2 font-mono text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="p-2 text-white">{log.action}</td>
                    <td className="p-2 text-slate-400">{log.target}</td>
                    <td className="p-2 text-slate-500">{log.user || 'system'}</td>
                  </tr>
                ))}
                {auditLog.length === 0 && (
                  <tr><td colSpan="4" className="p-4 text-center text-slate-500">No audit logs found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* About */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:col-span-2">
          <h2 className="text-lg font-bold text-white mb-2">About IBVAP</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Intelligent Border Video Analytics Platform (IBVAP) is designed for perimeter security and surveillance. 
            It fuses multiple AI models including object detection, tracking, and ANPR to provide explainable alerts and cryptographic evidence.
          </p>
        </div>
      </div>
    </div>
  );
}
