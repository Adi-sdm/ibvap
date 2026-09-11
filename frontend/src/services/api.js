const API_BASE = '/api';

async function handleResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    let errorDetail = res.statusText || `HTTP ${res.status}`;
    if (contentType.includes('application/json')) {
      try {
        const data = await res.json();
        errorDetail = data.detail || data.message || JSON.stringify(data);
      } catch (_) {}
    } else {
      try {
        const text = await res.text();
        if (text && text.length < 200) errorDetail = text;
      } catch (_) {}
    }
    throw new Error(errorDetail);
  }
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

// Cameras & Dynamic Profiles
export const getCameras = () => fetch(`${API_BASE}/cameras`).then(handleResponse);
export const createCamera = (data) => fetch(`${API_BASE}/cameras`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(handleResponse);
export const updateCameraConfig = (cameraId, config) => fetch(`${API_BASE}/cameras/${cameraId}/config`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(config) }).then(handleResponse);
export const testCameraConnection = (rtsp_url) => fetch(`${API_BASE}/cameras/test-connection`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({rtsp_url}) }).then(handleResponse);
export const deleteCamera = (id) => fetch(`${API_BASE}/cameras/${id}`, { method: 'DELETE' }).then(handleResponse);
export const getCameraHealth = (id) => fetch(`${API_BASE}/cameras/${id}/health`).then(handleResponse);
export const startCamera = (id) => fetch(`${API_BASE}/cameras/${id}/start`, { method: 'POST' }).then(handleResponse);
export const stopCamera = (id) => fetch(`${API_BASE}/cameras/${id}/stop`, { method: 'POST' }).then(handleResponse);
export const getCameraStreamUrl = (id, annotated = true) => `${API_BASE}/cameras/${id}/stream?annotated=${annotated ? '1' : '0'}`;
export const getProfiles = () => fetch(`${API_BASE}/profiles`).then(handleResponse);

// Incidents & Dual Reasoning Events
export const getEvents = (offset = 0, limit = 25, source = null, status = null, recentOnly = false) => {
  let url = `${API_BASE}/events?offset=${offset}&limit=${limit}`;
  if (source) url += `&source=${encodeURIComponent(source)}`;
  if (status) url += `&status=${encodeURIComponent(status)}`;
  if (recentOnly) url += `&recent_only=true`;
  return fetch(url).then(handleResponse);
};
export const getEvent = (id) => fetch(`${API_BASE}/events/${id}`).then(handleResponse);
export const updateEventStatus = (id, status) => fetch(`${API_BASE}/events/${id}/status`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({status}) }).then(handleResponse);
export const updateEventFeedback = (id, feedback, notes) => fetch(`${API_BASE}/events/${id}/feedback`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({feedback, notes}) }).then(handleResponse);
export const consultGemini = (eventId) => fetch(`${API_BASE}/events/${eventId}/consult-gemini`, { method: 'POST' }).then(handleResponse);

// ANPR & Vehicle Intelligence
export const getANPR = (offset = 0, limit = 25) => fetch(`${API_BASE}/anpr?offset=${offset}&limit=${limit}`).then(handleResponse);
export const getAuthorizedVehicles = () => fetch(`${API_BASE}/vehicles/authorized`).then(handleResponse);
export const createAuthorizedVehicle = (data) => fetch(`${API_BASE}/vehicles/authorized`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(handleResponse);
export const deleteAuthorizedVehicle = (plate) => fetch(`${API_BASE}/vehicles/authorized/${encodeURIComponent(plate)}`, { method: 'DELETE' }).then(handleResponse);
export const verifyVehicleIntel = (plate, detected_color, sector) => fetch(`${API_BASE}/vehicles/verify`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ plate, detected_color, sector }) }).then(handleResponse);
export const getVehicleHandoff = (cameraId) => fetch(`${API_BASE}/vehicles/handoff?camera_id=${encodeURIComponent(cameraId)}`).then(handleResponse);
export const getVehicleCorridors = () => fetch(`${API_BASE}/vehicles/corridors`).then(handleResponse);

