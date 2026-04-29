import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Waves } from 'lucide-react'
import HydrologyForm from './HydrologyForm'
import { DEFAULT_HYDROLOGY_INPUTS, type HydrologyInputs } from '@/lib/calc/hydrology'

export const metadata = {
  title: 'Hydrology — HydroStack',
}

export default async function HydrologyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // ─── Fetch the project ──────────────────────────────────────────────────
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, river, district, capacity_kw, standard, status')
    .eq('id', id)
    .single()

  if (!project) notFound()

  // ─── Fetch any previously-saved hydrology inputs ────────────────────────
  const { data: existingModule } = await supabase
    .from('project_modules')
    .select('inputs, outputs, updated_at')
    .eq('project_id', id)
    .eq('module', 'hydrology')
    .maybeSingle()

  // Merge saved inputs over defaults so the UI is always fully populated
  // even if the saved JSONB is partial or from an older schema.
  const initialInputs: HydrologyInputs = {
    ...DEFAULT_HYDROLOGY_INPUTS,
    // Seed target capacity from the project record so the cross-check is meaningful
    targetCapacityKW: Number(project.capacity_kw) || DEFAULT_HYDROLOGY_INPUTS.targetCapacityKW,
    ...(existingModule?.inputs as Partial<HydrologyInputs> | null),
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* ─── Header / breadcrumb ─────────────────────────────────────────── */}
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-5">
          <Link
            href={`/projects/${project.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-stone-900 transition-colors mb-3"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{project.name}</span>
          </Link>

          <div className="flex items-start justify-between gap-6">
            <div>
              <div
                className="flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase text-emerald-800 mb-2"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                <Waves className="w-3 h-3" />
                <span>Module 01 · Hydrology</span>
              </div>
              <h1
                className="text-4xl lg:text-5xl text-stone-900 tracking-tight"
                style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
              >
                Hydrological Analysis
              </h1>
              <p className="mt-2 text-stone-600 max-w-2xl">
                Flow duration, design flood, head, and installed capacity per
                <span
                  className="ml-1 text-stone-800"
                  style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                >
                  AEPC&nbsp;DFS&nbsp;2014&nbsp;§2.4
                </span>
                .
              </p>
            </div>

            {existingModule?.updated_at && (
              <div
                className="text-[11px] text-stone-500 uppercase tracking-wider whitespace-nowrap pt-2"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                Last saved
                <br />
                {new Date(existingModule.updated_at).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── Form ──────────────────────────────────────────────────────────── */}
      <HydrologyForm projectId={project.id} initialInputs={initialInputs} />
    </div>
  )
}