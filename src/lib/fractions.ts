/**
 * Parse a dimension string that may contain fractions.
 * Supports: "12", "12.5", "12 1/2", "1/8", "12-1/2"
 * Returns the value in inches, or NaN if invalid.
 */
export function parseDimension(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) return NaN;

  // Pure decimal number
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }

  // Pure fraction: "1/8", "3/4"
  const purefractionMatch = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (purefractionMatch) {
    const num = parseInt(purefractionMatch[1]);
    const den = parseInt(purefractionMatch[2]);
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
 * Format a decimal number as a fractional string.
 * Uses 1/16" precision.
 */
export function formatDimension(value: number): string {
  if (isNaN(value)) return '';

  const whole = Math.floor(value);
  const remainder = value - whole;

  if (remainder < 0.001) {
    return whole.toString();
  }

  // Find closest fraction with denominator up to 16
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

  // Simplify fraction
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(bestNum, bestDen);
  bestNum /= g;
  bestDen /= g;

  if (bestNum === 0) return whole.toString();
  if (bestNum === bestDen) return (whole + 1).toString();
  if (whole === 0) return `${bestNum}/${bestDen}`;
  return `${whole} ${bestNum}/${bestDen}`;
}
