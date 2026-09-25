'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  RotateCcw,
  Sliders,
  AlertCircle,
  LifeBuoy,
  Truck,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Phone,
  MessageSquare,
  Flame,
  Radio,
  Lock,
  Unlock,
  Key,
  Eye,
  MapPin,
  CloudRain,
  Thermometer,
  Wind,
  X,
  Compass,
  Database,
} from 'lucide-react';

import DynamicLeafletMap from '../../components/map/DynamicLeafletMap';
import LocationSearchBar from '../../components/search/LocationSearchBar';
import RainfallSlider from '../../components/ops/RainfallSlider';
import AuditTimeline from '../../components/ops/AuditTimeline';
import { HonestyBadge } from '../../lib/labels';
import {
  evaluateRoutes,
  resetScenario,
  fetchIncidents,
  fetchDatabaseStats,
  fetchSOSQueue,
  verifySOSBeacon,
  relaySOSToSDMA,
  updateSOSStatus,
  triageIncident,
} from '../../lib/api';
import { MockAdapter } from '../../lib/adapters/mockAdapter';
import { useTranslation } from '../../lib/i18n';
import { fetchLiveWeatherSonapur } from '../../lib/services/weatherLive';

/**
 * MargSetu Operations Console (/ops)
 * Spec Reference: DESIGN.md (FINAL v2) §3 & SIH 2026 EOC Operational Standards
 * 65/35 Desktop Split on Paper Background (#FAF8F5).
 * - Light theme ONLY
 * - Tactical Security Gate: PIN NDMA2026 or 1-Click Demo Bypass
 * - Real-time SOS Queue with exact geodetic coordinates, photo inspection & SDMA relay
 * - Streamlined 2-tier incident triage
 * - Corridor focus switcher (C1 Sonapur vs C2 Haflong) with auto-pan
 * - Open-Meteo live weather telemetry
 */
