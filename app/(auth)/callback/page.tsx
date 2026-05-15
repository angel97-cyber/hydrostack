'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { identifyUser } from '@/lib/analytics/identify'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const params   = new URLSearchParams(window.location.search)
    const code     = params.get('code')
    const next     = params.get('next') ?? '/projects'

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(async ({ error }) => {
        if (error) {
          console.error('[auth/callback]', error.message)
          router.replace('/login?error=auth_callback_failed')
        } else {
          // PostHog identification — fire and forget
          try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('plan, org_id')
                .eq('id', user.id)
                .single()
              identifyUser({
                id: user.id,
                email: user.email ?? '',
                plan: profile?.plan ?? 'beta',
                org_id: profile?.org_id ?? null,
              })
            }
          } catch (e) {
            console.warn('[auth/callback] PostHog identify failed:', e)
          }

          // Welcome email for new signups — fire and forget
          fetch('/api/auth/welcome', { method: 'POST' }).catch(() => {})

          router.replace(next)
        }
      })
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        router.replace(session ? next : '/login?error=no_code')
      })
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <p className="font-mono text-sm text-stone-500">Signing you in…</p>
    </div>
  )
}