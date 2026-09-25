'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, Phone, MessageSquare, AlertCircle } from 'lucide-react';
import UnifiedSOSButton from '../../components/sos/UnifiedSOSButton';
import { useTranslation } from '../../lib/i18n';
import { HonestyBadge } from '../../lib/labels';

/**
 * Dedicated Full-Screen SOS Lifeline Screen
 * Spec: Direct access for emergency SOS distress broadcast
 */
export default function SOSPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#FDFBF7] text-ink flex flex-col justify-between p-4 sm:p-6">
      <div className="max-w-md mx-auto w-full">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/driver"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink px-3 py-1.5 rounded-lg border border-line bg-white shadow-xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('report_back', 'Back to Driver HUD')}</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#FAF0E6] text-[#78350F] border border-[#FED7AA]">
              EMERGENCY ONLY
            </span>
            <HonestyBadge label="SIMULATION" size="xs" />
          </div>
        </div>

        {/* Card Container */}
        <div className="bg-white rounded-2xl border border-line p-6 shadow-sm text-center">
          <div className="w-12 h-12 rounded-xl bg-[#FFEBEE] border border-[#FFCDD2] text-[#B71C1C] flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6" />
          </div>

          <h1 className="text-xl font-black text-ink tracking-tight">
            {t('driver_sos_heading', 'Emergency Lifeline Trigger')}
          </h1>
          <p className="text-xs text-muted mt-1.5 max-w-xs mx-auto">
            {t('driver_sos_sub', 'Layer 1 Local Cache → Layer 3 Direct SMS 1077 Fallback')}
          </p>

          {/* Central 1.5s Press-and-Hold Button */}
          <div className="my-8 flex justify-center">
            <UnifiedSOSButton
              driverLocation={{
                latitude: 25.1147,
                longitude: 92.3654,
                landmark_name: 'Sonapur Tunnel Sector',
              }}
            />
          </div>

          {/* Direct Telephony Fallback Options */}
          <div className="pt-6 border-t border-line/60">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted font-bold block mb-3">
              Hardware Fallback Hooks (No Internet Required)
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              <a
                href="tel:1077"
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-line hover:border-brand bg-[#FAF8F5] text-ink transition-colors"
              >
                <Phone className="w-4 h-4 text-[#C62828]" />
                <span>{t('sos_call_ddma', 'Call 1077')}</span>
              </a>
              <a
                href="sms:1077?body=EMERGENCY%20SOS%20@%2025.1147,92.3654"
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-line hover:border-brand bg-[#FAF8F5] text-ink transition-colors"
              >
                <MessageSquare className="w-4 h-4 text-[#1565C0]" />
                <span>{t('sos_send_sms', 'SMS 1077')}</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory NDMA simulation disclaimer */}
      <footer className="mt-8 text-center text-[11px] text-muted max-w-md mx-auto">
        <p>{t('footer_disclaimer', 'SIMULATION — not connected to official NDMA systems. Sole Authority: NDMA.')}</p>
      </footer>
    </div>
  );
}
