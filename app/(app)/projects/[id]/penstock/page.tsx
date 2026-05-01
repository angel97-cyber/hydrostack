// HydroStack — Module 04: Penstock (server component)
//
// Reads three upstream modules' saved JSONB to seed inputs:
//   - hydrology  → qDesign, grossHead
//   - intake     → hIntakeLoss (rack head loss + entrance loss in basin)
//   - headrace   → hHeadrace   (Manning friction + minor losses in conduit)
// If any are missing the form still renders, with the missing values shown as
// 0 and a per-module banner asking the engineer to save it first.

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { PenstockForm } from './PenstockForm'
import {
  PENSTOCK_DEFAULTS,
  type PenstockInput,
} from '@/lib/calc/penstock'

interface PageProps {
  // Next.js 16 async params
  params: Promise<{ id: string }>
}

export default async function PenstockPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Project (only safe columns) ─────────────────────────────────────────
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name, river, district, capacity_kw, standard, status')
    .eq('id', id)
    .single()
  if (projectError || !project) notFound()

  // ── Upstream module: hydrology ──────────────────────────────────────────
  const { data: hydro } = await supabase
    .from('project_modules')
    .select('inputs, outputs, updated_at')
    .eq('project_id', id)
    .eq('module', 'hydrology')
    .maybeSingle()

  const hydroInputs  = (hydro?.inputs  as Record<string, unknown> | null) ?? null
  const hydroOutputs = (hydro?.outputs as Record<string, unknown> | null) ?? null
  const qDesign      = (hydroInputs?.qDesign  as number | undefined) ?? 0
  const grossHead    =
    (hydroInputs?.grossHead  as number | undefined) ??
    (hydroOutputs?.grossHead as number | undefined) ?? 0

  // ── Upstream module: intake ─────────────────────────────────────────────
  const { data: intake } = await supabase
    .from('project_modules')
    .select('outputs')
    .eq('project_id', id)
    .eq('module', 'intake')
    .maybeSingle()

  const intakeOutputs = (intake?.outputs as Record<string, unknown> | null) ?? null
  // The intake module does not currently report a single rack-head-loss number,
  // so we fall back to a sensible default (0.05 m) that the engineer can
  // override on the form.
  const hIntakeLoss =
    (intakeOutputs?.rackHeadLossM    as number | undefined) ??
    (intakeOutputs?.headLossM        as number | undefined) ??
    (intakeOutputs?.kirschmerHeadLossM as number | undefined) ??
    0.05

  // ── Upstream module: headrace ───────────────────────────────────────────
  const { data: headrace } = await supabase
    .from('project_modules')
    .select('outputs')
    .eq('project_id', id)
    .eq('module', 'headrace')
    .maybeSingle()

  const headraceOutputs = (headrace?.outputs as Record<string, unknown> | null) ?? null
  const hHeadrace =
    (headraceOutputs?.hHeadrace  as number | undefined) ??
    (headraceOutputs?.hHeadraceM as number | undefined) ?? 0

  const hydrologyComplete = !!hydro && qDesign > 0 && grossHead > 0
  const headraceComplete  = !!headrace
  const intakeComplete    = !!intake

  // ── Saved penstock inputs (resume) ──────────────────────────────────────
  const { data: saved } = await supabase
    .from('project_modules')
    .select('inputs, updated_at')
    .eq('project_id', id)
    .eq('module', 'penstock')
    .maybeSingle()
  const savedInputs = (saved?.inputs as Partial<PenstockInput> | null) ?? null

  const initialInputs: PenstockInput = {
    ...PENSTOCK_DEFAULTS,
    ...(savedInputs ?? {}),
    // upstream values always override stale saved inputs
    qDesign,
    grossHead,
    hIntakeLoss,
    hHeadrace,
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6 lg:px-10">
          <div className="mb-3 flex items-center gap-2 text-xs text-stone-500">
            <Link href={`/projects/${id}`} className="inline-flex items-center gap-1 hover:text-stone-800">
              <ArrowLeft className="h-3 w-3" />
              Back to project
            </Link>
            <span>·</span>
            <span>{project.name}</span>
          </div>
          <div className="flex items-baseline justify-between gap-6">
            <div>
              <p
                className="text-[11px] uppercase tracking-[0.2em] text-stone-500"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                Module 04
              </p>
              <h1
                className="mt-1 text-3xl text-stone-900"
                style={{ fontFamily: 'var(--font-display), Georgia, serif' }}
              >
                Penstock
              </h1>
              <p className="mt-1 text-sm text-stone-600">
                Pressure-pipe sizing, water-hammer surge, wall thickness and
                hydraulic head losses. Net head and installed capacity feed
                back to powerhouse / turbine selection.
              </p>
            </div>
            <div
              className="text-right text-[11px] uppercase tracking-[0.15em] text-stone-500"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              <div>AEPC DFS 2014 §3.4.1</div>
              <div>IS 11639 Pt 1 · Pt 2</div>
              <div>IS 11625 · AHEC §11</div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
        {!hydrologyComplete && (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>Hydrology module is not saved.</strong> Penstock design
            requires the design flow Q<sub>design</sub> and gross head from
            hydrology. {' '}
            <Link
              href={`/projects/${id}/hydrology`}
              className="font-medium underline hover:text-amber-950"
            >
              Open hydrology →
            </Link>
          </div>
        )}
        {hydrologyComplete && !intakeComplete && (
          <div className="mb-4 rounded-md border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-700">
            Intake module is not saved. The intake head loss is being
            estimated as 0.05 m — save the intake module for an accurate value.
            <Link
              href={`/projects/${id}/intake`}
              className="ml-2 font-medium text-stone-900 underline"
            >
              Open intake →
            </Link>
          </div>
        )}
        {hydrologyComplete && !headraceComplete && (
          <div className="mb-6 rounded-md border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-700">
            Headrace module is not saved. The headrace head loss is being
            taken as 0 m — save the headrace module for an accurate net head.
            <Link
              href={`/projects/${id}/headrace`}
              className="ml-2 font-medium text-stone-900 underline"
            >
              Open headrace →
            </Link>
          </div>
        )}

        <PenstockForm
          projectId={id}
          initialInputs={initialInputs}
          locked={!hydrologyComplete}
          alreadySaved={!!saved}
        />
      </main>
    </div>
  )
}