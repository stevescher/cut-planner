import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import { PostHogPageView } from "@/components/PostHogPageView";
import { PHProvider } from "./providers";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
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
