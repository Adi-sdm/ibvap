import React, { useState, useEffect, useMemo } from 'react';
import { 
  Map, 
  Compass, 
  Camera, 
  Crosshair, 
  Eye, 
  Plus,
  Navigation,
  ExternalLink,
  Sliders,
  Save,
  Check,
  MapPin,
  LocateFixed,
  AlertTriangle,
  X
} from 'lucide-react';
import { 
  getCameraStreamUrl, 
  getSystemSettings, 
  updateSystemSettings, 
  updateCameraConfig, 
  createCamera 
} from '../services/api';

export default function GISMap({ cameras = [], incidents = [], onNavigateToCameras, onRefresh }) {
  const [selectedCam, setSelectedCam] = useState(null);
  const [targetPoint, setTargetPoint] = useState(null);
  const [showFOV, setShowFOV] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);

  // Operational Area Center state
  const [opArea, setOpArea] = useState({
    configured: false,
    lat: 28.6139,
    lng: 77.2090,
    name: '',
    radiusMeters: 1000
  });
  const [showAreaSetupModal, setShowAreaSetupModal] = useState(false);
  const [manualAreaName, setManualAreaName] = useState('');
  const [manualAreaLat, setManualAreaLat] = useState('');
  const [manualAreaLng, setManualAreaLng] = useState('');
  const [detectingGps, setDetectingGps] = useState(false);

  // Spatial Calibration & Placement Mode
  const [placementMode, setPlacementMode] = useState(null); // 'reposition' | 'add_new' | null
  const [selectedCamToPosition, setSelectedCamToPosition] = useState('');
  const [tempCoords, setTempCoords] = useState(null); // { x, y, lat, lng }
  const [tempDirection, setTempDirection] = useState(0);
  const [tempFov, setTempFov] = useState(60);
  const [tempRange, setTempRange] = useState(150);
  const [savingPosition, setSavingPosition] = useState(false);

  // Add camera modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCamName, setNewCamName] = useState('');
  const [newCamRtsp, setNewCamRtsp] = useState('0');
  const [newCamSector, setNewCamSector] = useState('Sector A');

  // Load operational area from system settings
  useEffect(() => {
    getSystemSettings()
      .then(cfg => {
        if (cfg && cfg.operational_area_lat != null && cfg.operational_area_lng != null) {
          setOpArea({
            configured: true,
            lat: cfg.operational_area_lat,
            lng: cfg.operational_area_lng,
            name: cfg.operational_area_name || 'Designated Facility',
            radiusMeters: cfg.operational_area_radius || 1000
          });
        } else {
          setOpArea(prev => ({ ...prev, configured: false }));
        }
      })
      .catch(() => {});
  }, []);

  // Handle GPS detection
  const handleDetectDeviceLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser or device.");
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        const name = "Device Location (Live GPS)";
        try {
          await updateSystemSettings({
            operational_area_lat: lat,
            operational_area_lng: lng,
            operational_area_name: name,
            operational_area_radius: 1000.0
          });
          setOpArea({
            configured: true,
            lat,
            lng,
            name,
            radiusMeters: 1000
          });
          setShowAreaSetupModal(false);
        } catch (err) {
          alert("Failed to save operational center: " + err.message);
        } finally {
          setDetectingGps(false);
        }
      },
      (err) => {
        setDetectingGps(false);
        alert(`Could not acquire GPS location (${err.message}). Please enter coordinates manually.`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSaveManualLocation = async (e) => {
    e.preventDefault();
    const lat = parseFloat(manualAreaLat);
    const lng = parseFloat(manualAreaLng);
    if (isNaN(lat) || isNaN(lng)) {
      alert("Please provide valid numerical coordinates for Latitude and Longitude.");
      return;
    }
    const name = manualAreaName.trim() || `Operational Center (${lat.toFixed(2)}, ${lng.toFixed(2)})`;
    try {
      await updateSystemSettings({
        operational_area_lat: lat,
        operational_area_lng: lng,
        operational_area_name: name,
        operational_area_radius: 1000.0
      });
      setOpArea({
        configured: true,
        lat,
        lng,
        name,
        radiusMeters: 1000
      });
      setShowAreaSetupModal(false);
    } catch (err) {
      alert("Failed to save operational center: " + err.message);
    }
  };

  // Convert GPS (lat, lng) to canvas (x, y) relative to opArea
  // Canvas is 1000x500 with center at (500, 250) representing radiusMeters
  const gpsToCanvas = (lat, lng) => {
    const latDiff = lat - opArea.lat;
    const lngDiff = lng - opArea.lng;
    // 1 deg lat ≈ 111,320m
    const metersY = latDiff * 111320;
    // 1 deg lng ≈ 111,320m * cos(lat)
    const metersX = lngDiff * 111320 * Math.cos((opArea.lat * Math.PI) / 180);
    
    // Scale: radiusMeters maps to 220px from center
    const scale = 220 / (opArea.radiusMeters || 1000);
    const x = Math.round(500 + metersX * scale);
    const y = Math.round(250 - metersY * scale);
    return { x: Math.max(30, Math.min(970, x)), y: Math.max(30, Math.min(470, y)) };
  };

  // Convert canvas (x, y) back to GPS (lat, lng)
  const canvasToGps = (x, y) => {
    const scale = 220 / (opArea.radiusMeters || 1000);
    const metersX = (x - 500) / scale;
    const metersY = (250 - y) / scale;

    const latDiff = metersY / 111320;
    const lngDiff = metersX / (111320 * Math.cos((opArea.lat * Math.PI) / 180));

    return {
      lat: parseFloat((opArea.lat + latDiff).toFixed(6)),
      lng: parseFloat((opArea.lng + lngDiff).toFixed(6))
    };
  };

  // Map cameras to canvas positions
  const cameraNodes = useMemo(() => {
    return cameras.map((cam, idx) => {
      const hasCoords = cam.latitude != null && cam.longitude != null;
      let mapX, mapY;
      if (hasCoords) {
        const c = gpsToCanvas(cam.latitude, cam.longitude);
        mapX = c.x;
        mapY = c.y;
      } else {
        // Deterministic unconfigured spread around perimeter
        const total = Math.max(cameras.length, 1);
        const angle = (idx / total) * 2 * Math.PI;
        mapX = Math.round(500 + 180 * Math.cos(angle));
        mapY = Math.round(250 + 120 * Math.sin(angle));
      }

      return {
        ...cam,
        hasCoords,
        mapX,
        mapY,
        direction: cam.direction != null ? cam.direction : (idx * 60) % 360,
        fov_degrees: cam.fov_degrees || 60,
        range_meters: cam.range_meters || 150
      };
    });
  }, [cameras, opArea]);

  // Nearest camera triangulation
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

    const metersPerPx = (opArea.radiusMeters || 1000) / 220;
    const meters = Math.round(minD * metersPerPx);

    return {
      camera: nearest,
      distanceMeters: meters,
      targetX: targetPoint.x,
      targetY: targetPoint.y
    };
  }, [targetPoint, cameraNodes, opArea]);

  // Click on map
  const handleMapClick = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 500);
    const coords = canvasToGps(x, y);

    if (placementMode === 'reposition') {
      setTempCoords({ x, y, lat: coords.lat, lng: coords.lng });
    } else if (placementMode === 'add_new') {
      setTempCoords({ x, y, lat: coords.lat, lng: coords.lng });
      setShowAddModal(true);
    } else {
      setTargetPoint({ x, y, lat: coords.lat, lng: coords.lng });
    }
  };

  // Save repositioned camera
  const handleSaveReposition = async () => {
    if (!selectedCamToPosition || !tempCoords) return;
    setSavingPosition(true);
    try {
      await updateCameraConfig(selectedCamToPosition, {
        latitude: tempCoords.lat,
        longitude: tempCoords.lng,
        direction: tempDirection,
        fov_degrees: tempFov,
        range_meters: tempRange
      });
      setPlacementMode(null);
      setTempCoords(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert("Failed to save camera coordinates: " + err.message);
    } finally {
      setSavingPosition(false);
    }
  };

  // Add new camera at clicked coordinates
  const handleCreateCameraAtLocation = async (e) => {
    e.preventDefault();
    if (!newCamName.trim() || !tempCoords) return;
    setSavingPosition(true);
    try {
      await createCamera({
        name: newCamName.trim(),
        rtsp_url: newCamRtsp.trim() || '0',
        sector: newCamSector.trim() || 'Sector Alpha',
        latitude: tempCoords.lat,
        longitude: tempCoords.lng,
        direction: tempDirection,
        fov_degrees: tempFov,
        range_meters: tempRange
      });
      setShowAddModal(false);
      setPlacementMode(null);
      setTempCoords(null);
      setNewCamName('');
      if (onRefresh) onRefresh();
    } catch (err) {
      alert("Failed to create camera at location: " + err.message);
    } finally {
      setSavingPosition(false);
    }
  };

  // Compute SVG polygon for FOV cone
  const getFovPoints = (cx, cy, direction, fov, rangeMeters) => {
    const scale = 220 / (opArea.radiusMeters || 1000);
    const rangePx = Math.max(35, Math.min(180, rangeMeters * scale));
    const rad = (deg) => (deg * Math.PI) / 180;
    const startAngle = rad(direction - 90 - fov / 2);
    const endAngle = rad(direction - 90 + fov / 2);
    
    const x1 = cx + rangePx * Math.cos(startAngle);
    const y1 = cy + rangePx * Math.sin(startAngle);
    const x2 = cx + rangePx * Math.cos(endAngle);
    const y2 = cy + rangePx * Math.sin(endAngle);

    return `${cx},${cy} ${x1},${y1} ${x2},${y2}`;
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto font-sans">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Map className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-100 tracking-tight font-mono">
              Geospatial Operations & Sensor Grid
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
              COORDINATE GRID
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
            {opArea.configured ? (
              <span className="text-emerald-400 font-mono flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                Operational Center: <strong className="text-white">{opArea.name}</strong> ({opArea.lat.toFixed(4)}° N, {opArea.lng.toFixed(4)}° E)
              </span>
            ) : (
              <span className="text-amber-400 font-mono flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Operational center unconfigured — using default reference coordinates.
              </span>
            )}
            <button
              onClick={() => setShowAreaSetupModal(true)}
              className="text-[11px] underline text-cyan-400 hover:text-cyan-300 ml-2"
            >
              {opArea.configured ? 'Change Center' : 'Configure Location'}
            </button>
          </div>
        </div>

        {/* Toolbar: Placement & Add Camera */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-2 shrink-0 font-mono text-xs">
          <button
            onClick={() => {
              if (placementMode === 'reposition') {
                setPlacementMode(null);
                setTempCoords(null);
              } else {
                setPlacementMode('reposition');
                if (cameraNodes.length > 0 && !selectedCamToPosition) {
                  setSelectedCamToPosition(cameraNodes[0].camera_id);
                  setTempDirection(cameraNodes[0].direction || 0);
                  setTempFov(cameraNodes[0].fov_degrees || 60);
                  setTempRange(cameraNodes[0].range_meters || 150);
                }
              }
            }}
            className={`px-3 py-1.5 rounded border transition flex items-center gap-1.5 ${
              placementMode === 'reposition'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{placementMode === 'reposition' ? 'Cancel Reposition' : 'Position Camera'}</span>
          </button>

          <button
            onClick={() => {
              if (placementMode === 'add_new') {
                setPlacementMode(null);
                setTempCoords(null);
              } else {
                setPlacementMode('add_new');
              }
            }}
            className={`px-3 py-1.5 rounded border transition flex items-center gap-1.5 ${
              placementMode === 'add_new'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{placementMode === 'add_new' ? 'Click Map to Place' : 'Add Camera on Map'}</span>
          </button>
        </div>
      </div>

      {/* Reposition Toolbar Banner */}
      {placementMode === 'reposition' && (
        <div className="bg-slate-900 border border-amber-500/40 rounded-lg p-3.5 shadow-md space-y-3 font-mono text-xs text-slate-300">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <Sliders className="w-4 h-4" /> Position & Orient Camera
            </span>
            <span className="text-[11px] text-slate-400 font-sans">
              Click anywhere on the map grid to set target coordinates.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Target Camera:</label>
              <select
                value={selectedCamToPosition}
                onChange={e => {
                  const cid = e.target.value;
                  setSelectedCamToPosition(cid);
                  const found = cameraNodes.find(c => c.camera_id === cid);
                  if (found) {
                    setTempDirection(found.direction || 0);
                    setTempFov(found.fov_degrees || 60);
                    setTempRange(found.range_meters || 150);
                    setTempCoords(found.hasCoords ? { x: found.mapX, y: found.mapY, lat: found.latitude, lng: found.longitude } : null);
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 p-1.5 rounded text-white"
              >
                {cameraNodes.map(c => (
                  <option key={c.camera_id} value={c.camera_id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Azimuth Angle:</span>
                <span className="text-cyan-400 font-bold">{tempDirection}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                step="5"
                value={tempDirection}
                onChange={e => setTempDirection(parseInt(e.target.value))}
                className="w-full accent-cyan-500 h-1 bg-slate-800 rounded cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Aperture FOV:</span>
                <span className="text-emerald-400 font-bold">{tempFov}°</span>
              </div>
              <input
                type="range"
                min="30"
                max="120"
                step="5"
                value={tempFov}
                onChange={e => setTempFov(parseInt(e.target.value))}
                className="w-full accent-emerald-500 h-1 bg-slate-800 rounded cursor-pointer"
              />
            </div>

            <div className="pt-2 sm:pt-0">
              <button
                type="button"
                onClick={handleSaveReposition}
                disabled={savingPosition || !tempCoords}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-bold transition flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingPosition ? 'Saving...' : (tempCoords ? 'Save Coordinates' : 'Click Map to Place')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Vector Grid */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden shadow-2xl relative">
        {/* Layer Toggles */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1.5 rounded-lg shadow-lg">
          <button
            onClick={() => setShowFOV(prev => !prev)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition ${
              showFOV ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
            }`}
          >
            FOV Cones {showFOV ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => setShowIncidents(prev => !prev)}
            className={`px-2.5 py-1 rounded text-[11px] font-mono transition ${
              showIncidents ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'text-slate-400 hover:text-white'
            }`}
          >
            Threat Pins {showIncidents ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Nearest Camera / Telemetry overlay */}
        <div className="absolute top-4 left-4 z-10 space-y-2 max-w-sm pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 p-3 rounded-lg shadow-lg text-xs font-mono text-slate-300 pointer-events-auto">
            <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
              <span>Concentric Metric Scale: 200m / Ring</span>
            </div>
            <div className="mt-1 text-slate-200">
              {placementMode ? 'Click on map grid to place sensor.' : 'Click anywhere on grid to locate nearest camera.'}
            </div>
          </div>

          {nearestCameraInfo && !placementMode && (
            <div className="bg-slate-900/95 backdrop-blur-md border border-cyan-500/50 p-3.5 rounded-lg shadow-2xl text-xs font-mono space-y-1.5 pointer-events-auto animate-fade-in">
              <div className="flex items-center justify-between text-cyan-400 font-bold">
                <span>NEAREST SURVEILLANCE SENSOR:</span>
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
                (Terrain & transit velocity model not configured)
              </div>
              {onNavigateToCameras && (
                <button
                  onClick={() => onNavigateToCameras(nearestCameraInfo.camera?.camera_id)}
                  className="w-full mt-2 py-1 bg-cyan-600/80 hover:bg-cyan-600 text-white rounded text-[11px] font-bold flex items-center justify-center gap-1 transition"
                >
                  <Eye className="w-3 h-3" />
                  <span>Switch to Camera Stream</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Clean Cartographic SVG Canvas */}
        <div className="relative w-full aspect-[2/1] bg-[#070b14] cursor-crosshair select-none">
          <svg
            viewBox="0 0 1000 500"
            className="w-full h-full"
            onClick={handleMapClick}
          >
            <defs>
              {/* Tactical Grid Pattern */}
              <pattern id="cleanGrid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.5" />
              </pattern>

              {/* FOV Radial Gradient */}
              <radialGradient id="fovGrad" cx="0%" cy="50%" r="100%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
              </radialGradient>
            </defs>

            {/* Background Grid */}
            <rect width="1000" height="500" fill="url(#cleanGrid)" />

            {/* Concentric Metric Range Rings from Center (500, 250) */}
            <circle cx="500" cy="250" r="55" fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="500" cy="250" r="110" fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="500" cy="250" r="165" fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="500" cy="250" r="220" fill="none" stroke="#475569" strokeWidth="1.5" />

            {/* Range Labels */}
            <text x="505" y="195" fill="#64748b" fontSize="8" fontFamily="monospace">250m</text>
            <text x="505" y="140" fill="#64748b" fontSize="8" fontFamily="monospace">500m</text>
            <text x="505" y="85" fill="#64748b" fontSize="8" fontFamily="monospace">750m</text>
            <text x="505" y="30" fill="#64748b" fontSize="8" fontFamily="monospace">1000m</text>

            {/* Center Axis Crosshairs */}
            <line x1="500" y1="10" x2="500" y2="490" stroke="#1e293b" strokeWidth="1" />
            <line x1="10" y1="250" x2="990" y2="250" stroke="#1e293b" strokeWidth="1" />
            <circle cx="500" cy="250" r="3" fill="#38bdf8" />
            <text x="510" y="260" fill="#38bdf8" fontSize="9" fontFamily="monospace" fontWeight="bold">
              CENTER ({opArea.lat.toFixed(4)}, {opArea.lng.toFixed(4)})
            </text>

            {/* Compass Rose (Top Right) */}
            <g transform="translate(940, 60)">
              <circle r="20" fill="#0f172a" stroke="#334155" strokeWidth="1" />
              <polygon points="0,-16 4,0 0,-4 -4,0" fill="#ef4444" />
              <polygon points="0,16 4,0 0,4 -4,0" fill="#94a3b8" />
              <text x="0" y="-19" fill="#ef4444" fontSize="8" fontFamily="monospace" fontWeight="bold" textAnchor="middle">N</text>
              <text x="0" y="25" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">S</text>
              <text x="25" y="3" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">E</text>
              <text x="-25" y="3" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">W</text>
            </g>

            {/* Camera Nodes */}
            {cameraNodes.map((cam) => {
              const isSelected = selectedCam?.camera_id === cam.camera_id;
              const isBeingRepositioned = placementMode === 'reposition' && selectedCamToPosition === cam.camera_id;
              const posX = isBeingRepositioned && tempCoords ? tempCoords.x : cam.mapX;
              const posY = isBeingRepositioned && tempCoords ? tempCoords.y : cam.mapY;
              const dir = isBeingRepositioned ? tempDirection : cam.direction;
              const fov = isBeingRepositioned ? tempFov : cam.fov_degrees;
              const range = isBeingRepositioned ? tempRange : cam.range_meters;

              return (
                <g key={cam.camera_id} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setSelectedCam(cam); }}>
                  {/* Directional FOV Cone */}
                  {showFOV && (
                    <polygon
                      points={getFovPoints(posX, posY, dir, fov, range)}
                      fill="url(#fovGrad)"
                      stroke="#38bdf8"
                      strokeWidth="1"
                      strokeOpacity="0.4"
                    />
                  )}

                  {/* Camera Marker */}
                  <circle
                    cx={posX}
                    cy={posY}
                    r={isSelected || isBeingRepositioned ? 10 : 7}
                    fill={isBeingRepositioned ? '#f59e0b' : (cam.status === 'ONLINE' ? '#10b981' : '#64748b')}
                    stroke="#ffffff"
                    strokeWidth="2"
                    filter="drop-shadow(0 0 6px rgba(16,185,129,0.7))"
                  />

                  {/* Azimuth Direction Needle */}
                  <line
                    x1={posX}
                    y1={posY}
                    x2={posX + 15 * Math.cos(((dir - 90) * Math.PI) / 180)}
                    y2={posY + 15 * Math.sin(((dir - 90) * Math.PI) / 180)}
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />

                  {/* Label */}
                  <text
                    x={posX}
                    y={posY + 18}
                    fill="#e2e8f0"
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {cam.name}
                  </text>
                  <text
                    x={posX}
                    y={posY + 27}
                    fill={cam.hasCoords ? '#10b981' : '#94a3b8'}
                    fontSize="7.5"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {cam.hasCoords ? `${cam.latitude?.toFixed(3)}, ${cam.longitude?.toFixed(3)}` : 'GRID ESTIMATE'}
                  </text>
                </g>
              );
            })}

            {/* Incidents Threat Pins */}
            {showIncidents && incidents.slice(0, 4).map((inc, i) => {
              const pinX = 280 + (i * 150);
              const pinY = 220 + (i % 2 === 0 ? -25 : 25);
              return (
                <g key={inc.event_id || i} transform={`translate(${pinX}, ${pinY})`}>
                  <circle r="12" fill="#ef4444" fillOpacity="0.2" className="animate-ping" />
                  <circle r="5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                  <text x="8" y="3" fill="#f87171" fontSize="8" fontFamily="monospace" fontWeight="bold">
                    ALERT #{inc.event_id?.slice(0, 6) || i+1}
                  </text>
                </g>
              );
            })}

            {/* Crosshair Target Point & Connecting Line */}
            {targetPoint && nearestCameraInfo && !placementMode && (
              <g>
                <line
                  x1={targetPoint.x}
                  y1={targetPoint.y}
                  x2={nearestCameraInfo.camera.mapX}
                  y2={nearestCameraInfo.camera.mapY}
                  stroke="#38bdf8"
                  strokeWidth="1.5"
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

        {/* Selected Camera Drawer */}
        {selectedCam && (
          <div className="absolute bottom-4 right-4 z-20 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-lg p-4 w-80 shadow-2xl text-xs font-mono space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <span className="font-bold text-white truncate block">{selectedCam.name}</span>
                <span className="text-[10px] text-slate-400">{selectedCam.camera_id}</span>
              </div>
              <button onClick={() => setSelectedCam(null)} className="text-slate-400 hover:text-white p-1">
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

      {/* Operational Area Setup Modal */}
      {showAreaSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-mono text-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="font-bold text-slate-100 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-400" /> Operational Area Setup
              </span>
              <button onClick={() => setShowAreaSetupModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
              Define the geographic anchor for this surveillance perimeter. Coordinates serve as the reference origin for all cameras and distance triangulation.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleDetectDeviceLocation}
                disabled={detectingGps}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-bold transition flex items-center justify-center gap-2 shadow"
              >
                <LocateFixed className={`w-4 h-4 ${detectingGps ? 'animate-spin' : ''}`} />
                <span>{detectingGps ? 'Acquiring GPS Position...' : 'Detect Device Location (Browser GPS)'}</span>
              </button>

              <div className="flex items-center gap-2 text-slate-500 my-1">
                <div className="flex-1 border-t border-slate-800"></div>
                <span className="text-[10px] uppercase">OR ENTER MANUALLY</span>
                <div className="flex-1 border-t border-slate-800"></div>
              </div>

              <form onSubmit={handleSaveManualLocation} className="space-y-2.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">Facility / Sector Name:</label>
                  <input
                    type="text"
                    placeholder="e.g. North Gate Command Facility"
                    value={manualAreaName}
                    onChange={e => setManualAreaName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-0.5">Latitude (°N):</label>
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="e.g. 28.6139"
                      value={manualAreaLat}
                      onChange={e => setManualAreaLat(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-0.5">Longitude (°E):</label>
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="e.g. 77.2090"
                      value={manualAreaLng}
                      onChange={e => setManualAreaLng(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-white"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded font-bold transition flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Save Operational Coordinates</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Camera at Position Modal */}
      {showAddModal && tempCoords && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-mono text-xs">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-cyan-400" /> Add Camera at Map Location
              </span>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCameraAtLocation} className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Camera Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Perimeter Camera 3"
                  value={newCamName}
                  onChange={e => setNewCamName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Stream Source (RTSP URL, '0' for Webcam, or video file):</label>
                <input
                  type="text"
                  placeholder="e.g. rtsp://192.168.1.100:554/stream or 0"
                  value={newCamRtsp}
                  onChange={e => setNewCamRtsp(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Sector Identifier:</label>
                <input
                  type="text"
                  placeholder="e.g. Sector Charlie"
                  value={newCamSector}
                  onChange={e => setNewCamSector(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-white"
                />
              </div>

              <div className="p-2.5 bg-slate-950 rounded border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div>Selected Coordinates: <span className="text-emerald-400 font-bold">{tempCoords.lat}, {tempCoords.lng}</span></div>
                <div>Default Azimuth Heading: <span className="text-cyan-400">{tempDirection}°</span></div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPosition}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{savingPosition ? 'Deploying...' : 'Deploy Camera'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

