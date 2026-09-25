'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  RotateCw,
  AlertTriangle,
  Smartphone,
  ShieldAlert,
  CloudRain,
} from 'lucide-react';

import DynamicLeafletMap from '../../components/map/DynamicLeafletMap';
import RouteCard from '../../components/driver/RouteCard';
import TradeOffPanel from '../../components/driver/TradeOffPanel';
import UnifiedSOSButton from '../../components/sos/UnifiedSOSButton';
import LocationSearchBar from '../../components/search/LocationSearchBar';
import { HonestyBadge } from '../../lib/labels';
import { evaluateRoutes } from '../../lib/api';
import { useTranslation } from '../../lib/i18n';
import { fetchLiveWeatherSonapur } from '../../lib/services/weatherLive';

/**
 * MargSetu Driver HUD (/driver)
 * Spec Reference: DESIGN.md (FINAL v2) §3 & SIH 2026 Mobile Ergonomics
 * - 360px Mobile-first container
 * - EMERGENCY SOS AT THE ABSOLUTE TOP: Above the fold, immediate access without scrolling
 * - Search bar with 1-click Northeast POI chips (Sonapur, Haflong, Silchar, etc.)
 * - Clean paper aesthetic (#FAF8F5)
 * - Map with live corridor polyline
 * - Detour TradeOff panel (zero rupees: distance, time, fuel volume, hazard cut)
 * - Full reactive multilingual support (EN / HI / AS)
 */
