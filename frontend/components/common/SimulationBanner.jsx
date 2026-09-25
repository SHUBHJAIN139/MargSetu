import React from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import HonestyBadge from './HonestyBadge';

/**
 * Prominent NDMA Simulation Notice Banner.
 * Must be visible across all ops views and reports.
 * Complies with PRD Rule 2: NDMA is sole authority, strictly labeled SIMULATION.
 */
export default function SimulationBanner({ compact = false }) {
  if (compact) {
    return (
      <div className="bg-[#FFF8E1] border-b border-[#E08A00]/40 px-3 py-1 flex items-center justify-between text-xs text-[#663C00]">
        <div className="flex items-center gap-2 font-mono">
          <AlertTriangle className="w-3.5 h-3.5 text-[#E08A00] shrink-0" />
          <span className="font-bold tracking-wide uppercase">NDMA SIMULATION ENVIRONMENT</span>
          <span className="hidden sm:inline text-[#663C00]/80">— Not connected to official NDMA emergency dispatch systems</span>
        </div>
        <HonestyBadge label="SIMULATION" size="xs" />
      </div>
    );
  }

  return (
    <div className="bg-[#FFF8E1] border-b border-[#E08A00]/40 px-4 py-2 text-xs text-[#663C00] flex flex-wrap items-center justify-between gap-3 shadow-xs">
      <div className="flex items-center gap-2.5">
        <div className="bg-white p-1.5 rounded border border-[#E08A00]/40 shadow-xs">
          <ShieldAlert className="w-4 h-4 text-[#E08A00]" />
        </div>
        <div>
          <div className="font-bold text-[#663C00] font-mono tracking-wide uppercase flex items-center gap-2">
            NDMA DECISION SUPPORT &amp; DISASTER ALERT SYSTEM
            <span className="bg-[#FBEBEB] text-[#5A1010] text-[10px] px-1.5 py-0.5 rounded border border-[#8B1A1A]/30">SIMULATION ONLY</span>
          </div>
          <p className="text-[11px] text-[#663C00]/80 mt-0.5">
            Notice: SIMULATION — not connected to official NDMA systems. Never claim live dispatch or responder confirmation.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <HonestyBadge label="SIMULATION" size="sm" />
      </div>
    </div>
  );
}