export default function OpsConsolePage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('incidents'); // incidents | sos | fleet | scenario
  const [rainfallMm, setRainfallMm] = useState(68.0);
  const [injectSonapur, setInjectSonapur] = useState(false);
  const [injectHaflong, setInjectHaflong] = useState(false);
  const [ndmaOverride, setNdmaOverride] = useState(false);

  // Security Gate State
  const [isAuthenticated, setIsAuthenticated] = useState(true); // default true for hydration, checked in effect
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Map and Routing State
  const [routesData, setRoutesData] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [sosQueue, setSosQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [targetLocation, setTargetLocation] = useState(null);
  const [focusedCorridor, setFocusedCorridor] = useState(null); // 'C1' | 'C2'
  const [expandedPhoto, setExpandedPhoto] = useState(null);
  const [showResolvedSOS, setShowResolvedSOS] = useState(false);
  const [showResolvedIncidents, setShowResolvedIncidents] = useState(false);

  // Filtered active queues: resolved items are stored in SQLite but removed from active view to prevent clutter
  const activeSosQueue = useMemo(() => {
    return sosQueue.filter((s) => s.status !== 'resolved' && s.state !== 'resolved');
  }, [sosQueue]);

  const resolvedSosList = useMemo(() => {
    return sosQueue.filter((s) => s.status === 'resolved' || s.state === 'resolved');
  }, [sosQueue]);

  const activeIncidents = useMemo(() => {
    return incidents.filter(
      (i) => i.status !== 'resolve' && i.status !== 'resolved' && i.status !== 'false_positive'
    );
  }, [incidents]);

  const resolvedIncidentsList = useMemo(() => {
    return incidents.filter(
      (i) => i.status === 'resolve' || i.status === 'resolved' || i.status === 'false_positive'
    );
  }, [incidents]);

  // Red pulsing dot is shown ONLY when there are active/unresolved distress beacons
  const hasActiveSOSAlert = activeSosQueue.length > 0;

  // Live Telemetry & Database
  const [liveWeather, setLiveWeather] = useState(null);
  const [dbStats, setDbStats] = useState({
    status: 'connected',
    engine: 'SQLite (WAL)',
    database_file: 'margsetu.db',
  });

  // Check authentication session on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const auth = sessionStorage.getItem('margsetu_ops_auth');
      if (auth !== 'true') {
        setIsAuthenticated(false);
        setShowSecurityModal(true);
      } else {
        setIsAuthenticated(true);
        setShowSecurityModal(false);
      }
    }
  }, []);

  const handleUnlockWithPin = async (e) => {
    if (e) e.preventDefault();
    const pin = pinInput.trim().toUpperCase();
    try {
      const res = await fetch('http://localhost:8000/ops/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        sessionStorage.setItem('margsetu_ops_auth', 'true');
        setIsAuthenticated(true);
        setShowSecurityModal(false);
        setPinError(false);
        setPinInput('');
        return;
      }
    } catch {
      // Offline fallback: verify locally
      if (pin === 'NDMA2026' || pin === '1077') {
        sessionStorage.setItem('margsetu_ops_auth', 'true');
        setIsAuthenticated(true);
        setShowSecurityModal(false);
        setPinError(false);
        setPinInput('');
        return;
      }
    }
    setPinError(true);
    setTimeout(() => setPinError(false), 2000);
  };

  const handleQuickDemoBypass = () => {
    sessionStorage.setItem('margsetu_ops_auth', 'true');
    setIsAuthenticated(true);
    setShowSecurityModal(false);
    setPinError(false);
  };

  const handleLockConsole = () => {
    sessionStorage.removeItem('margsetu_ops_auth');
    setIsAuthenticated(false);
    setShowSecurityModal(true);
  };

  // Sync / Recalculate routes dynamically
  const updateSimulation = useCallback(async (overrides = {}) => {
    const rMm = overrides.rainfall_mm ?? rainfallMm;
    const injSonapur = overrides.inject_hazard_sonapur ?? injectSonapur;
    const injHaflong = overrides.inject_hazard_haflong ?? injectHaflong;
    const ndma = overrides.ndma_override ?? ndmaOverride;

    try {
      const res = await evaluateRoutes({
        rainfall_mm: rMm,
        inject_hazard_sonapur: injSonapur,
        inject_hazard_haflong: injHaflong,
        ndma_override: ndma,
      });
      setRoutesData(res.data);
    } catch (e) {
      console.error('Failed to update ops simulation:', e);
    }
  }, [rainfallMm, injectSonapur, injectHaflong, ndmaOverride]);

  // Load initial data and live weather
  useEffect(() => {
    async function init() {
      setLoading(true);
      await updateSimulation({ rainfall_mm: 68.0 });
      try {
        const incRes = await fetchIncidents();
        setIncidents(incRes.data || []);
      } catch (err) {
        const incRes = await MockAdapter.getIncidents();
        setIncidents(incRes.data);
      }

      try {
        const sosRes = await fetchSOSQueue();
        setSosQueue(sosRes.data || []);
      } catch (err) {
        const sosRes = await MockAdapter.getSOSQueue();
        setSosQueue(sosRes.data);
      }

      // Fetch live weather
      try {
        const weather = await fetchLiveWeatherSonapur();
        setLiveWeather(weather);
      } catch (err) {
        // Fallback
      }

      // Fetch DB telemetry
      try {
        const stats = await fetchDatabaseStats();
        if (stats) setDbStats(stats);
      } catch (err) {
        // Fallback
      }

      setLoading(false);
    }
    init();
  }, [updateSimulation]);

  // Real-time SOS & Incident Ingestion via BroadcastChannel, Storage, and Polling Listener
  useEffect(() => {
    const syncSOS = async () => {
      try {
        const res = await fetchSOSQueue();
        if (res?.data) {
          setSosQueue([...res.data]);
        }
      } catch (e) {
        const res = await MockAdapter.getSOSQueue();
        setSosQueue([...res.data]);
      }
    };

    const syncIncidents = async () => {
      try {
        const res = await fetchIncidents();
        if (res?.data) {
          setIncidents([...res.data]);
        }
      } catch (e) {
        const res = await MockAdapter.getIncidents();
        setIncidents([...res.data]);
      }
    };

    const syncAll = () => {
      syncSOS();
      syncIncidents();
    };

    window.addEventListener('margsetu_sos_updated', syncSOS);
    window.addEventListener('margsetu_incident_updated', syncIncidents);
    window.addEventListener('storage', syncAll);

    let bc = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('margsetu_ops_bus');
      bc.onmessage = (e) => {
        if (e.data?.type === 'NEW_SOS_SIGNAL') {
          syncSOS();
        } else if (e.data?.type === 'NEW_INCIDENT_REPORT') {
          syncIncidents();
        }
      };
    }

    const intervalId = setInterval(syncAll, 2000);

    return () => {
      window.removeEventListener('margsetu_sos_updated', syncSOS);
      window.removeEventListener('margsetu_incident_updated', syncIncidents);
      window.removeEventListener('storage', syncAll);
      if (bc) bc.close();
      clearInterval(intervalId);
    };
  }, []);

  // Slider change handler
  const handleSliderChange = (newRainfall) => {
    setRainfallMm(newRainfall);
    updateSimulation({ rainfall_mm: newRainfall });
  };

  // Keyboard shortcut 'R' for instant reset
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'r' || e.key === 'R') && !e.target.matches('input, textarea')) {
        e.preventDefault();
        handleResetBaseline();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleResetBaseline = async () => {
    setRainfallMm(68.0);
    setInjectSonapur(false);
    setInjectHaflong(false);
    setNdmaOverride(false);
    setFocusedCorridor(null);
    setTargetLocation(null);
    await resetScenario();
    await updateSimulation({
      rainfall_mm: 68.0,
      inject_hazard_sonapur: false,
      inject_hazard_haflong: false,
      ndma_override: false,
    });
  };

  // Streamlined Incident Triage Handler
  const handleTriageAction = async (incidentId, action) => {
    // 1. Optimistic UI update so buttons reflect state instantly
    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === incidentId || inc.cluster_id === incidentId
          ? { ...inc, status: action, is_confirmed_blockage: action === 'approve_detour' || action === 'verify' }
          : inc
      )
    );

    try {
      await triageIncident(incidentId, action);
    } catch (e) {
      console.warn('Incident triage API error:', e);
    }

    try {
      const incRes = await fetchIncidents();
      if (incRes?.data) setIncidents([...incRes.data]);
    } catch (e) {
      const incRes = await MockAdapter.getIncidents();
      setIncidents([...incRes.data]);
    }

    // If hazard verified by operator, block Sonapur and divert transit to C2 Haflong!
    if (action === 'approve_detour' || action === 'verify') {
      setInjectSonapur(true);
      await updateSimulation({ inject_hazard_sonapur: true });
    } else if (action === 'resolve' || action === 'false_positive') {
      setInjectSonapur(false);
      await updateSimulation({ inject_hazard_sonapur: false });
    }
  };

  // SOS Queue Actions
  const handleVerifyBeacon = async (sosId) => {
    // 1. Optimistic UI update
    setSosQueue((prev) =>
      prev.map((item) =>
        item.id === sosId || item.event_id === sosId
          ? {
              ...item,
              status: 'verified',
              state: 'acknowledged',
              status_label: 'Ground Beacon Verified — Operator Corroborated',
            }
          : item
      )
    );

    try {
      await verifySOSBeacon(sosId);
    } catch (e) {
      console.warn('Verify beacon API error:', e);
    }

    try {
      const res = await fetchSOSQueue();
      if (res?.data) setSosQueue([...res.data]);
    } catch (e) {
      const res = await MockAdapter.getSOSQueue();
      setSosQueue([...res.data]);
    }
  };

  const handleRelaySDMA = async (sosId) => {
    // 1. Optimistic UI update
    setSosQueue((prev) =>
      prev.map((item) =>
        item.id === sosId || item.event_id === sosId
          ? {
              ...item,
              status: 'relayed',
              state: 'assigned',
              status_label: 'Relayed to Assam SDMA 1077 — EOC Docket Assigned',
            }
          : item
      )
    );

    try {
      await relaySOSToSDMA(sosId, 'Assam SDMA 1077');
    } catch (e) {
      console.warn('Relay SDMA API error:', e);
    }

    try {
      const res = await fetchSOSQueue();
      if (res?.data) setSosQueue([...res.data]);
    } catch (e) {
      const res = await MockAdapter.getSOSQueue();
      setSosQueue([...res.data]);
    }
  };

  const handleResolveSOS = async (sosId) => {
    // 1. Optimistic UI update: mark resolved so it immediately vanishes from activeSosQueue and removes red dot!
    setSosQueue((prev) =>
      prev.map((item) =>
        item.id === sosId || item.event_id === sosId
          ? {
              ...item,
              status: 'resolved',
              state: 'resolved',
              status_label: 'Distress Signal Closed and Marked Resolved by Operator',
            }
          : item
      )
    );

    try {
      await updateSOSStatus(sosId, 'resolved', 'Emergency convoy assist completed');
    } catch (e) {
      console.warn('Resolve SOS API error:', e);
    }

    try {
      const res = await fetchSOSQueue();
      if (res?.data) setSosQueue([...res.data]);
    } catch (e) {
      const res = await MockAdapter.getSOSQueue();
      setSosQueue([...res.data]);
    }
  };

  const handleLocateSOS = (sos) => {
    if (sos.location?.latitude && sos.location?.longitude) {
      setTargetLocation({
        lat: sos.location.latitude,
        lng: sos.location.longitude,
        name: `Distress Beacon: ${sos.id} (${sos.location.landmark_name || 'Ground Location'})`,
      });
    }
  };

  // Corridor focus selection
  const handleCorridorFocus = (cid) => {
    setFocusedCorridor(cid);
    if (cid === 'C2') {
      setTargetLocation({
        lat: 25.1667,
        lng: 93.0245,
        name: 'Haflong Bypass (NH-27 Detour)',
      });
    } else {
      setTargetLocation({
        lat: 25.1147,
        lng: 92.3654,
        name: 'Sonapur Tunnel Portal (NH-6)',
      });
    }
  };

  // Derived state from active evaluation
  const routesList = routesData?.routes || [];
  const c1Route = routesList.find((r) => r.corridor_id === 'C1');
  const c2Route = routesList.find((r) => r.corridor_id === 'C2');
  const recommendedId = routesData?.recommended_corridor_id || 'C1';
  const isC1Vetoed = Boolean(c1Route?.is_blocked);
  const isC2Vetoed = Boolean(c2Route?.is_blocked);
  const c1Ri = Number(c1Route?.average_risk_score ?? 2.40);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-paper text-ink p-4 sm:p-6 space-y-4">
      {/* Tactical PIN Security Gate Modal */}
      {showSecurityModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-line max-w-md w-full p-6 shadow-2xl text-left space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#E6F4F1] border border-brand/30 flex items-center justify-center text-brand">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-ink">
                  {t('ops_gate_title', 'NDMA Crisis Operations Center')}
                </h3>
                <span className="text-[11px] text-muted font-mono">
                  {t('ops_gate_sub', 'RESTRICTED EOC ACCESS · DISPUR / SHILLONG SECTOR')}
                </span>
              </div>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              {t('ops_gate_desc', 'This terminal controls highway transit veto gates and emergency distress beacons for Northeast lifelines. Please verify operator authorization.')}
            </p>

            <form onSubmit={handleUnlockWithPin} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-ink mb-1">
                  {t('ops_gate_label', 'Operator Passkey PIN:')}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder={t('ops_gate_placeholder', 'Enter PIN (Default: NDMA2026)')}
                    className={`w-full min-h-[44px] px-3 py-2 border rounded-xl font-mono text-sm bg-[#FAF8F5] focus:outline-none focus:ring-2 ${
                      pinError
                        ? 'border-[#C62828] focus:ring-[#C62828] animate-shake'
                        : 'border-line focus:ring-brand'
                    }`}
                  />
                  <Key className="w-4 h-4 text-muted absolute right-3 top-3.5" />
                </div>
                {pinError && (
                  <span className="text-[11px] text-[#C62828] font-bold mt-1 block">
                    {t('ops_gate_denied', 'Access Denied: Invalid Operator PIN')}
                  </span>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 min-h-[44px] bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                >
                  {t('ops_gate_btn', 'Authenticate & Unlock')}
                </button>
              </div>
            </form>

            <div className="pt-3 border-t border-line/70">
              <button
                type="button"
                onClick={handleQuickDemoBypass}
                className="w-full min-h-[38px] px-3 py-2 bg-[#FAF8F5] hover:bg-[#E6F4F1] border border-brand/30 text-brand rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>{t('ops_gate_quick_btn', '⚡ Quick Access for SIH Evaluation (NDMA-OP-01)')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded Photo Inspection Modal */}
      {expandedPhoto && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-line max-w-lg w-full p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink">
                Field Hazard Ground Truth Photo
              </span>
              <button
                type="button"
                onClick={() => setExpandedPhoto(null)}
                className="p-1 text-muted hover:text-ink rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden border border-line bg-paper max-h-96 flex items-center justify-center">
              <img
                src={expandedPhoto}
                alt="Hazard Ground Verification"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Top Ops Bar: Pinned Simulation Banner + Demo Mode Pill + Reset Shortcut */}
      <div className="bg-white border border-line rounded-xl px-4 py-2.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse" />
          <span className="font-bold text-sm text-ink font-mono tracking-tight">
            {t('ops_title', 'NDMA TACTICAL DISASTER LOGISTICS CONSOLE')}
          </span>
          <span className="bg-[#E6F4F1] text-brand border border-brand/20 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
            {t('ops_demo_mode', 'DEMO MODE')}
          </span>
          <HonestyBadge label="SIMULATION" size="xs" />
        </div>

        {/* Live Weather Telemetry Pill with 1-click sync */}
        {liveWeather && (
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-[#FAF8F5] border border-line rounded-lg text-xs font-mono">
            <CloudRain className="w-3.5 h-3.5 text-brand" />
            <span className="text-ink font-bold">
              Sonapur: {liveWeather.precipitation_mm.toFixed(1)}mm
            </span>
            <span className="text-muted">|</span>
            <Thermometer className="w-3.5 h-3.5 text-muted" />
            <span className="text-muted">{liveWeather.temperature_c.toFixed(1)}°C</span>
            <HonestyBadge label={liveWeather.is_live ? 'LIVE API' : 'VERIFIED STATIC'} size="xs" />
            <button
              type="button"
              onClick={() => handleSliderChange(Number(liveWeather.precipitation_mm.toFixed(1)))}
              className="text-[10px] font-sans font-bold text-brand hover:underline border-l border-line pl-2 ml-1"
              title="Inject live precipitation rate into routing engine"
            >
              Sync
            </button>
          </div>
        )}

        {/* Database Telemetry Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-[#E6F4F1] border border-brand/20 rounded-lg text-xs font-mono text-brand">
          <Database className="w-3.5 h-3.5" />
          <span className="font-bold">DB: SQLite (WAL)</span>
          <span className="text-[10px] text-brand/80 font-bold bg-white px-1.5 py-0.5 rounded border border-brand/20">
            {dbStats?.status === 'connected' ? t('ops_connected', 'CONNECTED') : t('ops_offline', 'OFFLINE')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLockConsole}
            className="min-h-touch px-2.5 py-1.5 bg-white hover:bg-paper text-muted hover:text-ink border border-line rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors"
            title="Lock Console Gate"
          >
            <Lock className="w-3.5 h-3.5 text-brand" />
            <span className="hidden md:inline">{t('ops_gate_lock_btn', 'Lock Console')}</span>
          </button>

          <button
            type="button"
            onClick={handleResetBaseline}
            className="min-h-touch px-3 py-1.5 bg-white hover:bg-paper active:bg-white text-ink border border-line rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            title={t('ops_reset_tooltip', 'Shortcut: Press R to reset to nominal baseline')}
          >
            <RotateCcw className="w-3.5 h-3.5 text-brand" />
            <span>{t('ops_reset_btn', 'Reset Baseline (68mm)')}</span>
          </button>
        </div>
      </div>

      {/* 65 / 35 Desktop Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ===================================================================
            LEFT 65% PANE: Map, Corridor Switcher, Rainfall Slider & Primary Decision
            =================================================================== */}
        <div className="lg:col-span-8 space-y-4">
          {/* Corridor Quick Focus Switcher Chips */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-white border border-line rounded-xl shadow-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-muted font-mono uppercase px-1">
                {t('ops_corridor_focus', 'Corridor Focus:')}
              </span>
              <button
                type="button"
                onClick={() => handleCorridorFocus('C1')}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  (focusedCorridor === 'C1' || (!focusedCorridor && recommendedId === 'C1'))
                    ? 'bg-brand text-white shadow-xs'
                    : 'bg-[#FAF8F5] text-ink hover:bg-[#E6F4F1] border border-line'
                }`}
              >
                <span>C1: NH-6 Sonapur (320 km)</span>
                {isC1Vetoed && (
                  <span className="text-[10px] bg-[#8B1A1A] text-white px-1.5 py-0.2 rounded">
                    {t('card_blocked', 'BLOCKED')}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleCorridorFocus('C2')}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  (focusedCorridor === 'C2' || (!focusedCorridor && recommendedId === 'C2'))
                    ? 'bg-[#10B981] text-white shadow-xs'
                    : 'bg-[#FAF8F5] text-ink hover:bg-[#E6F4F1] border border-line'
                }`}
              >
                <span>C2: NH-27 Haflong Bypass (362 km)</span>
                {isC2Vetoed ? (
                  <span className="text-[10px] bg-[#8B1A1A] text-white px-1.5 py-0.2 rounded">
                    {t('card_blocked', 'BLOCKED')}
                  </span>
                ) : (
                  <span className="text-[10px] bg-[#0F6E5D] text-white px-1.5 py-0.2 rounded">
                    +42 km
                  </span>
                )}
              </button>
            </div>

            <div className="text-[11px] text-muted font-mono hidden md:block">
              {t('ops_corridor_inspect_hint', 'Double-click corridor polyline on map to inspect')}
            </div>
          </div>

          {/* Location Search Bar for Ops Tactical Positioning */}
          <div className="bg-white border border-line rounded-xl p-2.5 shadow-xs">
            <LocationSearchBar
              onSelectLocation={(loc) => {
                setTargetLocation(loc);
                if (loc.name?.includes('Sonapur')) {
                  handleCorridorFocus('C1');
                } else if (loc.name?.includes('Haflong')) {
                  handleCorridorFocus('C2');
                }
              }}
            />
          </div>

          {/* Rainfall Slider on Map Toolbar (The Demo Star) */}
          <RainfallSlider
            rainfallMm={rainfallMm}
            onChange={handleSliderChange}
            onReset={() => handleSliderChange(68.0)}
            isVetoed={isC1Vetoed}
            c1Ri={c1Ri}
          />

          {/* Map View */}
          <div className="relative">
            <DynamicLeafletMap
              activeRouteId={recommendedId}
              isSonapurBlocked={isC1Vetoed}
              isHaflongBlocked={injectHaflong}
              targetLocation={targetLocation}
              riskScore={c1Ri}
              height="480px"
              onCorridorSelect={(cid) => handleCorridorFocus(cid)}
            />
          </div>

          {/* Active Route Recommendation Callout */}
          <div className="bg-white rounded-xl border border-line p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted uppercase tracking-wider font-mono">
                  {t('ops_primary_routing', 'Primary Routing Decision')}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                  isC1Vetoed && isC2Vetoed
                    ? 'bg-[#FBEBEB] text-[#5A1010] border border-[#8B1A1A]'
                    : isC1Vetoed
                    ? 'bg-[#FAF0E6] text-[#78350F] border border-[#FED7AA]'
                    : 'bg-[#EDF7ED] text-[#1E4620] border border-[#2E7D32]'
                }`}>
                  {isC1Vetoed && isC2Vetoed
                    ? 'Dual Corridor Veto (C3 Staging)'
                    : isC1Vetoed
                    ? 'Detour Active (C2)'
                    : 'Direct Lifeline (C1)'}
                </span>
              </div>
              <div className="text-sm font-bold text-ink mt-1">
                {isC1Vetoed && isC2Vetoed
                  ? 'DUAL GROUND CORRIDOR VETO: Ground lifelines impassable. Diverting to C3 Guwahati West Emergency Staging.'
                  : isC1Vetoed
                  ? 'NH-27 Haflong Bypass Recommended (+42 km detour, −99.2% hazard exposure)'
                  : 'NH-6 Guwahati-Silchar Nominal Lifeline via Sonapur Tunnel (320 km)'}
              </div>
            </div>

            <Link
              href="/driver"
              className="min-h-touch px-4 py-2 bg-brand hover:bg-brand-dark text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
            >
              <span>{t('ops_verify_driver', 'Verify in Driver HUD')}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* ===================================================================
            RIGHT 35% DRAWER: Incidents, SOS Queue, Fleet, Scenario Tabs
            =================================================================== */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-line shadow-xs flex flex-col overflow-hidden">
          {/* Tab Switcher Headers */}
          <div className="flex border-b border-line bg-[#FAF8F5] p-1 gap-1">
            <button
              onClick={() => setActiveTab('incidents')}
              className={`flex-1 min-h-[38px] py-1.5 px-2 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'incidents'
                  ? 'bg-white text-brand shadow-xs border border-line'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {t('ops_tab_incidents', 'Incidents')} ({activeIncidents.length})
            </button>
            <button
              onClick={() => setActiveTab('sos')}
              className={`flex-1 min-h-[38px] py-1.5 px-2 rounded-lg text-xs font-bold transition-colors relative ${
                activeTab === 'sos'
                  ? 'bg-white text-brand shadow-xs border border-line'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <span>{t('ops_tab_sos', 'SOS Queue')} ({activeSosQueue.length})</span>
              {hasActiveSOSAlert && (
                <span className="w-2.5 h-2.5 rounded-full bg-[#C62828] absolute top-1.5 right-1.5 animate-pulse shadow-xs" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('fleet')}
              className={`flex-1 min-h-[38px] py-1.5 px-2 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'fleet'
                  ? 'bg-white text-brand shadow-xs border border-line'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {t('ops_tab_fleet', 'Fleet')}
            </button>
            <button
              onClick={() => setActiveTab('scenario')}
              className={`flex-1 min-h-[38px] py-1.5 px-2 rounded-lg text-xs font-bold transition-colors ${
                activeTab === 'scenario'
                  ? 'bg-white text-brand shadow-xs border border-line'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {t('ops_tab_scenario', 'Scenario')}
            </button>
          </div>

          {/* Tab Contents */}
          <div className="p-4 flex-1 overflow-y-auto max-h-[580px] space-y-4">
            {/* 1. INCIDENTS TAB (Streamlined 2-Tier Actions) */}
            {activeTab === 'incidents' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink uppercase tracking-wide">
                    {t('ops_corroborated_clusters', 'Corroborated Hazard Clusters')}
                  </span>
                  <HonestyBadge label="USER-SUBMITTED" size="xs" />
                </div>

                {activeIncidents.length === 0 ? (
                  <div className="p-6 text-center text-muted text-xs bg-[#FAF8F5] rounded-xl border border-line space-y-1">
                    <CheckCircle2 className="w-6 h-6 text-[#2E7D32] mx-auto opacity-80" />
                    <div className="font-bold text-ink">All Incidents Triaged &amp; Resolved</div>
                    <div className="text-[11px] text-muted">No active hazard clusters cluttering the queue. Corridors operating normally.</div>
                  </div>
                ) : (
                  activeIncidents.map((cluster) => (
                    <div key={cluster.id} className="bg-[#FAF8F5] rounded-xl border border-line p-3.5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-xs text-ink">{cluster.cluster_id}</div>
                          <div className="text-[11px] text-muted">{cluster.location?.landmark_name}</div>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white text-brand border border-line">
                          {cluster.hazard_type}
                        </span>
                      </div>

                      <p className="text-xs text-muted leading-relaxed">
                        {cluster.notes}
                      </p>

                      {/* Attached Field Photo Preview (if uploaded) */}
                      {cluster.photo_preview && (
                        <div className="bg-white p-2 rounded-lg border border-line">
                          <span className="text-[10px] font-bold text-muted uppercase font-mono block mb-1">
                            {t('ops_ground_photo', 'Ground Truth Photo:')}
                          </span>
                          <div
                            onClick={() => setExpandedPhoto(cluster.photo_preview)}
                            className="relative h-24 rounded overflow-hidden cursor-pointer group border border-line"
                          >
                            <img
                              src={cluster.photo_preview}
                              alt="Incident Ground Photo"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                              <Eye className="w-4 h-4 mr-1" /> {t('ops_click_enlarge', 'Click to Enlarge')}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Incident Status Badge */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted uppercase">Status:</span>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                          cluster.status === 'approve_detour' || cluster.status === 'verified'
                            ? 'bg-[#FDECEA] text-[#D32F2F] border-[#D32F2F]'
                            : 'bg-white text-brand border-line'
                        }`}>
                          {(cluster.status || 'UNVERIFIED').toUpperCase()}
                        </span>
                      </div>

                      {/* Streamlined Triage Action Bar */}
                      <div className="pt-2 border-t border-line/60">
                        <div className="text-[10px] font-bold uppercase text-muted mb-1.5">
                          {t('ops_operator_decision', 'Operator Decision:')}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleTriageAction(cluster.id, 'approve_detour')}
                            className="flex-1 min-h-[36px] px-2.5 py-1 bg-brand hover:bg-brand-dark text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-xs transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{t('ops_corroborate_reroute_btn', 'Corroborate & Reroute (C2)')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTriageAction(cluster.id, 'resolve')}
                            className="min-h-[36px] px-2.5 py-1 bg-[#EDF7ED] hover:bg-[#D4EDDA] text-[#1E4620] border border-[#2E7D32]/30 rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-xs transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D32]" />
                            <span>{t('ops_mark_resolved_btn', 'Mark Incident Resolved')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTriageAction(cluster.id, 'false_positive')}
                            className="min-h-[36px] px-2.5 py-1 bg-white hover:bg-paper text-ink border border-line rounded-lg text-xs font-medium flex items-center justify-center gap-1 shadow-xs transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5 text-muted" />
                            <span>{t('ops_dismiss_btn', 'Dismiss')}</span>
                          </button>
                        </div>
                      </div>

                      {/* Vertical Audit Timeline */}
                      <div className="pt-2 border-t border-line/60">
                        <div className="text-[10px] font-bold uppercase text-muted mb-2">
                          {t('ops_audit_timeline', 'Audit Trail Timeline:')}
                        </div>
                        <AuditTimeline timeline={cluster.timeline} />
                      </div>
                    </div>
                  ))
                )}

                {/* Optional Expandable Archive of Resolved Incidents */}
                {resolvedIncidentsList.length > 0 && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowResolvedIncidents(!showResolvedIncidents)}
                      className="w-full py-1.5 px-3 bg-white hover:bg-paper text-muted hover:text-ink border border-line rounded-lg text-[11px] font-medium flex items-center justify-between transition-colors"
                    >
                      <span>Resolved / Cleared Incidents ({resolvedIncidentsList.length})</span>
                      <span className="font-mono text-[10px]">{showResolvedIncidents ? '▲ Hide History' : '▼ View History'}</span>
                    </button>
                    {showResolvedIncidents && (
                      <div className="space-y-2 mt-2 opacity-80">
                        {resolvedIncidentsList.map((cluster) => (
                          <div key={cluster.id} className="bg-white rounded-lg border border-line p-2.5 text-xs space-y-1">
                            <div className="flex items-center justify-between font-mono">
                              <span className="font-bold text-ink">{cluster.cluster_id}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                                RESOLVED
                              </span>
                            </div>
                            <div className="text-[11px] text-muted">{cluster.location?.landmark_name} · Closed &amp; Cleared</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 2. SOS QUEUE TAB (With Geodetic Telemetry, Photo Preview & SDMA Relay) */}
            {activeTab === 'sos' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink uppercase tracking-wide">
                    {t('ops_emergency_queue', 'Emergency Distress Queue')}
                  </span>
                  <HonestyBadge label="SIMULATION" size="xs" />
                </div>

                {activeSosQueue.length === 0 ? (
                  <div className="p-6 text-center text-muted text-xs bg-[#FAF8F5] rounded-xl border border-line space-y-1">
                    <CheckCircle2 className="w-6 h-6 text-[#2E7D32] mx-auto opacity-80" />
                    <div className="font-bold text-ink">{t('ops_all_distress_resolved', 'All Distress Signals Resolved')}</div>
                    <div className="text-[11px] text-muted">{t('ops_no_distress_pending', 'No pending emergency distress requests. System nominal.')}</div>
                  </div>
                ) : (
                  activeSosQueue.map((sos) => {
                    const lat = sos.location?.latitude?.toFixed(4) || '25.1147';
                    const lng = sos.location?.longitude?.toFixed(4) || '92.3654';
                    const isVerified = sos.status === 'verified' || sos.status === 'acknowledged' || sos.state === 'acknowledged';
                    const isRelayed = sos.status === 'relayed' || sos.status === 'assigned' || sos.state === 'assigned';
                    const isResolved = sos.status === 'resolved' || sos.state === 'resolved';

                    return (
                      <div
                        key={sos.id}
                        className={`rounded-xl border p-3.5 space-y-3 transition-colors ${
                          isRelayed
                            ? 'bg-[#E6F4F1]/30 border-brand/40 shadow-sm'
                            : isVerified
                            ? 'bg-[#F2F9F7] border-[#0F6E5D]/30 shadow-sm'
                            : 'bg-white border-line shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-bold text-xs text-ink font-mono flex items-center gap-1.5">
                              <span>{sos.id}</span>
                              {sos.vehicle_type && (
                                <span className="text-[10px] font-normal text-muted font-sans uppercase">
                                  ({sos.vehicle_type.replace('_', ' ')})
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted">{sos.location?.landmark_name}</div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            isRelayed
                              ? 'bg-[#E6F4F1] text-brand border-brand/30'
                              : isVerified
                              ? 'bg-[#EDF7ED] text-[#1E4620] border-[#2E7D32]/30'
                              : 'bg-[#FDECEA] text-[#D32F2F] border-[#D32F2F]'
                          }`}>
                            {isRelayed ? t('ops_relayed_1077', 'RELAYED EOC') : isVerified ? t('ops_beacon_verified', 'VERIFIED') : sos.urgency_level}
                          </span>
                        </div>

                        {/* Coordinates Telemetry & Locate Action */}
                        <div className="bg-white p-2.5 rounded-lg border border-line flex items-center justify-between gap-2 text-xs">
                          <div>
                            <div className="text-[10px] text-muted font-mono uppercase">
                              {t('ops_geodetic_coords', 'Geodetic Coordinates')}
                            </div>
                            <div className="font-mono font-bold text-ink">
                              {lat}°N, {lng}°E
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleLocateSOS(sos)}
                            className="min-h-[32px] px-2.5 py-1 bg-[#FAF8F5] hover:bg-[#E6F4F1] text-brand border border-brand/20 rounded-md text-xs font-bold flex items-center gap-1 transition-colors"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{t('ops_locate_btn', 'Locate')}</span>
                          </button>
                        </div>

                        {/* Status Label */}
                        <div className="text-xs text-ink font-medium bg-[#FAF8F5] p-2.5 rounded-lg border border-line">
                          <span className="font-semibold text-muted text-[10px] block uppercase font-mono mb-0.5">
                            {t('ops_docket_status', 'Docket Status:')}
                          </span>
                          <span>{sos.status_label || 'Signal Delivered to Queue — Awaiting Operator Review'}</span>
                        </div>

                        {/* Attached Field Photo Preview (if uploaded) */}
                        {sos.photo_preview && (
                          <div className="bg-white p-2 rounded-lg border border-line">
                            <span className="text-[10px] font-bold text-muted uppercase font-mono block mb-1">
                              {t('ops_ground_photo', 'Ground Truth Photo:')}
                            </span>
                            <div
                              onClick={() => setExpandedPhoto(sos.photo_preview)}
                              className="relative h-24 rounded overflow-hidden cursor-pointer group border border-line"
                            >
                              <img
                                src={sos.photo_preview}
                                alt="Driver Ground Photo"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                                <Eye className="w-4 h-4 mr-1" /> {t('ops_click_enlarge', 'Click to Enlarge')}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Operator Triage Verification Suite */}
                        <div className="pt-2 border-t border-line/60 space-y-1.5">
                          <div className="text-[10px] font-bold uppercase text-muted">
                            {t('ops_operator_triage', 'Operator Triage Actions:')}
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleVerifyBeacon(sos.id)}
                              disabled={isVerified}
                              className={`min-h-[34px] px-2 py-1 rounded text-[11px] font-bold flex items-center justify-center gap-1 transition-colors ${
                                isVerified
                                  ? 'bg-[#EDF7ED] text-[#1E4620] border border-[#2E7D32]/30 opacity-80 cursor-default'
                                  : 'bg-brand text-white hover:bg-brand-dark'
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{isVerified ? t('ops_beacon_verified', 'Beacon Verified') : t('ops_verify_beacon_btn', 'Verify Beacon')}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRelaySDMA(sos.id)}
                              className={`min-h-[34px] px-2 py-1 rounded text-[11px] font-bold flex items-center justify-center gap-1 transition-colors ${
                                isRelayed
                                  ? 'bg-[#E6F4F1] text-brand border border-brand/30'
                                  : 'bg-white hover:bg-paper text-ink border border-line'
                              }`}
                            >
                              <Radio className="w-3 h-3 text-brand" />
                              <span>{isRelayed ? t('ops_relayed_1077', 'Relayed 1077 EOC') : t('ops_relay_1077_btn', 'Relay 1077 EOC')}</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleResolveSOS(sos.id)}
                            className="w-full min-h-[32px] px-2 py-1.5 bg-[#FAF8F5] hover:bg-paper text-ink hover:text-brand border border-line hover:border-brand/40 rounded text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D32]" />
                            <span>{t('ops_mark_resolved_btn', 'Mark Incident Resolved')}</span>
                          </button>
                        </div>

                        {/* 4-Layer Cascade Summary */}
                        <div className="space-y-1 text-xs pt-1">
                          <div className="flex items-center justify-between p-1.5 bg-[#FAF8F5] border border-line rounded text-[11px]">
                            <span>L3 Hardware Hooks:</span>
                            <span className="font-mono text-[10px] font-bold text-[#1E4620]">
                              REAL HOOKS (sms:1077, tel:1077)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Collapsible Archive for Resolved SOS Dockets */}
                {resolvedSosList.length > 0 && (
                  <div className="pt-2 border-t border-line/50">
                    <button
                      type="button"
                      onClick={() => setShowResolvedSOS(!showResolvedSOS)}
                      className="w-full py-1.5 px-3 bg-white hover:bg-paper text-muted hover:text-ink border border-line rounded-lg text-[11px] font-medium flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D32]" />
                        <span>Resolved Dockets Archived ({resolvedSosList.length})</span>
                      </div>
                      <span className="font-mono text-[10px] text-muted">
                        {showResolvedSOS ? '▲ Hide Archive' : '▼ View Archive'}
                      </span>
                    </button>

                    {showResolvedSOS && (
                      <div className="space-y-2 mt-2">
                        {resolvedSosList.map((sos) => (
                          <div
                            key={sos.id}
                            className="p-3 bg-white/70 border border-line rounded-lg text-xs space-y-1.5 opacity-80"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-ink">{sos.id}</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-paper text-muted border border-line">
                                RESOLVED
                              </span>
                            </div>
                            <div className="text-[11px] text-muted">{sos.location?.landmark_name}</div>
                            <div className="text-[10px] text-muted font-mono">
                              Status: {sos.status_label || 'Resolved by NDMA Command'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 3. FLEET TAB */}
            {activeTab === 'fleet' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink uppercase tracking-wide">
                    {t('ops_simulated_fleet', 'Simulated Relief Convoys')}
                  </span>
                  <HonestyBadge label="SIMULATION" size="xs" />
                </div>

                <div className="space-y-2">
                  <div className="p-3 bg-[#FAF8F5] border border-line rounded-xl text-xs space-y-1">
                    <div className="flex justify-between font-bold text-ink">
                      <span>Convoy ALPHA-16T (Medical/Diesel)</span>
                      <span className="text-brand">On Route</span>
                    </div>
                    <div className="text-muted text-[11px]">Corridor: NH-6 Sonapur Sector (310km)</div>
                    <div className="text-muted text-[11px] font-mono">Modifier: HCV (1.35x risk weight, 0.35 L/km)</div>
                  </div>

                  <div className="p-3 bg-[#FAF8F5] border border-line rounded-xl text-xs space-y-1">
                    <div className="flex justify-between font-bold text-ink">
                      <span>Convoy BRAVO-LCV (Food Supply)</span>
                      <span className="text-brand">Detouring NH-27</span>
                    </div>
                    <div className="text-muted text-[11px]">Corridor: Haflong Bypass (362km)</div>
                    <div className="text-muted text-[11px] font-mono">ETA: 536 min · Low Hazard Exposure</div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. SCENARIO CONTROLS TAB */}
            {activeTab === 'scenario' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink uppercase tracking-wide">
                    {t('ops_hazard_injections', 'Hazard Injections & Overrides')}
                  </span>
                  <HonestyBadge label="SIMULATION" size="xs" />
                </div>

                <div className="space-y-3 text-xs">
                  <label className="flex items-center justify-between p-3 bg-[#FAF8F5] border border-line rounded-xl cursor-pointer">
                    <div>
                      <div className="font-bold text-ink">{t('ops_sonapur_toggle', 'Inject Landslide at Sonapur Tunnel (C1)')}</div>
                      <div className="text-[11px] text-muted">{t('ops_sonapur_sub', 'Forces hard veto on Corridor C1')}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={injectSonapur}
                      onChange={(e) => {
                        setInjectSonapur(e.target.checked);
                        updateSimulation({ inject_hazard_sonapur: e.target.checked });
                      }}
                      className="w-4 h-4 accent-brand cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-[#FAF8F5] border border-line rounded-xl cursor-pointer">
                    <div>
                      <div className="font-bold text-ink">{t('ops_haflong_toggle', 'Inject Landslide at Haflong Bypass (C2)')}</div>
                      <div className="text-[11px] text-muted">{t('ops_haflong_sub', 'Simulates dual ground blockage (Triggers C3 Failover)')}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={injectHaflong}
                      onChange={(e) => {
                        setInjectHaflong(e.target.checked);
                        updateSimulation({ inject_hazard_haflong: e.target.checked });
                      }}
                      className="w-4 h-4 accent-brand cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-[#FAF8F5] border border-line rounded-xl cursor-pointer">
                    <div>
                      <div className="font-bold text-ink">{t('ops_ndma_toggle', 'Enforce NDMA Administrative Override (Full Transit Halt)')}</div>
                      <div className="text-[11px] text-muted">{t('ops_ndma_sub', 'Authority lockdown of all mountain transit')}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={ndmaOverride}
                      onChange={(e) => {
                        setNdmaOverride(e.target.checked);
                        updateSimulation({ ndma_override: e.target.checked });
                      }}
                      className="w-4 h-4 accent-brand cursor-pointer"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={handleResetBaseline}
                  className="w-full min-h-touch py-2.5 px-4 bg-brand hover:bg-brand-dark text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                >
                  {t('ops_reset_all_btn', 'Reset All to Baseline State (68mm)')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
