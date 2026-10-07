import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    // unsafe-inline: required by Next.js hydration inline scripts and Tailwind CSS
    // unsafe-eval: required by jsPDF (uses Function() internally)
    // blob:: required for object URLs (JSON export)
    // worker-src 'self': the optimizer Web Worker (comlink) loads as a same-origin
    //   script chunk (/_next/static/chunks/...) in both dev and production builds;
    //   without it the worker is blocked and the solver falls back to the main thread
    // data:: required for html-to-image PNG export (data URL canvas output)
    // ws: wss:: required for Turbopack HMR WebSocket connections in development
    // https://*.posthog.com: PostHog loads remote config and surveys scripts and
    //   sends events across its subdomains; PostHog's CSP guide recommends the
    //   wildcard over specific hosts because the subdomains change over time
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://*.posthog.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "worker-src 'self' blob:",
      "connect-src 'self' ws: wss: https://*.posthog.com https://*.ingest.us.sentry.io",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: "opus-techops",
  project: "cut-planner",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    automaticVercelMonitors: true,
  },
});
