'use client';

import React from 'react';
import Link from 'next/link';
import {
  Truck,
  LayoutDashboard,
  MapPin,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Compass,
  CheckCircle2,
  Radio,
  Eye,
  Cpu,
  Route,
  Zap,
} from 'lucide-react';
import { HonestyBadge } from '../lib/labels';
import { useTranslation } from '../lib/i18n';

/**
 * MargSetu Landing Page
 * Spec Reference: DESIGN.md (FINAL v2) §3 & SIH 2026 Pitch Deck
 * - Clean Paper Map aesthetic (#FAF8F5)
 * - Hero: "Know which road is open before you leave."
 * - Two main portals: Driver HUD vs Ops Console
 * - 4-step Operational Methodology: Observe → Assess → Decide → Act
 * - Full reactive multilingual support (EN / HI / AS)
 */
export default function HomePage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-paper text-ink flex flex-col justify-between">
      {/* Hero Section */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-8 text-center">
        {/* Project Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-line text-xs font-mono text-muted mb-4 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-brand" />
          <span>{t('hero_tag', 'SIH 2026 / Problem Statement SIH26002 — MDoNER & NDMA')}</span>
          <HonestyBadge label="VERIFIED STATIC" size="xs" />
        </div>

        {/* Motto & Heading */}
        <h1 className="text-3xl sm:text-5xl font-black text-ink tracking-tight leading-tight max-w-3xl mx-auto">
          {t('hero_title_1', 'Know which road is open')} <br className="hidden sm:inline" />
          <span className="text-brand">{t('hero_title_2', 'before you leave.')}</span>
        </h1>

        <p className="mt-4 text-base sm:text-lg text-muted max-w-2xl mx-auto font-sans leading-relaxed">
          {t(
            'hero_subtitle',
            "Resilient logistics & emergency accessibility intelligence for Northeast India. Real-time multi-factor risk, automated mountain chokepoint vetoes, and offline fail-safe driver lifeline."
          )}
        </p>

        {/* Two Primary Action Cards (Driver vs Operator) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10 max-w-3xl mx-auto text-left">
          {/* Driver Mobile Card */}
          <Link
            href="/driver"
            className="group relative bg-white border border-line hover:border-brand rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#E6F4F1] border border-brand/20 text-brand flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Truck className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-[#FAF8F5] text-muted border border-line">
                  MOBILE 360px
                </span>
              </div>

              <h2 className="text-xl font-bold text-ink group-hover:text-brand transition-colors flex items-center gap-2">
                <span>{t('hero_card_driver_title', 'Mountain Driver HUD')}</span>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </h2>

              <p className="text-xs sm:text-sm text-muted mt-2 leading-relaxed">
                {t(
                  'hero_card_driver_desc',
                  'Mobile-first driver cockpit (360px) with 1.5s emergency SOS hold, offline SMS 1077 fallback, and multi-factor corridor risk breakdown.'
                )}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-line/60 flex items-center justify-between text-xs font-semibold text-brand">
              <span>{t('hero_card_driver_btn', 'Launch Driver HUD')}</span>
              <span className="font-mono text-muted text-[10px]">/driver</span>
            </div>
          </Link>

          {/* Operations Desktop Console Card */}
          <Link
            href="/ops"
            className="group relative bg-white border border-line hover:border-brand rounded-2xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#FAF0E6] border border-[#FED7AA] text-[#78350F] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <LayoutDashboard className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-[#FAF8F5] text-muted border border-line">
                  DESKTOP CONSOLE
                </span>
              </div>

              <h2 className="text-xl font-bold text-ink group-hover:text-brand transition-colors flex items-center gap-2">
                <span>{t('hero_card_ops_title', 'NDMA Operations Console')}</span>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </h2>

              <p className="text-xs sm:text-sm text-muted mt-2 leading-relaxed">
                {t(
                  'hero_card_ops_desc',
                  'Logistics & disaster control room view. Live rainfall simulation slider, Sonapur Tunnel chokepoint veto tracking, citizen incident triage, and SOS queue management.'
                )}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-line/60 flex items-center justify-between text-xs font-semibold text-brand">
              <span>{t('hero_card_ops_btn', 'Open Ops Console')}</span>
              <span className="font-mono text-muted text-[10px]">/ops</span>
            </div>
          </Link>
        </div>

        {/* Quick Secondary Links (Corridors & Report) */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6 text-xs">
          <Link
            href="/corridors"
            className="min-h-touch px-4 py-2 bg-white hover:bg-paper border border-line rounded-lg text-ink font-medium flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <MapPin className="w-3.5 h-3.5 text-brand" />
            <span>{t('nav_corridors', 'Public Corridors Map')}</span>
          </Link>
          <Link
            href="/report"
            className="min-h-touch px-4 py-2 bg-white hover:bg-paper border border-line rounded-lg text-ink font-medium flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-[#E08A00]" />
            <span>{t('nav_report', 'Report Road Hazard')}</span>
          </Link>
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-touch px-4 py-2 bg-white hover:bg-paper border border-line rounded-lg text-ink font-medium flex items-center gap-1.5 transition-colors shadow-xs"
            title="Interactive Swagger UI Documentation on Port 8000"
          >
            <Cpu className="w-3.5 h-3.5 text-brand" />
            <span>{t('nav_swagger', 'FastAPI Swagger UI')}</span>
          </a>
        </div>
      </div>

      {/* Observe -> Assess -> Decide -> Act Strip */}
      <div className="bg-white border-t border-line py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-muted font-mono">
              {t('methodology_title', 'Operational Methodology')}
            </span>
            <h3 className="text-base font-bold text-ink mt-1">
              {t('methodology_subtitle', 'How MargSetu protects Northeast lifeline corridors')}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Step 1: Ingest */}
            <div className="p-4 rounded-xl bg-[#FAF8F5] border border-line space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-white border border-line flex items-center justify-center text-brand mb-2">
                <Eye className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-ink">{t('step_observe_title', '1. Ingest & Observe')}</h4>
              <p className="text-[11px] text-muted leading-relaxed">
                {t(
                  'step_observe_desc',
                  'Continuous telemetry ingestion: IMD precipitation, CWC flood gauges, satellite slope cuts, and citizen field reports.'
                )}
              </p>
            </div>

            {/* Step 2: Assess */}
            <div className="p-4 rounded-xl bg-[#FAF8F5] border border-line space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-white border border-line flex items-center justify-center text-brand mb-2">
                <Cpu className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-ink">{t('step_assess_title', '2. Multi-Factor Assess')}</h4>
              <p className="text-[11px] text-muted leading-relaxed">
                {t(
                  'step_assess_desc',
                  'Calibrated Ri risk engine evaluates Rain (0.40), Slope (0.30), Soil (0.15), Crowd (0.10), and History (0.05).'
                )}
              </p>
            </div>

            {/* Step 3: Veto */}
            <div className="p-4 rounded-xl bg-[#FAF8F5] border border-line space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-white border border-line flex items-center justify-center text-[#8B1A1A] mb-2">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-ink">{t('step_decide_title', '3. Hard Structural Veto')}</h4>
              <p className="text-[11px] text-muted leading-relaxed">
                {t(
                  'step_decide_desc',
                  'Automatic veto when rainfall exceeds 75mm or active landslides occur. Zero hallucination, 100% deterministic safety.'
                )}
              </p>
            </div>

            {/* Step 4: Act */}
            <div className="p-4 rounded-xl bg-[#FAF8F5] border border-line space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-white border border-line flex items-center justify-center text-[#2E7D32] mb-2">
                <Route className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-ink">{t('step_act_title', '4. Fail-Safe Act')}</h4>
              <p className="text-[11px] text-muted leading-relaxed">
                {t(
                  'step_act_desc',
                  'Sub-second traffic reroute to resilient detours (NH-27 Haflong Bypass) with Layer 3 native SMS 1077 dispatch hook.'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-muted border-t border-line/60 bg-[#FAF8F5]">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>{t('footer_disclaimer', 'SIMULATION — not connected to official NDMA systems. Sole Authority: NDMA.')}</span>
          <span className="font-mono text-[10px]">MargSetu v2.1 · SIH 2026</span>
        </div>
      </footer>
    </div>
  );
}
