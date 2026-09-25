'use client';

import React, { useState } from 'react';
import { 
  Sliders, 
  CloudRain, 
  AlertTriangle, 
  RotateCcw, 
  ShieldAlert, 
  CheckCircle2, 
  Zap,
  Info
} from 'lucide-react';
import HonestyBadge from '../common/HonestyBadge';

/**
 * ScenarioControlsTab Component.
 * Interactive real-time scenario simulation controls.
 * PRD Reference: §3, §8, §10 (Demo Controls).
 * - Rainfall slider (0-150mm)
 * - Sonapur hazard toggle
 * - Haflong hazard toggle
 * - NDMA override toggle
 * - One-click byte-identical RESET button calling POST /scenario/reset
 */
export default function ScenarioControlsTab({
  scenarioState,
  onApplyScenario,
  onResetScenario,
  loading = false
}) {
  const [rainfall, setRainfall] = useState(scenarioState?.rainfall_mm ?? 24.5);
  const [sonapurHazard, setSonapurHazard] = useState(scenarioState?.inject_hazard_sonapur ?? false);
  const [haflongHazard, setHaflongHazard] = useState(scenarioState?.inject_hazard_haflong ?? false);
  const [ndmaOverride, setNdmaOverride] = useState(scenarioState?.ndma_override ?? false);
  const [season, setSeason] = useState(scenarioState?.season ?? 'monsoon');
  const [isResetting, setIsResetting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // Sync when prop updates
  React.useEffect(() => {
    if (scenarioState) {
      setRainfall(scenarioState.rainfall_mm ?? 24.5);
      setSonapurHazard(scenarioState.inject_hazard_sonapur ?? false);
      setHaflongHazard(scenarioState.inject_hazard_haflong ?? false);
      setNdmaOverride(scenarioState.ndma_override ?? false);
      setSeason(scenarioState.season ?? 'monsoon');
    }
  }, [scenarioState]);

  const handleRainfallChange = (e) => {
    const val = parseFloat(e.target.value);
    setRainfall(val);
  };

  const handleRainfallCommit = async () => {
    await applyCurrentParams({ rainfall_mm: rainfall });
  };

  const toggleSonapur = async () => {
    const nextVal = !sonapurHazard;
    setSonapurHazard(nextVal);
    await applyCurrentParams({ inject_hazard_sonapur: nextVal });
  };

  const toggleHaflong = async () => {
    const nextVal = !haflongHazard;
    setHaflongHazard(nextVal);
    await applyCurrentParams({ inject_hazard_haflong: nextVal });
  };

  const toggleNdmaOverride = async () => {
    const nextVal = !ndmaOverride;
    setNdmaOverride(nextVal);
    await applyCurrentParams({ ndma_override: nextVal });
  };

  const handleSeasonChange = async (newSeason) => {
    setSeason(newSeason);
    await applyCurrentParams({ season: newSeason });
  };

  const applyCurrentParams = async (overrides = {}) => {
    setIsApplying(true);
    try {
      const payload = {
        rainfall_mm: overrides.rainfall_mm !== undefined ? overrides.rainfall_mm : rainfall,
        inject_hazard_sonapur: overrides.inject_hazard_sonapur !== undefined ? overrides.inject_hazard_sonapur : sonapurHazard,
        inject_hazard_haflong: overrides.inject_hazard_haflong !== undefined ? overrides.inject_hazard_haflong : haflongHazard,
        ndma_override: overrides.ndma_override !== undefined ? overrides.ndma_override : ndmaOverride,
        season: overrides.season !== undefined ? overrides.season : season,
      };
      await onApplyScenario(payload);
    } finally {
      setIsApplying(false);
    }
  };

  const handleResetClick = async () => {
    setIsResetting(true);
    try {
      await onResetScenario();
      setRainfall(24.5);
      setSonapurHazard(false);
      setHaflongHazard(false);
      setNdmaOverride(false);
      setSeason('monsoon');
    } finally {
      setIsResetting(false);
    }
  };

  const isC1Vetoed = sonapurHazard || rainfall > 75.0 || ndmaOverride;
  const isC2Vetoed = haflongHazard;
  const isAllBlocked = isC1Vetoed && isC2Vetoed;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-sky-400" />
            <span>SCENARIO INJECTION CONTROLS</span>
          </h3>
          <p className="text-xs text-slate-400">
            Real-time environmental stress tests &amp; automated Dijkstra failover
          </p>
        </div>
        <HonestyBadge label="SIMULATION" size="xs" />
      </div>

      {/* One-Click Byte-Identical Reset Button */}
      <div className="bg-slate-900/90 border border-slate-700/80 rounded-lg p-3 flex items-center justify-between gap-3 shadow-inner">
        <div>
          <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5 font-mono">
            <span>BYTE-IDENTICAL RESET HARNESS</span>
            <span className="text-[10px] text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-500/30">
              PRD §10 Compliance
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Instantly restores all corridor vetoes, rainfall &amp; incident states to verified baseline.
          </p>
        </div>
        <button
          disabled={isResetting || loading}
          onClick={handleResetClick}
          className="px-3.5 py-1.5 text-xs font-mono font-bold rounded-md bg-sky-600 hover:bg-sky-500 text-white shadow-md flex items-center gap-1.5 shrink-0 transition-all active:scale-95 disabled:opacity-50"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
          <span>{isResetting ? 'RESETTING...' : 'RESET TO BASELINE'}</span>
        </button>
      </div>

      {/* Live Corridor Veto Status Matrix */}
      <div className="grid grid-cols-3 gap-2 text-xs font-mono">
        {/* C1 Veto */}
        <div className={`p-2.5 rounded-md border flex flex-col justify-between ${
          isC1Vetoed 
            ? 'bg-red-950/50 border-red-500/60 text-red-200' 
            : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
        }`}>
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold">C1 (NH-6)</span>
            <span className={`w-2 h-2 rounded-full ${isC1Vetoed ? 'bg-red-400 animate-ping' : 'bg-emerald-400'}`} />
          </div>
          <div className="mt-2">
            <span className={`font-bold ${isC1Vetoed ? 'text-red-300' : 'text-emerald-400'}`}>
              {isC1Vetoed ? 'HARD VETOED' : 'OPERATIONAL'}
            </span>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {sonapurHazard ? 'Sonapur Injected' : (rainfall > 75 ? `Rainfall ${rainfall}mm` : (ndmaOverride ? 'NDMA Override' : 'Clear'))}
            </div>
          </div>
        </div>

        {/* C2 Veto */}
        <div className={`p-2.5 rounded-md border flex flex-col justify-between ${
          isC2Vetoed 
            ? 'bg-red-950/50 border-red-500/60 text-red-200' 
            : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
        }`}>
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold">C2 (NH-27)</span>
            <span className={`w-2 h-2 rounded-full ${isC2Vetoed ? 'bg-red-400 animate-ping' : 'bg-emerald-400'}`} />
          </div>
          <div className="mt-2">
            <span className={`font-bold ${isC2Vetoed ? 'text-red-300' : 'text-emerald-400'}`}>
              {isC2Vetoed ? 'HARD VETOED' : 'RESILIENT DETOUR'}
            </span>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {haflongHazard ? 'Haflong Slide Injected' : 'Passable'}
            </div>
          </div>
        </div>

        {/* Ground Routes Status */}
        <div className={`p-2.5 rounded-md border flex flex-col justify-between ${
          isAllBlocked 
            ? 'bg-purple-950/60 border-purple-500/70 text-purple-200' 
            : 'bg-slate-900 border-slate-800 text-slate-300'
        }`}>
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold">AIR BRIDGE</span>
            <span className={`w-2 h-2 rounded-full ${isAllBlocked ? 'bg-purple-400 animate-pulse' : 'bg-slate-600'}`} />
          </div>
          <div className="mt-2">
            <span className={`font-bold ${isAllBlocked ? 'text-purple-300' : 'text-slate-500'}`}>
              {isAllBlocked ? 'TRIGGERED' : 'STANDBY'}
            </span>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {isAllBlocked ? 'GAU-IXS Active' : 'Ground Intact'}
            </div>
          </div>
        </div>
      </div>

      {/* Control 1: Rainfall Slider (0 - 150 mm) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CloudRain className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-bold font-mono text-slate-200">PRECIPITATION LEVEL (0 - 150 mm)</span>
          </div>
          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
            rainfall > 75 
              ? 'bg-red-950 text-red-300 border border-red-700' 
              : rainfall > 50 
                ? 'bg-amber-950 text-amber-300 border border-amber-700' 
                : 'bg-sky-950 text-sky-300 border border-sky-800'
          }`}>
            {rainfall.toFixed(1)} mm
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="150"
          step="2.5"
          value={rainfall}
          onChange={handleRainfallChange}
          onMouseUp={handleRainfallCommit}
          onTouchEnd={handleRainfallCommit}
          className="w-full accent-sky-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
        />

        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span>0 mm (Dry)</span>
          <span className="text-amber-400">&gt;50mm (Corroboration)</span>
          <span className="text-red-400">&gt;75mm (Automatic C1 Veto)</span>
          <span>150 mm (Extreme Cloudburst)</span>
        </div>

        {rainfall > 75 && (
          <div className="text-[11px] font-mono text-red-400 bg-red-950/30 p-1.5 rounded border border-red-500/30 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Rainfall &gt; 75 mm triggers compound soil saturation veto on Sonapur slope.</span>
          </div>
        )}
      </div>

      {/* Control 2: Sonapur Hazard Toggle */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className={`p-2 rounded mt-0.5 ${sonapurHazard ? 'bg-red-600/30 text-red-400 border border-red-500/40' : 'bg-slate-800 text-slate-400'}`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200 font-mono flex items-center gap-1.5">
              <span>SONAPUR TUNNEL HAZARD INJECTION</span>
              <span className="text-[10px] text-slate-400 font-normal">(25.1147°N, 92.3654°E)</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Simulates sudden 4,000 m³ rockfall/debris blockage at NH-6 north portal.
            </p>
          </div>
        </div>

        <button
          onClick={toggleSonapur}
          disabled={loading || isApplying}
          className={`px-3.5 py-1.5 text-xs font-mono font-bold rounded border transition-colors shrink-0 ${
            sonapurHazard
              ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-900/30'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
          }`}
        >
          {sonapurHazard ? 'HAZARD ACTIVE' : 'INJECT HAZARD'}
        </button>
      </div>

      {/* Control 3: Haflong Hazard Toggle */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className={`p-2 rounded mt-0.5 ${haflongHazard ? 'bg-red-600/30 text-red-400 border border-red-500/40' : 'bg-slate-800 text-slate-400'}`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200 font-mono flex items-center gap-1.5">
              <span>HAFLONG BYPASS HAZARD INJECTION</span>
              <span className="text-[10px] text-slate-400 font-normal">(25.1667°N, 93.0245°E)</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Simulates slope failure along NH-27 detour. If combined with Sonapur, triggers Air Advisory.
            </p>
          </div>
        </div>

        <button
          onClick={toggleHaflong}
          disabled={loading || isApplying}
          className={`px-3.5 py-1.5 text-xs font-mono font-bold rounded border transition-colors shrink-0 ${
            haflongHazard
              ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-900/30'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
          }`}
        >
          {haflongHazard ? 'HAZARD ACTIVE' : 'INJECT HAZARD'}
        </button>
      </div>

      {/* Control 4: NDMA Administrative Override Toggle */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className={`p-2 rounded mt-0.5 ${ndmaOverride ? 'bg-amber-600/30 text-amber-400 border border-amber-500/40' : 'bg-slate-800 text-slate-400'}`}>
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200 font-mono">
              NDMA ADMINISTRATIVE CORRIDOR OVERRIDE
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Imposes administrative closure on C1 regardless of sensor readings.
            </p>
          </div>
        </div>

        <button
          onClick={toggleNdmaOverride}
          disabled={loading || isApplying}
          className={`px-3.5 py-1.5 text-xs font-mono font-bold rounded border transition-colors shrink-0 ${
            ndmaOverride
              ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-900/30'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
          }`}
        >
          {ndmaOverride ? 'OVERRIDE ON' : 'ENABLE OVERRIDE'}
        </button>
      </div>

      {/* Season Selector */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 text-xs font-mono">
        <div className="text-slate-400 mb-2">SEASONAL RISK MODEL WEIGHTS (PRD §3):</div>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { id: 'monsoon', label: 'Monsoon' },
            { id: 'post_monsoon', label: 'Post-Mon' },
            { id: 'winter', label: 'Winter' },
            { id: 'pre_monsoon', label: 'Pre-Mon' },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => handleSeasonChange(s.id)}
              className={`py-1 rounded text-center transition-colors ${
                season === s.id
                  ? 'bg-sky-600 text-white font-bold'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