export default function DriverHudPage() {
  const { t } = useTranslation();
  const [routesData, setRoutesData] = useState(null);
  const [selectedCorridorId, setSelectedCorridorId] = useState('C1');
  const [targetLocation, setTargetLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDesktopNotice, setShowDesktopNotice] = useState(true);
  const [liveWeather, setLiveWeather] = useState(null);
  const [useLiveWeather, setUseLiveWeather] = useState(false);
  const [injectSonapurHazard, setInjectSonapurHazard] = useState(false);

  // Driver Location: Near Sonapur Tunnel Portal (Barak Valley chokepoint)
  const driverLocation = {
    latitude: 25.1147,
    longitude: 92.3654,
    landmark_name: 'Sonapur Tunnel Portal (NH-6)',
  };

  useEffect(() => {
    fetchLiveWeatherSonapur().then((w) => {
      if (w) setLiveWeather(w);
    });
  }, []);

  const loadRoutes = useCallback(async (liveSyncActive = useLiveWeather, sonapurBlocked = injectSonapurHazard) => {
    setLoading(true);
    try {
      const rain = liveSyncActive && liveWeather ? liveWeather.precipitation_mm : 68.0;
      const res = await evaluateRoutes({
        rainfall_mm: rain,
        inject_hazard_sonapur: sonapurBlocked,
      });
      const data = res.data || {};
      setRoutesData(data);
      const recommended = data.recommended_corridor_id || (sonapurBlocked ? 'C2' : (data.recommended_route_type === 'resilient' ? 'C2' : 'C1'));
      setSelectedCorridorId(recommended);
    } catch (e) {
      console.error('Failed to load routes:', e);
    } finally {
      setLoading(false);
    }
  }, [useLiveWeather, liveWeather, injectSonapurHazard]);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  const rawRoutes = routesData?.routes || [];
  const routesList = rawRoutes.map((r, idx) => {
    const evalData = r.evaluation || r;
    const cid = r.corridor_id || evalData.corridor_id || (idx === 1 ? 'C2' : 'C1');
    const isBlk = r.is_blocked !== undefined ? r.is_blocked : Boolean(evalData.is_blocked);
    return {
      ...r,
      corridor_id: cid,
      is_blocked: isBlk,
      average_risk_score: evalData.average_risk_score,
      evaluation: evalData,
    };
  });

  const recommendedId = routesData?.recommended_corridor_id || (injectSonapurHazard ? 'C2' : 'C1');
  const activeRoute = routesList.find((r) => r.corridor_id === selectedCorridorId) || routesList[0];
  const isC1Vetoed = routesList.some((r) => r.corridor_id === 'C1' && r.is_blocked) || injectSonapurHazard;
  const showDetourTradeoff = recommendedId === 'C2' || selectedCorridorId === 'C2' || isC1Vetoed;

  return (
    <div className="min-h-screen bg-paper text-ink pb-12">
      {/* Viewport >500px Responsive Notice */}
      {showDesktopNotice && (
        <div className="bg-[#FFF8E1] border-b border-[#E08A00]/30 px-4 py-2 text-center text-xs font-medium text-[#663C00] flex items-center justify-center gap-2">
          <Smartphone className="w-4 h-4 text-[#E08A00]" />
          <span>
            This view is optimized for a phone (360px). Use DevTools device emulation or shrink your browser for the intended mobile driver experience.
          </span>
          <button
            onClick={() => setShowDesktopNotice(false)}
            className="text-[11px] underline font-bold ml-2 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 360px Mobile Container */}
      <div className="max-w-[420px] mx-auto px-3.5 py-4 space-y-4">
        {/* Top 44px Status Bar */}
        <div className="flex items-center justify-between min-h-[44px] bg-white border border-line rounded-xl px-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse" />
            <span className="font-bold text-xs text-ink font-mono tracking-tight">
              {t('driver_hud_title', 'DRIVER CONVOY HUD')}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {liveWeather && (
              <button
                type="button"
                onClick={() => {
                  const nextSync = !useLiveWeather;
                  setUseLiveWeather(nextSync);
                  loadRoutes(nextSync);
                }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors ${
                  useLiveWeather
                    ? 'bg-[#E6F4F1] text-brand border-brand/30 shadow-xs'
                    : 'bg-[#FAF8F5] text-muted border-line hover:text-ink'
                }`}
                title={useLiveWeather ? 'Live Weather Active (Click for Baseline 68mm)' : 'Click to Sync Live Open-Meteo Weather'}
              >
                <CloudRain className="w-3 h-3 text-brand" />
                <span>{useLiveWeather ? `${liveWeather.precipitation_mm.toFixed(1)}mm LIVE` : 'SYNC RAIN'}</span>
              </button>
            )}
            <HonestyBadge label={useLiveWeather ? 'LIVE API' : 'SIMULATION'} size="xs" />
            <button
              type="button"
              onClick={() => loadRoutes()}
              className="p-1 text-muted hover:text-ink transition-colors"
              title="Refresh Corridor Telemetry"
              aria-label="Refresh route telemetry"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Disaster Detour Simulator Bar for YouTube Video Demonstration */}
        <div className="bg-amber-50 border border-amber-300/80 rounded-xl p-2.5 flex items-center justify-between text-xs shadow-xs">
          <div className="flex items-center gap-1.5 font-bold text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Landslide Detour Demo:</span>
          </div>
          <div className="flex items-center gap-1.5">
            {!injectSonapurHazard ? (
              <button
                type="button"
                onClick={() => {
                  setInjectSonapurHazard(true);
                  loadRoutes(useLiveWeather, true);
                }}
                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[11px] transition-transform active:scale-95 shadow-xs"
              >
                Block NH-6 (Sonapur)
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setInjectSonapurHazard(false);
                  loadRoutes(useLiveWeather, false);
                }}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition-transform active:scale-95 shadow-xs"
              >
                Clear Route
              </button>
            )}
          </div>
        </div>

        {/* PRIORITY #1: SOS BUTTON AT ABSOLUTE TOP (Above the fold for immediate life safety) */}
        <section aria-label="Emergency SOS Action" className="w-full">
          <div className="bg-white border-2 border-[#D32F2F]/40 rounded-2xl p-4 shadow-sm flex flex-col items-center">
            <div className="text-center mb-2.5">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#D32F2F] uppercase tracking-wide">
                <ShieldAlert className="w-4 h-4" />
                <span>{t('driver_sos_heading', 'Emergency Lifeline Trigger')}</span>
              </div>
              <p className="text-[10px] text-muted mt-0.5">
                {t('driver_sos_sub', 'Layer 1 local cache → Layer 3 native SMS 1077 fallback')}
              </p>
            </div>

            <UnifiedSOSButton
              location={driverLocation}
              vehicleType="heavy_freight"
              onTriggered={(data) => {
                console.log('[Driver HUD] SOS Distress Triggered:', data);
              }}
            />
          </div>
        </section>

        {/* 1-Tap Search & Mountain POI Chips */}
        <section aria-label="Route Search">
          <LocationSearchBar onSelectLocation={(loc) => setTargetLocation(loc)} />
        </section>

        {/* Map (~240px) */}
        <section aria-label="Route Map">
          <DynamicLeafletMap
            activeRouteId={selectedCorridorId}
            isSonapurBlocked={isC1Vetoed}
            driverLocation={driverLocation}
            targetLocation={targetLocation}
            riskScore={activeRoute?.average_risk_score || 2.40}
            height="240px"
          />
        </section>

        {/* Trade-off Panel (Appears on Detour to C2) - ZERO RUPEE METRICS */}
        {showDetourTradeoff && (
          <section aria-label="Detour Trade-Off">
            <TradeOffPanel
              detourKm={routesData?.tradeoff?.detour_km || 42.0}
              addedTimeMin={routesData?.tradeoff?.added_time_minutes || 56.0}
              addedFuelLiters={14.7}
              exposureReductionPct={routesData?.tradeoff?.hazard_exposure_reduction_pct || 99.2}
              addedCarbonKg={routesData?.tradeoff?.added_carbon_kg || 39.4}
            />
          </section>
        )}

        {/* Evaluated Route Cards */}
        <section aria-label="Evaluated Highway Corridors" className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted font-mono">
              {t('driver_corridor_options', 'Corridor Options')} ({routesList.length})
            </h2>
            <span className="text-[10px] text-muted font-sans">
              {t('driver_tap_to_select', 'Tap card to select route')}
            </span>
          </div>

          {routesList.map((route, idx) => {
            const cid = route.corridor_id || route.evaluation?.corridor_id || (idx === 1 ? 'C2' : 'C1');
            const isRec = cid === recommendedId;
            const isSel = cid === selectedCorridorId;
            return (
              <RouteCard
                key={`${route.route_type || 'route'}-${cid}-${idx}`}
                route={route}
                isRecommended={isRec}
                isSelected={isSel}
                onSelect={() => setSelectedCorridorId(cid)}
              />
            );
          })}
        </section>

        {/* Secondary Action: 1-Tap Hazard Reporting Button */}
        <section aria-label="Report Hazard Action">
          <Link
            href="/report"
            className="w-full min-h-touch py-3 px-4 bg-white hover:bg-paper active:bg-white border border-line rounded-xl text-xs font-bold text-ink uppercase tracking-wide flex items-center justify-center gap-2 shadow-xs transition-colors"
          >
            <AlertTriangle className="w-4 h-4 text-[#E08A00]" />
            <span>{t('driver_report_hazard', 'Report Road Hazard / Obstruction')}</span>
          </Link>
        </section>

        {/* Footer Disclaimers */}
        <footer className="pt-2 text-center text-[10px] text-muted font-sans border-t border-line space-y-1">
          <p className="font-semibold text-[#8B1A1A]">
            {t('driver_disclaimer_1', 'MargSetu is not a replacement for official emergency services.')}
          </p>
          <p>
            {t('driver_disclaimer_2', 'SIMULATION — not connected to official NDMA systems. Sole Authority: NDMA.')}
          </p>
        </footer>
      </div>
    </div>
  );
}
