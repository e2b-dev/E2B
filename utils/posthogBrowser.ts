import posthog from 'posthog-js'

export function maybeInit() {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    // Use the ingest endpoint for all requests
    api_host: `${window.location.protocol}//${window.location.host}/ingest`,
    // Disable session recording when not in production
    disable_session_recording: process.env.NODE_ENV !== 'production',
    advanced_disable_toolbar_metrics: true,
    loaded: (posthog) => {
      // Enable debug mode in development
      if (process.env.NODE_ENV === 'development') {
        posthog.debug()
      }
    }
  })
}
