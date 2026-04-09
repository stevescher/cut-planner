import { describe, it, expect, beforeAll } from 'vitest';
import type { NextConfig } from 'next';

/**
 * Unit tests for the Content-Security-Policy header in next.config.ts.
 *
 * Run with: npm run test:unit
 *
 * These tests catch config-level CSP regressions that break the app at runtime
 * even though `next build` and `next start` succeed without errors (OPUS-110).
 *
 * A missing `'unsafe-inline'` in script-src blocks Next.js hydration and makes
 * every interactive element on the page non-functional.
 */

describe('next.config.ts — Content-Security-Policy', () => {
  let csp: string;

  beforeAll(async () => {
    // Dynamically import so Vitest resolves the TS file via its transformer
    const mod = await import('../../next.config');
    const config: NextConfig = mod.default;

    const rules = await config.headers!();
    const catchAll = rules.find((r) => r.source === '/(.*)');
    if (!catchAll) throw new Error("No '/(.*) source rule found in next.config.ts headers");

    const cspHeader = catchAll.headers.find((h) => h.key === 'Content-Security-Policy');
    if (!cspHeader) throw new Error('Content-Security-Policy header missing from next.config.ts');

    csp = cspHeader.value;
  });

  it("script-src includes 'unsafe-inline' (required for Next.js hydration)", () => {
    expect(csp).toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it("script-src includes 'unsafe-eval' (required for jsPDF)", () => {
    expect(csp).toMatch(/script-src[^;]*'unsafe-eval'/);
  });

  it('connect-src includes ws: (required for Turbopack HMR)', () => {
    expect(csp).toMatch(/connect-src[^;]*\bws:/);
  });

  it('connect-src includes wss: (required for Turbopack HMR over TLS)', () => {
    expect(csp).toMatch(/connect-src[^;]*\bwss:/);
  });

  it('worker-src includes blob: (required for Comlink web worker)', () => {
    expect(csp).toMatch(/worker-src[^;]*\bblob:/);
  });

  it('img-src includes data: (required for html-to-image PNG export)', () => {
    expect(csp).toMatch(/img-src[^;]*\bdata:/);
  });

  it('img-src includes blob: (required for object URL image output)', () => {
    expect(csp).toMatch(/img-src[^;]*\bblob:/);
  });
});
