/**
 * Rate strings come from FBR's rate list (spec v1.12 §5.8), e.g. "18%", "0%", or compound forms like
 * "18% along with rupees 60 per kilogram". Only the simple "N%" form can be checked offline.
 */
export function parseSimpleRate(rate: unknown): number | null {
  if (typeof rate !== 'string') return null;
  const m = /^\s*(\d+(?:\.\d+)?)\s*%\s*$/.exec(rate);
  if (!m || m[1] === undefined) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;
