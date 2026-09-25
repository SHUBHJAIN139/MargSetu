/**
 * MargSetu RealAdapter
 * Spec Reference: DESIGN.md (FINAL v2) §5
 * Connects directly to FastAPI backend on http://localhost:8000
 */

import { createResponse } from './types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const RealAdapter = {
  async evaluateRoutes(params = {}) {
    const res = await fetch(`${BASE_URL}/routes/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`FastAPI routes error: ${res.status}`);
    const data = await res.json();
    return createResponse(data, 'LIVE API');
  },

  async submitIncident(report) {
    const payload = {
      user_id_hash: report.user_id_hash || `user_${Math.random().toString(36).substring(2, 10)}`,
      location: {
        latitude: Number(report.location?.latitude || 25.1147),
        longitude: Number(report.location?.longitude || 92.3654),
        accuracy_m: Number(report.location?.accuracy_m || 5.0),
        landmark_name: report.location?.landmark_name || 'Sonapur Sector',
      },
      hazard_type: (report.hazard_type || report.incident_type || 'LANDSLIDE').toUpperCase(),
      incident_type: (report.incident_type || report.hazard_type || 'landslide').toLowerCase(),
      severity: report.severity || 'HIGH',
      description: report.notes || report.description || 'Citizen hazard alert',
      notes: report.notes || report.description || 'Citizen hazard alert',
      cluster_id: report.cluster_id || 'CLUSTER-SONAPUR-01',
      is_blocked: report.is_blocked !== undefined ? report.is_blocked : true,
      rainfall_mm_reported: Number(report.rainfall_mm_reported || 0.0),
      photo_preview: report.photo_preview || null,
      has_photo: Boolean(report.photo_preview || report.has_photo),
    };

    const res = await fetch(`${BASE_URL}/reports/incident`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`FastAPI incident error: ${res.status}`);
    const data = await res.json();

    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('margsetu_incident_updated', { detail: data }));
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('margsetu_ops_bus');
          bc.postMessage({ type: 'NEW_INCIDENT_REPORT', payload: data });
          bc.close();
        }
      } catch (e) {
        // SSR safe
      }
    }

    return createResponse(data, 'USER-SUBMITTED');
  },

  async getIncidents() {
    const res = await fetch(`${BASE_URL}/reports/corridor/C1`);
    if (!res.ok) throw new Error(`FastAPI fetch incidents error: ${res.status}`);
    const data = await res.json();
    return createResponse(data.incidents || [], 'LIVE API');
  },

  async triggerSOS(payload) {
    const safePayload = {
      sender_id_hash: payload.sender_id_hash || `user_${Math.random().toString(36).substring(2, 10)}`,
      location: {
        latitude: Number(payload.location?.latitude || 25.1147),
        longitude: Number(payload.location?.longitude || 92.3654),
        accuracy_m: Number(payload.location?.accuracy_m || 5.0),
        landmark_name: payload.location?.landmark_name || 'Sonapur Tunnel Sector',
      },
      distress_type: payload.distress_type || 'STRANDED_HAZARD',
      urgency_level: payload.urgency_level || 'CRITICAL',
      message: payload.message || 'Distress SOS beacon dispatched from MargSetu driver interface',
      network_condition: payload.network_condition || (typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline'),
      vehicle_type: payload.vehicle_type || 'commercial_light',
    };
    const res = await fetch(`${BASE_URL}/sos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(safePayload),
    });
    if (!res.ok) throw new Error(`FastAPI SOS error: ${res.status}`);
    const data = await res.json();
    return createResponse(data, 'LIVE API');
  },

  async getSOSQueue() {
    const res = await fetch(`${BASE_URL}/sos/queue`);
    if (!res.ok) throw new Error(`FastAPI SOS queue error: ${res.status}`);
    const data = await res.json();
    return createResponse(data.records || [], 'LIVE API');
  },

  async applyScenario(payload) {
    const res = await fetch(`${BASE_URL}/scenario/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`FastAPI scenario error: ${res.status}`);
    const data = await res.json();
    return createResponse(data, 'LIVE API');
  },

  async resetScenario() {
    const res = await fetch(`${BASE_URL}/scenario/reset`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`FastAPI reset error: ${res.status}`);
    const data = await res.json();
    return createResponse(data, 'LIVE API');
  },

  async applySOSAction(sosId, { action, operator_id = 'NDMA-OP-01', reason, notes, relayed_to } = {}) {
    const res = await fetch(`${BASE_URL}/ops/sos/${encodeURIComponent(sosId)}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operator_id: operator_id || 'NDMA-OP-01',
        action: action,
        reason: reason || `Operator action: ${action}`,
        notes: notes || reason || '',
      }),
    });
    if (!res.ok) throw new Error(`FastAPI SOS action error: ${res.status}`);
    const data = await res.json();
    return createResponse(data, 'LIVE API');
  },

  async verifySOSBeacon(sosId, operatorId = 'NDMA-OP-01') {
    return this.applySOSAction(sosId, {
      action: 'verify',
      operator_id: operatorId,
      notes: 'Ground Beacon Verified by Operator',
    });
  },

  async relaySOSToSDMA(sosId, agency = 'Assam SDMA 1077', operatorId = 'NDMA-OP-01') {
    return this.applySOSAction(sosId, {
      action: 'relay',
      operator_id: operatorId,
      notes: `Relayed to ${agency}`,
      relayed_to: agency,
    });
  },

  async updateSOSStatus(sosId, status, operatorNotes = '') {
    const actionVal = status === 'resolved' ? 'resolve' : status;
    return this.applySOSAction(sosId, {
      action: actionVal,
      operator_id: 'NDMA-OP-01',
      notes: operatorNotes || `Status updated to ${status}`,
    });
  },

  async triageIncident(incidentId, action, operatorId = 'NDMA-OP-01', reason = 'Verified via radar') {
    const res = await fetch(`${BASE_URL}/ops/incidents/${encodeURIComponent(incidentId)}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operator_id: operatorId || 'NDMA-OP-01',
        action: action,
        reason: reason || `Incident triage: ${action}`,
        notes: reason || '',
      }),
    });
    if (!res.ok) throw new Error(`FastAPI Incident triage error: ${res.status}`);
    const data = await res.json();
    return createResponse(data, 'LIVE API');
  },
};

