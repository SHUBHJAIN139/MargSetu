'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, MapPin, Truck, AlertCircle, LayoutDashboard, Globe } from 'lucide-react';
import { HonestyBadge } from '../../lib/labels';
import { useTranslation } from '../../lib/i18n';

/**
 * Sticky Global Navigation Bar
 * Spec Reference: DESIGN.md (FINAL v2) §2
 * Clean Paper Map aesthetic: White surface, 1px line border, active brand teal.
 */
export default function Navbar() {
  const pathname = usePathname();
  const { lang, changeLang, t } = useTranslation();

  const navLinks = [
    { href: '/', label: t('nav_home', 'Home'), icon: Shield },
    { href: '/corridors', label: t('nav_corridors', 'Corridors'), icon: MapPin },
    { href: '/driver', label: t('nav_driver', 'Driver HUD'), icon: Truck },
    { href: '/report', label: t('nav_report', 'Report Hazard'), icon: AlertCircle },
    { href: '/ops', label: t('nav_ops', 'Ops Console'), icon: LayoutDashboard },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-line shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {/* Pinned Thin Simulation Notice Banner */}
      <div className="bg-[#FAF0E6] border-b border-[#FED7AA] px-4 py-1 text-center text-xs font-mono font-medium text-[#78350F] flex items-center justify-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] animate-pulse" />
        <span>{t('nav_simulation_banner')}</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Brand & Wordmark */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 group focus:outline-none focus:ring-2 focus:ring-brand rounded-lg p-1"
          >
            <div className="w-8 h-8 rounded-md bg-brand text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-sm group-hover:bg-brand-dark transition-colors">
              MS
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-ink text-base tracking-tight leading-none">
                  MargSetu
                </span>
                <span className="text-xs text-muted font-medium font-sans leading-none">
                  (मार्गसेतु)
                </span>
              </div>
              <span className="text-[10px] text-muted font-mono tracking-wider leading-tight">
                NDMA LIFELINE PROTOTYPE
              </span>
            </div>
          </Link>

          {/* Quiet Status Badge */}
          <div className="hidden sm:block ml-1">
            <HonestyBadge label="SIMULATION" size="xs" />
          </div>
        </div>

        {/* Center: Real Clickable Navigation Routes */}
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main Navigation">
          {navLinks.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors min-h-touch ${
                  isActive
                    ? 'bg-[#E6F4F1] text-brand font-semibold border border-[#BCE3DC]'
                    : 'text-[#4B5563] hover:text-ink hover:bg-[#FAF8F5]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand' : 'text-muted'}`} />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right: Language Toggle (EN / HI / AS) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#FAF8F5] border border-line rounded-md p-0.5 text-xs font-medium">
            <button
              onClick={() => changeLang('en')}
              className={`px-2 py-1 rounded min-w-[32px] min-h-[30px] transition-colors ${
                lang === 'en'
                  ? 'bg-white text-ink font-bold shadow-xs border border-line'
                  : 'text-muted hover:text-ink'
              }`}
              title="English"
            >
              EN
            </button>
            <button
              onClick={() => changeLang('hi')}
              className={`px-2 py-1 rounded min-w-[32px] min-h-[30px] transition-colors ${
                lang === 'hi'
                  ? 'bg-white text-ink font-bold shadow-xs border border-line'
                  : 'text-muted hover:text-ink'
              }`}
              title="Hindi (हिंदी)"
            >
              हिं
            </button>
            <button
              onClick={() => changeLang('as')}
              className={`px-2 py-1 rounded min-w-[32px] min-h-[30px] transition-colors ${
                lang === 'as'
                  ? 'bg-white text-ink font-bold shadow-xs border border-line'
                  : 'text-muted hover:text-ink'
              }`}
              title="Assamese (অসমীয়া)"
            >
              অস
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
