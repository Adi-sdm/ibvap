const API_BASE = '/api';

// Cameras
export const getCameras = () => fetch(`${API_BASE}/cameras`).then(r => r.json());
export const createCamera = (data) => fetch(`${API_BASE}/cameras`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(r => r.json());
export const testCameraConnection = (rtsp_url) => fetch(`${API_BASE}/cameras/test-connection`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({rtsp_url}) }).then(r => r.json());
export const deleteCamera = (id) => fetch(`${API_BASE}/cameras/${id}`, { method: 'DELETE' }).then(r => r.json());
export const getCameraHealth = (id) => fetch(`${API_BASE}/cameras/${id}/health`).then(r => r.json());
export const startCamera = (id) => fetch(`${API_BASE}/cameras/${id}/start`, { method: 'POST' }).then(r => r.json());
export const stopCamera = (id) => fetch(`${API_BASE}/cameras/${id}/stop`, { method: 'POST' }).then(r => r.json());
export const getCameraStreamUrl = (id) => `${API_BASE}/cameras/${id}/stream`;

// Events
export const getEvents = (offset = 0, limit = 25) => fetch(`${API_BASE}/events?offset=${offset}&limit=${limit}`).then(r => r.json());
export const getEvent = (id) => fetch(`${API_BASE}/events/${id}`).then(r => r.json());
export const updateEventStatus = (id, status) => fetch(`${API_BASE}/events/${id}/status`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({status}) }).then(r => r.json());
export const updateEventFeedback = (id, feedback, notes) => fetch(`${API_BASE}/events/${id}/feedback`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({feedback, notes}) }).then(r => r.json());

// ANPR
export const getANPR = (offset = 0, limit = 25) => fetch(`${API_BASE}/anpr?offset=${offset}&limit=${limit}`).then(r => r.json());

// Zones
export const getZones = (cameraId) => fetch(`${API_BASE}/zones${cameraId ? '?camera_id=' + cameraId : ''}`).then(r => r.json());
export const createZone = (data) => fetch(`${API_BASE}/zones`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) }).then(r => r.json());
export const saveZone = createZone;
export const deleteZone = (id) => fetch(`${API_BASE}/zones/${id}`, { method: 'DELETE' }).then(r => r.json());

// System
export const getSystemMode = () => fetch(`${API_BASE}/system/mode`).then(r => r.json());
export const getSystemStats = () => fetch(`${API_BASE}/system/stats`).then(r => r.json());
export const startDemo = () => fetch(`${API_BASE}/demo/start`, { method: 'POST' }).then(r => r.json());
export const stopDemo = () => fetch(`${API_BASE}/demo/stop`, { method: 'POST' }).then(r => r.json());

// Evidence Vault
export const getEvidence = (cameraId = '', search = '', offset = 0, limit = 25) => {
  let url = `${API_BASE}/evidence?offset=${offset}&limit=${limit}`;
  if (cameraId) url += `&camera_id=${encodeURIComponent(cameraId)}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  return fetch(url).then(r => r.json());
};

// Activity Timeline
export const getActivityTimeline = (limit = 30) => fetch(`${API_BASE}/system/timeline?limit=${limit}`).then(r => r.json());

// AI Analysis
export const getAIAnalysis = () => fetch(`${API_BASE}/ai/analysis`).then(r => r.json());

// Sensitivity Settings
export const getSensitivity = () => fetch(`${API_BASE}/settings/sensitivity`).then(r => r.json());
export const updateSensitivity = (config) => fetch(`${API_BASE}/settings/sensitivity`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(config) }).then(r => r.json());

// Audit Log
export const getAuditLog = () => fetch(`${API_BASE}/audit-log`).then(r => r.json());


// WebSocket
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