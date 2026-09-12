import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { 
  Map as MapIcon, 
  Compass, 
  Camera, 
  Crosshair, 
  Eye, 
  EyeOff,
  Navigation, 
  Sliders, 
  Save, 
  Check, 
  MapPin, 
  LocateFixed, 
  AlertTriangle, 
  Layers, 
  RotateCw,
  X,
  ExternalLink,
  Plus
} from 'lucide-react';
import { 
  getCameraStreamUrl, 
  getSystemSettings, 
  updateSystemSettings, 
  updateCameraConfig,
  createCamera,
  getVehicleCorridors,
  getVehicleHandoff
} from '../services/api';

// Geodesic coordinate calculation for circular sector FOV cone
function calculateFovPolygon(lat, lng, headingDeg, fovDeg, rangeMeters) {
  const R = 6371000; // Earth radius in meters
  const points = [[lat, lng]]; // Apex at camera position
  
  const startAngle = headingDeg - (fovDeg / 2);
  const endAngle = headingDeg + (fovDeg / 2);
  const step = Math.max(1, fovDeg / 16); // 16 arc segments

  for (let a = startAngle; a <= endAngle; a += step) {
    const bearingRad = (a * Math.PI) / 180;
    const lat1Rad = (lat * Math.PI) / 180;
    const lng1Rad = (lng * Math.PI) / 180;
    const dOverR = rangeMeters / R;

    const lat2Rad = Math.asin(
      Math.sin(lat1Rad) * Math.cos(dOverR) +
      Math.cos(lat1Rad) * Math.sin(dOverR) * Math.cos(bearingRad)
    );
    const lng2Rad = lng1Rad + Math.atan2(
      Math.sin(bearingRad) * Math.sin(dOverR) * Math.cos(lat1Rad),
      Math.cos(dOverR) - Math.sin(lat1Rad) * Math.sin(lat2Rad)
    );

    points.push([
      (lat2Rad * 180) / Math.PI,
      (lng2Rad * 180) / Math.PI
    ]);
  }
  
  points.push([lat, lng]); // Close polygon back at apex
  return points;
}

