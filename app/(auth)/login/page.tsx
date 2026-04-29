'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Mail, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [sent, setSent]             = useState(false)
  const [error, setError]           = useState('')

  const supabase = createClient()

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setLoading(false) }
    else { setSent(true); setLoading(false) }
  }

  async function handleGoogle() {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  return (
    <div
      className="min-h-screen bg-stone-50 flex flex-col"
      style={{ fontFamily: 'var(--font-body), system-ui, sans-serif' }}
    >
      {/* Top bar */}
      <header className="border-b border-stone-200 bg-white px-8 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-emerald-800 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 text-emerald-100">
              <path d="M12 2 L12 8 M12 8 L7 14 C7 18 9 22 12 22 C15 22 17 18 17 14 L12 8 Z"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span
            className="text-stone-900 font-medium text-base"
            style={{ fontFamily: 'var(--font-display), Georgia, serif' }}
          >
            HydroStack
          </span>
        </Link>
        <Link href="/" className="text-sm text-stone-500 hover:text-stone-800 transition-colors">
          ← Back to home
        </Link>
      </header>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Subtle drafting grid card */}
          <div className="bg-white border border-stone-200 shadow-sm relative overflow-hidden">
            {/* Drawing title strip */}
            <div
              className="flex items-center justify-between px-5 py-2.5 border-b border-stone-200 bg-stone-50"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              <span className="text-[9px] tracking-[0.18em] uppercase text-stone-500">
                Auth / Sign in
              </span>
              <span className="text-[9px] text-stone-400">HS-AUTH-01</span>
            </div>

            <div className="p-7">
              {sent ? (
                <div className="text-center py-4">
                  <div className="w-11 h-11 bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-5 h-5 text-emerald-700" />
                  </div>
                  <h2
                    className="text-stone-900 font-medium text-lg mb-2"
                    style={{ fontFamily: 'var(--font-display), Georgia, serif' }}
                  >
                    Check your email
                  </h2>
                  <p className="text-stone-500 text-sm leading-relaxed mb-5">
                    Login link sent to{' '}
                    <span className="text-stone-800 font-medium">{email}</span>.
                    Click it to sign in — link expires in 60 seconds.
                  </p>
                  <button
                    onClick={() => setSent(false)}
                    className="text-sm text-emerald-800 hover:text-emerald-900 underline underline-offset-4"
                  >
                    Use a different email
                  </button>
                </div>
              ) : (
                <>
                  <h1
                    className="text-stone-900 text-xl font-medium mb-1"
                    style={{ fontFamily: 'var(--font-display), Georgia, serif' }}
                  >
                    Sign in to HydroStack
                  </h1>
                  <p className="text-stone-500 text-sm mb-7">
                    Your hydropower design workbench.
                  </p>

                  {/* Google */}
                  <button
                    onClick={handleGoogle}
                    disabled={googleLoading}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-stone-300 hover:border-stone-400 hover:bg-stone-50 text-stone-700 py-3 px-4 text-sm font-medium transition-all mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {googleLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    )}
                    Continue with Google
                  </button>

                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-stone-200" />
                    <span
                      className="text-stone-400 text-[10px] tracking-widest"
                      style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                    >
                      OR
                    </span>
                    <div className="flex-1 h-px bg-stone-200" />
                  </div>

                  {/* Magic link */}
                  <form onSubmit={handleMagicLink} className="space-y-3">
                    <div className="relative">
                      <span
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[10px] text-stone-400 pointer-events-none"
                        style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                      >
                        ▸
                      </span>
                      <input
                        type="email"
                        placeholder="engineer@example.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        className="w-full bg-white border border-stone-300 text-stone-900 placeholder-stone-400 pl-8 pr-4 py-3 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 transition-all"
                      />
                    </div>
                    {error && (
                      <p
                        className="text-red-700 text-xs"
                        style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                      >
                        {error}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={loading || !email}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-800 hover:bg-emerald-900 text-white py-3 px-4 text-sm font-medium tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          Send magic link
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>

          <p
            className="text-center text-stone-400 text-[10px] mt-6 tracking-wide"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            Built by a Nepali hydropower engineer · AEPC/IS compliant
          </p>
        </div>
      </div>
    </div>
  )
}