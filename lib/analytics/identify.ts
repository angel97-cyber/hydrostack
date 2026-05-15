'use client'

import posthog from 'posthog-js'

export function identifyUser(args: {
  id: string
  email: string
  plan?: string
  org_id?: string | null
}) {
  if (typeof window === 'undefined') return
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return

  posthog.identify(args.id, {
    email: args.email,
    plan: args.plan ?? 'beta',
    org_id: args.org_id ?? null,
  })
}

export function resetUser() {
  if (typeof window === 'undefined') return
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  posthog.reset()
}