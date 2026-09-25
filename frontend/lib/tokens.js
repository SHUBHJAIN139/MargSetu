/**
 * MargSetu Canonical Design Tokens
 * Spec Reference: DESIGN.md (FINAL v2) · "Paper Map, Not Cockpit"
 * Light Theme Only: No dark panels, no gradients, no glassmorphism.
 */

export const TOKENS = {
  // App Surfaces
  paper: '#FAF8F5',      // App background (warm off-white)
  surface: '#FFFFFF',    // Cards, nav, panels
  ink: '#1F2933',        // Primary text
  muted: '#6B7280',      // Secondary text, quiet tags
  line: '#E5E0D8',       // 1px borders

  // MargSetu Brand
  brand: '#0F6E5D',      // MargSetu teal: primary buttons, active nav
  brandDark: '#0A4F43',
  brandLight: '#E6F4F1',

  // Status & Risk Tokens
  safe: '#2E7D32',       // Risk < 4
  caution: '#E08A00',    // Risk 4–6
  danger: '#C62828',     // Risk > 6
  blocked: '#8B1A1A',    // Veto / Blocked
  emergency: '#6A3FA0',  // Emergency-only route

  // SOS Tokens
  sos: '#D32F2F',        // SOS button ONLY
  sosLight: '#FDECEA',   // SOS-adjacent backgrounds
  sosDark: '#B71C1C',
};

/**
 * Collapsed Single Source of Truth for Risk Metadata
 * Prevents drift across 4x maintenance points.
 */
export const RISK_META = {
  safe: {
    key: 'safe',
    label: 'SAFE',
    min: 0.0,
    max: 4.0,
    color: '#2E7D32',
    bg: '#EDF7ED',
    border: '#2E7D32',
    text: '#1E4620',
    badgeClass: 'risk-badge-safe',
    icon: 'ShieldCheck',
  },
  caution: {
    key: 'caution',
    label: 'CAUTION',
    min: 4.0,
    max: 6.0,
    color: '#E08A00',
    bg: '#FFF8E1',
    border: '#E08A00',
    text: '#663C00',
    badgeClass: 'risk-badge-caution',
    icon: 'AlertTriangle',
  },
  danger: {
    key: 'danger',
    label: 'DANGER',
    min: 6.0,
    max: 10.0,
    color: '#C62828',
    bg: '#FDE8E8',
    border: '#C62828',
    text: '#7A1414',
    badgeClass: 'risk-badge-danger',
    icon: 'AlertOctagon',
  },
  blocked: {
    key: 'blocked',
    label: 'BLOCKED',
    color: '#8B1A1A',
    bg: '#FBEBEB',
    border: '#8B1A1A',
    text: '#5A1010',
    badgeClass: 'risk-badge-blocked',
    icon: 'XCircle',
  },
  emergency: {
    key: 'emergency',
    label: 'EMERGENCY ONLY',
    color: '#6A3FA0',
    bg: '#F3EAFD',
    border: '#6A3FA0',
    text: '#3B1F61',
    badgeClass: 'risk-badge-emergency',
    icon: 'LifeBuoy',
  },
};

export function getRiskMeta(score, isBlocked = false, isEmergency = false) {
  if (isEmergency) return RISK_META.emergency;
  if (isBlocked || score >= 10.0) return RISK_META.blocked;
  if (score < 4.0) return RISK_META.safe;
  if (score <= 6.0) return RISK_META.caution;
  return RISK_META.danger;
}
