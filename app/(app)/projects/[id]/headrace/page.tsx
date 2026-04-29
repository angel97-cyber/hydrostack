// HydroStack — Module 03: Headrace & Forebay (server component)
//
// Reads upstream hydrology module's saved JSONB to seed the design flow.
// If hydrology is not yet saved, the form renders disabled with a warning.

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { HeadraceForm } from './HeadraceForm'
import {
  HEADRACE_DEFAULTS,
  type HeadraceInput,
} from '@/lib/calc/headrace'

interface PageProps {
  // Next.js 15+ async params
  params: Promise<{ id: string }>
}

export default async function HeadracePage({ params }: PageProps) {
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

  const hydroInputs  = (hydro?.inputs as Record<string, unknown> | null) ?? null
  const qDesign      = (hydroInputs?.qDesign as number | undefined) ?? 0

  const hydrologyComplete = !!hydro && qDesign > 0

  // ── This module's saved row (if any) ────────────────────────────────────
  const { data: saved } = await supabase
    .from('project_modules')
    .select('inputs, outputs, updated_at')
    .eq('project_id', id)
    .eq('module', 'headrace')
    .maybeSingle()

  const savedInputs = (saved?.inputs as Partial<HeadraceInput> | null) ?? null

  // Merge: defaults → saved → live qDesign
  const initialInputs: HeadraceInput = {
    ...HEADRACE_DEFAULTS,
    ...(savedInputs ?? {}),
    qDesign,
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6 lg:px-10">
          <Link
            href={`/projects/${id}`}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {project.name}
          </Link>

          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div
                className="mb-2 text-[11px] uppercase tracking-[0.2em] text-emerald-800"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                Module 03 · Headrace &amp; Forebay
              </div>
              <h1
                className="text-3xl text-stone-900"
                style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
              >
                Conveyance &amp; storage
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-stone-600">
                Manning&rsquo;s open-channel hydraulics for the headrace, with forebay sizing,
                submergence and fine-trashrack checks. Design flow is read from the hydrology
                module.
              </p>
            </div>
            <div
              className="text-right text-[11px] uppercase tracking-[0.15em] text-stone-500"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              <div>AEPC DFS 2014 §3.3.5</div>
              <div>AHEC-IITR §8 · §9</div>
              <div>IS:11388-1995</div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
        {!hydrologyComplete && (
          <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>Hydrology module is not saved.</strong> Headrace and forebay design
            require the design flow Q<sub>design</sub> from hydrology. Open the hydrology
            module, run the calculation and save it before proceeding here.
            <div className="mt-2">
              <Link
                href={`/projects/${id}/hydrology`}
                className="font-medium text-amber-900 underline hover:text-amber-950"
              >
                Open hydrology →
              </Link>
            </div>
          </div>
        )}

        <HeadraceForm
          projectId={id}
          initialInputs={initialInputs}
          qDesign={qDesign}
          locked={!hydrologyComplete}
          alreadySaved={!!saved}
        />
      </main>
    </div>
  )
}