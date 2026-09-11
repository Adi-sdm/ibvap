const API_BASE = '/api';

// Cameras & Dynamic Profiles
export const getCameras = () => fetch(`${API_BASE}/cameras`).then(r => r.json());
export const createCamera = (data) => fetch(`${API_BASE}/cameras`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(r => r.json());
export const updateCameraConfig = (cameraId, config) => fetch(`${API_BASE}/cameras/${cameraId}/config`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(config) }).then(r => r.json());
export const testCameraConnection = (rtsp_url) => fetch(`${API_BASE}/cameras/test-connection`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({rtsp_url}) }).then(r => r.json());
export const deleteCamera = (id) => fetch(`${API_BASE}/cameras/${id}`, { method: 'DELETE' }).then(r => r.json());
export const getCameraHealth = (id) => fetch(`${API_BASE}/cameras/${id}/health`).then(r => r.json());
export const startCamera = (id) => fetch(`${API_BASE}/cameras/${id}/start`, { method: 'POST' }).then(r => r.json());
export const stopCamera = (id) => fetch(`${API_BASE}/cameras/${id}/stop`, { method: 'POST' }).then(r => r.json());
export const getCameraStreamUrl = (id, annotated = true) => `${API_BASE}/cameras/${id}/stream?annotated=${annotated ? '1' : '0'}`;
export const getProfiles = () => fetch(`${API_BASE}/profiles`).then(r => r.json());

// Incidents & Dual Reasoning Events
export const getEvents = (offset = 0, limit = 25) => fetch(`${API_BASE}/events?offset=${offset}&limit=${limit}`).then(r => r.json());
export const getEvent = (id) => fetch(`${API_BASE}/events/${id}`).then(r => r.json());
export const updateEventStatus = (id, status) => fetch(`${API_BASE}/events/${id}/status`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({status}) }).then(r => r.json());
export const updateEventFeedback = (id, feedback, notes) => fetch(`${API_BASE}/events/${id}/feedback`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({feedback, notes}) }).then(r => r.json());
export const consultGemini = (eventId) => fetch(`${API_BASE}/events/${eventId}/consult-gemini`, { method: 'POST' }).then(r => r.json());

// ANPR & Vehicle Intelligence
export const getANPR = (offset = 0, limit = 25) => fetch(`${API_BASE}/anpr?offset=${offset}&limit=${limit}`).then(r => r.json());
export const getAuthorizedVehicles = () => fetch(`${API_BASE}/vehicles/authorized`).then(r => r.json());
export const createAuthorizedVehicle = (data) => fetch(`${API_BASE}/vehicles/authorized`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(r => r.json());
export const deleteAuthorizedVehicle = (plate) => fetch(`${API_BASE}/vehicles/authorized/${encodeURIComponent(plate)}`, { method: 'DELETE' }).then(r => r.json());
export const verifyVehicleIntel = (plate, detected_color, sector) => fetch(`${API_BASE}/vehicles/verify`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ plate, detected_color, sector }) }).then(r => r.json());
export const getVehicleHandoff = (cameraId) => fetch(`${API_BASE}/vehicles/handoff?camera_id=${encodeURIComponent(cameraId)}`).then(r => r.json());

// Authorized Personnel
export const getAuthorizedPersonnel = () => fetch(`${API_BASE}/personnel/authorized`).then(r => r.json());
export const createAuthorizedPerson = (data) => fetch(`${API_BASE}/personnel/authorized`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(r => r.json());
export const deleteAuthorizedPerson = (id) => fetch(`${API_BASE}/personnel/authorized/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(r => r.json());

// Virtual Geofence Zones
export const getZones = (cameraId) => fetch(`${API_BASE}/zones${cameraId ? '?camera_id=' + cameraId : ''}`).then(r => r.json());
export const createZone = (data) => fetch(`${API_BASE}/zones`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(r => r.json());
export const saveZone = createZone;
export const deleteZone = (id) => fetch(`${API_BASE}/zones/${id}`, { method: 'DELETE' }).then(r => r.json());

// Gemini Advisory Configuration
export const getGeminiStatus = () => fetch(`${API_BASE}/ai/gemini/status`).then(r => r.json());
export const updateGeminiConfig = (config) => fetch(`${API_BASE}/ai/gemini/config`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(config) }).then(r => r.json());
export const testGeminiConnection = (req = {}) => fetch(`${API_BASE}/ai/gemini/test`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(req) }).then(r => r.json());
export const toggleGemini = () => fetch(`${API_BASE}/ai/gemini/toggle`, { method: 'POST' }).then(r => r.json());
export const clearGeminiCredentials = () => fetch(`${API_BASE}/ai/gemini/config`, { method: 'DELETE' }).then(r => r.json());

// Platform Settings & Models
export const getSystemSettings = () => fetch(`${API_BASE}/settings`).then(r => r.json());
export const updateSystemSettings = (config) => fetch(`${API_BASE}/settings`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(config) }).then(r => r.json());
export const getSensitivity = getSystemSettings;
export const updateSensitivity = updateSystemSettings;
export const getAIModels = () => fetch(`${API_BASE}/ai/models`).then(r => r.json());

// System Telemetry & Mode
export const getSystemMode = () => fetch(`${API_BASE}/system/mode`).then(r => r.json());
export const getSystemStats = () => fetch(`${API_BASE}/system/stats`).then(r => r.json());
export const startDemo = () => fetch(`${API_BASE}/demo/start`, { method: 'POST' }).then(r => r.json());
export const stopDemo = () => fetch(`${API_BASE}/demo/stop`, { method: 'POST' }).then(r => r.json());

// Evidence Vault & Forensic Dossier
export const getEvidence = (cameraId = '', search = '', offset = 0, limit = 25) => {
  let url = `${API_BASE}/evidence?offset=${offset}&limit=${limit}`;
  if (cameraId) url += `&camera_id=${encodeURIComponent(cameraId)}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  return fetch(url).then(r => r.json());
};
export const getIncidentDossier = (eventId) => fetch(`${API_BASE}/evidence/${eventId}/dossier`).then(r => r.json());

// Activity Timeline & Behavioral AI
export const getActivityTimeline = (limit = 30) => fetch(`${API_BASE}/system/timeline?limit=${limit}`).then(r => r.json());
export const getAIAnalysis = () => fetch(`${API_BASE}/ai/analysis`).then(r => r.json());
export const getCameraActivityAnalysis = (cameraId) => fetch(`${API_BASE}/cameras/${encodeURIComponent(cameraId)}/activity-analysis`).then(r => r.json());
export const getAuditLog = () => fetch(`${API_BASE}/audit-log`).then(r => r.ok ? r.json() : []);
export const createAuditLog = (data) => fetch(`${API_BASE}/audit-log`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(r => r.json());

// WebSocket Live Telemetry
export function connectWebSocket(onMessage) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/events`;
  let ws = null;
  let reconnectTimer = null;
  
  function connect() {
    ws = new WebSocket(wsUrl);
    ws.onopen = () => onMessage({ type: 'WS_CONNECTED' });
    ws.onclose = () => {
      onMessage({ type: 'WS_DISCONNECTED' });
      reconnectTimer = setTimeout(connect, 3000);
    };
    ws.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data)); } catch {}
    };
  }
  
  connect();
  return () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) ws.close();
  };
}