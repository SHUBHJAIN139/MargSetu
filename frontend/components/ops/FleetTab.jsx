'use client';

import React, { useState } from 'react';
import { Truck, Navigation, AlertTriangle, ShieldCheck, Gauge, Package, ArrowUpRight } from 'lucide-react';
import HonestyBadge from '../common/HonestyBadge';

/**
 * FleetTab Component.
 * Simulated convoy telemetry along lifeline corridors C1 (NH-6) and C2 (NH-27).
 * Honesty Label: Strictly SIMULATION.
 */
export default function FleetTab({ 
  detourActive = false, 
  c1Blocked = false,
  onTrackVehicle 
}) {
  const [filterCorridor, setFilterCorridor] = useState('ALL');

  // Simulated convoy fleet data reflecting active corridor conditions
  const simulatedFleet = [
    {
      id: 'CV-AS-0192',
      name: 'Essential Medical Convoy Alpha',
      vehicle_type: 'Heavy Freight',
      cargo: 'Vaccines & Cryogenic Oxygen',
      corridor: detourActive ? 'C2 (NH-27 Haflong Detour)' : 'C1 (NH-6 Sonapur)',
      corridor_code: detourActive ? 'C2' : 'C1',
      speed_kmh: detourActive ? 42 : (c1Blocked ? 0 : 48),
      location: detourActive ? 'Lumding Junction (25.7533°N, 93.1706°E)' : (c1Blocked ? 'Holding at Shillong Bypass (25.5788°N, 91.8933°E)' : 'En Route Jowai (25.4411°N, 92.2033°E)'),
      status: detourActive ? 'REROUTED_DETOUR' : (c1Blocked ? 'HOLDING_SAFETY' : 'IN_TRANSIT'),
      status_label: detourActive ? 'Rerouted via NH-27 Detour' : (c1Blocked ? 'Holding North of Slide Zone' : 'Transit Normal'),
      fuel_remaining_pct: 78,
      lat: detourActive ? 25.7533 : (c1Blocked ? 25.5788 : 25.4411),
      lng: detourActive ? 93.1706 : (c1Blocked ? 91.8933 : 92.2033),
    },
    {
      id: 'CV-TR-4401',
      name: 'Barak Food Grain Supply Line',
      vehicle_type: 'Heavy Freight',
      cargo: 'FCI Essential Staples (Rice/Wheat)',
      corridor: detourActive ? 'C2 (NH-27 Haflong Detour)' : 'C1 (NH-6 Sonapur)',
      corridor_code: detourActive ? 'C2' : 'C1',
      speed_kmh: detourActive ? 38 : (c1Blocked ? 0 : 45),
      location: detourActive ? 'Maibang Ghats (25.3015°N, 93.1610°E)' : (c1Blocked ? 'Holding at Nongpoh Staging (25.9015°N, 91.8803°E)' : 'Khliehriat Descent (25.3524°N, 92.3643°E)'),
      status: detourActive ? 'REROUTED_DETOUR' : (c1Blocked ? 'HOLDING_SAFETY' : 'IN_TRANSIT'),
      status_label: detourActive ? 'Active on Haflong Bypass' : (c1Blocked ? 'Holding at Pre-designated Staging' : 'Transit Normal'),
      fuel_remaining_pct: 64,
      lat: detourActive ? 25.3015 : (c1Blocked ? 25.9015 : 25.3524),
      lng: detourActive ? 93.1610 : (c1Blocked ? 91.8803 : 92.3643),
    },
    {
      id: 'CV-ML-8820',
      name: 'Cachar Petroleum Tanker Rake',
      vehicle_type: 'Hazardous Commercial',
      cargo: 'High Speed Diesel (24KL)',
      corridor: detourActive ? 'C2 (NH-27 Haflong Detour)' : 'C1 (NH-6 Sonapur)',
      corridor_code: detourActive ? 'C2' : 'C1',
      speed_kmh: detourActive ? 35 : (c1Blocked ? 0 : 40),
      location: detourActive ? 'Dabaka Checkpost (26.0121°N, 92.8687°E)' : (c1Blocked ? 'Turned Back at Jowai (25.4411°N, 92.2033°E)' : 'Passing Jowai (25.4411°N, 92.2033°E)'),
      status: detourActive ? 'REROUTED_DETOUR' : (c1Blocked ? 'BLOCKED_DIVERTING' : 'IN_TRANSIT'),
      status_label: detourActive ? 'Fuel Diversion via C2' : (c1Blocked ? 'Reroute Commanded' : 'Transit Normal'),
      fuel_remaining_pct: 82,
      lat: detourActive ? 26.0121 : (c1Blocked ? 25.4411 : 25.4411),
      lng: detourActive ? 92.8687 : (c1Blocked ? 92.2033 : 92.2033),
    },
    {
      id: 'CV-REF-1004',
      name: 'West Corridor Courier Link',
      vehicle_type: 'Commercial Light',
      cargo: 'Express Postal & Telemetry Batteries',
      corridor: 'C3 (NH-27 Siliguri Lifeline Reference)',
      corridor_code: 'C3',
      speed_kmh: 55,
      location: 'Bongaigaon Bypass (26.5028°N, 90.5434°E)',
      status: 'IN_TRANSIT',
      status_label: 'Lifeline Reference Clear',
      fuel_remaining_pct: 91,
      lat: 26.5028,
      lng: 90.5434,
    }
  ];

  const filtered = filterCorridor === 'ALL' 
    ? simulatedFleet 
    : simulatedFleet.filter(v => v.corridor_code === filterCorridor);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <span>SIMULATED CONVOY TELEMETRY</span>
            <span className="bg-slate-800 text-sky-400 text-xs px-2 py-0.5 rounded font-mono">
              {filtered.length} Units Tracked
            </span>
          </h3>
          <p className="text-xs text-slate-400">
            Real-time simulated freight location, corridor assignment &amp; failover diversion
          </p>
        </div>
        <HonestyBadge label="SIMULATION" size="xs" />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800 text-xs font-mono">
        {['ALL', 'C1', 'C2', 'C3'].map((code) => (
          <button
            key={code}
            onClick={() => setFilterCorridor(code)}
            className={`px-3 py-1 rounded transition-colors ${
              filterCorridor === code 
                ? 'bg-sky-600 text-white font-bold' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {code === 'ALL' ? 'All Convoys' : `Corridor ${code}`}
          </button>
        ))}
      </div>

      {/* Fleet Cards */}
      <div className="space-y-3">
        {filtered.map((vehicle) => {
          const isDetour = vehicle.status === 'REROUTED_DETOUR';
          const isHolding = vehicle.status === 'HOLDING_SAFETY' || vehicle.status === 'BLOCKED_DIVERTING';

          return (
            <div 
              key={vehicle.id}
              className={`rounded-lg border p-3.5 transition-all ${
                isDetour 
                  ? 'bg-amber-950/30 border-amber-500/50' 
                  : isHolding 
                    ? 'bg-red-950/30 border-red-500/50'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className={`p-2 rounded mt-0.5 ${
                    isDetour 
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : isHolding
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-white">{vehicle.id}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {vehicle.vehicle_type}
                      </span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        isDetour 
                          ? 'bg-amber-900/80 text-amber-200 border border-amber-600'
                          : isHolding
                            ? 'bg-red-900/80 text-red-200 border border-red-600'
                            : 'bg-emerald-900/80 text-emerald-200 border border-emerald-600'
                      }`}>
                        {vehicle.status_label}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-100 mt-1">{vehicle.name}</h4>
                    
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                      <Package className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>Payload: {vehicle.cargo}</span>
                    </div>

                    <div className="mt-2 text-xs font-mono text-slate-300">
                      <span className="text-slate-500">Waypoint:</span> {vehicle.location}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-mono font-bold text-sky-400 flex items-center justify-end gap-1">
                    <Gauge className="w-3.5 h-3.5" />
                    <span>{vehicle.speed_kmh} km/h</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1">
                    Fuel: {vehicle.fuel_remaining_pct}%
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500">
                  Route: <span className="text-slate-300 font-semibold">{vehicle.corridor}</span>
                </span>
                {onTrackVehicle && (
                  <button
                    onClick={() => onTrackVehicle(vehicle)}
                    className="text-sky-400 hover:text-sky-300 flex items-center gap-1 text-[11px]"
                  >
                    <span>Focus Map</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
