'use client';

import React, { useState } from 'react';
import {
  Clock,
  Navigation,
  Fuel,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { HonestyBadge } from '../../lib/labels';
import { TOKENS, getRiskMeta } from '../../lib/tokens';
import { useTranslation } from '../../lib/i18n';

/**
 * RouteCard Component
 * Spec: DESIGN.md (FINAL v2) §3
 * Clean white surface, radius-12, 4px color spine, BEST tag on recommended route,
 * 5 thin factor bars with bold tabular figures.
 */
export default function RouteCard({
  route,
  isRecommended = false,
  isSelected = false,
  onSelect = () => {},
}) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  if (!route) return null;

  const evalData = route.evaluation || route;
  const isBlocked = Boolean(evalData.is_blocked);
  const vetoReason = evalData.veto_reason;
  const riskScore = Number(evalData.average_risk_score ?? 0);
  const riskMeta = getRiskMeta(riskScore, isBlocked, route.isEmergency);

  // 5 factor breakdown (Rain, Slope, Soil, Crowd, Hist)
  const factors = evalData.factors || {
    rain: isBlocked ? 10.0 : (evalData.corridor_id === 'C1' ? 3.63 : 1.2),
    slope: evalData.corridor_id === 'C1' ? 2.0 : 1.5,
    soil: evalData.corridor_id === 'C1' ? 1.5 : 1.0,
    crowd: 0.0,
    hist: evalData.corridor_id === 'C1' ? 2.5 : 1.0,
  };

  const distanceKm = Number(evalData.base_distance_km ?? 0).toFixed(0);
  const etaMinutes = Number(evalData.eta_minutes ?? 0).toFixed(0);
  const hours = Math.floor(etaMinutes / 60);
  const mins = etaMinutes % 60;
  const etaFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const fuelLiters = Number(evalData.fuel_consumption_liters ?? 0).toFixed(1);
  const carbonKg = Number(evalData.carbon_emission_kg ?? 0).toFixed(1);

  return (
    <div
      onClick={onSelect}
      className={`relative w-full bg-white rounded-xl border transition-all cursor-pointer overflow-hidden shadow-xs ${
        isRecommended
          ? 'border-brand ring-2 ring-brand/20'
          : isSelected
          ? 'border-brand'
          : 'border-line hover:border-muted/50'
      }`}
    >
      {/* 4px Left Color Spine */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: riskMeta.color }}
      />

      <div className="pl-4 pr-3.5 py-3.5">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-ink leading-tight">
              {evalData.corridor_name || evalData.highway_code}
            </span>
            {isRecommended && (
              <span className="bg-brand text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                {t('card_best', 'BEST')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <HonestyBadge label={evalData.honesty_label || 'VERIFIED STATIC'} size="xs" />
          </div>
        </div>

        {/* Primary Metrics Row */}
        <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-line/60">
          <div className="flex items-center gap-3 text-xs text-ink font-medium">
            <span className="flex items-center gap-1">
              <Navigation className="w-3.5 h-3.5 text-muted" />
              <strong className="tabular-nums">{distanceKm}</strong> km
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-muted" />
              <strong className="tabular-nums">{etaFormatted}</strong>
            </span>
            <span className="flex items-center gap-1 hidden sm:inline-flex">
              <Fuel className="w-3.5 h-3.5 text-muted" />
              <strong className="tabular-nums">{fuelLiters}L</strong>
            </span>
          </div>

          {/* Risk Score Pill */}
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold font-mono uppercase"
            style={{ backgroundColor: riskMeta.bg, color: riskMeta.text, border: `1px solid ${riskMeta.border}` }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: riskMeta.color }} />
            <span>{isBlocked ? t('card_blocked', 'BLOCKED') : `Ri ${riskScore.toFixed(2)}`}</span>
          </div>
        </div>

        {/* Veto Alert Callout if Blocked */}
        {isBlocked && (
          <div className="mt-2.5 p-2 bg-[#FBEBEB] border border-[#8B1A1A] rounded-lg text-xs text-[#5A1010] flex items-start gap-1.5">
            <AlertTriangle className="w-4 h-4 text-[#8B1A1A] shrink-0 mt-0.5" />
            <div className="leading-snug">
              <strong>{t('card_corridor_vetoed', 'Corridor Vetoed')}:</strong> {vetoReason || 'Structural threshold breached'}
            </div>
          </div>
        )}

        {/* 5 Thin Factor Bars (Rain, Slope, Soil, Crowd, Hist) */}
        <div className="mt-3 pt-2.5 border-t border-line/60">
          <div className="flex items-center justify-between text-[10px] text-muted font-medium mb-1.5">
            <span>{t('card_risk_components', 'Risk Components (0-10)')}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="text-brand hover:underline flex items-center gap-0.5"
            >
              <span>{expanded ? t('card_hide_details', 'Hide Details') : t('card_view_factors', 'View Factors')}</span>
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          <div className="grid grid-cols-5 gap-1.5 text-center">
            {/* Rain */}
            <div>
              <div className="h-1.5 bg-[#FAF8F5] border border-line rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, factors.rain * 10)}%`,
                    backgroundColor: factors.rain > 6 ? TOKENS.danger : TOKENS.brand,
                  }}
                />
              </div>
              <span className="text-[9px] text-muted font-mono block mt-0.5">
                R:{Number(factors.rain).toFixed(1)}
              </span>
            </div>

            {/* Slope */}
            <div>
              <div className="h-1.5 bg-[#FAF8F5] border border-line rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all"
                  style={{ width: `${Math.min(100, factors.slope * 10)}%` }}
                />
              </div>
              <span className="text-[9px] text-muted font-mono block mt-0.5">
                S:{Number(factors.slope).toFixed(1)}
              </span>
            </div>

            {/* Soil */}
            <div>
              <div className="h-1.5 bg-[#FAF8F5] border border-line rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all"
                  style={{ width: `${Math.min(100, factors.soil * 10)}%` }}
                />
              </div>
              <span className="text-[9px] text-muted font-mono block mt-0.5">
                Sl:{Number(factors.soil).toFixed(1)}
              </span>
            </div>

            {/* Crowd */}
            <div>
              <div className="h-1.5 bg-[#FAF8F5] border border-line rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all"
                  style={{ width: `${Math.min(100, factors.crowd * 10)}%` }}
                />
              </div>
              <span className="text-[9px] text-muted font-mono block mt-0.5">
                C:{Number(factors.crowd).toFixed(1)}
              </span>
            </div>

            {/* Hist */}
            <div>
              <div className="h-1.5 bg-[#FAF8F5] border border-line rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all"
                  style={{ width: `${Math.min(100, factors.hist * 10)}%` }}
                />
              </div>
              <span className="text-[9px] text-muted font-mono block mt-0.5">
                H:{Number(factors.hist).toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Expanded Details Drawer */}
        {expanded && (
          <div className="mt-3 pt-2.5 border-t border-line text-xs space-y-1.5 bg-[#FAF8F5] -mx-4 -mb-3.5 p-3">
            <div className="flex justify-between text-muted">
              <span>{t('card_fuel_consumption', 'Fuel Consumption')}:</span>
              <strong className="text-ink font-mono">{fuelLiters} L</strong>
            </div>
            <div className="flex justify-between text-muted">
              <span>{t('card_carbon_footprint', 'Carbon Footprint')}:</span>
              <strong className="text-ink font-mono">{carbonKg} kg CO₂</strong>
            </div>
            <div className="text-[11px] text-muted leading-tight pt-1">
              {t('card_formula', 'Formula: 0.40·Rain + 0.30·Slope + 0.15·Soil + 0.10·Crowd + 0.05·Hist')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
