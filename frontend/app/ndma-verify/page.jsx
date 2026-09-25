'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Search, ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import { HonestyBadge } from '../../lib/labels';

/**
 * Public NDMA Corroboration & Verification Lookup Portal
 * Spec: Allows citizens and convoys to verify whether a road hazard or SOS beacon is registered.
 */
export default function NDMAVerifyPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);

  const handleVerify = (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Simulate verification lookups for common demo IDs or custom input
    const clean = query.trim().toUpperCase();
    if (clean.includes('SONAPUR') || clean.includes('INC-01') || clean.includes('LANDSLIDE')) {
      setResult({
        id: 'INC-SONAPUR-01',
        type: 'LANDSLIDE',
        location: 'Sonapur Tunnel Sector (NH-6 km 141.2)',
        coordinates: '25.1147°N, 92.3654°E',
        status: 'CORROBORATED_BLOCKED',
        veto: true,
        authority: 'NDMA EOC Dispur Sector',
        updated: new Date().toLocaleTimeString(),
      });
    } else if (clean.includes('SOS') || clean.includes('9912')) {
      setResult({
        id: 'SOS-2026-9912',
        type: 'DISTRESS_BEACON',
        location: 'Sonapur North Portal Approach',
        coordinates: '25.1147°N, 92.3654°E',
        status: 'Signal Delivered to Queue — Awaiting Operator Review',
        veto: false,
        authority: 'NDMA Crisis Operations Bus',
        updated: new Date().toLocaleTimeString(),
      });
    } else {
      setResult({
        id: clean,
        type: 'FIELD_QUERY',
        location: 'Northeast Lifeline Sector',
        coordinates: '25.1147°N, 92.3654°E',
        status: 'VERIFIED_ACTIVE',
        veto: false,
        authority: 'NDMA Automated Corridor Telemetry',
        updated: new Date().toLocaleTimeString(),
      });
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-paper text-ink p-4 sm:p-6 flex flex-col justify-between">
      <div className="max-w-xl mx-auto w-full pt-4">
        {/* Navigation back */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink px-3 py-1.5 rounded-lg border border-line bg-white shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('nav_home', 'Home')}</span>
          </Link>
          <HonestyBadge label="VERIFIED STATIC" size="xs" />
        </div>

        {/* Verification Card */}
        <div className="bg-white rounded-2xl border border-line p-6 shadow-xs text-left">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#E6F4F1] border border-brand/20 text-brand flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-ink">NDMA Corridor Hazard & SOS Verification</h1>
              <p className="text-xs text-muted">Lookup verified incident cluster IDs, beacon dockets, or road vetoes</p>
            </div>
          </div>

          <form onSubmit={handleVerify} className="mt-4 flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter Incident or Beacon ID (e.g. INC-01, SOS-9912)..."
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-line bg-[#FAF8F5] text-xs font-mono focus:outline-none focus:border-brand"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-brand text-white font-bold text-xs hover:bg-brand/90 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Search className="w-4 h-4" />
              <span>Verify</span>
            </button>
          </form>

          {/* Quick preset suggestions */}
          <div className="mt-3 flex items-center gap-2 text-[11px] text-muted">
            <span>Try:</span>
            <button
              type="button"
              onClick={() => { setQuery('INC-SONAPUR-01'); }}
              className="px-2 py-0.5 rounded bg-[#FAF8F5] border border-line hover:border-brand font-mono text-[10px]"
            >
              INC-SONAPUR-01
            </button>
            <button
              type="button"
              onClick={() => { setQuery('SOS-2026-9912'); }}
              className="px-2 py-0.5 rounded bg-[#FAF8F5] border border-line hover:border-brand font-mono text-[10px]"
            >
              SOS-2026-9912
            </button>
          </div>

          {/* Result Box */}
          {result && (
            <div className="mt-6 pt-5 border-t border-line space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-ink">{result.id}</span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  result.veto ? 'bg-[#FFEBEE] text-[#B71C1C] border border-[#FFCDD2]' : 'bg-[#EDF7ED] text-[#2E7D32] border border-[#C8E6C9]'
                }`}>
                  {result.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-[#FAF8F5] p-3 rounded-xl border border-line">
                <div>
                  <span className="text-[10px] text-muted block">Location Landmark</span>
                  <span className="font-semibold text-ink">{result.location}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block">Coordinates</span>
                  <span className="font-mono font-semibold text-ink">{result.coordinates}</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-line/40 flex items-center justify-between text-[11px]">
                  <span className="text-muted">Authority: {result.authority}</span>
                  <span className="font-mono text-muted text-[10px]">Updated: {result.updated}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Link
                  href="/ops"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                >
                  <span>Open in NDMA Ops Console</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="py-4 text-center text-xs text-muted">
        <span>{t('footer_disclaimer', 'SIMULATION — not connected to official NDMA systems. Sole Authority: NDMA.')}</span>
      </footer>
    </div>
  );
}
