/**
 * MargSetu Service Adapter Interface Contracts
 * Spec Reference: DESIGN.md (FINAL v2) §4 & §5
 * Guarantees that swapping MockAdapter <-> RealAdapter requires zero UI changes.
 */

export const DATA_MODES = {
  MOCK: 'mock',
  LIVE: 'live',
};

/**
 * Common Response Wrapper with Provenance Metadata
 */
export function createResponse(data, source = 'SIMULATION', isFallback = false) {
  return {
    data,
    meta: {
      source, // 'LIVE API' | 'VERIFIED STATIC' | 'SIMULATION' | 'USER-SUBMITTED'
      isFallback,
      timestamp: new Date().toISOString(),
      authority: 'NDMA',
      disclaimer: 'SIMULATION — not connected to official NDMA systems',
    },
  };
}
