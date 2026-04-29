// HydroStack — Module 02: Intake & Settling Basin
// Server component — reads upstream hydrology JSONB, passes to client form.

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { IntakeForm } from './IntakeForm'
import { INTAKE_DEFAULTS, type IntakeInput } from '@/lib/calc/intake'

interface PageProps {
  params: Promise<{ id: string }>   // Next.js 15+: params is a Promise
}

export default async function IntakePage({ params }: PageProps) {
  const { id } = await params       // ← must await
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Project ──────────────────────────────────────────────────────────────
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name, status')
    .eq('id', id)
    .single()
  if (projectError || !project) notFound()

  // ── Upstream hydrology module ─────────────────────────────────────────────
  const { data: hydro } = await supabase
    .from('project_modules')
    .select('inputs, outputs, updated_at')
    .eq('project_id', id)
    .eq('module', 'hydrology')
    .maybeSingle()

  const hydroInputs  = (hydro?.inputs  as Record<string, unknown> | null) ?? null
  const hydroOutputs = (hydro?.outputs as Record<string, unknown> | null) ?? null

  const qDesign  = (hydroInputs?.qDesign  as number | undefined) ?? 0
  const grossHead =
    (hydroInputs?.grossHead  as number | undefined) ??
    (hydroOutputs?.grossHead as number | undefined) ??
    0
  const q40 = (hydroOutputs?.q40 as number | undefined) ?? (hydroOutputs?.Q40 as number | undefined) ?? null
  const q80 = (hydroOutputs?.q80 as number | undefined) ?? (hydroOutputs?.Q80 as number | undefined) ?? null

  // ── This module (persisted inputs if re-opening) ──────────────────────────
  const { data: savedIntake } = await supabase
    .from('project_modules')
    .select('inputs, outputs, updated_at')
    .eq('project_id', id)
    .eq('module', 'intake')
    .maybeSingle()

  const initialInputs: IntakeInput = {

    ...INTAKE_DEFAULTS,
    ...((savedIntake?.inputs as Partial<IntakeInput> | null) ?? {}),
    // always override with latest hydrology values
    qDesign,
    grossHead,
  }

  const hydrologyComplete = qDesign > 0 && grossHead > 0

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-8 py-6">
          <div className="flex items-baseline justify-between">
            <div>
              <div
                className="text-[11px] tracking-[0.2em] uppercase text-stone-500"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                §2 · Module 02
              </div>
              <h1
                className="mt-1 text-3xl text-stone-900 tracking-tight"
                style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
              >
                Intake &amp; Settling Basin
              </h1>
              <p
                className="mt-1 text-sm text-stone-500"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                {project.name}
              </p>
            </div>
            <Link
              href={`/projects/${id}`}
              className="text-sm text-stone-500 hover:text-stone-900"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              ← Project hub
            </Link>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-6xl px-8 py-8">
        {!hydrologyComplete && (
          <div className="mb-8 rounded border border-amber-300 bg-amber-50 p-4">
            <div
              className="text-[11px] tracking-[0.2em] uppercase text-amber-800"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              Upstream module incomplete
            </div>
            <p className="mt-2 text-sm text-amber-900">
              Complete the{' '}
              <Link href={`/projects/${id}/hydrology`} className="underline">
                hydrology module
              </Link>{' '}
              first. Design flow Q<sub>design</sub> and gross head are required.
            </p>
          </div>
        )}

        <IntakeForm
          projectId={id}
          initialInputs={initialInputs}
          hydroSummary={{ qDesign, grossHead, q40, q80 }}
          locked={!hydrologyComplete}
          alreadySaved={!!savedIntake}
        />
      </main>
    </div>
  )
}
