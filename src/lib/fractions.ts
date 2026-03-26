export type Units = 'imperial' | 'metric';

// ── Imperial (inches with fractions) ─────────────────────────────────────────

/**
 * Parse a dimension string that may contain fractions (imperial, inches).
 * Supports: "12", "12.5", "12 1/2", "1/8", "12-1/2"
 * Returns the value in inches, or NaN if invalid.
 */
export function parseDimension(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) return NaN;

  // Pure decimal
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Pure fraction: "1/8", "3/4"
  const pureFracMatch = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (pureFracMatch) {
    const num = parseInt(pureFracMatch[1]);
    const den = parseInt(pureFracMatch[2]);
    if (den === 0) return NaN;
    return num / den;
  }

  // Mixed: "12 1/2" or "12-1/2"
  const mixedMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*[-\s]\s*(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const num = parseInt(mixedMatch[2]);
    const den = parseInt(mixedMatch[3]);
    if (den === 0) return NaN;
    return whole + num / den;
  }

  return NaN;
}

/**
 * Format a decimal number (inches) as a fractional string.
 * Uses 1/16" precision.
 */
export function formatDimension(value: number): string {
  if (isNaN(value)) return '';

  const whole = Math.floor(value);
  const remainder = value - whole;

  if (remainder < 0.001) return whole.toString();

  const denominators = [2, 4, 8, 16];
  let bestNum = 0;
  let bestDen = 1;
  let bestDiff = remainder;

  for (const den of denominators) {
    const num = Math.round(remainder * den);
    const diff = Math.abs(remainder - num / den);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestNum = num;
      bestDen = den;
    }
  }

  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(bestNum, bestDen);
  bestNum /= g;
  bestDen /= g;

  if (bestNum === 0) return whole.toString();
  if (bestNum === bestDen) return (whole + 1).toString();
  if (whole === 0) return `${bestNum}/${bestDen}`;
  return `${whole} ${bestNum}/${bestDen}`;
}

// ── Metric (millimeters) ──────────────────────────────────────────────────────

const MM_PER_INCH = 25.4;

/** Parse a metric input string (mm) and return inches. */
export function parseMetric(input: string): number {
  const trimmed = input.trim().replace(/\s*mm$/i, '');
  if (!trimmed) return NaN;
  const mm = parseFloat(trimmed);
  if (isNaN(mm)) return NaN;
  return mm / MM_PER_INCH;
}

/**
 * Format inches as millimeters.
 * Values ≥ 1 mm → whole number. Smaller (e.g. kerf) → 1 decimal.
 */
export function formatMetric(inches: number): string {
  if (isNaN(inches)) return '';
  const mm = inches * MM_PER_INCH;
  return mm < 1 ? mm.toFixed(1) : String(Math.round(mm));
}

// ── Unified helpers (used throughout the app) ─────────────────────────────────

/** Parse user input for any unit system. Returns inches internally. */
export function parseInput(input: string, units: Units): number {
  return units === 'metric' ? parseMetric(input) : parseDimension(input);
}

/**
 * Format an inch value for display.
 * Imperial: "12 1/2"  Metric: "317"
 * The caller appends the unit suffix (" or mm).
 */
export function formatDisplay(inches: number, units: Units): string {
  return units === 'metric' ? formatMetric(inches) : formatDimension(inches);
}

/** Unit suffix string for display (e.g. `"` or ` mm`). */
export function unitSuffix(units: Units): string {
  return units === 'metric' ? ' mm' : '"';
}

/** Default kerf for each unit system (returned in inches). */
export function defaultKerf(units: Units): number {
  return units === 'metric' ? 3 / MM_PER_INCH : 0.125; // 3 mm or 1/8"
}
