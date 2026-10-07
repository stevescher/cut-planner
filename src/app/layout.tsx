import type { Metadata } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import { PostHogPageView } from "@/components/PostHogPageView";
import { PHProvider } from "./providers";
import "./globals.css";

// Self-hosted rather than next/font/google: Google Fonts intermittently answers
// the build's CSS request with extensionless /l/font?kit=...&skey=... URLs, and
// the build fails on them (Turbopack reports "next/font/google queries have
// exactly one entry", vercel/next.js#99114, open as of 2026-10-06; webpack
// throws a TypeError in the Google font loader). Shipping the files removes the
// build-time network dependency entirely.
//
// This is the Google Fonts "latin" subset woff2 of Plus Jakarta Sans v12: one
// variable file, which Google served for every requested weight (300 to 800),
// SIL Open Font License.
const jakarta = localFont({
  src: "./fonts/plus-jakarta-sans-latin.woff2",
  variable: "--font-jakarta",
  weight: "300 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cut Planner",
  description: "Plan and optimize plywood and sheet goods cutting layouts to minimize waste",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // No-flash theme script: set the `dark` class before first paint so a
  // dark-mode user never sees a white flash. Reads the stored preference,
  // falling back to the OS setting. Mirrors the logic in useThemeStore.
  const themeScript = `(function(){try{var p=localStorage.getItem('cut-planner-theme');var d=p==='dark'||((p===null||p==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <PHProvider>
        <body className="min-h-full flex flex-col">
          <Suspense>
            <PostHogPageView />
          </Suspense>
          {children}
        </body>
      </PHProvider>
    </html>
  );
}
