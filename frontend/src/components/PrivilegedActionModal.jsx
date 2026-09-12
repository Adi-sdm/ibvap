import React, { useState } from 'react';
import { ShieldAlert, Lock, AlertTriangle, Key, X, Check, FileText } from 'lucide-react';
import { verifyPrivilegedAction } from '../services/api';

export default function PrivilegedActionModal({
  isOpen,
  title = "Privileged Command Authorization",
  actionName = "Execute Privileged Action",
  description = "This action modifies mission-critical surveillance infrastructure and requires senior supervisor authentication.",
  entityType = "SYSTEM",
  entityId = null,
  onConfirm,
  onClose
}) {
  const [passcode, setPasscode] = useState('');
  const [justification, setJustification] = useState('');
  const [officerRole, setOfficerRole] = useState('Duty Commander');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!passcode.trim()) {
      setError("Supervisor authorization passcode is mandatory.");
      return;
    }
    if (justification.trim().length < 5) {
      setError("Operational justification must be at least 5 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const authRes = await verifyPrivilegedAction({
        passcode: passcode.trim(),
        officer_role: officerRole,
        justification: justification.trim(),
        action: actionName,
        entity_type: entityType,
        entity_id: entityId ? String(entityId) : null
      });

      if (!authRes.authorized) {
        setError(authRes.detail || "Authorization denied: Invalid supervisor passcode.");
        return;
      }

      // Execute privileged action
      await onConfirm({
        officerRole,
        justification: justification.trim(),
        auditId: authRes.audit_id
      });

      onClose();
    } catch (err) {
      setError(err.message || "Authorization failed during verification.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-amber-500/50 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl font-mono text-xs">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 tracking-tight">{title}</h3>
              <span className="text-[10px] text-amber-400 font-semibold tracking-wider uppercase">
                Senior Officer Authentication Required
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Warning Box */}
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5 font-sans">
          <div className="font-mono text-xs font-semibold text-rose-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Target: {actionName}</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {description}
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
          <div>
            <label className="block text-slate-400 text-[11px] mb-1">Authorizing Officer Role:</label>
            <select
              value={officerRole}
              onChange={e => setOfficerRole(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-slate-200 text-xs focus:outline-none focus:border-amber-500 font-mono"
            >
              <option value="Duty Commander">Duty Commander (Border Operations)</option>
              <option value="Senior Watch Officer">Senior Watch Officer</option>
              <option value="Technical Systems Admin">Technical Systems Administrator</option>
              <option value="Sector Intelligence Lead">Sector Intelligence Lead</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center text-[11px] mb-1">
              <label className="text-slate-400">Security Authorization Passcode:</label>
              <span className="text-slate-500 text-[10px] font-mono">Mandatory Passcode</span>
            </div>
            <div className="relative">
              <input
                type="password"
                placeholder="Enter security passcode..."
                value={passcode}
                onChange={e => setPasscode(e.target.value)}
                autoFocus
                className="w-full bg-slate-950 border border-slate-800 pl-8 pr-3 py-2 rounded text-white text-xs placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
              />
              <Key className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-[11px] mb-1">Mandatory Operational Justification:</label>
            <textarea
              rows={2}
              placeholder="e.g. Scheduled sensor recalibration or authorized perimeter protocol change..."
              value={justification}
              onChange={e => setJustification(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-white text-xs placeholder-slate-600 focus:outline-none focus:border-amber-500 font-sans"
            />
          </div>

          {error && (
            <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="text-[10px] text-slate-500 pt-1 font-mono flex items-center gap-1">
            <FileText className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Action is cryptographically logged with officer ID, justification & timestamp.</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded text-xs font-bold transition flex items-center gap-1.5 shadow"
            >
              <Lock className="w-3 h-3" />
              <span>{submitting ? 'Authenticating...' : 'Authorize & Execute'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
