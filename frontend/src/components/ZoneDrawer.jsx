import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Trash2, 
  Check, 
  RotateCcw, 
  AlertTriangle, 
  X, 
  ShieldAlert, 
  Info,
  Maximize2
} from 'lucide-react';
import { createZone, deleteZone } from '../services/api';
import PrivilegedActionModal from './PrivilegedActionModal';

export default function ZoneDrawer({ 
  cameraId, 
  streamUrl,
  existingZones = [], 
  onZoneSaved, 
  onCancel 
}) {
  const [points, setPoints] = useState([]);
  const [zoneName, setZoneName] = useState('Perimeter Zone 1');
  const [zoneType, setZoneType] = useState('RESTRICTED');
  const [mousePos, setMousePos] = useState(null);
  const [hoveredVertex, setHoveredVertex] = useState(null);
  const [draggingVertex, setDraggingVertex] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [deletingZoneId, setDeletingZoneId] = useState(null);
  const [privilegedModal, setPrivilegedModal] = useState(null);

  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [imgLayout, setImgLayout] = useState({ left: 0, top: 0, width: 0, height: 0, ready: false });

  const colorMap = {
    RESTRICTED: '#EF4444',
    WARNING: '#F59E0B',
    CHECKPOINT: '#38BDF8'
  };

  // Recompute exact rendered box of video stream inside container
  const updateLayout = useCallback(() => {
    if (!containerRef.current || !imgRef.current) return;
    const cRect = containerRef.current.getBoundingClientRect();
    const img = imgRef.current;
    
    // Natural image resolution (default to 16:9 if image still loading)
    const natW = img.naturalWidth || 1280;
    const natH = img.naturalHeight || 720;
    const imgRatio = natW / natH;
    const contRatio = cRect.width / (cRect.height || 1);

    let w = cRect.width;
    let h = cRect.height;
    let left = 0;
    let top = 0;

    if (contRatio > imgRatio) {
      // Container is wider than image -> pillarboxing (bars left & right)
      w = cRect.height * imgRatio;
      left = (cRect.width - w) / 2;
    } else {
      // Container is taller than image -> letterboxing (bars top & bottom)
      h = cRect.width / imgRatio;
      top = (cRect.height - h) / 2;
    }

    setImgLayout({
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(w),
      height: Math.round(h),
      ready: true
    });
  }, []);

  useEffect(() => {
    updateLayout();
    window.addEventListener('resize', updateLayout);
    const observer = new ResizeObserver(updateLayout);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      window.removeEventListener('resize', updateLayout);
      observer.disconnect();
    };
  }, [updateLayout]);

  // Convert mouse event coordinates to normalized [0.0 - 1.0] relative to rendered image
  const getNormCoords = (e) => {
    if (!containerRef.current || !imgLayout.ready || imgLayout.width === 0) return null;
    const cRect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - cRect.left - imgLayout.left;
    const clickY = e.clientY - cRect.top - imgLayout.top;

    // Check bounds with slight margin
    if (clickX < -15 || clickX > imgLayout.width + 15 || clickY < -15 || clickY > imgLayout.height + 15) {
      return null;
    }

    const normX = Math.max(0, Math.min(1, Math.round((clickX / imgLayout.width) * 1000) / 1000));
    const normY = Math.max(0, Math.min(1, Math.round((clickY / imgLayout.height) * 1000) / 1000));
    return [normX, normY];
  };

  const handleMouseMove = (e) => {
    const coords = getNormCoords(e);
    if (!coords) {
      setMousePos(null);
      return;
    }

    if (draggingVertex !== null) {
      setPoints(prev => {
        const next = [...prev];
        next[draggingVertex] = coords;
        return next;
      });
      return;
    }

    setMousePos(coords);

    // Check hover near first point (snap to close)
    if (points.length >= 3) {
      const p0 = points[0];
      const dx = (coords[0] - p0[0]) * imgLayout.width;
      const dy = (coords[1] - p0[1]) * imgLayout.height;
      if (Math.hypot(dx, dy) < 18) {
        setHoveredVertex(0);
        return;
      }
    }
    setHoveredVertex(null);
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Left click only
    const coords = getNormCoords(e);
    if (!coords) return;

    // If dragging existing vertex
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const dx = (coords[0] - p[0]) * imgLayout.width;
      const dy = (coords[1] - p[1]) * imgLayout.height;
      if (Math.hypot(dx, dy) < 14) {
        setDraggingVertex(i);
        return;
      }
    }

    // If snapping to first vertex to close
    if (points.length >= 3 && hoveredVertex === 0) {
      handleSave();
      return;
    }

    // Add new vertex
    setPoints(prev => [...prev, coords]);
    setErrorMsg(null);
  };

  const handleMouseUp = () => {
    if (draggingVertex !== null) {
      setDraggingVertex(null);
    }
  };

  const handleSave = async () => {
    if (points.length < 3) {
      setErrorMsg("A virtual polygon requires at least 3 vertices.");
      return;
    }
    setSaving(true);
    setErrorMsg(null);

    const zoneId = `ZONE-${cameraId}-${Date.now().toString().slice(-4)}`;
    try {
      await createZone({
        zone_id: zoneId,
        camera_id: cameraId,
        name: zoneName.trim() || 'Perimeter Geofence',
        polygon_coords: points,
        zone_type: zoneType,
        color: colorMap[zoneType]
      });
      if (onZoneSaved) onZoneSaved();
    } catch (err) {
      console.error("Save zone error:", err);
      setErrorMsg("Failed to save virtual zone to database.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExisting = (zoneId, name) => {
    setPrivilegedModal({
      actionName: `Delete Virtual Geofence '${name || zoneId}'`,
      description: `Permanently removes this security geofence from camera ${cameraId}. Tripwire boundary detection and perimeter alerts for this polygon will be dismantled.`,
      entityType: 'ZONE',
      entityId: zoneId,
      onConfirm: async () => {
        setDeletingZoneId(zoneId);
        try {
          await deleteZone(zoneId);
          if (onZoneSaved) onZoneSaved();
        } catch (err) {
          console.error("Failed to delete zone:", err);
        } finally {
          setDeletingZoneId(null);
        }
      }
    });
  };

  const handleUndo = () => {
    setPoints(prev => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleReset = () => {
    setPoints([]);
    setErrorMsg(null);
  };

  const resolvedStreamUrl = streamUrl || `/api/cameras/${cameraId}/stream?annotated=0`;

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-lg overflow-hidden shadow-2xl">
      {/* Top Toolbar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono font-bold text-slate-200 uppercase">
            Interactive Geofence Editor
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            {cameraId}
          </span>
        </div>

        {/* Configuration Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <input 
            type="text" 
            value={zoneName} 
            onChange={(e) => setZoneName(e.target.value)} 
            className="bg-slate-950 border border-slate-700 px-2.5 py-1 rounded text-white text-xs font-mono focus:border-cyan-500 focus:outline-none w-48"
            placeholder="Zone Name"
          />

          <select 
            value={zoneType} 
            onChange={(e) => setZoneType(e.target.value)}
            className="bg-slate-950 border border-slate-700 px-2.5 py-1 rounded text-white text-xs font-mono focus:border-cyan-500 focus:outline-none">
            <option value="RESTRICTED">🔴 RESTRICTED (Zero-Line Fence)</option>
            <option value="WARNING">🟡 WARNING (Approach Buffer)</option>
            <option value="CHECKPOINT">🔵 CHECKPOINT (Road Clearance)</option>
          </select>

          {/* Preset Buttons */}
          <button 
            type="button"
            onClick={() => { setZoneName("Zero-Line Fence"); setZoneType("RESTRICTED"); }}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] rounded transition">
            Fence
          </button>
          <button 
            type="button"
            onClick={() => { setZoneName("Buffer Zone Alpha"); setZoneType("WARNING"); }}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] rounded transition">
            Buffer
          </button>
          <button 
            type="button"
            onClick={() => { setZoneName("Road Checkpoint"); setZoneType("CHECKPOINT"); }}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] rounded transition">
            Road
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={handleUndo} 
            disabled={points.length === 0}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-slate-300 text-xs font-mono flex items-center gap-1 transition">
            <RotateCcw className="w-3.5 h-3.5" /> Undo
          </button>
          <button 
            type="button"
            onClick={handleReset} 
            disabled={points.length === 0}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded text-slate-300 text-xs font-mono flex items-center gap-1 transition">
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
          <button 
            type="button"
            onClick={onCancel} 
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 text-xs font-mono transition">
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleSave} 
            disabled={points.length < 3 || saving}
            className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-mono font-bold text-xs rounded flex items-center gap-1.5 transition shadow-lg">
            <Check className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save Polygon"}
          </button>
        </div>
      </div>

      {/* Main Drawing Workspace */}
      <div 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        className="relative flex-1 bg-black overflow-hidden select-none cursor-crosshair min-h-[420px]"
      >
        {/* Clean Live Video Stream without burnt-in overlays */}
        <img 
          ref={imgRef}
          src={resolvedStreamUrl} 
          alt="Live Stream Feed"
          onLoad={updateLayout}
          className="w-full h-full object-contain pointer-events-none"
        />

        {/* Subpixel-Aligned Drawing Overlay */}
        {imgLayout.ready && (
          <div 
            style={{
              position: 'absolute',
              left: `${imgLayout.left}px`,
              top: `${imgLayout.top}px`,
              width: `${imgLayout.width}px`,
              height: `${imgLayout.height}px`,
              pointerEvents: 'none'
            }}
          >
            <svg 
              className="w-full h-full"
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
            >
              {/* Existing Geofences Outline */}
              {existingZones.map((ez) => {
                const poly = ez.polygon_coords || ez.coordinates || [];
                if (!poly || poly.length < 3) return null;
                const ptsStr = poly.map(p => `${p[0] * 1000},${p[1] * 1000}`).join(' ');
                const ezColor = ez.color || colorMap[ez.zone_type] || '#64748B';
                return (
                  <g key={ez.zone_id || ez.id} opacity="0.35">
                    <polygon 
                      points={ptsStr} 
                      fill={ezColor} 
                      fillOpacity="0.15" 
                      stroke={ezColor} 
                      strokeWidth="2" 
                      strokeDasharray="4 4" 
                    />
                    <text 
                      x={poly[0][0] * 1000 + 8} 
                      y={poly[0][1] * 1000 + 16} 
                      fill={ezColor} 
                      fontSize="14" 
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {ez.name} ({ez.zone_type})
                    </text>
                  </g>
                );
              })}

              {/* In-Progress Polygon Area Fill */}
              {points.length >= 2 && (
                <polygon
                  points={points.map(p => `${p[0] * 1000},${p[1] * 1000}`).join(' ')}
                  fill={zoneType === 'RESTRICTED' ? 'rgba(239, 68, 68, 0.25)' : (zoneType === 'WARNING' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(56, 189, 248, 0.25)')}
                  stroke={colorMap[zoneType]}
                  strokeWidth="3"
                  strokeDasharray="6 3"
                />
              )}

              {/* Rubber-band preview line from last placed vertex to current mouse cursor */}
              {points.length > 0 && mousePos && draggingVertex === null && (
                <line
                  x1={points[points.length - 1][0] * 1000}
                  y1={points[points.length - 1][1] * 1000}
                  x2={hoveredVertex === 0 ? points[0][0] * 1000 : mousePos[0] * 1000}
                  y2={hoveredVertex === 0 ? points[0][1] * 1000 : mousePos[1] * 1000}
                  stroke={hoveredVertex === 0 ? '#10B981' : colorMap[zoneType]}
                  strokeWidth="2.5"
                  strokeDasharray="4 4"
                />
              )}

              {/* Closing line preview to start vertex when 3+ points */}
              {points.length >= 3 && (
                <line
                  x1={points[points.length - 1][0] * 1000}
                  y1={points[points.length - 1][1] * 1000}
                  x2={points[0][0] * 1000}
                  y2={points[0][1] * 1000}
                  stroke={colorMap[zoneType]}
                  strokeWidth="1.5"
                  strokeOpacity="0.5"
                  strokeDasharray="3 3"
                />
              )}

              {/* Vertices Markers with numbering */}
              {points.map((p, idx) => {
                const isStart = idx === 0;
                const isHovered = hoveredVertex === idx;
                return (
                  <g key={idx}>
                    <circle
                      cx={p[0] * 1000}
                      cy={p[1] * 1000}
                      r={isStart ? (isHovered ? 12 : 8) : 6}
                      fill={isStart && isHovered ? '#10B981' : colorMap[zoneType]}
                      stroke="#FFFFFF"
                      strokeWidth="2"
                    />
                    <text
                      x={p[0] * 1000 + 8}
                      y={p[1] * 1000 - 8}
                      fill="#FFFFFF"
                      fontSize="14"
                      fontWeight="bold"
                      fontFamily="monospace"
                      filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.8))"
                    >
                      P{idx + 1}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        {/* First-time / empty prompt */}
        {points.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-slate-900/90 backdrop-blur border border-cyan-500/40 p-4 rounded-lg text-center max-w-md shadow-2xl">
              <div className="text-cyan-400 font-mono font-bold text-sm mb-1">
                POINT & CLICK TO DRAW VIRTUAL PERIMETER
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                Click anywhere on the stream to place polygon vertices.
                Define at least 3 points. Click the first point or press &quot;Save Polygon&quot; to finalize.
              </p>
            </div>
          </div>
        )}

        {/* Snap to close indicator */}
        {hoveredVertex === 0 && points.length >= 3 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-emerald-950/90 border border-emerald-500 text-emerald-300 px-4 py-1.5 rounded-full text-xs font-mono font-bold shadow-lg pointer-events-none flex items-center gap-2">
            <Check className="w-4 h-4" /> Click to snap and complete polygon
          </div>
        )}

        {/* Error notification */}
        {errorMsg && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-rose-950/95 border border-rose-500 text-rose-200 px-4 py-2 rounded text-xs font-mono shadow-xl flex items-center gap-2 z-20">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="ml-2 text-rose-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Footer Info & Existing Zones List */}
      <div className="bg-slate-900 border-t border-slate-800 p-3 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-4">
          <span className="text-slate-200 font-semibold">
            Vertices: <span className="text-cyan-400">{points.length}</span>
          </span>
          {points.length > 0 && (
            <span className="text-slate-400 truncate max-w-md">
              Points: {points.map((p, i) => `P${i+1}(${p[0]}, ${p[1]})`).join(' → ')}
            </span>
          )}
        </div>

        {/* Existing Geofences Badges */}
        {existingZones.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-500 text-[11px]">Saved Geofences:</span>
            {existingZones.map(ez => (
              <span 
                key={ez.zone_id || ez.id} 
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[11px]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ez.color || colorMap[ez.zone_type] }} />
                <span>{ez.name}</span>
                <button 
                  type="button"
                  title="Delete Zone"
                  disabled={deletingZoneId === ez.zone_id}
                  onClick={() => handleDeleteExisting(ez.zone_id, ez.name)}
                  className="hover:text-rose-400 transition ml-1">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {privilegedModal && (
        <PrivilegedActionModal
          isOpen={true}
          actionName={privilegedModal.actionName}
          description={privilegedModal.description}
          entityType={privilegedModal.entityType}
          entityId={privilegedModal.entityId}
          onConfirm={privilegedModal.onConfirm}
          onClose={() => setPrivilegedModal(null)}
        />
      )}
    </div>
  );
}