// Authorized Personnel
export const getAuthorizedPersonnel = () => fetch(`${API_BASE}/personnel/authorized`).then(handleResponse);
export const createAuthorizedPerson = (data) => fetch(`${API_BASE}/personnel/authorized`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(handleResponse);
export const deleteAuthorizedPerson = (id) => fetch(`${API_BASE}/personnel/authorized/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(handleResponse);

// Virtual Geofence Zones
export const getZones = (cameraId) => fetch(`${API_BASE}/zones${cameraId ? '?camera_id=' + cameraId : ''}`).then(handleResponse);
export const createZone = (data) => fetch(`${API_BASE}/zones`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(handleResponse);
export const saveZone = createZone;
export const deleteZone = (id) => fetch(`${API_BASE}/zones/${id}`, { method: 'DELETE' }).then(handleResponse);

// Gemini Advisory Configuration
export const getGeminiStatus = () => fetch(`${API_BASE}/ai/gemini/status`).then(handleResponse);
export const updateGeminiConfig = (config) => fetch(`${API_BASE}/ai/gemini/config`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(config) }).then(handleResponse);
export const testGeminiConnection = (req = {}) => fetch(`${API_BASE}/ai/gemini/test`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(req) }).then(handleResponse);
export const toggleGemini = () => fetch(`${API_BASE}/ai/gemini/toggle`, { method: 'POST' }).then(handleResponse);
export const clearGeminiCredentials = () => fetch(`${API_BASE}/ai/gemini/config`, { method: 'DELETE' }).then(handleResponse);

// Platform Settings & Models
export const getSystemSettings = () => fetch(`${API_BASE}/settings`).then(handleResponse);
export const updateSystemSettings = (config) => fetch(`${API_BASE}/settings`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(config) }).then(handleResponse);
export const getSensitivity = getSystemSettings;
export const updateSensitivity = updateSystemSettings;
export const getAIModels = () => fetch(`${API_BASE}/ai/models`).then(handleResponse);

// System Telemetry & Mode
export const getSystemMode = () => fetch(`${API_BASE}/system/mode`).then(handleResponse);
export const getSystemStats = (source = null) => {
  let url = `${API_BASE}/system/stats`;
  if (source) url += `?source=${encodeURIComponent(source)}`;
  return fetch(url).then(handleResponse);
};
export const startDemo = () => fetch(`${API_BASE}/demo/start`, { method: 'POST' }).then(handleResponse);
export const stopDemo = () => fetch(`${API_BASE}/demo/stop`, { method: 'POST' }).then(handleResponse);

// Evidence Vault & Forensic Dossier
export const getEvidence = (cameraId = '', search = '', offset = 0, limit = 25) => {
  let url = `${API_BASE}/evidence?offset=${offset}&limit=${limit}`;
  if (cameraId) url += `&camera_id=${encodeURIComponent(cameraId)}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  return fetch(url).then(handleResponse);
};
export const getIncidentDossier = (eventId) => fetch(`${API_BASE}/evidence/${eventId}/dossier`).then(handleResponse);

// Activity Timeline & Behavioral AI
export const getActivityTimeline = (limit = 30) => fetch(`${API_BASE}/system/timeline?limit=${limit}`).then(handleResponse);
export const getAIAnalysis = () => fetch(`${API_BASE}/ai/analysis`).then(handleResponse);
export const getCameraActivityAnalysis = (cameraId) => fetch(`${API_BASE}/cameras/${encodeURIComponent(cameraId)}/activity-analysis`).then(handleResponse);
export const getAuditLog = () => fetch(`${API_BASE}/audit-log`).then(r => r.ok ? r.json() : []).catch(() => []);
export const createAuditLog = (data) => fetch(`${API_BASE}/audit-log`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(handleResponse);
export const verifyPrivilegedAction = (data) => fetch(`${API_BASE}/auth/verify-privileged`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(handleResponse);

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

// Deployment Architecture, Readiness & Configuration
export const getSystemStatus = () => fetch(`${API_BASE}/system/status`).then(handleResponse);
export const initializeSystem = () => fetch(`${API_BASE}/system/initialize`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}' }).then(handleResponse);
export const resetToClean = (payload) => fetch(`${API_BASE}/system/reset-clean`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }).then(handleResponse);
export const getSystemReadiness = () => fetch(`${API_BASE}/system/readiness`).then(handleResponse);
export const exportConfiguration = () => fetch(`${API_BASE}/config/export`).then(handleResponse);
export const importConfiguration = (configuration) => fetch(`${API_BASE}/config/import`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ configuration }) }).then(handleResponse);
export const getConfigHistory = (limit = 50) => fetch(`${API_BASE}/config/history?limit=${limit}`).then(handleResponse);
export const setCameraMaintenance = (cameraId, payload) => fetch(`${API_BASE}/cameras/${encodeURIComponent(cameraId)}/maintenance`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) }).then(handleResponse);
export const setEmergencyMode = (emergency_mode, officer = 'Senior Supervisor', justification = 'Tactical threat escalation') => fetch(`${API_BASE}/system/emergency-mode`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ emergency_mode, officer, justification }) }).then(handleResponse);

// Operational Sectors
export const getSectors = () => fetch(`${API_BASE}/sectors`).then(handleResponse);
export const createSector = (data) => fetch(`${API_BASE}/sectors`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(handleResponse);
export const deleteSector = (id) => fetch(`${API_BASE}/sectors/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(handleResponse);
