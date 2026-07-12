'use client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    // Only initialize when a key is configured, so dev/preview builds without the
    // env var don't emit analytics.
    if (!key) return
    posthog.init(key, {
      api_host: 'https://us.i.posthog.com',
      defaults: '2025-05-24',
      person_profiles: 'identified_only',
      capture_pageview: false,
      // This app has no accounts; never send DOM interaction snapshots or
      // session replays, which could otherwise capture typed panel labels.
      autocapture: false,
      disable_session_recording: true,
    })
    posthog.register({ app: 'cut-planner' })
  }, [])
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}
