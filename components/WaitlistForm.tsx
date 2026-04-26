'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    const { error } = await supabase.from('waitlist').insert({ email })

    if (error) {
      // 23505 = unique violation = already on the list (treat as success)
      if (error.code === '23505') {
        setStatus('success')
      } else {
        setStatus('error')
        setErrorMsg('Something went wrong. Please try again.')
      }
    } else {
      setStatus('success')
    }
  }

  if (status === 'success') {
    return (
      <div className="bg-emerald-50 border border-emerald-700/30 px-5 py-4 inline-flex items-center gap-3 max-w-md">
        <svg className="w-5 h-5 text-emerald-700 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 12.5 L11 15.5 L16 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          <p className="text-emerald-900 font-medium text-[15px]">You are on the list.</p>
          <p
            className="text-emerald-800/80 text-xs mt-0.5"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            We will reach out before launch.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <span
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] tracking-[0.18em] uppercase text-stone-400 pointer-events-none"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            ▸
          </span>
          <input
            type="email"
            required
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'loading'}
            className="w-full bg-white border border-stone-300 px-9 py-3.5 text-[15px] text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 transition-all disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={status === 'loading'}
          className="bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium px-6 py-3.5 transition-colors text-[15px] tracking-wide flex items-center justify-center gap-2"
        >
          {status === 'loading' ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path
                  d="M22 12 A 10 10 0 0 0 12 2"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              Joining…
            </>
          ) : (
            <>
              Request access
              <span aria-hidden>→</span>
            </>
          )}
        </button>
      </form>
      {errorMsg && (
        <p
          className="mt-3 text-sm text-red-700"
          style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
        >
          {errorMsg}
        </p>
      )}
      <p
        className="mt-3 text-[11px] text-stone-500 tracking-wide"
        style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
      >
        NO SPAM. NEVER SHARED. UNSUBSCRIBE WITH ONE CLICK.
      </p>
    </div>
  )
}