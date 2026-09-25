'use client';

import React from 'react';
import { ArrowRight, Fuel, Clock, MapPin, Leaf, ShieldCheck, AlertCircle } from 'lucide-react';
import HonestyBadge from '../common/HonestyBadge';

/**
 * TradeOffPanel Component.
 * Visible on /ops when C2 detour is active due to C1 hazard.
 * PRD Reference: §3, §8, §10.
 * Quantifies trade-offs: +42 km, +56 min, +14.7 L fuel, -99.2% hazard reduction.
 */
export default function TradeOffPanel({ tradeOff, onClose, onSelectCorridor }) {
  if (!tradeOff) return null;

  const addedDistance = tradeOff.added_distance_km ?? 42.0;
  const addedTime = tradeOff.added_time_minutes ?? 56.0;
  const fuelDiff = tradeOff.fuel_cost_diff_inr ?? 1411.0;
  const carbonDelta = tradeOff.carbon_delta_kg ?? 39.4;
  const hazardReduction = tradeOff.hazard_exposure_reduction_pct ?? 99.2;

  return (
    <div className="bg-slate-900/95 border border-amber-500/50 rounded-lg p-4 shadow-xl backdrop-blur-md">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              ACTIVE DETOUR FAILOVER
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                NH-6 (C1) ➔ NH-27 (C2)
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated multi-factor corridor detour recommended due to Sonapur Tunnel hard-veto.
            </p>
          </div>
        </div>
        <HonestyBadge label={tradeOff.honesty_label || 'SIMULATION'} size="xs" />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 my-3">
        {/* Added Distance */}
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-md p-2.5 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <MapPin className="w-3.5 h-3.5 text-sky-400" />
            <span>DISTANCE</span>
          </div>
          <div className="mt-1.5">
            <span className="text-base font-bold font-mono text-amber-400">+{addedDistance.toFixed(1)}</span>
            <span className="text-xs text-slate-400 ml-1 font-mono">km</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">310 km ➔ 352 km</div>
        </div>

        {/* Added Transit Time */}
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-md p-2.5 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>TRANSIT TIME</span>
          </div>
          <div className="mt-1.5">
            <span className="text-base font-bold font-mono text-amber-400">+{addedTime.toFixed(0)}</span>
            <span className="text-xs text-slate-400 ml-1 font-mono">min</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">9.5h ➔ 10.4h</div>
        </div>

        {/* Fuel Volume Delta */}
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-md p-2.5 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <Fuel className="w-3.5 h-3.5 text-orange-400" />
            <span>ADDITIONAL FUEL</span>
          </div>
          <div className="mt-1.5">
            <span className="text-base font-bold font-mono text-orange-400">+14.7 L</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Diesel (16T Truck)</div>
        </div>

        {/* Carbon Delta */}
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-md p-2.5 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <Leaf className="w-3.5 h-3.5 text-emerald-400" />
            <span>CARBON DELTA</span>
          </div>
          <div className="mt-1.5">
            <span className="text-base font-bold font-mono text-emerald-400">+{carbonDelta.toFixed(1)}</span>
            <span className="text-xs text-slate-400 ml-1 font-mono">kg CO₂</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">2.68 kg/L factor</div>
        </div>

        {/* Hazard Exposure Reduction */}
        <div className="col-span-2 sm:col-span-1 bg-emerald-950/40 border border-emerald-500/50 rounded-md p-2.5 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>RISK MITIGATION</span>
          </div>
          <div className="mt-1.5">
            <span className="text-lg font-extrabold font-mono text-emerald-400">-{hazardReduction.toFixed(1)}%</span>
          </div>
          <div className="text-[10px] text-emerald-400/80 mt-0.5">Zero severe slide exposure</div>
        </div>
      </div>

      {/* Corridor Comparison Legend */}
      <div className="bg-slate-950/60 rounded border border-slate-800 p-2.5 text-xs flex flex-wrap items-center justify-between gap-2 font-mono">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-800 border border-red-500"></span>
            <span className="text-slate-300">C1 (NH-6 Sonapur):</span>
            <span className="text-red-400 font-bold uppercase">BLOCKED (Risk 9.8)</span>
          </div>
          <ArrowRight className="w-3 h-3 text-slate-500 hidden sm:inline" />
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-600 border border-emerald-400"></span>
            <span className="text-slate-300">C2 (NH-27 Haflong):</span>
            <span className="text-emerald-400 font-bold uppercase">CLEAR &amp; RESILIENT (Risk 2.1)</span>
          </div>
        </div>
        <div className="text-[11px] text-amber-300/80">
          Heavy Freight &amp; Commercial Traffic rerouted via Haflong
        </div>
      </div>
    </div>
  );
}
