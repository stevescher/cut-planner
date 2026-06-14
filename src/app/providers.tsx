'use client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init('phc_ojv2WBjcasEUkrqJdirHb9HQynJpAAMLkjRqbJd2pC6p', {
      api_host: 'https://us.i.posthog.com',
      defaults: '2025-05-24',
      person_profiles: 'identified_only',
      capture_pageview: false,
    })
    posthog.register({ app: 'cut-planner' })
  }, [])
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}
