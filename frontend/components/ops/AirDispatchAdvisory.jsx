'use client';

import React from 'react';
import { Plane, AlertOctagon, ShieldAlert, Radio, ArrowRight } from 'lucide-react';
import HonestyBadge from '../common/HonestyBadge';

/**
 * AirDispatchAdvisory Component.
 * STRICT OPS VIEW ONLY: Displayed strictly when ALL ground routes (C1 and C2) are vetoed.
 * Authority Integrity: NDMA is the ONLY authority.
 * Strictly labeled SIMULATION. Never claims live dispatch.
 */
export default function AirDispatchAdvisory({ advisory, onDismiss }) {
  if (!advisory) return null;

  const airheads = advisory.recommended_airheads || [
    { code: 'GAU', name: 'Lokpriya Gopinath Bordoloi International Airport', city: 'Guwahati', coordinates: [26.1061, 91.5859], role: 'Airhead Staging & Cargo Origin' },
    { code: 'IXS', name: 'Silchar Kumbhirgram Airport', city: 'Silchar', coordinates: [24.9125, 92.9789], role: 'Forward Air Distribution Node' },
  ];

  return (
    <div className="bg-white border-2 border-[#6A3FA0]/60 rounded-xl p-4 text-ink shadow-xs relative overflow-hidden">
      {/* Simulation Watermark Overlay */}
      <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-2 pointer-events-none opacity-5 font-mono text-7xl font-extrabold text-[#6A3FA0] select-none">
        SIMULATION
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-3 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[#F3EAFD] text-[#3B1F61] border border-[#6A3FA0]/40">
            <Plane className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#FBEBEB] text-[#5A1010] border border-[#8B1A1A]/40">
                ALL GROUND ROUTES VETOED
              </span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#F3EAFD] text-[#3B1F61] border border-[#6A3FA0]/40">
                OPS CONTINGENCY ONLY
              </span>
            </div>
            <h2 className="text-base font-bold text-ink tracking-wide mt-1">
              EMERGENCY AIR-DISPATCH ADVISORY (NDMA CONTINGENCY)
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <HonestyBadge label="SIMULATION" size="sm" />
        </div>
      </div>

      {/* Mandatory Disclaimer Box */}
      <div className="bg-[#FBEBEB] border border-[#8B1A1A] rounded-lg p-3 mb-4 text-xs relative z-10">
        <div className="flex items-start gap-2">
          <AlertOctagon className="w-4 h-4 text-[#8B1A1A] shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[#5A1010]">
              MANDATORY NDMA SIMULATION PROTOCOL NOTICE
            </p>
            <p className="text-[#5A1010]/90 mt-0.5 font-mono text-[11px]">
              SIMULATION — not connected to official NDMA systems. This is an operational decision support projection. 
              Live dispatch is <span className="underline font-bold text-[#8B1A1A]">NOT</span> active. 
              No aircraft, helicopters, or ground responders have been deployed or confirmed.
            </p>
          </div>
        </div>
      </div>

      {/* Contingency Flight Corridor Definition */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 relative z-10">
        {airheads.map((airhead, idx) => (
          <div key={airhead.code || idx} className="bg-[#FAF8F5] border border-line rounded-lg p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between font-mono text-xs mb-1">
                <span className="text-[#6A3FA0] font-bold tracking-wider">AIRHEAD {idx === 0 ? 'ORIGIN' : 'TERMINAL'}</span>
                <span className="bg-white text-[#3B1F61] px-1.5 py-0.5 rounded border border-line text-[10px] font-bold">
                  ICAO/IATA: {airhead.code}
                </span>
              </div>
              <h4 className="font-bold text-sm text-ink">{airhead.name}</h4>
              <p className="text-xs text-muted mt-0.5 font-mono">{airhead.city} Hub · Role: {airhead.role}</p>
            </div>
            <div className="mt-2.5 pt-2 border-t border-line flex items-center justify-between text-[11px] font-mono text-muted">
              <span>Coords: {airhead.coordinates?.[0]?.toFixed(4)}°N, {airhead.coordinates?.[1]?.toFixed(4)}°E</span>
              <span className="text-[#2E7D32] font-semibold">Runway All-Weather</span>
            </div>
          </div>
        ))}
      </div>

      {/* Operational Simulation Summary */}
      <div className="bg-[#FAF8F5] rounded-lg border border-line p-3 text-xs flex flex-wrap items-center justify-between gap-2 font-mono relative z-10">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-[#6A3FA0]" />
          <span className="text-ink">Air Corridor: GAU (VEGT) ➔ IXS (VEKU)</span>
          <span className="text-muted">|</span>
          <span className="text-muted">Flight Distance: ~195 km</span>
          <span className="text-muted">|</span>
          <span className="text-muted">Transit ETA: ~45 min (Rotary/C-130)</span>
        </div>
        <div className="text-[11px] text-[#6A3FA0] font-semibold">
          Target Payload: High-priority medical consumables &amp; satcom cells
        </div>
      </div>
    </div>
  );
}
