'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const params   = new URLSearchParams(window.location.search)
    const code     = params.get('code')
    const next     = params.get('next') ?? '/projects'

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          console.error('[auth/callback]', error.message)
          router.replace('/login?error=auth_callback_failed')
        } else {
          router.replace(next)
        }
      })
    } else {
      // Implicit flow — session already in URL fragment, just check
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