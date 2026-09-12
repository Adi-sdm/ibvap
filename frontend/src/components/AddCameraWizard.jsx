import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { 
  Camera, 
  X, 
  Play, 
  Check, 
  AlertTriangle, 
  ChevronRight, 
  ChevronLeft,
  Radio, 
  HardDrive, 
  CheckCircle2, 
  RefreshCw, 
  Server,
  Navigation,
  MapPin,
  Search,
  Crosshair,
  LocateFixed,
  Compass
} from 'lucide-react';
import { testCameraConnection, createCamera, getSectors } from '../services/api';

const PROFILE_TEMPLATES = {
  'Border Fence Monitoring': {
    alert_threshold: 60,
    modules: {
      intrusion: true,
      loitering: true,
      direction: true,
      group: true,
      animal_filter: true,
      anpr: false,
      small_arms: false,
      day_night: true
    }
  },
  'Checkpoint Monitoring': {
    alert_threshold: 50,
    modules: {
      intrusion: true,
      loitering: true,
      direction: true,
      group: true,
      animal_filter: true,
      anpr: true,
      small_arms: false,
      day_night: true
    }
  },
  'Vehicle Inspection': {
    alert_threshold: 40,
    modules: {
      intrusion: false,
      loitering: false,
      direction: true,
      group: false,
      animal_filter: false,
      anpr: true,
      small_arms: false,
      day_night: true
    }
  },
  'Sensitive Sector': {
    alert_threshold: 40,
    modules: {
      intrusion: true,
      loitering: true,
      direction: true,
      group: true,
      animal_filter: true,
      anpr: true,
      small_arms: false,
      day_night: true
    }
  },
  'Custom': {
    alert_threshold: 60,
    modules: {
      intrusion: true,
      loitering: true,
      direction: true,
      group: true,
      animal_filter: true,
      anpr: true,
      small_arms: false,
      day_night: true
    }
  }
};

const STEP_LABELS = [
  "Source",
  "Connection Test",
  "Identity",
  "GIS Placement",
  "Optics",
  "AI Profile",
  "Review",
  "Deploy"
];

