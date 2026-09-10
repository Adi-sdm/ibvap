import React, { useState, useRef } from 'react';
import { Plus, Trash2, Check, RotateCcw, AlertTriangle } from 'lucide-react';
import { createZone } from '../services/api';

export default function ZoneDrawer({ cameraId, onZoneSaved, onCancel }) {
  const [points, setPoints] = useState([]);
  const [zoneName, setZoneName] = useState('New Perimeter Zone');
  const [zoneType, setZoneType] = useState('RESTRICTED');
  const [saving, setSaving] = useState(false);
  const containerRef = useRef(null);

  const [errorMsg, setErrorMsg] = useState(null);

  const handleSvgClick = (e) => {
    if (!containerRef.current) return;
    const img = containerRef.current.querySelector('img');
    if (!img) return;

    // Calculate actual displayed image area within the container due to object-fit: contain
    const rect = containerRef.current.getBoundingClientRect();
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const containerRatio = rect.width / rect.height;

    let displayWidth = rect.width;
    let displayHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (imgRatio > containerRatio) {
      // Image is wider than container, letterboxing on top and bottom
      displayHeight = rect.width / imgRatio;
      offsetY = (rect.height - displayHeight) / 2;
    } else {
      // Image is taller than container, pillarboxing on left and right
      displayWidth = rect.height * imgRatio;
      offsetX = (rect.width - displayWidth) / 2;
    }

    const clickX = e.clientX - rect.left - offsetX;
    const clickY = e.clientY - rect.top - offsetY;

    // Ignore clicks outside the actual image area
    if (clickX < 0 || clickX > displayWidth || clickY < 0 || clickY > displayHeight) {
      return;
    }

    const normX = Math.round((clickX / displayWidth) * 1000) / 1000;
    const normY = Math.round((clickY / displayHeight) * 1000) / 1000;
    
    setPoints([...points, [normX, normY]]);
    setErrorMsg(null);
  };

  const handleSave = async () => {
    if (points.length < 3) {
      setErrorMsg("Please define at least 3 vertices for the virtual polygon.");
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    const colorMap = {
      RESTRICTED: '#EF4444',
      WARNING: '#F59E0B',
      CHECKPOINT: '#38BDF8'
    };
    const zoneId = `ZONE-${cameraId}-${Date.now().toString().slice(-4)}`;
    try {
      await createZone({
        zone_id: zoneId,
        camera_id: cameraId,
        name: zoneName,
        polygon_coords: points,
        zone_type: zoneType,
        color: colorMap[zoneType]
      });
      if (onZoneSaved) onZoneSaved();
    } catch (err) {
      console.error("Save error:", err);
      setErrorMsg("Failed to save zone.");
    } finally {
      setSaving(false);
    }
  };

  const handleUndo = () => {
    setPoints(points.slice(0, -1));
  };

  const handleReset = () => {
    setPoints([]);
  };

  return (
    <div className="absolute inset-0 z-30 bg-black/40 flex flex-col justify-between pointer-events-auto">
      {/* Top Controls Header */}
      <div className="bg-slate-900/90 backdrop-blur-md p-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-cyan-400">DRAW VIRTUAL ZONE:</span>
          <input 
            type="text" 
            value={zoneName} 
            onChange={(e) => setZoneName(e.target.value)} 
            className="bg-slate-950 border border-slate-700 px-2 py-1 rounded text-white text-xs w-44"
            placeholder="Zone Name"
          />
          <select 
            value={zoneType} 
            onChange={(e) => setZoneType(e.target.value)}
            className="bg-slate-950 border border-slate-700 px-2 py-1 rounded text-white text-xs">
            <option value="RESTRICTED">🔴 RESTRICTED (Zero Line)</option>
            <option value="WARNING">🟡 WARNING (Buffer Zone)</option>
            <option value="CHECKPOINT">🔵 CHECKPOINT (Road Clearance)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleUndo} 
            disabled={points.length === 0}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-slate-300 flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5" /> Undo
          </button>
          <button 
            onClick={handleReset} 
            disabled={points.length === 0}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-slate-300 flex items-center gap-1">
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
          <button 
            onClick={onCancel} 
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300">
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            disabled={points.length < 3 || saving}
            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold rounded flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save Zone"}
          </button>
        </div>
      </div>

      {/* Interactive Click Canvas */}
      <div ref={containerRef} onClick={handleSvgClick} className="flex-1 relative cursor-crosshair">
        <svg className="w-full h-full absolute inset-0">
          {points.length >= 2 && (
            <polygon
              points={points.map(p => `${p[0] * 100}%,${p[1] * 100}%`).join(' ')}
              fill={zoneType === 'RESTRICTED' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}
              stroke={zoneType === 'RESTRICTED' ? '#EF4444' : '#F59E0B'}
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          )}
          {points.map((p, idx) => (
            <circle
              key={idx}
              cx={`${p[0] * 100}%`}
              cy={`${p[1] * 100}%`}
              r="5"
              fill="#38BDF8"
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
          ))}
        </svg>

        {points.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/70 px-4 py-2 rounded text-xs text-slate-300 border border-slate-700">
              Click anywhere on the stream to place polygon vertices. Define at least 3 points.
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-red-900/90 text-white px-3 py-1.5 rounded text-xs border border-red-500 shadow-lg flex items-center gap-2 z-10">
            <AlertTriangle className="w-4 h-4" />
            {errorMsg}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="bg-slate-900/90 p-2 text-[11px] text-slate-400 border-t border-slate-800 flex justify-between">
        <span>Vertices: {points.length} (Normalized [0.0 - 1.0])</span>
        <span>Coordinates: {points.map(p => `(${p[0]}, ${p[1]})`).join(' → ')}</span>
      </div>
    </div>
  );
}