import React from 'react';

/**
 * MargSetu Honesty Label and High-Contrast Status System.
 * PRD Reference: PRD v2.0 §0, §1, §6, §8, §11 (AC-2, Rule 4)
 * Authority: NDMA is the ONLY authority named.
 * Mandatory Disclaimers:
 *  - "SIMULATION — not connected to official NDMA systems"
 *  - "MargSetu is not a replacement for official emergency services."
 */

export const HONESTY_LABELS = {
  LIVE_API: 'LIVE API',
  VERIFIED_STATIC: 'VERIFIED STATIC',
  SIMULATION: 'SIMULATION',
  USER_SUBMITTED: 'USER-SUBMITTED',
};

export const MANDATORY_DISCLAIMERS = {
  SIMULATION: 'SIMULATION — not connected to official NDMA systems',
  EMERGENCY: 'MargSetu is not a replacement for official emergency services.',
};

export const RISK_LEVELS = {
  GREEN: {
    label: 'Low Risk',
    threshold: '< 4.0',
    color: '#16a34a',
    bgClass: 'bg-emerald-950/90 text-emerald-300 border-emerald-500',
    badgeClass: 'risk-badge-green',
  },
  AMBER: {
    label: 'Moderate Risk',
    threshold: '4.0 - 6.0',
    color: '#d97706',
    bgClass: 'bg-amber-950/90 text-amber-300 border-amber-500',
    badgeClass: 'risk-badge-amber',
  },
  RED: {
    label: 'Severe Hazard',
    threshold: '> 6.0',
    color: '#dc2626',
    bgClass: 'bg-red-950/90 text-red-300 border-red-500',
    badgeClass: 'risk-badge-red',
  },
  BLOCKED: {
    label: 'Blocked (Hard Veto)',
    threshold: 'Impassable',
    color: '#7f1d1d',
    bgClass: 'bg-red-950 text-rose-200 border-rose-700 ring-1 ring-rose-500',
    badgeClass: 'risk-badge-blocked',
  },
  EMERGENCY_ONLY: {
    label: 'Emergency Only',
    threshold: 'Bypass transit',
    color: '#7e22ce',
    bgClass: 'bg-purple-950/90 text-purple-200 border-purple-600',
    badgeClass: 'risk-badge-emergency',
  },
};

/**
 * HonestyBadge Component
 * Spec: DESIGN.md (FINAL v2) · small grey uppercase tag beside data elements.
 * Displays: LIVE API, VERIFIED STATIC, SIMULATION, USER-SUBMITTED
 */
export function HonestyBadge({
  label = 'SIMULATION',
  size = 'sm',
  className = '',
  showDot = true,
}) {
  const normalized = (label || 'SIMULATION').toUpperCase().replace('_', '-');

  const configs = {
    'LIVE API': {
      bg: 'bg-[#EDF7ED] text-[#1E4620] border-[#C8E6C9]',
      dot: 'bg-[#2E7D32]',
      description: 'Real-time telemetry / live API feed',
    },
    'VERIFIED STATIC': {
      bg: 'bg-[#EBF3FB] text-[#0C4A6E] border-[#BAE6FD]',
      dot: 'bg-[#0284C7]',
      description: 'Pre-computed GIS survey and verified corridor geometry',
    },
    'SIMULATION': {
      bg: 'bg-[#FAF0E6] text-[#78350F] border-[#FED7AA]',
      dot: 'bg-[#D97706]',
      description: 'Simulated environment — not connected to official NDMA systems',
    },
    'USER-SUBMITTED': {
      bg: 'bg-[#F3EAFD] text-[#4A1D96] border-[#DDD6FE]',
      dot: 'bg-[#7C3AED]',
      description: 'Crowdsourced citizen field report awaiting corroboration',
    },
  };

  const config = configs[normalized] || configs['SIMULATION'];

  const sizeStyles = {
    xs: 'text-[9px] px-1.5 py-0.5',
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-[11px] px-2.5 py-1',
    lg: 'text-xs px-3 py-1',
  };

  return (
    <span
      role="status"
      title={config.description}
      className={`inline-flex items-center gap-1.5 font-mono font-medium uppercase tracking-wider rounded border select-none ${config.bg} ${sizeStyles[size] || sizeStyles.sm} ${className}`}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dot}`}
          aria-hidden="true"
        />
      )}
      <span>{normalized}</span>
    </span>
  );
}

/**
 * RiskBadge Component
 * Maps a risk score (0-10) or blockage flag to canonical light theme tokens.
 */
export function RiskBadge({
  riskScore = 0,
  isBlocked = false,
  isEmergencyOnly = false,
  size = 'md',
  className = '',
}) {
  let level = RISK_LEVELS.GREEN;

  if (isEmergencyOnly) {
    level = RISK_LEVELS.EMERGENCY_ONLY;
  } else if (isBlocked || riskScore >= 10.0) {
    level = RISK_LEVELS.BLOCKED;
  } else if (riskScore > 6.0) {
    level = RISK_LEVELS.RED;
  } else if (riskScore >= 4.0) {
    level = RISK_LEVELS.AMBER;
  }

  const sizeStyles = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3.5 py-1.5 font-bold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold uppercase rounded border tabular-nums ${level.badgeClass} ${sizeStyles[size] || sizeStyles.md} ${className}`}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: level.color }} />
      <span>{level.label}</span>
      {!isBlocked && !isEmergencyOnly && (
        <span className="opacity-90 font-mono text-[0.85em]">
          ({Number(riskScore).toFixed(1)}/10)
        </span>
      )}
    </span>
  );
}

export default HonestyBadge;
