'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { updateProfile, type ProfileFormState } from './actions'

interface Initial {
  full_name: string
  firm_name: string
  nec_reg_no: string
  designation: string
  phone: string
}

const initialState: ProfileFormState = { status: 'idle', message: '' }

export default function ProfileForm({
  initial,
  userEmail,
  updatedAt,
}: {
  initial: Initial
  userEmail: string
  updatedAt: string | null
}) {
  const [state, formAction] = useActionState(updateProfile, initialState)

  // Mirror inputs into local state so the live preview updates as the user
  // types, without round-tripping to the server.
  const [draft, setDraft] = useState<Initial>(initial)

  // Compose the same `preparedBy` string the DFS builder will produce.
  const preparedBy =
    [
      draft.full_name,
      draft.nec_reg_no ? `NEC Reg. ${draft.nec_reg_no}` : null,
      draft.designation,
      draft.firm_name,
    ]
      .filter((v) => v && v.trim().length > 0)
      .join(' · ') || '[INSERT: Engineer name, NEC reg. no., firm name]'

  return (
    <form action={formAction} className="space-y-8">
      {/* Account email (read-only) */}
      <Field
        label="Sign-in email"
        hint="Tied to your auth account — change it under Account (coming soon)"
      >
        <input
          type="text"
          value={userEmail}
          disabled
          className="w-full px-3 py-2 bg-stone-100 border border-stone-200 text-[14px] text-stone-500 cursor-not-allowed"
          style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
        />
      </Field>

      <div className="border-t border-stone-200" />

      {/* Full name */}
      <Field
        label="Full name"
        hint="Appears first on every DFS cover page (e.g. Angel Mainali)"
        required
      >
        <input
          type="text"
          name="full_name"
          required
          maxLength={120}
          defaultValue={initial.full_name}
          onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))}
          placeholder="e.g. Angel Mainali"
          className="w-full px-3 py-2 bg-white border border-stone-300 focus:border-emerald-700 focus:outline-none text-[14px] text-stone-900 transition-colors"
        />
      </Field>

      {/* NEC registration */}
      <Field
        label="NEC registration number"
        hint="Nepal Engineering Council — e.g. NEC-CIV-12345 — required for AEPC submission"
      >
        <input
          type="text"
          name="nec_reg_no"
          maxLength={60}
          defaultValue={initial.nec_reg_no}
          onChange={(e) => setDraft((d) => ({ ...d, nec_reg_no: e.target.value }))}
          placeholder="e.g. NEC-CIV-12345"
          className="w-full px-3 py-2 bg-white border border-stone-300 focus:border-emerald-700 focus:outline-none text-[14px] text-stone-900 transition-colors"
          style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
        />
      </Field>

      {/* Designation */}
      <Field
        label="Designation"
        hint="Your title — appears on the DFS cover after your registration number"
      >
        <input
          type="text"
          name="designation"
          maxLength={120}
          defaultValue={initial.designation}
          onChange={(e) => setDraft((d) => ({ ...d, designation: e.target.value }))}
          placeholder="e.g. Senior Civil Engineer"
          className="w-full px-3 py-2 bg-white border border-stone-300 focus:border-emerald-700 focus:outline-none text-[14px] text-stone-900 transition-colors"
        />
      </Field>

      {/* Firm */}
      <Field
        label="Firm or organisation"
        hint="If you're independent, leave blank or write 'Independent Consultant'"
      >
        <input
          type="text"
          name="firm_name"
          maxLength={160}
          defaultValue={initial.firm_name}
          onChange={(e) => setDraft((d) => ({ ...d, firm_name: e.target.value }))}
          placeholder="e.g. Himalayan Hydropower Consultants Pvt. Ltd."
          className="w-full px-3 py-2 bg-white border border-stone-300 focus:border-emerald-700 focus:outline-none text-[14px] text-stone-900 transition-colors"
        />
      </Field>

      {/* Phone */}
      <Field
        label="Phone number"
        hint="Optional — not shown on the report, only stored for our records"
      >
        <input
          type="text"
          name="phone"
          maxLength={40}
          defaultValue={initial.phone}
          onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
          placeholder="e.g. +977 98XXXXXXXX"
          className="w-full px-3 py-2 bg-white border border-stone-300 focus:border-emerald-700 focus:outline-none text-[14px] text-stone-900 transition-colors"
          style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
        />
      </Field>

      {/* Live cover preview */}
      <div className="border border-stone-200 bg-stone-50 p-5">
        <p
          className="text-[10px] tracking-[0.18em] uppercase text-stone-500 mb-3"
          style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
        >
          DFS cover preview
        </p>
        <div className="bg-white border border-stone-300 p-5">
          <p
            className="text-[10px] tracking-[0.18em] uppercase text-stone-500 mb-1"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            Prepared by
          </p>
          <p
            className={`text-[14px] ${
              preparedBy.startsWith('[INSERT')
                ? 'text-amber-700 italic'
                : 'text-stone-900'
            }`}
          >
            {preparedBy}
          </p>
        </div>
      </div>

      {/* Status message */}
      {state.status !== 'idle' && (
        <div
          className={`px-4 py-3 border text-[13px] ${
            state.status === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {state.message}
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center justify-between pt-4 border-t border-stone-200">
        <p
          className="text-[11px] text-stone-500"
          style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
        >
          {updatedAt
            ? `Last saved · ${new Date(updatedAt).toLocaleString('en-GB')}`
            : 'Not saved yet'}
        </p>
        <SaveButton />
      </div>
    </form>
  )
}

// ─── helpers ────────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        className="block text-[12px] tracking-[0.06em] text-stone-700 font-medium mb-1.5"
        style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
      >
        {label}
        {required && <span className="text-emerald-700 ml-1">*</span>}
      </label>
      {children}
      {hint && (
        <p className="mt-1.5 text-[12px] text-stone-500 leading-snug">{hint}</p>
      )}
    </div>
  )
}

function SaveButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:bg-stone-400 disabled:cursor-not-allowed text-emerald-50 text-[13px] font-medium tracking-wide transition-colors"
      style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
    >
      {pending ? 'Saving…' : 'Save profile'}
    </button>
  )
}