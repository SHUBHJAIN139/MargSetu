'use client';

import React from 'react';
import { ArrowRightLeft, ShieldCheck, Fuel, Clock, Gauge } from 'lucide-react';
import { HonestyBadge } from '../../lib/labels';
import { useTranslation } from '../../lib/i18n';

/**
 * Detour Trade-off Panel
 * Spec: DESIGN.md (FINAL v2) §3 & SIH 2026 Logistics Spec
 * Renders cleanly when route diverges to C2 Haflong detour:
 * "+42 km · +56 min · +14.7 L · −99.2% exposure"
 * NO monetary / rupee metrics per humanitarian logistics requirements.
 */
export default function TradeOffPanel({
  detourKm = 42.0,
  addedTimeMin = 56.0,
  addedFuelLiters = 14.7,
  exposureReductionPct = 99.2,
  addedCarbonKg = 39.4,
}) {
  const { t } = useTranslation();

  return (
    <div className="w-full bg-white rounded-xl border border-line p-4 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-brand" />
          <span className="text-xs font-bold text-ink uppercase tracking-wide">
            {t('tradeoff_title', 'Detour Trade-Off Analysis')}
          </span>
        </div>
        <HonestyBadge label="VERIFIED STATIC" size="xs" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        {/* Extra Distance */}
        <div className="bg-[#FAF8F5] border border-line rounded-lg p-2">
          <div className="text-[10px] text-muted font-medium uppercase flex items-center justify-center gap-1">
            <Gauge className="w-3 h-3 text-muted" />
            <span>{t('tradeoff_distance', 'Distance')}</span>
          </div>
          <div className="text-sm font-bold text-ink tabular-nums mt-0.5">
            +{detourKm.toFixed(0)} km
          </div>
        </div>

        {/* Extra Travel Time */}
        <div className="bg-[#FAF8F5] border border-line rounded-lg p-2">
          <div className="text-[10px] text-muted font-medium uppercase flex items-center justify-center gap-1">
            <Clock className="w-3 h-3 text-muted" />
            <span>{t('tradeoff_eta', 'ETA Delta')}</span>
          </div>
          <div className="text-sm font-bold text-ink tabular-nums mt-0.5">
            +{addedTimeMin.toFixed(0)} min
          </div>
        </div>

        {/* Extra Fuel Volume (Physical diesel volume in liters, NO rupees) */}
        <div className="bg-[#FAF8F5] border border-line rounded-lg p-2">
          <div className="text-[10px] text-muted font-medium uppercase flex items-center justify-center gap-1">
            <Fuel className="w-3 h-3 text-muted" />
            <span>{t('tradeoff_fuel_volume', 'Fuel Volume')}</span>
          </div>
          <div className="text-sm font-bold text-ink tabular-nums mt-0.5">
            +{addedFuelLiters.toFixed(1)} L
          </div>
        </div>

        {/* Hazard Exposure Reduction */}
        <div className="bg-[#EDF7ED] border border-[#2E7D32]/30 rounded-lg p-2">
          <div className="text-[10px] text-[#1E4620] font-bold uppercase flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[#2E7D32]" />
            <span>{t('tradeoff_hazard_cut', 'Hazard Cut')}</span>
          </div>
          <div className="text-sm font-bold text-[#1E4620] tabular-nums mt-0.5">
            −{exposureReductionPct.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Carbon Note */}
      <div className="mt-2.5 pt-2 border-t border-line/60 flex items-center justify-between text-[11px] text-muted">
        <span>{t('tradeoff_carbon_note', 'Operational Carbon Footprint (16T Truck):')}</span>
        <span className="font-mono font-bold text-ink">+{addedCarbonKg.toFixed(1)} kg CO₂</span>
      </div>
    </div>
  );
}
