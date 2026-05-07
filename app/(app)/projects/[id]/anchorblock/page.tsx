import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import AnchorBlockForm from './AnchorBlockForm'
import type { AnchorBlockInputs } from '@/lib/calc/anchorblock'
import { ANCHORBLOCK_DEFAULTS } from '@/lib/calc/anchorblock'

// Next.js 16: params is a Promise — await it
export default async function AnchorBlockPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Project (only confirmed-existing columns: id, name, river)
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name, river')
    .eq('id', id)
    .maybeSingle()

  if (projectError || !project) {
    notFound()
  }

  // Upstream — read from penstock module JSONB
  const { data: penstock } = await supabase
    .from('project_modules')
    .select('inputs, outputs')
    .eq('project_id', id)
    .eq('module', 'penstock')
    .maybeSingle()

  const penstockInputs = (penstock?.inputs ?? {}) as Record<string, unknown>
const penstockOutputs = (penstock?.outputs ?? {}) as Record<string, unknown>


  // Pull pipe geometry. Penstock module outputs include externalDiameterMm,
  // tCommercialMm, designPressureMpa, slopeAngleDeg, thickness.designHeadM, etc.
  const num = (v: unknown, fallback: number): number =>
    typeof v === 'number' && !Number.isNaN(v) ? v : fallback

  const designHeadM = num(
    (penstockOutputs.thickness as Record<string, unknown> | undefined)?.designHeadM ??
      penstockOutputs.designHeadM,
    ANCHORBLOCK_DEFAULTS.designHeadM,
  )

  // AFTER (tries inputs first, then outputs, then alternative key names)
const upstream = {
  diameterMm: num(
    penstockInputs.diameterMm ?? penstockInputs.internalDiameterMm,
    ANCHORBLOCK_DEFAULTS.diameterMm,
  ),
  externalDiameterMm: num(
    penstockOutputs.externalDiameterMm ??
      penstockInputs.externalDiameterMm ??
      penstockOutputs.dExternalMm,
    ANCHORBLOCK_DEFAULTS.externalDiameterMm,
  ),
  tCommercialMm: num(
  penstockOutputs.thicknessSelectedMm ??
    (penstockOutputs.thickness as Record<string, unknown> | undefined)?.tCommercialMm,
  ANCHORBLOCK_DEFAULTS.tCommercialMm,
),
  designHeadM,
  // flowM3s: try every key the penstock module might use
  flowM3s: num(penstockInputs.qDesign, ANCHORBLOCK_DEFAULTS.flowM3s),
  pipeSlopeAngleDeg: num(
    penstockOutputs.slopeAngleDeg ??
      penstockInputs.slopeAngleDeg ??
      penstockInputs.pipeSlopeAngleDeg,
    ANCHORBLOCK_DEFAULTS.pipeSlopeAngleDeg,
  ),
}

  // Saved anchor block module
  const { data: saved } = await supabase
    .from('project_modules')
    .select('inputs')
    .eq('project_id', id)
    .eq('module', 'anchorblock')
    .maybeSingle()

  const savedInputs = (saved?.inputs ?? null) as Partial<AnchorBlockInputs> | null

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <Link
          href={`/projects/${id}`}
          className="inline-flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {project.name}
        </Link>

        {/* Header */}
        <header className="mb-8 pb-6 border-b-2 border-stone-300">
          <div className="font-mono text-xs text-stone-500 mb-2">MODULE 05 · ANCHOR BLOCK</div>
          <h1 className="text-4xl font-display text-stone-900 mb-2">{project.name}</h1>
          {project.river && <p className="text-stone-600">{project.river}</p>}
          <p className="text-stone-700 mt-3 text-sm leading-relaxed max-w-3xl">
            Detailed anchor-block design at a vertical or horizontal bend per <span className="font-mono">IS 5330:1984</span>.
            Computes all twelve force components of §5.1, resolves them to global axes for both expanding and
            contracting conditions per Fig. 3, and runs the three stability checks of §7 (sliding, overturning by
            kern, bearing). Reference: AHEC §11.6, AEPC DFS Guidelines 2014 §3.3.6.
          </p>
        </header>

        {/* Form */}
        <AnchorBlockForm projectId={id} upstream={upstream} saved={savedInputs} />
      </div>
    </div>
  )
}