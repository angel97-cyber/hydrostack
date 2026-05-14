'use client'

import { useState, useMemo } from 'react'
import { PlanManager } from './plan-manager'

export interface UserRow {
  id: string
  email: string
  fullName: string | null
  panNumber: string | null
  plan: string
  subscriptionStatus: string
  projectLimit: number
  planActivatedAt: string | null
  planNote: string | null
  updatedAt: string | null
  projectCount: number
}

const PLAN_COLOR: Record<string, string> = {
  beta: 'bg-stone-200 text-stone-900',
  student: 'bg-stone-200 text-stone-900',
  solo: 'bg-emerald-100 text-emerald-900',
  studio: 'bg-blue-100 text-blue-900',
  enterprise: 'bg-purple-100 text-purple-900',
}

export function UsersTable({ initialRows }: { initialRows: UserRow[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return initialRows
    return initialRows.filter(
      (r) =>
        r.email.toLowerCase().includes(q) ||
        r.fullName?.toLowerCase().includes(q) ||
        r.panNumber?.toLowerCase().includes(q),
    )
  }, [initialRows, query])

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by email, name or PAN…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-md rounded-sm border border-stone-300 bg-white px-3 py-2 font-mono text-sm text-stone-900 placeholder-stone-400 focus:border-stone-600 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-sm border border-stone-300 bg-white">
        <table className="min-w-full divide-y divide-stone-200 font-mono text-xs">
          <thead className="bg-stone-50">
            <tr>
              <Th>Email</Th>
              <Th>Name</Th>
        <Th>PAN</Th>
              <Th>Plan</Th>
              <Th>Projects</Th>
              <Th>Activated</Th>
              <Th>Note</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-stone-500">
                  No users match.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-stone-50/60">
                <Td>
                  <div className="text-stone-900">{r.email}</div>
                </Td>
                <Td>
                  <div className="text-stone-900">{r.fullName ?? '—'}</div>
                </Td>
                <Td>
                  <span className="text-stone-700">{r.panNumber ?? '—'}</span>
                </Td>
                <Td>
                  <span
                    className={`inline-block rounded-sm px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                      PLAN_COLOR[r.plan] ?? 'bg-stone-200 text-stone-900'
                    }`}
                  >
                    {r.plan}
                  </span>
                  <div className="mt-0.5 text-[10px] text-stone-500">
                    {r.subscriptionStatus}
                  </div>
                </Td>
                <Td>
                  <span className="text-stone-900">
                    {r.projectCount}
                    <span className="text-stone-400"> / {r.projectLimit >= 999 ? '∞' : r.projectLimit}</span>
                  </span>
                </Td>
                <Td>
                  <span className="text-stone-700">
                    {r.planActivatedAt
                      ? new Date(r.planActivatedAt).toLocaleDateString()
                      : '—'}
                  </span>
                </Td>
                <Td>
                  <span className="block max-w-[180px] truncate text-stone-600" title={r.planNote ?? ''}>
                    {r.planNote ?? '—'}
                  </span>
                </Td>
                <Td>
                  <PlanManager
                    userId={r.id}
                    currentPlan={r.plan}
                    currentNote={r.planNote ?? ''}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-stone-600">
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 align-top">{children}</td>
}