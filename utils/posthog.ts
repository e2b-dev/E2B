import { PostHog } from 'posthog-node'

export const client = process.env.NEXT_PUBLIC_POSTHOG_KEY ? new PostHog(
  process.env.NEXT_PUBLIC_POSTHOG_KEY,
) : undefined
