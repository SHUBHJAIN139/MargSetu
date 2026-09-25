import React from 'react';
import { HonestyBadge as CanonicalHonestyBadge } from '../../lib/labels';

/**
 * HonestyBadge component for MargSetu.
 * Spec: DESIGN.md (FINAL v2)
 * Quiet, light-theme uppercase tag.
 */
export default function HonestyBadge(props) {
  return <CanonicalHonestyBadge {...props} />;
}

