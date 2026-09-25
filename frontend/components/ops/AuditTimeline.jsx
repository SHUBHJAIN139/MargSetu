'use client';

import React from 'react';
import { Clock, UserCheck, Shield, AlertTriangle } from 'lucide-react';
import { HonestyBadge } from '../../lib/labels';

/**
 * Vertical Audit Timeline Component
 * Spec Reference: DESIGN.md (FINAL v2) §3 & §7
 * Renders audit log as a clean vertical timeline (dot · operator · time · reason), NOT a table.
 */
export default function AuditTimeline({ timeline = [] }) {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="text-center py-6 text-xs text-muted font-mono">
        No recorded operator triage actions.
      </div>
    );
  }

  return (
    <div className="relative pl-4 space-y-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-line">
      {timeline.map((entry, idx) => {
        const isLatest = idx === 0;
        return (
          <div key={entry.id || idx} className="relative flex items-start gap-3">
            {/* Timeline Dot */}
            <div
              className={`absolute -left-4 mt-1.5 w-3 h-3 rounded-full border-2 border-white shadow-xs ${
                isLatest ? 'bg-brand ring-2 ring-brand/30' : 'bg-muted'
              }`}
            />

            {/* Content Card */}
            <div className="flex-1 bg-white rounded-lg border border-line p-3 shadow-xs">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-ink flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-brand" />
                  <span>{entry.operator}</span>
                </span>
                <span className="text-[11px] text-muted font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{entry.time}</span>
                </span>
              </div>

              <div className="text-xs font-semibold text-brand uppercase tracking-wide">
                {entry.action}
              </div>

              <p className="text-xs text-muted mt-1 leading-normal">
                {entry.reason || 'Verified against sensor telemetry'}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
