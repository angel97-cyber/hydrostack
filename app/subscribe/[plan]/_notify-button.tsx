'use client'

import { useState, useTransition } from 'react'
import { notifyPaymentIntent } from './actions'
import type { PlanName } from '@/lib/billing/plans'

export function NotifyButton({ plan, price, userEmail, userName, userId }: {
  plan: PlanName; price: number; userEmail: string; userName: string; userId: string
}) {
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(false)

  function handleClick() {
    startTransition(async () => {
      const result = await notifyPaymentIntent({ plan, priceNPR: price, userEmail, userName: userName || null, userId })
      if (result.ok) { setDone(true); setTimeout(() => setDone(false), 5000) }
    })
  }

  if (done) {
    return (
      <div className="rounded-sm border border-emerald-700 bg-emerald-50 px-4 py-3 font-mono text-xs text-emerald-900">
        ✓ We&apos;ve notified Angel. Expect activation within 24 hours.
      </div>
    )
  }
  return (
    <button onClick={handleClick} disabled={pending}
      className="w-full rounded-sm border border-stone-300 bg-white px-4 py-2 font-mono text-xs text-stone-900 transition hover:bg-stone-50 disabled:opacity-50">
      {pending ? 'Notifying…' : "I've sent the screenshot — notify Angel"}
    </button>
  )
}