export default function GISMap({ cameras = [], incidents = [], onNavigateToCameras, onRefresh }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);
  const tileLayerRef = useRef(null);

  const [selectedCam, setSelectedCam] = useState(null);
  const [targetPoint, setTargetPoint] = useState(null);
  const [showFOV, setShowFOV] = useState(true);
  const [baseMapLayer, setBaseMapLayer] = useState('osm'); // 'osm' | 'satellite'

  // Operational Area Center
  const [opArea, setOpArea] = useState({
    configured: false,
    lat: 26.604665,
    lng: 84.935982,
    name: 'Designated Operational Sector',
    radiusMeters: 1000
  });
  const [detectingGps, setDetectingGps] = useState(false);

  // Calibration / Placement Mode
  const [calibrationCamId, setCalibrationCamId] = useState(null);
  const [tempCoords, setTempCoords] = useState(null); // { lat, lng }
  const [tempDirection, setTempDirection] = useState(0);
  const [tempFov, setTempFov] = useState(60);
  const [tempRange, setTempRange] = useState(150);
  const [savingPosition, setSavingPosition] = useState(false);

  // Add Camera Directly on Map Mode
  const [addCameraMode, setAddCameraMode] = useState(false);
  const [newCamData, setNewCamData] = useState(null);
  const [creatingCam, setCreatingCam] = useState(false);
  const addCameraModeRef = useRef(false);
  addCameraModeRef.current = addCameraMode;
  const calibrationCamIdRef = useRef(null);
  calibrationCamIdRef.current = calibrationCamId;

  // Tactical Corridors & Route Prediction (Truthful GIS)
  const [corridors, setCorridors] = useState([]);
  const [predictedHandoff, setPredictedHandoff] = useState(null);
  const [showRoutes, setShowRoutes] = useState(true);

  useEffect(() => {
    getVehicleCorridors().then(c => setCorridors(c || [])).catch(() => setCorridors([]));
  }, [cameras]);

  useEffect(() => {
    if (selectedCam?.camera_id) {
      getVehicleHandoff(selectedCam.camera_id).then(setPredictedHandoff).catch(() => setPredictedHandoff(null));
    } else {
      setPredictedHandoff(null);
    }
  }, [selectedCam]);

  // Load operational area from system settings
  useEffect(() => {
    getSystemSettings()
      .then(cfg => {
        if (cfg && cfg.operational_area_lat != null && cfg.operational_area_lng != null) {
          setOpArea({
            configured: true,
            lat: cfg.operational_area_lat,
            lng: cfg.operational_area_lng,
            name: cfg.operational_area_name || 'Designated Operational Sector',
            radiusMeters: cfg.operational_area_radius || 1000
          });
        }
      })
      .catch(() => {});
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // Already initialized

    const initialCenter = [opArea.lat, opArea.lng];
    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 15,
      zoomControl: false,
      attributionControl: true
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const tileUrl = baseMapLayer === 'satellite'
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const tileLayer = L.tileLayer(tileUrl, {
      attribution: baseMapLayer === 'satellite'
        ? 'Tiles &copy; Esri &mdash; Source: Esri'
        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Feature layer group for markers, cones, lines
    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;
    mapInstanceRef.current = map;

    // Click handler on map
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      const roundedLat = parseFloat(lat.toFixed(6));
      const roundedLng = parseFloat(lng.toFixed(6));

      if (addCameraModeRef.current) {
        setNewCamData({
          name: `Sector Node (${roundedLat.toFixed(3)}, ${roundedLng.toFixed(3)})`,
          rtsp_url: '0',
          sector: 'Perimeter Sector',
          latitude: roundedLat,
          longitude: roundedLng,
          direction: 0,
          fov_degrees: 60,
          range_meters: 150,
          profile: 'PERIMETER_DEFENSE'
        });
        setAddCameraMode(false);
        return;
      }

      if (calibrationCamIdRef.current) {
        setTempCoords({ lat: roundedLat, lng: roundedLng });
        return;
      }

      setTargetPoint({ lat: roundedLat, lng: roundedLng });
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Switch Base Tile Layer
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    const tileUrl = baseMapLayer === 'satellite'
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const newLayer = L.tileLayer(tileUrl, {
      attribution: baseMapLayer === 'satellite' ? 'Tiles &copy; Esri' : '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newLayer;
  }, [baseMapLayer]);

  // Center map when opArea updates
  useEffect(() => {
    if (mapInstanceRef.current && opArea.configured) {
      mapInstanceRef.current.setView([opArea.lat, opArea.lng], 15);
    }
  }, [opArea.configured, opArea.lat, opArea.lng]);

  // Render Markers, Cones, and Triangulation Target
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;
    const group = layerGroupRef.current;
    group.clearLayers();

    // 1. Draw Operational Center Circle
    if (opArea.configured) {
      L.circle([opArea.lat, opArea.lng], {
        radius: opArea.radiusMeters || 1000,
        color: '#3B82F6',
        weight: 1,
        dashArray: '4, 8',
        fillColor: '#3B82F6',
        fillOpacity: 0.05
      }).addTo(group);

      const centerIcon = L.divIcon({
        className: 'op-center-icon',
        html: `<div class="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600/80 border-2 border-white shadow-md text-[9px] font-bold text-white">OP</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      L.marker([opArea.lat, opArea.lng], { icon: centerIcon })
        .bindTooltip(`<b>${opArea.name}</b><br/>Sector Command Center`, { direction: 'top' })
        .addTo(group);
    }

    // 2. Draw Camera Nodes & FOV Cones
    cameras.forEach(cam => {
      const isCalibrating = calibrationCamId === cam.camera_id;
      const lat = isCalibrating && tempCoords ? tempCoords.lat : cam.latitude;
      const lng = isCalibrating && tempCoords ? tempCoords.lng : cam.longitude;
      const direction = isCalibrating ? tempDirection : (cam.direction || 0);
      const fov = isCalibrating ? tempFov : (cam.fov_degrees || 60);
      const range = isCalibrating ? tempRange : (cam.range_meters || 150);

      if (lat == null || lng == null) return; // Skip unconfigured cameras from map canvas

      const isSelected = selectedCam?.camera_id === cam.camera_id;
      const isOnline = cam.status === 'ONLINE';

      // FOV Sector Cone Polygon
      if (showFOV) {
        const polyCoords = calculateFovPolygon(lat, lng, direction, fov, range);
        const coneColor = isCalibrating ? '#F59E0B' : (isSelected ? '#3B82F6' : '#10B981');
        
        L.polygon(polyCoords, {
          color: coneColor,
          weight: 1.5,
          fillColor: coneColor,
          fillOpacity: isCalibrating ? 0.35 : (isSelected ? 0.25 : 0.15)
        }).addTo(group);
      }

      // Camera Marker Icon
      const markerColor = isCalibrating 
        ? 'border-amber-400 bg-amber-950 text-amber-300 ring-2 ring-amber-400'
        : (isSelected 
            ? 'border-blue-400 bg-blue-950 text-blue-300 ring-2 ring-blue-400' 
            : (isOnline ? 'border-emerald-500 bg-slate-900 text-emerald-400' : 'border-rose-500 bg-slate-900 text-rose-400'));

      const cameraIcon = L.divIcon({
        className: 'custom-camera-node',
        html: `
          <div class="relative flex items-center justify-center w-8 h-8 rounded-full border-2 ${markerColor} shadow-xl cursor-pointer transition-transform hover:scale-110">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
              <circle cx="12" cy="13" r="3"/>
            </svg>
            <div class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}"></div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18]
      });

      const marker = L.marker([lat, lng], { icon: cameraIcon })
        .addTo(group);

      marker.on('click', () => {
        setSelectedCam(cam);
      });

      marker.bindTooltip(`
        <div class="text-xs font-mono">
          <div class="font-bold text-slate-100">${cam.name}</div>
          <div class="text-[10px] text-slate-400">${cam.sector || 'Unassigned'} • Heading: ${direction}°</div>
          <div class="text-[10px] ${isOnline ? 'text-emerald-400' : 'text-rose-400'} font-semibold">${cam.status}</div>
        </div>
      `, { direction: 'top', offset: [0, -14], className: 'tactical-map-tooltip' });
    });

    // 3. Draw Target Point & Triangulation Line
    if (targetPoint) {
      const targetIcon = L.divIcon({
        className: 'target-marker-icon',
        html: `
          <div class="flex items-center justify-center w-7 h-7 rounded-full bg-rose-600/90 border-2 border-white shadow-2xl text-white animate-bounce">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="22" y1="12" x2="18" y2="12"/>
              <line x1="6" y1="12" x2="2" y2="12"/>
              <line x1="12" y1="6" x2="12" y2="2"/>
              <line x1="12" y1="22" x2="12" y2="18"/>
            </svg>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      L.marker([targetPoint.lat, targetPoint.lng], { icon: targetIcon })
        .bindPopup(`<b>Tactical Target Point</b><br/>Lat: ${targetPoint.lat}<br/>Lng: ${targetPoint.lng}`)
        .addTo(group);

      let minDistance = Infinity;
      let nearestCam = null;

      cameras.forEach(c => {
        if (c.latitude != null && c.longitude != null) {
          const d = mapInstanceRef.current.distance([targetPoint.lat, targetPoint.lng], [c.latitude, c.longitude]);
          if (d < minDistance) {
            minDistance = d;
            nearestCam = c;
          }
        }
      });

      if (nearestCam) {
        L.polyline([[targetPoint.lat, targetPoint.lng], [nearestCam.latitude, nearestCam.longitude]], {
          color: '#EF4444',
          weight: 2,
          dashArray: '6, 6'
        }).addTo(group);
      }
    }

    // 4. Draw Truthful Vehicle Routes: Observed, Estimated, and Predicted
    if (showRoutes) {
      // Estimated Pairwise Corridors (Dashed Amber line)
      corridors.forEach(cor => {
        const c1 = cameras.find(c => c.camera_id === cor.origin_camera);
        const c2 = cameras.find(c => c.camera_id === cor.destination_camera);
        if (c1 && c2 && c1.latitude != null && c2.latitude != null) {
          L.polyline([[c1.latitude, c1.longitude], [c2.latitude, c2.longitude]], {
            color: '#F59E0B',
            weight: 2,
            dashArray: '6, 6',
            opacity: 0.65
          }).bindTooltip(`Estimated Corridor: ${cor.name || 'Patrol Route'} (${Math.round(cor.distance_meters)}m)`).addTo(group);
        }
      });

      // Predicted Route Handoff (Dotted Cyan line)
      if (selectedCam && predictedHandoff && predictedHandoff.predicted_next_camera) {
        const nextCam = cameras.find(c => c.camera_id === predictedHandoff.predicted_next_camera);
        if (nextCam && selectedCam.latitude != null && nextCam.latitude != null) {
          L.polyline([[selectedCam.latitude, selectedCam.longitude], [nextCam.latitude, nextCam.longitude]], {
            color: '#38BDF8',
            weight: 3,
            dashArray: '2, 6',
            opacity: 0.95
          }).bindTooltip(`Predicted Route: ${selectedCam.name} ➔ ${nextCam.name} (ETA: ${predictedHandoff.estimated_time_seconds}s)`).addTo(group);
        }
      }
    }
  }, [cameras, showFOV, showRoutes, corridors, predictedHandoff, selectedCam, calibrationCamId, tempCoords, tempDirection, tempFov, tempRange, targetPoint, opArea]);

  // Live GPS Centering
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
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([lat, lng], 16, { duration: 1.5 });
          }
        } catch (err) {
          alert("Failed to save operational center: " + err.message);
        } finally {
          setDetectingGps(false);
        }
      },
      (err) => {
        setDetectingGps(false);
        alert(`Could not acquire GPS location (${err.message}).`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Start Calibration Mode for a camera
  const handleStartCalibration = (cam) => {
    setCalibrationCamId(cam.camera_id);
    setSelectedCam(cam);
    const lat = cam.latitude != null ? cam.latitude : opArea.lat;
    const lng = cam.longitude != null ? cam.longitude : opArea.lng;
    setTempCoords({ lat, lng });
    setTempDirection(cam.direction != null ? cam.direction : 0);
    setTempFov(cam.fov_degrees || 60);
    setTempRange(cam.range_meters || 150);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], 16);
    }
  };

  // Save Spatial Calibration to Backend SQLite
  const handleSaveCalibration = async () => {
    if (!calibrationCamId || !tempCoords) return;
    setSavingPosition(true);
    try {
      await updateCameraConfig(calibrationCamId, {
        latitude: tempCoords.lat,
        longitude: tempCoords.lng,
        direction: tempDirection,
        fov_degrees: tempFov,
        range_meters: tempRange
      });
      setCalibrationCamId(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert("Failed to save camera position: " + err.message);
    } finally {
      setSavingPosition(false);
    }
  };

  const handleCreateNewCamOnMap = async (e) => {
    e.preventDefault();
    if (!newCamData) return;
    setCreatingCam(true);
    try {
      await createCamera(newCamData);
      setNewCamData(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert("Failed to deploy camera: " + err.message);
    } finally {
      setCreatingCam(false);
    }
  };

  // Distance calculation from target point
  const nearestDistanceInfo = useMemo(() => {
    if (!targetPoint || !mapInstanceRef.current) return null;
    let minD = Infinity;
    let nearest = null;

    cameras.forEach(c => {
      if (c.latitude != null && c.longitude != null) {
        const d = mapInstanceRef.current.distance([targetPoint.lat, targetPoint.lng], [c.latitude, c.longitude]);
        if (d < minD) {
          minD = d;
          nearest = c;
        }
      }
    });

    if (!nearest) return null;
    return {
      camera: nearest,
      meters: Math.round(minD)
    };
  }, [targetPoint, cameras]);

  const unconfiguredCameras = useMemo(() => {
    return cameras.filter(c => c.latitude == null || c.longitude == null);
  }, [cameras]);

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Tactical Command Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 gap-3 text-xs z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-mono font-bold tracking-wider text-slate-200">
            <MapIcon className="w-4 h-4 text-emerald-400" />
            <span>GIS TACTICAL MAP</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800 text-emerald-300">
              LEAFLET OSM
            </span>
          </div>
          <div className="hidden md:flex items-center gap-2 text-slate-400 font-mono">
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            <span>{opArea.name} ({opArea.lat.toFixed(4)}, {opArea.lng.toFixed(4)})</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Add Camera on Map Toggle */}
          <button
            onClick={() => setAddCameraMode(prev => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-mono border transition-colors ${
              addCameraMode 
                ? 'bg-emerald-600 border-emerald-500 text-white shadow animate-pulse' 
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
            title="Click on map to place new camera"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{addCameraMode ? 'Click Map to Place...' : 'Add Camera on Map'}</span>
          </button>

          {/* Tile Layer Toggle */}
          <button
            onClick={() => setBaseMapLayer(prev => prev === 'osm' ? 'satellite' : 'osm')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono transition-colors"
            title="Toggle OpenStreetMap / Esri Satellite View"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>{baseMapLayer === 'osm' ? 'Satellite' : 'OSM Street'}</span>
          </button>

          {/* FOV Toggle */}
          <button
            onClick={() => setShowFOV(!showFOV)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-mono border transition-colors ${
              showFOV 
                ? 'bg-blue-950/60 border-blue-700 text-blue-300' 
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {showFOV ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>FOV Cones</span>
          </button>

          {/* Tactical Routes & Corridors Toggle */}
          <button
            onClick={() => setShowRoutes(!showRoutes)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-mono border transition-colors ${
              showRoutes 
                ? 'bg-amber-950/60 border-amber-700 text-amber-300' 
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title="Toggle Estimated Corridors and Predicted Handoffs"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Tactical Routes</span>
          </button>

          {/* GPS Auto Center */}
          <button
            onClick={handleDetectDeviceLocation}
            disabled={detectingGps}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono transition-colors"
            title="Center map on device GPS coordinates"
          >
            <LocateFixed className={`w-3.5 h-3.5 text-emerald-400 ${detectingGps ? 'animate-spin' : ''}`} />
            <span>{detectingGps ? 'Locating...' : 'My GPS'}</span>
          </button>

          {/* Target Clear */}
          {targetPoint && (
            <button
              onClick={() => setTargetPoint(null)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-rose-950/60 border border-rose-800 text-rose-300 font-mono hover:bg-rose-900/60"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Target</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Map Body + Side Panels */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex">
        {/* Leaflet Map Canvas Container */}
        <div ref={mapContainerRef} className="flex-1 w-full h-full z-0 bg-slate-900" />

        {/* Tactical Route & FOV Legend */}
        <div className="absolute bottom-6 left-4 z-10 p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 backdrop-blur text-[10px] font-mono space-y-1.5 shadow-xl pointer-events-none">
          <div className="font-bold text-slate-300 border-b border-slate-800 pb-1">TACTICAL GIS LEGEND</div>
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="w-3.5 h-1 bg-emerald-500 rounded"></span>
            <span>Solid: Observed / Calibrated Field</span>
          </div>
          <div className="flex items-center gap-2 text-amber-400">
            <span className="w-3.5 h-0.5 border-t-2 border-dashed border-amber-400"></span>
            <span>Dashed: Estimated Sector Corridor</span>
          </div>
          <div className="flex items-center gap-2 text-sky-400">
            <span className="w-3.5 h-0.5 border-t-2 border-dotted border-sky-400"></span>
            <span>Dotted: Predicted Downstream Route</span>
          </div>
        </div>

        {/* Floating Calibration HUD Overlay */}
        {calibrationCamId && (
          <div className="absolute top-4 left-4 z-20 w-84 p-4 rounded-lg bg-slate-900/95 border border-amber-500/80 shadow-2xl backdrop-blur-md text-xs font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Sliders className="w-4 h-4" />
                <span>SPATIAL CALIBRATION</span>
              </div>
              <button 
                onClick={() => setCalibrationCamId(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-300 mb-3">
              Click anywhere on the map to set camera coordinates, or adjust the sliders below:
            </p>

            {tempCoords ? (
              <div className="p-2 rounded bg-slate-950/70 border border-slate-800 mb-3 text-[11px] text-emerald-400">
                Lat: {tempCoords.lat.toFixed(6)}, Lng: {tempCoords.lng.toFixed(6)}
              </div>
            ) : (
              <div className="p-2 rounded bg-amber-950/40 border border-amber-800 mb-3 text-[11px] text-amber-300">
                Click map to select placement location
              </div>
            )}

            {/* Direction Slider */}
            <div className="mb-3">
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Azimuth Heading:</span>
                <span className="text-amber-400 font-bold">{tempDirection}°</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="359" 
                value={tempDirection} 
                onChange={(e) => setTempDirection(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* FOV Slider */}
            <div className="mb-3">
              <div className="flex justify-between text-slate-300 mb-1">
                <span>FOV Aperture:</span>
                <span className="text-amber-400 font-bold">{tempFov}°</span>
              </div>
              <input 
                type="range" 
                min="15" 
                max="120" 
                value={tempFov} 
                onChange={(e) => setTempFov(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* Range Slider */}
            <div className="mb-4">
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Metric Range:</span>
                <span className="text-amber-400 font-bold">{tempRange}m</span>
              </div>
              <input 
                type="range" 
                min="30" 
                max="500" 
                step="10"
                value={tempRange} 
                onChange={(e) => setTempRange(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            <button
              onClick={handleSaveCalibration}
              disabled={savingPosition || !tempCoords}
              className="w-full flex items-center justify-center gap-2 py-2 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-bold transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{savingPosition ? 'Saving to Database...' : 'Save Calibration'}</span>
            </button>
          </div>
        )}

        {/* Floating Triangulation Target HUD */}
        {nearestDistanceInfo && !calibrationCamId && (
          <div className="absolute bottom-6 left-4 z-20 p-3 rounded-lg bg-slate-900/95 border border-rose-600/70 shadow-2xl backdrop-blur-md text-xs font-mono max-w-xs">
            <div className="flex items-center gap-2 text-rose-400 font-bold mb-1.5">
              <Crosshair className="w-4 h-4" />
              <span>TRIANGULATION RESULT</span>
            </div>
            <div className="text-slate-300 text-[11px] mb-1">
              Nearest Node: <span className="font-bold text-white">{nearestDistanceInfo.camera.name}</span>
            </div>
            <div className="text-slate-300 text-[11px] mb-2">
              Geodesic Distance: <span className="font-bold text-emerald-400">{nearestDistanceInfo.meters} meters</span>
            </div>
            <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-1.5">
              Travel ETA unavailable (Terrain & transport speed model not configured)
            </div>
          </div>
        )}

        {/* Right Tactical Sidebar */}
        <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col z-10">
          {/* Selected Camera Details Card */}
          {selectedCam ? (
            <div className="p-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono font-bold text-sm text-slate-100">{selectedCam.name}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  selectedCam.status === 'ONLINE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                }`}>
                  {selectedCam.status}
                </span>
              </div>

              <div className="space-y-1.5 text-xs font-mono text-slate-300 mb-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Sector:</span>
                  <span>{selectedCam.sector || 'Unassigned'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Profile:</span>
                  <span>{selectedCam.profile}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Position:</span>
                  {selectedCam.latitude != null ? (
                    <span className="text-emerald-400">{selectedCam.latitude.toFixed(4)}, {selectedCam.longitude.toFixed(4)}</span>
                  ) : (
                    <span className="text-amber-400">Location not configured</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Coverage:</span>
                  {selectedCam.direction != null ? (
                    <span>{selectedCam.direction}° @ {selectedCam.range_meters || 150}m</span>
                  ) : (
                    <span className="text-amber-400">Coverage not configured</span>
                  )}
                </div>
              </div>

              {/* Live Mini Preview */}
              <div className="relative rounded overflow-hidden aspect-video bg-black border border-slate-800 mb-3">
                <img 
                  src={getCameraStreamUrl(selectedCam.camera_id)} 
                  alt={selectedCam.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="hidden absolute inset-0 items-center justify-center bg-slate-950 text-slate-500 text-[11px] font-mono">
                  Stream Standby
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleStartCalibration(selectedCam)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>Calibrate</span>
                </button>
                {onNavigateToCameras && (
                  <button
                    onClick={() => onNavigateToCameras(selectedCam.camera_id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-semibold transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Feed</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 border-b border-slate-800 text-xs font-mono text-slate-400 text-center">
              Click on any camera marker on the map to inspect live optics and coordinates.
            </div>
          )}

          {/* Calibrated Cameras List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-300">
              <span>SURVEILLANCE NODES</span>
              <span className="text-slate-500">{cameras.length} Active</span>
            </div>

            <div className="space-y-2">
              {cameras.map(c => {
                const hasGps = c.latitude != null && c.longitude != null;
                return (
                  <div 
                    key={c.camera_id}
                    onClick={() => {
                      setSelectedCam(c);
                      if (hasGps && mapInstanceRef.current) {
                        mapInstanceRef.current.flyTo([c.latitude, c.longitude], 16);
                      }
                    }}
                    className={`p-2.5 rounded border text-xs font-mono cursor-pointer transition-colors ${
                      selectedCam?.camera_id === c.camera_id 
                        ? 'bg-slate-800 border-blue-500/80 text-white' 
                        : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-850 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-200">{c.name}</span>
                      <span className={`w-2 h-2 rounded-full ${c.status === 'ONLINE' ? 'bg-emerald-400' : 'bg-rose-500'}`} />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{c.sector || 'Sector Alpha'}</span>
                      {hasGps ? (
                        <span className="text-emerald-400">Calibrated ({c.direction || 0}°)</span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Location not set
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Unconfigured Alert Drawer */}
            {unconfiguredCameras.length > 0 && (
              <div className="mt-4 p-3 rounded bg-amber-950/30 border border-amber-800/60 text-xs font-mono">
                <div className="flex items-center gap-2 text-amber-300 font-bold mb-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Uncalibrated Nodes ({unconfiguredCameras.length})</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2.5">
                  The following cameras lack geographic coordinates:
                </p>
                <div className="space-y-1.5">
                  {unconfiguredCameras.map(uc => (
                    <div key={uc.camera_id} className="flex items-center justify-between text-[11px] bg-slate-900/90 p-1.5 rounded border border-slate-800">
                      <span className="text-slate-300 truncate max-w-[140px]">{uc.name}</span>
                      <button
                        onClick={() => handleStartCalibration(uc)}
                        className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-[10px]"
                      >
                        Place
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal: Register New Camera Placed on Map */}
        {newCamData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono text-xs">
            <div className="bg-slate-900 border border-emerald-500/60 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <Camera className="w-4 h-4" />
                  <span>REGISTER CAMERA ON MAP</span>
                </div>
                <button onClick={() => setNewCamData(null)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-emerald-400">
                Coordinates: {newCamData.latitude.toFixed(6)}, {newCamData.longitude.toFixed(6)}
              </div>

              <form onSubmit={handleCreateNewCamOnMap} className="space-y-3">
                <div>
                  <label className="block text-slate-400 mb-1">Camera Name:</label>
                  <input
                    type="text"
                    required
                    value={newCamData.name}
                    onChange={e => setNewCamData({ ...newCamData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Stream Source (RTSP URL or Device Index '0'):</label>
                  <input
                    type="text"
                    required
                    value={newCamData.rtsp_url}
                    onChange={e => setNewCamData({ ...newCamData, rtsp_url: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Sector:</label>
                    <input
                      type="text"
                      value={newCamData.sector}
                      onChange={e => setNewCamData({ ...newCamData, sector: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Azimuth Heading (°):</label>
                    <input
                      type="number"
                      min="0"
                      max="359"
                      value={newCamData.direction}
                      onChange={e => setNewCamData({ ...newCamData, direction: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">FOV Aperture (°):</label>
                    <input
                      type="number"
                      min="15"
                      max="120"
                      value={newCamData.fov_degrees}
                      onChange={e => setNewCamData({ ...newCamData, fov_degrees: parseInt(e.target.value) || 60 })}
                      className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Range (Meters):</label>
                    <input
                      type="number"
                      min="30"
                      max="500"
                      value={newCamData.range_meters}
                      onChange={e => setNewCamData({ ...newCamData, range_meters: parseInt(e.target.value) || 150 })}
                      className="w-full bg-slate-950 border border-slate-800 p-2 rounded text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setNewCamData(null)}
                    className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingCam}
                    className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition disabled:opacity-50"
                  >
                    {creatingCam ? 'Deploying...' : 'Deploy Camera'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
