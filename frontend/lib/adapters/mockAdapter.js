/**
 * MargSetu MockAdapter (Simulation Ground Truth)
 * Spec Reference: DESIGN.md (FINAL v2) §5
 *
 * Implements:
 * - Deterministic PRD §3 & §10 math (baseline Ri = 2.40 at 68mm)
 * - Dynamic rainfall slider response (2.23 -> 2.40 -> 2.55 -> veto >75mm)
 * - 4-layer SOS cascade state machine
 * - Incident triage audit trail with vertical timeline records
 * - <5ms byte-identical baseline reset
 */

import { createResponse } from './types';

// Baseline state (byte-identical)
const BASELINE_STATE = {
  rainfall_mm: 68.0,
  inject_hazard_sonapur: false,
  inject_hazard_haflong: false,
  ndma_override: false,
};

let currentState = { ...BASELINE_STATE };

let currentIncidents = [
  {
    id: 'INC-SONAPUR-01',
    cluster_id: 'CLUSTER-SONAPUR-01',
    hazard_type: 'LANDSLIDE',
    location: {
      latitude: 25.1147,
      longitude: 92.3654,
      landmark_name: 'Sonapur Tunnel NH-6',
    },
    severity: 'HIGH',
    status: 'corroborated_pending',
    corroboration_level: 2,
    timestamp: '2026-09-20T11:15:00Z',
    notes: 'Loose debris and mudslide spilling onto north portal',
    honesty_label: 'USER-SUBMITTED',
    timeline: [
      { id: 'TL-1', time: '11:15', operator: 'Auto-Ingest', action: 'Signal Received', reason: 'Field report via mobile HUD' },
      { id: 'TL-2', time: '11:18', operator: 'Operator NDMA-04', action: 'Corroborated', reason: 'Verified against local weather station rain rate' }
    ]
  },
  {
    id: 'INC-JOWAI-02',
    cluster_id: 'CLUSTER-JOWAI-01',
    hazard_type: 'WATERLOGGING',
    location: {
      latitude: 25.4411,
      longitude: 92.2033,
      landmark_name: 'Jowai Bypass Dip',
    },
    severity: 'MODERATE',
    status: 'under_review',
    corroboration_level: 1,
    timestamp: '2026-09-20T11:30:00Z',
    notes: 'Runoff pooling in low-lying carriageway',
    honesty_label: 'USER-SUBMITTED',
    timeline: [
      { id: 'TL-3', time: '11:30', operator: 'Auto-Ingest', action: 'Signal Received', reason: 'Citizen alert' }
    ]
  }
];

let sosQueue = [
  {
    id: 'SOS-2026-9912',
    sender_id_hash: 'c8f3e2b9',
    location: {
      latitude: 25.1147,
      longitude: 92.3654,
      landmark_name: 'Sonapur Tunnel Sector',
    },
    vehicle_type: 'heavy_freight',
    distress_type: 'STRANDED_HAZARD',
    urgency_level: 'CRITICAL',
    status: 'delivered',
    status_label: 'Signal Delivered to Queue — Awaiting Operator Review',
    timestamp: '2026-09-20T11:42:10Z',
    honesty_label: 'SIMULATION',
    cascade_layer: 'L3_REAL_HOOKS',
    hooks: {
      sms: 'sms:1077?body=SOS%20HELP%20NEEDED%20@%2025.1147,92.3654',
      call_ndma: 'tel:1077',
      call_erps: 'tel:112',
    }
  }
];

