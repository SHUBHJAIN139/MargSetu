'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MapPin,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Info,
  Navigation,
} from 'lucide-react';
import DynamicLeafletMap from '../../components/map/DynamicLeafletMap';
import LocationSearchBar from '../../components/search/LocationSearchBar';
import { HonestyBadge } from '../../lib/labels';
import { evaluateRoutes } from '../../lib/api';
import { useTranslation } from '../../lib/i18n';

/**
 * Public Corridors Trust Page
 * Spec Reference: DESIGN.md (FINAL v2) §3 & SIH 2026 Explorer
 * Displays:
 * - Interactive Location Search Bar (OSM Nominatim + Preset Northeast Hubs)
 * - Mapbox Outdoors (Terrain) / Carto Positron basemaps
 * - 6-state status legend with dual encoding (color + dashed/solid pattern)
 * - Click-line-for-record details drawer
 * - Full reactive multilingual translation (EN / HI / AS)
 */
export default function CorridorsPage() {
  const { t } = useTranslation();
  const [routesData, setRoutesData] = useState([]);
  const [selectedCorridorId, setSelectedCorridorId] = useState('C1');
  const [targetLocation, setTargetLocation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await evaluateRoutes({ rainfall_mm: 68.0 });
        setRoutesData(res.data?.routes || []);
      } catch (e) {
        console.error('Failed to load corridor routes:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const activeRoute = routesData.find((r) => r.corridor_id === selectedCorridorId) || routesData[0];

  const legendStates = [
    { label: t('legend_no_risk', 'No Risk (<2.0)'), color: '#2E7D32', pattern: 'Solid', desc: t('legend_no_risk_desc', 'Clear mountain segment') },
    { label: t('legend_medium', 'Medium (2.0-4.0)'), color: '#16A34A', pattern: 'Solid', desc: t('legend_medium_desc', 'Nominal monsoon conditions') },
    { label: t('legend_heavy', 'Heavy (4.0-6.0)'), color: '#E08A00', pattern: 'Solid', desc: t('legend_heavy_desc', 'Caution: slow heavy transit') },
    { label: t('legend_very_heavy', 'Very Heavy (6.0-7.0)'), color: '#EA580C', pattern: 'Dashed', desc: t('legend_very_heavy_desc', 'High slope saturation') },
    { label: t('legend_extreme', 'Extreme (>7.0)'), color: '#C62828', pattern: 'Dashed', desc: t('legend_extreme_desc', 'Active hazard cluster') },
    { label: t('legend_blocked', 'Dangerous / Blocked'), color: '#8B1A1A', pattern: 'Dashed', desc: t('legend_blocked_desc', 'Structural Veto (>75mm rain)') },
  ];

  const handleLocationSelect = (loc) => {
    setTargetLocation(loc);
    // If user clicked Sonapur or Haflong, also select corresponding corridor
    if (loc.name?.includes('Sonapur')) {
      setSelectedCorridorId('C1');
    } else if (loc.name?.includes('Haflong')) {
      setSelectedCorridorId('C2');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-ink tracking-tight">
              {t('corridors_title', 'Northeast Lifeline Corridors')}
            </h1>
            <HonestyBadge label="VERIFIED STATIC" size="xs" />
          </div>
          <p className="text-xs text-muted max-w-2xl">
            {t(
              'corridors_subtitle',
              'Verifiable multi-factor risk telemetry for Northeast lifeline arteries. Click a corridor line or search a mountain junction.'
            )}
          </p>
        </div>

        {/* Find Paths CTA */}
        <Link
          href="/driver"
          className="min-h-touch px-4 py-2 bg-brand hover:bg-brand-dark text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors shrink-0"
        >
          <span>{t('find_safe_paths', 'Find Safe Paths')}</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Location Search Bar with Preset Northeast Hubs */}
      <div className="bg-white border border-line rounded-2xl p-4 shadow-xs">
        <LocationSearchBar
          onLocationSelect={handleLocationSelect}
          placeholder={t('corridors_search_placeholder', 'Search Northeast location (e.g. Sonapur Tunnel, Haflong Bypass, Silchar)...')}
          showPresetChips={true}
        />
      </div>

      {/* Main Grid: Map & Details Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Leaflet Map + 6-State Legend */}
        <div className="lg:col-span-8 space-y-4">
          <DynamicLeafletMap
            activeRouteId={selectedCorridorId}
            isSonapurBlocked={activeRoute?.is_blocked}
            riskScore={activeRoute?.average_risk_score || 2.40}
            targetLocation={targetLocation}
            height="460px"
            onCorridorSelect={(id) => setSelectedCorridorId(id)}
          />

          {/* 6-State Status Legend (Dual Encoding: Color + Pattern) */}
          <div className="bg-white rounded-xl border border-line p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-ink uppercase tracking-wide">
                {t('corridors_legend_title', 'Classification Legend (Dual Pattern Encoded)')}
              </span>
              <span className="text-[10px] text-muted font-mono">
                Solid = Floodplain | Dashed = Landslide Sector
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {legendStates.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 p-2 rounded-lg bg-[#FAF8F5] border border-line text-left"
                >
                  <div
                    className={`w-3.5 h-3.5 rounded-xs shrink-0 ${
                      item.pattern === 'Dashed' ? 'border-2 border-dashed' : 'border'
                    }`}
                    style={{ backgroundColor: item.color, borderColor: item.color }}
                  />
                  <div className="overflow-hidden">
                    <div className="text-[11px] font-bold text-ink truncate">{item.label}</div>
                    <div className="text-[10px] text-muted truncate">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Corridor Cards List & Telemetry Record */}
        <div className="lg:col-span-4 space-y-4">
          {/* Corridor Cards List */}
          <div className="space-y-3">
            {routesData.map((corridor) => {
              const isSelected = corridor.corridor_id === selectedCorridorId;
              return (
                <div
                  key={corridor.corridor_id}
                  onClick={() => setSelectedCorridorId(corridor.corridor_id)}
                  className={`bg-white rounded-xl border p-3.5 cursor-pointer transition-all shadow-xs ${
                    isSelected
                      ? 'border-brand ring-2 ring-brand/20'
                      : 'border-line hover:border-muted/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm text-ink leading-tight">
                        {corridor.corridor_name}
                      </div>
                      <div className="text-[11px] text-muted font-mono mt-0.5">
                        {corridor.highway_code} · {corridor.base_distance_km} km
                      </div>
                    </div>
                    <HonestyBadge label="VERIFIED STATIC" size="xs" />
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-line/60 flex items-center justify-between text-xs">
                    <span className="text-muted">
                      Risk Index: <strong className="text-ink font-mono">{Number(corridor.average_risk_score).toFixed(2)}</strong>/10
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        corridor.is_blocked
                          ? 'bg-[#FBEBEB] text-[#5A1010] border border-[#8B1A1A]'
                          : 'bg-[#EDF7ED] text-[#1E4620] border border-[#2E7D32]'
                      }`}
                    >
                      {corridor.is_blocked ? t('card_blocked', 'BLOCKED') : t('card_passable', 'PASSABLE')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Corridor Record Card */}
          {activeRoute && (
            <div className="bg-[#FAF8F5] rounded-xl border border-line p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-brand" />
                <span className="text-xs font-bold text-ink uppercase tracking-wide">
                  {t('corridor_record_details', 'Record Details')}: {activeRoute.corridor_id}
                </span>
              </div>

              <div className="text-xs text-muted space-y-1.5 leading-relaxed">
                <p>
                  <strong>{t('corridor_chokepoints_label', 'Surveyed Chokepoints:')}</strong>{' '}
                  {t('corridor_chokepoints_val', 'Sonapur Tunnel (25.1147°N, 92.3654°E), Nongpoh, Khliehriat slope cutting.')}
                </p>
                <p>
                  <strong>{t('corridor_threshold_label', 'Structural Threshold:')}</strong>{' '}
                  {t('corridor_threshold_val', '75.0 mm/h precipitation triggers immediate automatic veto.')}
                </p>
                <p>
                  <strong>{t('corridor_carbon_label', 'Operational Carbon:')}</strong>{' '}
                  {t('corridor_carbon_val', '~300 kg CO₂ per 16-ton convoy under nominal conditions.')}
                </p>
              </div>

              <div className="pt-2 border-t border-line/60 flex items-center justify-between text-xs">
                <span className="text-muted font-mono text-[10px]">{t('corridor_provenance_label', 'Data Provenance:')}</span>
                <span className="font-bold text-brand">{t('corridor_provenance_val', 'MoRTH & NDMA GIS Survey')}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
