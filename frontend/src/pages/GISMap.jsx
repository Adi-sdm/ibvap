import React, { useState, useMemo } from 'react';
import { 
  Map, 
  Compass, 
  Camera, 
  ShieldAlert, 
  Crosshair, 
  Eye, 
  Layers, 
  Radio, 
  AlertTriangle, 
  CheckCircle2, 
  Maximize2,
  ZoomIn,
  ZoomOut,
  Navigation,
  ExternalLink,
  Info
} from 'lucide-react';
import { getCameraStreamUrl } from '../services/api';

export default function GISMap({ cameras = [], incidents = [], onNavigateToCameras }) {
  const [selectedCam, setSelectedCam] = useState(null);
  const [targetPoint, setTargetPoint] = useState(null);
  const [showFOV, setShowFOV] = useState(true);
  const [showBuffer, setShowBuffer] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Compute coordinates for cameras
  const cameraNodes = useMemo(() => {
    return cameras.map((cam, idx) => {
      const hasCoords = cam.latitude != null && cam.longitude != null;
      let mapX, mapY;
      if (hasCoords) {
        mapX = Math.max(50, Math.min(950, (cam.longitude % 1) * 1000 || 200 + idx * 250));
        mapY = Math.max(50, Math.min(450, (cam.latitude % 1) * 500 || 250));
      } else {
        const total = Math.max(cameras.length, 1);
        const step = 700 / (total + 1);
        mapX = 150 + (idx + 1) * step;
        mapY = 260 + (idx % 2 === 0 ? -30 : 25);
      }
      return {
        ...cam,
        hasCoords,
        mapX,
        mapY,
        fovAngle: cam.direction != null ? cam.direction : (idx % 2 === 0 ? 30 : -25)
      };
    });
  }, [cameras]);

  // Find nearest camera when operator clicks on map
  const nearestCameraInfo = useMemo(() => {
    if (!targetPoint || cameraNodes.length === 0) return null;
    let minD = Infinity;
    let nearest = null;

    cameraNodes.forEach(c => {
      const d = Math.hypot(c.mapX - targetPoint.x, c.mapY - targetPoint.y);
      if (d < minD) {
        minD = d;
        nearest = c;
      }
    });

    const meters = Math.round(minD * 1.5); // Scaled tactical metric: 1 px ≈ 1.5 meters

    return {
      camera: nearest,
      distanceMeters: meters,
      targetX: targetPoint.x,
      targetY: targetPoint.y
    };
  }, [targetPoint, cameraNodes]);

  const handleMapClick = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 500);
    setTargetPoint({ x, y });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Map className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-100 tracking-tight">
              Tactical GIS & Border Surveillance Grid
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold">
              BORDER DEFENSE GRID
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Geospatial surveillance coverage, camera field-of-view (FOV) projection cones, active threat triangulation, and rapid nearest-node locator.
          </p>
        </div>

        {/* Layer Toggles */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          <button
            onClick={() => setShowFOV(prev => !prev)}
            className={`px-3 py-1.5 rounded text-xs font-mono font-medium border transition ${
              showFOV 
                ? 'bg-slate-800 text-cyan-400 border-cyan-500/40' 
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            FOV Cones {showFOV ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => setShowBuffer(prev => !prev)}
            className={`px-3 py-1.5 rounded text-xs font-mono font-medium border transition ${
              showBuffer 
                ? 'bg-slate-800 text-amber-400 border-amber-500/40' 
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            Buffer Corridors {showBuffer ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => setShowIncidents(prev => !prev)}
            className={`px-3 py-1.5 rounded text-xs font-mono font-medium border transition ${
              showIncidents 
                ? 'bg-slate-800 text-rose-400 border-rose-500/40' 
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            Threat Pins {showIncidents ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Main Tactical Map Viewport */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden shadow-2xl relative">
        {/* Top Floating Telemetry & Nearest Node Info */}
        <div className="absolute top-4 left-4 z-10 space-y-2 max-w-sm pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 p-3 rounded-lg shadow-lg text-xs font-mono text-slate-300 pointer-events-auto">
            <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
              <span>Tactical Grid Scaled: 1:1800m</span>
            </div>
            <div className="mt-1 text-slate-200">
              Click anywhere on the map to triangulate the nearest camera coverage.
            </div>
          </div>

          {nearestCameraInfo && (
            <div className="bg-slate-900/95 backdrop-blur-md border border-cyan-500/50 p-3.5 rounded-lg shadow-2xl text-xs font-mono space-y-1.5 pointer-events-auto animate-fade-in">
              <div className="flex items-center justify-between text-cyan-400 font-bold">
                <span>NEAREST SURVEILLANCE NODE:</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  {nearestCameraInfo.camera?.camera_id?.slice(0, 8)}
                </span>
              </div>
              <div className="text-white font-semibold">{nearestCameraInfo.camera?.name}</div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                <div>Distance: <span className="text-emerald-400 font-bold">{nearestCameraInfo.distanceMeters}m</span></div>
                <div>Transit ETA: <span className="text-slate-500 italic">Travel ETA unavailable</span></div>
              </div>
              <div className="text-[10px] text-slate-500 italic pt-0.5">
                (Terrain and transport speed model not configured)
              </div>
              {onNavigateToCameras && (
                <button
                  onClick={() => onNavigateToCameras(nearestCameraInfo.camera?.camera_id)}
                  className="w-full mt-2 py-1 bg-cyan-600/80 hover:bg-cyan-600 text-white rounded text-[11px] font-bold flex items-center justify-center gap-1 transition"
                >
                  <Eye className="w-3 h-3" />
                  <span>Switch to Camera Console</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Interactive SVG Tactical Grid */}
        <div className="relative w-full aspect-[2/1] bg-[#070b14] cursor-crosshair select-none">
          <svg
            viewBox="0 0 1000 500"
            className="w-full h-full"
            onClick={handleMapClick}
          >
            <defs>
              {/* Tactical Grid Pattern */}
              <pattern id="tacticalGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.4" />
              </pattern>

              {/* FOV Radial Gradient */}
              <radialGradient id="fovGradient" cx="0%" cy="50%" r="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
              </radialGradient>
            </defs>

            {/* Background Grid */}
            <rect width="1000" height="500" fill="url(#tacticalGrid)" />

            {/* Topography: Monitored Perimeter Boundary */}
            <path
              d="M 0 180 Q 250 160 500 180 T 1000 170"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2.5"
              strokeDasharray="8 4"
            />
            <text x="50" y="170" fill="#ef4444" fontSize="11" fontFamily="monospace" fontWeight="bold">
              MONITORED PERIMETER BOUNDARY
            </text>

            {/* Buffer Corridor Shading */}
            {showBuffer && (
              <path
                d="M 0 180 Q 250 160 500 180 T 1000 170 L 1000 240 Q 750 250 500 240 T 0 240 Z"
                fill="#f59e0b"
                fillOpacity="0.07"
                stroke="#f59e0b"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            )}
            <text x="50" y="230" fill="#f59e0b" fontSize="10" fontFamily="monospace" fillOpacity="0.8">
              50-METER ADVISORY BUFFER CORRIDOR
            </text>

            {/* Operational Access Corridor */}
            <path
              d="M 0 340 Q 300 330 600 350 T 1000 340"
              fill="none"
              stroke="#475569"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <text x="50" y="360" fill="#64748b" fontSize="10" fontFamily="monospace">
              OPERATIONAL ACCESS CORRIDOR
            </text>

            {/* Camera Nodes with FOV Cones */}
            {cameraNodes.map((cam) => {
              const isSelected = selectedCam?.camera_id === cam.camera_id;
              return (
                <g key={cam.camera_id} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedCam(cam); }}>
                  {/* FOV Projection Cone */}
                  {showFOV && (
                    <polygon
                      points={`${cam.mapX},${cam.mapY} ${cam.mapX - 90},${cam.mapY - 140} ${cam.mapX + 90},${cam.mapY - 140}`}
                      fill="url(#fovGradient)"
                      stroke="#38bdf8"
                      strokeWidth="1"
                      strokeOpacity="0.4"
                    />
                  )}

                  {/* Camera Circle Marker */}
                  <circle
                    cx={cam.mapX}
                    cy={cam.mapY}
                    r={isSelected ? 10 : 7}
                    fill={cam.status === 'ONLINE' ? '#10b981' : '#64748b'}
                    stroke="#ffffff"
                    strokeWidth="2"
                    filter="drop-shadow(0 0 6px rgba(16,185,129,0.7))"
                  />

                  {/* Label */}
                  <text
                    x={cam.mapX}
                    y={cam.mapY + 18}
                    fill="#e2e8f0"
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {cam.name}
                  </text>
                </g>
              );
            })}

            {/* Active Incident Threat Pins */}
            {showIncidents && incidents.slice(0, 4).map((inc, i) => {
              const pinX = 220 + (i * 190);
              const pinY = 210 + (i % 2 === 0 ? -15 : 15);
              return (
                <g key={inc.event_id || i} transform={`translate(${pinX}, ${pinY})`}>
                  <circle r="14" fill="#ef4444" fillOpacity="0.2" className="animate-ping" />
                  <circle r="6" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                  <text x="10" y="4" fill="#f87171" fontSize="9" fontFamily="monospace" fontWeight="bold">
                    ALERT #{inc.event_id?.slice(-4) || i+1}
                  </text>
                </g>
              );
            })}

            {/* Crosshair Target Point & Connecting Line to Nearest Camera */}
            {targetPoint && nearestCameraInfo && (
              <g>
                <line
                  x1={targetPoint.x}
                  y1={targetPoint.y}
                  x2={nearestCameraInfo.camera.mapX}
                  y2={nearestCameraInfo.camera.mapY}
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
                <circle cx={targetPoint.x} cy={targetPoint.y} r="8" fill="none" stroke="#38bdf8" strokeWidth="2" />
                <circle cx={targetPoint.x} cy={targetPoint.y} r="2" fill="#38bdf8" />
                <line x1={targetPoint.x - 12} y1={targetPoint.y} x2={targetPoint.x + 12} y2={targetPoint.y} stroke="#38bdf8" strokeWidth="1.5" />
                <line x1={targetPoint.x} y1={targetPoint.y - 12} x2={targetPoint.x} y2={targetPoint.y + 12} stroke="#38bdf8" strokeWidth="1.5" />
              </g>
            )}
          </svg>
        </div>

        {/* Selected Camera Mini-HUD Drawer */}
        {selectedCam && (
          <div className="absolute bottom-4 right-4 z-20 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-lg p-4 w-72 shadow-2xl text-xs font-mono space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-white truncate">{selectedCam.name}</span>
              <button onClick={() => setSelectedCam(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="aspect-video bg-black rounded overflow-hidden border border-slate-800">
              <img
                src={getCameraStreamUrl(selectedCam.camera_id, true)}
                alt={selectedCam.name}
                className="w-full h-full object-contain"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>

            <div className="space-y-1 text-[11px] text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Sector:</span>
                <span className="text-white font-medium">{selectedCam.sector || 'Sector Alpha'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className={`font-bold ${selectedCam.status === 'ONLINE' ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {selectedCam.status || 'ONLINE'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Coverage:</span>
                <span className="text-cyan-400 font-bold">
                  {selectedCam.fov_degrees ? `${selectedCam.fov_degrees}° / ${selectedCam.range_meters || 150}m` : 'Coverage not configured'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Coordinates:</span>
                <span className="text-slate-300">
                  {selectedCam.hasCoords ? `${selectedCam.latitude?.toFixed(4)}, ${selectedCam.longitude?.toFixed(4)}` : 'Coordinates not configured'}
                </span>
              </div>
            </div>

            {onNavigateToCameras && (
              <button
                onClick={() => onNavigateToCameras(selectedCam.camera_id)}
                className="w-full py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold transition flex items-center justify-center gap-1.5"
              >
                <span>Jump to Camera Console</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