export const MockAdapter = {
  /**
   * Evaluate lifeline corridors with dynamic rainfall and veto logic
   */
  async evaluateRoutes({
    rainfall_mm = currentState.rainfall_mm,
    inject_hazard_sonapur = currentState.inject_hazard_sonapur,
    inject_hazard_haflong = currentState.inject_hazard_haflong,
    ndma_override = currentState.ndma_override,
  } = {}) {
    const rain = Number(rainfall_mm);
    currentState.rainfall_mm = rain;
    currentState.inject_hazard_sonapur = inject_hazard_sonapur;
    currentState.inject_hazard_haflong = inject_hazard_haflong;
    currentState.ndma_override = ndma_override;

    // PRD §3 & §10 Calibrated Formula:
    // r_rain = min(10.0, (rain / 75.0) * 4.0)
    const r_rain = Math.min(10.0, (rain / 75.0) * 4.0);
    // Weights: 0.40 rain, 0.30 slope (2.0), 0.15 soil (1.5), 0.10 crowd (0.0), 0.05 hist (2.5)
    let c1_ri = (0.40 * r_rain) + (0.30 * 2.0) + (0.15 * 1.5) + (0.10 * 0.0) + (0.05 * 2.5);
    c1_ri = Number(c1_ri.toFixed(2));

    const isSonapurVetoed = rain > 75.0 || inject_hazard_sonapur || ndma_override;
    const c1_blocked = isSonapurVetoed;
    const c1_final_ri = c1_blocked ? 10.0 : c1_ri;

    let c1_veto_reason = null;
    if (ndma_override) {
      c1_veto_reason = 'NDMA Administrative Safety Override: transit suspended';
    } else if (inject_hazard_sonapur) {
      c1_veto_reason = 'Active landslide obstruction at Sonapur Tunnel (NH-6)';
    } else if (rain > 75.0) {
      c1_veto_reason = `Precipitation ${rain.toFixed(1)}mm exceeds structural threshold (75.0mm)`;
    }

    // Corridor C1: NH-6 Guwahati-Silchar via Sonapur Tunnel
    const c1 = {
      corridor_id: 'C1',
      corridor_name: 'C1 NH-6 Guwahati-Silchar',
      highway_code: 'NH-6',
      base_distance_km: 320.0,
      eta_minutes: 480.0,
      effective_cost: c1_blocked ? 999999.0 : 320.0 * Math.exp(c1_final_ri / 3.0),
      average_risk_score: c1_final_ri,
      is_blocked: c1_blocked,
      veto_reason: c1_veto_reason,
      fuel_consumption_liters: 112.0, // 320 * 0.35
      carbon_emission_kg: 300.2,
      hazard_exposure_pct: c1_blocked ? 100.0 : 34.5,
      factors: {
        rain: Number(r_rain.toFixed(2)),
        slope: 2.0,
        soil: 1.5,
        crowd: inject_hazard_sonapur ? 8.0 : 0.0,
        hist: 2.5,
      },
      advisory_brief: {
        en: c1_blocked
          ? `[NDMA SIMULATION ADVISORY] RED ALERT: C1 NH-6 is IMPASSABLE. Reason: ${c1_veto_reason}. Transit prohibited.`
          : `[NDMA SIMULATION ADVISORY] C1 NH-6 is OPEN with standard mountain precautions. Rainfall: ${rain.toFixed(1)}mm | Risk: ${c1_final_ri}/10.`,
        hi: c1_blocked
          ? `[NDMA सिमुलेशन परामर्श] रेड अलर्ट: C1 NH-6 अवरुद्ध है। कारण: ${c1_veto_reason}। पारगमन निषेध।`
          : `[NDMA सिमुलेशन परामर्श] C1 NH-6 खुला है। वर्षा: ${rain.toFixed(1)} मिमी | जोखिम: ${c1_final_ri}/10।`,
        as: c1_blocked
          ? `[NDMA ছিমুলেচন পৰামৰ্শ] ৰেড এলাৰ্ট: C1 NH-6 বন্ধ হৈ পৰিছে। কাৰণ: ${c1_veto_reason}। যাতায়াত নিষিদ্ধ।`
          : `[NDMA ছিমুলেচন পৰামৰ্শ] C1 NH-6 খোলা আছে। বৰষুণ: ${rain.toFixed(1)} মিমি | বিপদাশংকা: ${c1_final_ri}/10।`,
      },
      honesty_label: 'VERIFIED STATIC',
    };

    // Corridor C2: NH-27 Detour via Haflong Bypass (Structurally Resilient)
    const c2_blocked = ndma_override || currentState.inject_hazard_haflong;
    const c2_ri = 1.80; // Elevated bypass, low flood risk
    let c2_veto_reason = null;
    if (ndma_override) {
      c2_veto_reason = 'NDMA Administrative Safety Override: transit suspended';
    } else if (currentState.inject_hazard_haflong) {
      c2_veto_reason = 'Active landslide obstruction at Haflong Bypass (NH-27)';
    }

    const c2 = {
      corridor_id: 'C2',
      corridor_name: 'C2 NH-27 Detour via Haflong',
      highway_code: 'NH-27',
      base_distance_km: 362.0, // +42 km detour
      eta_minutes: 536.0,      // +56 min
      effective_cost: c2_blocked ? 999999.0 : 362.0 * Math.exp(c2_ri / 3.0),
      average_risk_score: c2_blocked ? 10.0 : c2_ri,
      is_blocked: c2_blocked,
      veto_reason: c2_veto_reason,
      fuel_consumption_liters: 126.7, // 362 * 0.35 (+14.7 L)
      carbon_emission_kg: 339.6,      // +39.4 kg CO2 (DEC-001 formula)
      hazard_exposure_pct: c2_blocked ? 100.0 : 0.8,       // -99.2% exposure drop vs Sonapur chokepoint
      factors: {
        rain: 1.2,
        slope: 1.5,
        soil: 1.0,
        crowd: currentState.inject_hazard_haflong ? 8.0 : 0.0,
        hist: 1.0,
      },
      advisory_brief: {
        en: c2_blocked
          ? `[NDMA SIMULATION ADVISORY] RED ALERT: C2 Haflong Bypass is BLOCKED. Transit prohibited.`
          : `[NDMA SIMULATION ADVISORY] C2 NH-27 Haflong Bypass is the recommended resilient corridor. Distance: 362km (+42km detour).`,
        hi: c2_blocked
          ? `[NDMA सिमुलेशन परामर्श] रेड अलर्ट: C2 हाफलोंग बाईपास अवरुद्ध है।`
          : `[NDMA सिमुलेशन परामर्श] C2 NH-27 हाफलोंग बाईपास अनुशंसित सुरक्षित मार्ग है। दूरी: 362 किमी।`,
        as: c2_blocked
          ? `[NDMA ছিমুলেচন পৰামৰ্শ] ৰেড এলাৰ্ট: C2 হাফলং বাইপাছ বন্ধ হৈ পৰিছে।`
          : `[NDMA ছিমুলেচন পৰামৰ্শ] C2 NH-27 হাফলং বাইপাছ নিৰাপদ বিকল্প পথ। দূৰত্ব: ৩৬২ কিমি।`,
      },
      honesty_label: 'VERIFIED STATIC',
    };

    // Corridor C3: NH-27 West Reference / Evacuation Staging
    const c3 = {
      corridor_id: 'C3',
      corridor_name: 'C3 NH-27 West (Siliguri - Guwahati)',
      highway_code: 'NH-27 W',
      base_distance_km: 470.0,
      eta_minutes: 680.0,
      effective_cost: 470.0,
      average_risk_score: 1.1,
      is_blocked: false,
      veto_reason: null,
      fuel_consumption_liters: 164.5,
      carbon_emission_kg: 440.8,
      hazard_exposure_pct: 0.0,
      factors: { rain: 0.8, slope: 0.5, soil: 0.5, crowd: 0.0, hist: 0.5 },
      advisory_brief: {
        en: (c1_blocked && c2_blocked)
          ? `[NDMA SIMULATION ADVISORY] DUAL CORRIDOR VETO: C1 & C2 both impassable. Divert to C3 Guwahati West Emergency Staging & NDMA Relief Shelter.`
          : `[NDMA SIMULATION ADVISORY] C3 West Lifeline is clear. Emergency shelter staging active at Guwahati West.`,
        hi: (c1_blocked && c2_blocked)
          ? `[NDMA सिमुलेशन परामर्श] दोहरा मार्ग अवरोध: C1 और C2 दोनों बंद। C3 गुवाहाटी पश्चिम आश्रय स्थल की ओर प्रस्थान करें।`
          : `[NDMA सिमुलेशन परामर्श] C3 पश्चिमी संपर्क मार्ग खुला है।`,
        as: (c1_blocked && c2_blocked)
          ? `[NDMA ছিমুলেচন পৰামৰ্শ] দ্বৈত পথ বন্ধ: C1 আৰু C2 দুয়োটা বন্ধ। C3 গুৱাহাটী পশ্চিম আশ্ৰয় শিবিৰলৈ যাওক।`
          : `[NDMA ছিমুলেচন পৰামৰ্শ] C3 পশ্চিম সংযোগ পথ মুকলি আছে।`,
      },
      honesty_label: 'VERIFIED STATIC',
    };

    // Recommended corridor calculation
    let recommendedRoute = 'C1';
    if (c1_blocked && !c2_blocked) {
      recommendedRoute = 'C2';
    } else if (c1_blocked && c2_blocked) {
      recommendedRoute = 'C3';
    }

    return createResponse({
      recommended_corridor_id: recommendedRoute,
      routes: [c1, c2, c3],
      scenario: { ...currentState },
      tradeoff: {
        detour_km: 42.0,
        added_time_minutes: 56.0,
        added_carbon_kg: 39.4,
        hazard_exposure_reduction_pct: 99.2,
      },
      audit: {
        formula: 'Ri = 0.40·R_rain + 0.30·R_slope + 0.15·R_soil + 0.10·R_crowd + 0.05·R_hist',
        baseline_calibrated: '2.40 @ 68.0mm',
      }
    }, 'SIMULATION');
  },

  /**
   * Submit citizen / driver incident report
   */
  async submitIncident(report) {
    const newId = `INC-${Date.now().toString().slice(-4)}`;
    const clusterId = report.cluster_id || 'CLUSTER-SONAPUR-01';

    const incident = {
      id: newId,
      cluster_id: clusterId,
      hazard_type: (report.hazard_type || report.incident_type || 'LANDSLIDE').toUpperCase(),
      location: report.location || {
        latitude: 25.1147,
        longitude: 92.3654,
        landmark_name: 'Sonapur Sector',
      },
      severity: report.severity || 'HIGH',
      status: 'corroborated_pending',
      corroboration_level: 2,
      timestamp: new Date().toISOString(),
      notes: report.notes || report.description || 'Reported via Driver HUD',
      photo_preview: report.photo_preview || null,
      has_photo: Boolean(report.photo_preview || report.has_photo),
      honesty_label: 'USER-SUBMITTED',
      timeline: [
        {
          id: `TL-${Date.now()}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          operator: 'Citizen Mobile HUD',
          action: 'Incident Submitted',
          reason: report.notes || report.description || 'Driver field alert',
        },
      ],
    };

    currentIncidents.unshift(incident);

    // Cross-tab and local persistence
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('margsetu_incidents', JSON.stringify(currentIncidents));
        window.dispatchEvent(new CustomEvent('margsetu_incident_updated', { detail: incident }));
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('margsetu_ops_bus');
          bc.postMessage({ type: 'NEW_INCIDENT_REPORT', payload: incident });
          bc.close();
        }
      } catch (e) {
        // Storage quota or SSR safe
      }
    }

    return createResponse(incident, 'USER-SUBMITTED');
  },

  async getIncidents() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('margsetu_incidents');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            currentIncidents = parsed;
          }
        }
      } catch (e) {
        // Fallback
      }
    }
    return createResponse(currentIncidents, 'USER-SUBMITTED');
  },

  /**
   * Triage incident in Ops Console with vertical timeline entry
   */
  async triageIncident(incidentId, action, operatorId = 'NDMA-OP-01', reason = 'Verified via radar') {
    const inc = currentIncidents.find((i) => i.id === incidentId || i.cluster_id === incidentId);
    if (inc) {
      inc.status = action;
      inc.is_confirmed_blockage = action === 'approve_detour' || action === 'verify';
      inc.timeline.unshift({
        id: `TL-${Date.now()}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        operator: operatorId,
        action: action.toUpperCase(),
        reason,
      });

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('margsetu_incidents', JSON.stringify(currentIncidents));
          window.dispatchEvent(new CustomEvent('margsetu_incident_updated', { detail: inc }));
        } catch (e) {}
      }
    }
    return createResponse(inc, 'SIMULATION');
  },

  /**
   * Trigger SOS Distress Signal (Layer 1 -> Layer 2 -> Layer 3)
   */
  async triggerSOS(data = {}) {
    const newSos = {
      id: `SOS-${Date.now().toString().slice(-4)}`,
      sender_id_hash: 'sha256-demo',
      location: data.location || {
        latitude: 25.1147,
        longitude: 92.3654,
        landmark_name: 'Sonapur Tunnel chokepoint (NH-6)',
      },
      vehicle_type: data.vehicle_type || 'heavy_freight',
      distress_type: 'STRANDED_HAZARD',
      urgency_level: 'CRITICAL',
      status: 'delivered',
      status_label: 'Signal Delivered to Queue — Awaiting Operator Review',
      is_dispatched: false, // Rule 2: Strictly False
      photo_preview: data.photo_preview || data.photo_data || null,
      notes: data.notes || 'Emergency assistance requested via mobile HUD',
      timestamp: new Date().toISOString(),
      honesty_label: 'SIMULATION',
      cascade_layer: 'L3_REAL_HOOKS',
      hooks: {
        sms: `sms:1077?body=SOS%20HELP%20NEEDED%20@%20${data.location?.latitude || 25.1147},${data.location?.longitude || 92.3654}`,
        call_ndma: 'tel:1077',
        call_erps: 'tel:112',
      },
    };

    sosQueue.unshift(newSos);

    // Cross-tab and local persistence
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('margsetu_sos_queue', JSON.stringify(sosQueue));
        window.dispatchEvent(new CustomEvent('margsetu_sos_updated', { detail: newSos }));

        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('margsetu_ops_bus');
          bc.postMessage({ type: 'NEW_SOS_SIGNAL', payload: newSos });
          bc.close();
        }
      } catch (e) {
        // Storage quota or SSR safe
      }
    }

    return createResponse(newSos, 'SIMULATION');
  },

  async getSOSQueue() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('margsetu_sos_queue');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            sosQueue = parsed;
          }
        }
      } catch (e) {
        // Ignore fallback
      }
    }
    return createResponse(sosQueue, 'SIMULATION');
  },

  async verifySOSBeacon(sosId, operatorId = 'NDMA-OP-01') {
    const item = sosQueue.find((s) => s.id === sosId || s.event_id === sosId);
    if (item) {
      item.status = 'verified';
      item.state = 'acknowledged';
      item.status_label = 'Ground Beacon Verified — Operator Corroborated';
      item.verified_by = operatorId;
      item.verified_at = new Date().toISOString();
      if (typeof window !== 'undefined') {
        localStorage.setItem('margsetu_sos_queue', JSON.stringify(sosQueue));
        window.dispatchEvent(new CustomEvent('margsetu_sos_updated', { detail: item }));
      }
    }
    return createResponse(item, 'SIMULATION');
  },

  async relaySOSToSDMA(sosId, agency = 'Assam SDMA 1077', operatorId = 'NDMA-OP-01') {
    const item = sosQueue.find((s) => s.id === sosId || s.event_id === sosId);
    if (item) {
      item.status = 'relayed';
      item.state = 'assigned';
      item.status_label = `Relayed to ${agency} — EOC Docket #ASM-${Date.now().toString().slice(-4)}`;
      item.relayed_to = agency;
      item.relayed_at = new Date().toISOString();
      item.operator_id = operatorId;
      if (typeof window !== 'undefined') {
        localStorage.setItem('margsetu_sos_queue', JSON.stringify(sosQueue));
        window.dispatchEvent(new CustomEvent('margsetu_sos_updated', { detail: item }));
      }
    }
    return createResponse(item, 'SIMULATION');
  },

  async updateSOSStatus(sosId, status, operatorNotes = '') {
    const item = sosQueue.find((s) => s.id === sosId || s.event_id === sosId);
    if (item) {
      item.status = status;
      item.state = status;
      item.operator_notes = operatorNotes;
      if (status === 'resolved') {
        item.status_label = 'Distress Signal Closed and Marked Resolved by Operator';
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('margsetu_sos_queue', JSON.stringify(sosQueue));
        window.dispatchEvent(new CustomEvent('margsetu_sos_updated', { detail: item }));
      }
    }
    return createResponse(item, 'SIMULATION');
  },

  /**
   * Reset simulation to byte-identical baseline (<5ms)
   */
  async resetScenario() {
    currentState = { ...BASELINE_STATE };
    return this.evaluateRoutes();
  },
};
