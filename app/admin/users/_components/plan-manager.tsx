'use client'

import { useState, useTransition } from 'react'
import { activatePlan } from '../actions'
import type { PlanName } from '@/lib/billing/plans'

const PLAN_OPTIONS: PlanName[] = ['beta', 'student', 'solo', 'studio', 'enterprise']

export function PlanManager({
  userId,
  currentPlan,
  currentNote,
}: {
  userId: string
  currentPlan: string
  currentNote: string
}) {
  const [selectedPlan, setSelectedPlan] = useState<PlanName>(
    (currentPlan as PlanName) ?? 'beta',
  )
  const [note, setNote] = useState(currentNote)
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleActivate() {
    setError(null)
    startTransition(async () => {
      const result = await activatePlan(userId, selectedPlan, note)
      if (result.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        setError(result.error ?? 'Failed')
      }
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <select
          value={selectedPlan}
          onChange={(e) => setSelectedPlan(e.target.value as PlanName)}
          className="rounded-sm border border-stone-300 bg-white px-1.5 py-1 text-[11px]"
        >
          {PLAN_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (e.g. paid 2500 14 May)"
        className="w-44 rounded-sm border border-stone-300 bg-white px-1.5 py-1 text-[11px]"
      />
      <button
        onClick={handleActivate}
        disabled={pending}
        className="rounded-sm bg-emerald-800 px-2 py-1 text-[11px] text-white hover:bg-emerald-900 disabled:opacity-50"
      >
        {pending ? '…' : saved ? '✓ Saved' : 'Activate'}
      </button>
      {error && (
        <span className="text-[10px] text-red-700">{error}</span>
      )}
    </div>
  )
}