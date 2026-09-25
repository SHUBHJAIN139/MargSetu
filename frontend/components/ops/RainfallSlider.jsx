'use client';

import React from 'react';
import { CloudRain, RotateCcw } from 'lucide-react';
import { HonestyBadge } from '../../lib/labels';

/**
 * Rainfall Slider Toolbar Component (The Demo Star)
 * Spec: DESIGN.md (FINAL v2) §3
 * Positioned on the Ops map toolbar.
 * Dragging from 0 to 150mm recalculates Ri live:
 * 60mm -> 2.23
 * 68mm -> 2.40 (baseline)
 * 74mm -> 2.53
 * 75mm -> 2.55 (critical boundary)
 * >75mm -> VETO (Dark red, cost inf, dynamic reason), flips to C2 Haflong (+42km)
 */
export default function RainfallSlider({
  rainfallMm = 68.0,
  onChange = () => {},
  onReset = () => {},
  isVetoed = false,
  c1Ri = 2.40,
}) {
  return (
    <div className="bg-white/95 backdrop-blur-xs border border-line rounded-xl p-3 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      {/* Label & Live Metrics */}
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          isVetoed ? 'bg-[#FBEBEB] text-[#8B1A1A] border border-[#8B1A1A]' : 'bg-[#E6F4F1] text-brand border border-brand/20'
        }`}>
          <CloudRain className="w-5 h-5" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-ink uppercase tracking-wide">
              Chokepoint Rainfall Simulation
            </span>
            <HonestyBadge label="SIMULATION" size="xs" />
          </div>
          <div className="text-xs text-muted font-mono flex items-center gap-2 mt-0.5">
            <span>Precipitation: <strong className="text-ink font-bold">{rainfallMm.toFixed(1)} mm/h</strong></span>
            <span>·</span>
            <span>C1 Ri: <strong className={isVetoed ? 'text-[#8B1A1A] font-bold' : 'text-brand font-bold'}>
              {isVetoed ? '10.0 (VETO)' : c1Ri.toFixed(2)}
            </strong></span>
          </div>
        </div>
      </div>

      {/* Slider Control */}
      <div className="flex-1 max-w-xs flex items-center gap-2">
        <span className="text-[10px] text-muted font-mono">0</span>
        <input
          type="range"
          min="0"
          max="150"
          step="1"
          value={rainfallMm}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 bg-[#FAF8F5] border border-line rounded-lg appearance-none cursor-pointer accent-brand focus:outline-none"
          title="Adjust precipitation (0-150 mm/h)"
          aria-label="Rainfall slider (0-150 mm/h)"
        />
        <span className="text-[10px] text-muted font-mono">150</span>
      </div>

      {/* Threshold indicator & Reset */}
      <div className="flex items-center gap-2 justify-end">
        <span className={`text-[11px] px-2 py-0.5 rounded font-bold uppercase ${
          isVetoed
            ? 'bg-[#FBEBEB] text-[#5A1010] border border-[#8B1A1A]'
            : 'bg-[#EDF7ED] text-[#1E4620] border border-[#2E7D32]'
        }`}>
          {isVetoed ? 'C1 VETOED (>75mm)' : 'C1 NOMINAL'}
        </span>

        <button
          type="button"
          onClick={onReset}
          className="p-1.5 bg-white hover:bg-paper text-muted hover:text-ink border border-line rounded-lg transition-colors shadow-xs"
          title="Reset Baseline (68.0 mm)"
          aria-label="Reset rainfall to baseline (68 mm)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