export default function AddCameraWizard({ onClose, onComplete }) {
  const [step, setStep] = useState(1);
  
  // Step 1: Source
  const [sourceType, setSourceType] = useState('webcam'); // 'webcam', 'rtsp', 'onvif', 'file'
  const [rtspUrl, setRtspUrl] = useState('0');

  // Step 2: Connection Test
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState('');
  const [latencyMs, setLatencyMs] = useState(null);

  // Step 3: Identity
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [sector, setSector] = useState('');
  const [availableSectors, setAvailableSectors] = useState([]);

  // Step 4: GIS
  const [skipLocation, setSkipLocation] = useState(false);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [gisMode, setGisMode] = useState('manual'); // 'manual', 'gps', 'map', 'search'
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [gpsDetecting, setGpsDetecting] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }
    setGpsDetecting(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsDetecting(false);
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setGpsAccuracy(Math.round(pos.coords.accuracy));
      },
      (err) => {
        setGpsDetecting(false);
        setGpsError(err.message || "Failed to retrieve device GPS coordinates.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSearchLocation = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.trim())}`);
      const items = await res.json();
      setSearchResults(items.slice(0, 5) || []);
    } catch (err) {
      console.error("Geocoding failed:", err);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (step === 4 && gisMode === 'map' && mapContainerRef.current) {
      const initLat = parseFloat(latitude) || 28.6139;
      const initLng = parseFloat(longitude) || 77.2090;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current).setView([initLat, initLng], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        const customIcon = L.divIcon({
          className: 'custom-cam-pin',
          html: `<div style="background:#10b981;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 10px rgba(16,185,129,0.8);"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });

        const marker = L.marker([initLat, initLng], { draggable: true, icon: customIcon }).addTo(map);
        marker.on('dragend', (e) => {
          const latlng = e.target.getLatLng();
          setLatitude(latlng.lat.toFixed(6));
          setLongitude(latlng.lng.toFixed(6));
        });

        map.on('click', (e) => {
          marker.setLatLng(e.latlng);
          setLatitude(e.latlng.lat.toFixed(6));
          setLongitude(e.latlng.lng.toFixed(6));
        });

        markerRef.current = marker;
        mapInstanceRef.current = map;
      } else {
        mapInstanceRef.current.setView([initLat, initLng]);
        if (markerRef.current) markerRef.current.setLatLng([initLat, initLng]);
      }

      setTimeout(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      }, 250);
    }

    return () => {
      if (mapInstanceRef.current && (step !== 4 || gisMode !== 'map')) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [step, gisMode]);

  // Step 5: Optics
  const [direction, setDirection] = useState(0); // 0-360 deg
  const [fovDegrees, setFovDegrees] = useState(60); // 15-120 deg
  const [rangeMeters, setRangeMeters] = useState(150); // 30-500m

  // Step 6: AI Profile
  const [profile, setProfile] = useState('Border Fence Monitoring');
  const [alertThreshold, setAlertThreshold] = useState(60);
  const [geminiEnabled, setGeminiEnabled] = useState(true);
  const [enabledModules, setEnabledModules] = useState(PROFILE_TEMPLATES['Border Fence Monitoring'].modules);

  // Step 8: Save & Deploy
  const [deploying, setDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [deployError, setDeployError] = useState('');

  useEffect(() => {
    getSectors().then(res => {
      if (Array.isArray(res)) setAvailableSectors(res.map(s => s.name));
    }).catch(() => {});
  }, []);

  const handleSourceSelect = (type) => {
    setSourceType(type);
    if (type === 'webcam') setRtspUrl('0');
    else if (type === 'rtsp') setRtspUrl('rtsp://192.168.1.100:554/live');
    else if (type === 'onvif') setRtspUrl('http://192.168.1.100:80/onvif/device_service');
    else if (type === 'file') setRtspUrl('demo/videos/border_intrusion.mp4');
    setTestResult(null);
    setTestError('');
  };

  const handleTestConnection = async () => {
    if (!rtspUrl.trim()) return;
    setTesting(true);
    setTestError('');
    const startTime = performance.now();
    try {
      const res = await testCameraConnection(rtspUrl.trim());
      const elapsed = Math.round(performance.now() - startTime);
      setLatencyMs(elapsed);
      if (res.success) {
        setTestResult(res);
      } else {
        setTestError(res.message || "Connection failed. Please verify stream endpoint.");
      }
    } catch (err) {
      setTestError(err.message || "Network error. Stream host is unreachable.");
    } finally {
      setTesting(false);
    }
  };

  const handleProfileChange = (newProfile) => {
    setProfile(newProfile);
    const tmpl = PROFILE_TEMPLATES[newProfile];
    if (tmpl) {
      setAlertThreshold(tmpl.alert_threshold);
      setEnabledModules({ ...tmpl.modules });
    }
  };

  const handleModuleToggle = (key) => {
    if (key === 'small_arms') return;
    setEnabledModules(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleDeploy = async () => {
    if (!name.trim()) {
      setDeployError("Camera identity name is required.");
      return;
    }
    setDeploying(true);
    setDeployError('');
    try {
      const payload = {
        name: name.trim(),
        rtsp_url: rtspUrl.trim(),
        location: location.trim() ? location.trim() : "Location not configured",
        sector: sector.trim() ? sector.trim() : "Unassigned Sector",
        profile,
        alert_threshold: alertThreshold,
        gemini_enabled: geminiEnabled,
        enabled_modules: enabledModules,
        latitude: (!skipLocation && latitude !== '') ? parseFloat(latitude) : null,
        longitude: (!skipLocation && longitude !== '') ? parseFloat(longitude) : null,
        direction: parseFloat(direction) || 0.0,
        fov_degrees: parseFloat(fovDegrees) || 60.0,
        range_meters: parseFloat(rangeMeters) || 150.0,
        fps: testResult?.fps || 20.0,
        resolution: testResult ? `${testResult.width}x${testResult.height}` : "800x600",
        is_demo: sourceType === 'file'
      };

      await createCamera(payload);
      setDeploySuccess(true);
      setTimeout(() => {
        onComplete();
      }, 1200);
    } catch (err) {
      setDeployError(err.message || "Failed to persist camera deployment.");
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Provision Surveillance Ingestion Node
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  STEP {step} OF 8
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{STEP_LABELS[step - 1]}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="px-6 pt-4 pb-2 bg-slate-950/30 border-b border-slate-800/60">
          <div className="flex items-center justify-between gap-1">
            {STEP_LABELS.map((label, idx) => (
              <div key={label} className="flex-1 flex flex-col items-center">
                <div 
                  className={`w-full h-1.5 rounded-full transition-all duration-300 ${
                    step > idx + 1 
                      ? 'bg-emerald-500' 
                      : step === idx + 1 
                        ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' 
                        : 'bg-slate-800'
                  }`} 
                />
                <span className={`text-[9px] font-mono mt-1 hidden md:block ${
                  step === idx + 1 ? 'text-emerald-400 font-bold' : 'text-slate-500'
                }`}>
                  {idx + 1}. {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Wizard Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* STEP 1: Source Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Select Ingestion Feed Source</h3>
                <p className="text-xs text-slate-400 mt-1">Specify whether to capture from local USB hardware, network RTSP, ONVIF discovery, or synthetic file.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'webcam', title: 'USB / Integrated Webcam', icon: Camera, desc: 'Hardware index (e.g. 0) via DirectShow' },
                  { id: 'rtsp', title: 'RTSP IP Camera', icon: Radio, desc: 'Network stream (rtsp://ip:port/live)' },
                  { id: 'onvif', title: 'ONVIF Profile S', icon: Server, desc: 'IP security camera service discovery' },
                  { id: 'file', title: 'Video File (DEMO ONLY)', icon: HardDrive, desc: 'Synthetic test clip explicitly marked DEMO' }
                ].map(item => {
                  const Icon = item.icon;
                  const isSelected = sourceType === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSourceSelect(item.id)}
                      className={`p-4 rounded-xl border text-left transition flex flex-col gap-2 ${
                        isSelected 
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-white' 
                          : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />
                        {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                      </div>
                      <span className="font-bold text-xs">{item.title}</span>
                      <span className="text-[11px] text-slate-400">{item.desc}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <label className="text-xs font-mono text-slate-300">
                  {sourceType === 'webcam' ? 'DirectShow Device Index:' : 'Stream Endpoint / Path:'}
                </label>
                <input
                  type="text"
                  value={rtspUrl}
                  onChange={(e) => {
                    setRtspUrl(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder={sourceType === 'webcam' ? '0' : 'rtsp://...'}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-emerald-500 outline-none"
                />
                <p className="text-[11px] text-slate-500">
                  {sourceType === 'webcam' && 'Device index 0 corresponds to the default physical webcam.'}
                  {sourceType === 'rtsp' && 'Supports standard H.264/H.265 RTSP streams over TCP transport.'}
                  {sourceType === 'file' && 'Will be segregated as DEMO mode data in incident dashboards.'}
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: Connection Test */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Ingestion Probe & Connection Test</h3>
                <p className="text-xs text-slate-400 mt-1">Verify stream decode, measure telemetry latency, and validate hardware frame rate.</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono text-slate-400">Target Endpoint:</span>
                  <p className="text-sm font-mono text-emerald-400 font-bold">{rtspUrl}</p>
                </div>
                <button
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 text-xs font-bold transition flex items-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                  {testing ? 'Probing Device...' : 'Run Connection Test'}
                </button>
              </div>

              {testError && (
                <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                  <div>
                    <span className="font-bold">Connection Failed: </span>
                    {testError}
                  </div>
                </div>
              )}

              {testResult && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 relative flex items-center justify-center">
                    {testResult.preview_frame ? (
                      <img 
                        src={`data:image/jpeg;base64,${testResult.preview_frame}`} 
                        alt="Stream Probe Preview" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <span className="text-xs text-slate-500 font-mono">Decoded Frame Preview</span>
                    )}
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-emerald-400 border border-emerald-500/30">
                      PROBE VERIFIED
                    </div>
                  </div>

                  <div className="space-y-2 p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-mono">
                    <div className="text-slate-400 font-bold mb-2 uppercase text-[10px] tracking-wider">Stream Telemetry</div>
                    <div className="flex justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">State:</span>
                      <span className="text-emerald-400 font-bold">ONLINE</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">Resolution:</span>
                      <span className="text-white font-bold">{testResult.width}x{testResult.height}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">Stream FPS:</span>
                      <span className="text-white font-bold">{testResult.fps?.toFixed(1) || '20.0'} FPS</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-900">
                      <span className="text-slate-400">Round-Trip Latency:</span>
                      <span className="text-emerald-400 font-bold">{latencyMs || 15} ms</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Identity */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Camera Identity & Operational Placement</h3>
                <p className="text-xs text-slate-400 mt-1">Provide clear operational naming and sector assignment. No default fake labels.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-mono text-slate-300">Camera Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. South Perimeter Cam 01"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-300">Installation Description / Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Watchtower Post Alpha, Outer Geofence"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none mt-1"
                  />
                  <span className="text-[11px] text-slate-500">Leave blank to truthful display &quot;Location not configured&quot;.</span>
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-300">Operational Sector</label>
                  <input
                    type="text"
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    placeholder="e.g. Sector Alpha"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none mt-1"
                  />
                  {availableSectors.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      <span className="text-[11px] text-slate-500">Existing Sectors:</span>
                      {availableSectors.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSector(s)}
                          className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: GIS Placement */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Geographic Coordinates (GIS)</h3>
                  <p className="text-xs text-slate-400 mt-1">Select placement method to bind ingestion source to tactical GIS coordinates.</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipLocation}
                    onChange={(e) => setSkipLocation(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
                  />
                  <span className="text-xs text-slate-400 font-mono">Skip Location</span>
                </label>
              </div>

              {!skipLocation && (
                <div className="space-y-4">
                  {/* Mode Selector Tabs */}
                  <div className="grid grid-cols-4 gap-2 p-1 rounded-xl bg-slate-950 border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setGisMode('gps')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-mono font-medium transition ${
                        gisMode === 'gps' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>CURRENT GPS</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGisMode('map')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-mono font-medium transition ${
                        gisMode === 'map' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>PICK ON MAP</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGisMode('search')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-mono font-medium transition ${
                        gisMode === 'search' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>SEARCH PLACE</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGisMode('manual')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-mono font-medium transition ${
                        gisMode === 'manual' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>MANUAL INPUT</span>
                    </button>
                  </div>

                  {/* Mode 1: USE CURRENT LOCATION */}
                  {gisMode === 'gps' && (
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-mono text-emerald-400 uppercase font-semibold">Device Hardware Geolocation</span>
                          <p className="text-[11px] text-slate-400 mt-0.5">Poll device GPS or network triangulation sensor.</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleDetectGPS}
                          disabled={gpsDetecting}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-mono font-bold transition flex items-center gap-2"
                        >
                          <LocateFixed className={`w-3.5 h-3.5 ${gpsDetecting ? 'animate-spin' : ''}`} />
                          <span>{gpsDetecting ? 'Detecting...' : 'Detect Coordinates'}</span>
                        </button>
                      </div>

                      {gpsError && (
                        <div className="text-xs text-rose-400 font-mono bg-rose-500/10 border border-rose-500/20 p-2 rounded">
                          {gpsError}
                        </div>
                      )}

                      {gpsAccuracy !== null && (
                        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>GPS Locked: Precision ±{gpsAccuracy} meters accuracy</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mode 2: PICK ON MAP */}
                  {gisMode === 'map' && (
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                        <span>Click map or drag the green marker to position camera node.</span>
                        <span className="text-emerald-400 font-bold">
                          {latitude && longitude ? `${latitude}, ${longitude}` : 'No point chosen'}
                        </span>
                      </div>
                      <div 
                        ref={mapContainerRef} 
                        className="w-full h-56 rounded-lg overflow-hidden border border-slate-800 z-10"
                      />
                    </div>
                  )}

                  {/* Mode 3: SEARCH LOCATION */}
                  {gisMode === 'search' && (
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                      <form onSubmit={handleSearchLocation} className="flex gap-2">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search border post, outpost, district, or landmark..."
                          className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 font-mono outline-none focus:border-emerald-500"
                        />
                        <button
                          type="submit"
                          disabled={searching}
                          className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-mono font-bold transition flex items-center gap-1.5"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>{searching ? 'Searching...' : 'Search'}</span>
                        </button>
                      </form>

                      {searchResults.length > 0 && (
                        <div className="divide-y divide-slate-800/80 rounded-lg border border-slate-800 bg-slate-900/60 overflow-hidden max-h-40 overflow-y-auto">
                          {searchResults.map((res, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setLatitude(parseFloat(res.lat).toFixed(6));
                                setLongitude(parseFloat(res.lon).toFixed(6));
                                setSearchResults([]);
                              }}
                              className="w-full p-2.5 text-left text-xs hover:bg-slate-800/60 transition flex items-start justify-between gap-2"
                            >
                              <span className="text-slate-200 line-clamp-1">{res.display_name}</span>
                              <span className="text-[10px] font-mono text-emerald-400 shrink-0">
                                {parseFloat(res.lat).toFixed(4)}, {parseFloat(res.lon).toFixed(4)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Active Coordinate Inputs (always accessible and editable) */}
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-mono text-slate-400">Latitude (°N)</label>
                        <input
                          type="number"
                          step="0.000001"
                          value={latitude}
                          onChange={(e) => setLatitude(e.target.value)}
                          placeholder="e.g. 26.604700"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-emerald-500 outline-none mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-mono text-slate-400">Longitude (°E)</label>
                        <input
                          type="number"
                          step="0.000001"
                          value={longitude}
                          onChange={(e) => setLongitude(e.target.value)}
                          placeholder="e.g. 84.936000"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-emerald-500 outline-none mt-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Optics */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-white">Optical Geometry & Field-of-View (FOV)</h3>
                <p className="text-xs text-slate-400 mt-1">Configure the physical camera heading and effective visual surveillance cone.</p>
              </div>

              <div className="space-y-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-400">Azimuth Compass Heading:</span>
                    <span className="text-emerald-400 font-bold">{direction}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="359"
                    value={direction}
                    onChange={(e) => setDirection(parseInt(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-400">Field of View Aperture (FOV):</span>
                    <span className="text-emerald-400 font-bold">{fovDegrees}°</span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="120"
                    value={fovDegrees}
                    onChange={(e) => setFovDegrees(parseInt(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-slate-400">Effective Optical Range:</span>
                    <span className="text-emerald-400 font-bold">{rangeMeters} Meters</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="500"
                    step="10"
                    value={rangeMeters}
                    onChange={(e) => setRangeMeters(parseInt(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: AI Profile */}
          {step === 6 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Surveillance Profile & Cognitive Modules</h3>
                <p className="text-xs text-slate-400 mt-1">Assign operational detection presets and active behavior analysis rules.</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.keys(PROFILE_TEMPLATES).map(p => (
                  <button
                    key={p}
                    onClick={() => handleProfileChange(p)}
                    className={`p-3 rounded-xl border text-left text-xs font-bold transition ${
                      profile === p 
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-white' 
                        : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">Enabled Analytical Modules</span>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(enabledModules).map(([key, isEnabled]) => (
                    <label key={key} className={`flex items-center gap-2 p-2 rounded border text-xs cursor-pointer ${
                      key === 'small_arms' ? 'opacity-50 cursor-not-allowed border-slate-900 bg-slate-950' : 'border-slate-800 bg-slate-900'
                    }`}>
                      <input
                        type="checkbox"
                        disabled={key === 'small_arms'}
                        checked={isEnabled}
                        onChange={() => handleModuleToggle(key)}
                        className="rounded border-slate-700 bg-slate-950 text-emerald-500"
                      />
                      <span className="capitalize">{key.replace('_', ' ')}</span>
                      {key === 'small_arms' && <span className="text-[9px] text-amber-400 font-mono ml-auto">UNAVAILABLE</span>}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: Review */}
          {step === 7 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Review Node Configuration</h3>
                <p className="text-xs text-slate-400 mt-1">Confirm parameters before deploying and launching real-time AI ingestion pipeline.</p>
              </div>

              <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs font-mono">
                <div className="grid grid-cols-2 gap-4 border-b border-slate-900 pb-3">
                  <div>
                    <span className="text-slate-500 block">Name:</span>
                    <span className="text-white font-bold">{name || '(Unspecified)'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Source:</span>
                    <span className="text-emerald-400 font-bold">{rtspUrl} ({sourceType.toUpperCase()})</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Sector:</span>
                    <span className="text-white font-bold">{sector || 'Unassigned'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Location:</span>
                    <span className="text-white font-bold">{location || 'Location not configured'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 border-b border-slate-900 pb-3">
                  <div>
                    <span className="text-slate-500 block">GIS Coordinates:</span>
                    <span className="text-white font-bold">
                      {skipLocation || !latitude ? 'Not configured' : `${latitude}, ${longitude}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Azimuth / FOV:</span>
                    <span className="text-white font-bold">{direction}° / {fovDegrees}°</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Range:</span>
                    <span className="text-white font-bold">{rangeMeters} m</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block mb-1">Active AI Profile:</span>
                  <span className="text-emerald-400 font-bold">{profile} (Threshold: {alertThreshold})</span>
                </div>
              </div>

              {deployError && (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-200 text-xs">
                  {deployError}
                </div>
              )}
            </div>
          )}

          {/* STEP 8: Deploy Confirmation */}
          {step === 8 && (
            <div className="py-8 text-center space-y-4">
              {deploySuccess ? (
                <div className="space-y-3">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-white">Node Deployed Successfully</h3>
                  <p className="text-xs text-slate-400">Surveillance pipeline initialized. Streaming to operational sector grid.</p>
                </div>
              ) : (
                <div className="space-y-4 max-w-sm mx-auto">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
                    <Play className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Ready to Deploy Node</h3>
                    <p className="text-xs text-slate-400 mt-1">Persist configuration to SQLite and launch live ingestion.</p>
                  </div>
                  <button
                    onClick={handleDeploy}
                    disabled={deploying}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    {deploying ? 'Deploying & Initializing...' : 'Deploy Ingestion Node'}
                  </button>
                  {deployError && (
                    <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-200 text-xs text-left">
                      {deployError}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            onClick={() => setStep(prev => Math.max(1, prev - 1))}
            disabled={step === 1 || deploying || deploySuccess}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:pointer-events-none text-xs font-bold transition flex items-center gap-1.5"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          {step < 8 ? (
            <button
              onClick={() => {
                if (step === 3 && !name.trim()) {
                  setDeployError("Camera identity name is required.");
                  return;
                }
                setDeployError('');
                setStep(prev => Math.min(8, prev + 1));
              }}
              className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/10"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onClose}
              disabled={deploying}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
            >
              Close
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
