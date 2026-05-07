// HydroStack — Module 06: Powerhouse Sizing & Turbine Selection
// app/(app)/projects/[id]/powerhouse/page.tsx
//
// Server component. Loads project, penstock module outputs and hydrology
// module outputs, merges them with module defaults, and passes the resolved
// initial values to the client form. Selects only columns confirmed to exist
// in the projects table (id, name, status) — see Day 4 lesson where selecting
// a non-existent column caused a silent notFound() 404.

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { POWERHOUSE_DEFAULTS, type PowerhouseInputs } from '@/lib/calc/powerhouse'
import PowerhouseForm from './PowerhouseForm'

// Next.js 16: route params are a Promise — must be awaited.
type PageProps = { params: Promise<{ id: string }> }

/** Pull a number from a JSONB record under any of several candidate keys. */
function num(obj: Record<string, unknown> | null | undefined, ...keys: string[]): number | undefined {
  if (!obj) return undefined
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return undefined
}

/** Walk nested keys: e.g. nested(obj, 'thickness', 'designHeadM') */
function nested(obj: Record<string, unknown> | null | undefined, ...path: string[]): number | undefined {
  let cur: unknown = obj
  for (const k of path) {
    if (cur && typeof cur === 'object' && k in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[k]
    } else return undefined
  }
  return typeof cur === 'number' && Number.isFinite(cur) ? cur : undefined
}

export default async function PowerhousePage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // 1) Auth — redirect to login if not signed in.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2) Project — only safe columns (id, name, status).
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name, status')
    .eq('id', id)
    .single()
  if (projectError || !project) notFound()

  // 3) Upstream module rows — read inputs/outputs JSONB.
  type ModuleRow = {
    module: string
    inputs: Record<string, unknown> | null
    outputs: Record<string, unknown> | null
  }
  const { data: rows } = (await supabase
    .from('project_modules')
    .select('module, inputs, outputs')
    .eq('project_id', id)
    .in('module', ['hydrology', 'intake', 'settling', 'headrace', 'forebay', 'penstock'])) as unknown as {
    data: ModuleRow[] | null
  }

  const findModule = (name: string): ModuleRow | null =>
    rows?.find((r) => r.module === name) ?? null

  const hydroRow = findModule('hydrology')
  const intakeRow = findModule('intake') ?? findModule('settling')
  const headraceRow = findModule('headrace') ?? findModule('forebay')
  const penstockRow = findModule('penstock')

  const hyIn = (hydroRow?.inputs ?? {}) as Record<string, unknown>
  const hyOut = (hydroRow?.outputs ?? {}) as Record<string, unknown>
  const inIn = (intakeRow?.inputs ?? {}) as Record<string, unknown>
  const inOut = (intakeRow?.outputs ?? {}) as Record<string, unknown>
  const hrIn = (headraceRow?.inputs ?? {}) as Record<string, unknown>
  const hrOut = (headraceRow?.outputs ?? {}) as Record<string, unknown>
  const peIn = (penstockRow?.inputs ?? {}) as Record<string, unknown>
  const peOut = (penstockRow?.outputs ?? {}) as Record<string, unknown>

  // 4) Resolve hydraulic context. Try authoritative keys first, fall through.
  // Day 8 prompt names: penstockInputs.qDesign, .grossHead, penstockOutputs.hNetM
  // Day 6 actual names confirmed: penstock saves hPenstockM (loss in penstock).
  // Hydrology may store qDesign / grossHead under various aliases.
  const Q =
    num(peIn, 'qDesign', 'qDesignM3s', 'designFlowM3s', 'flowM3s') ??
    num(hyOut, 'qDesign', 'qDesignM3s', 'qPlantM3s', 'designFlowM3s') ??
    num(hyIn, 'qDesign', 'qDesignM3s') ??
    POWERHOUSE_DEFAULTS.qDesignM3s

  const H_g =
    num(peIn, 'grossHead', 'hGrossM', 'designHeadM') ??
    num(hyOut, 'grossHead', 'hGrossM') ??
    num(hyIn, 'grossHead', 'hGrossM') ??
    POWERHOUSE_DEFAULTS.hGrossM

  // Loss accounting — per upstream module
  const h_intake =
    num(inOut, 'hIntakeM', 'hLossIntakeM', 'totalHeadLossM', 'headLossM') ??
    POWERHOUSE_DEFAULTS.hLossIntakeM

  const h_headrace =
    num(hrOut, 'hHeadraceM', 'hLossHeadraceM', 'totalHeadLossM', 'headLossM') ??
    POWERHOUSE_DEFAULTS.hLossHeadraceM

  const h_penstock =
    num(peOut, 'hPenstockM', 'hLossPenstockM', 'totalHeadLossM', 'frictionLossM') ??
    nested(peOut, 'losses', 'totalM') ??
    POWERHOUSE_DEFAULTS.hLossPenstockM

  // Site / tailwater context — typically provided by the user but try hydrology
  const tailwaterMasl =
    num(hyIn, 'tailwaterElevationMasl', 'tailwaterMasl') ??
    POWERHOUSE_DEFAULTS.tailwaterMinElevationMasl

  const siteMasl =
    num(hyIn, 'powerhouseElevationMasl', 'siteElevationMasl', 'elevationMasl') ??
    POWERHOUSE_DEFAULTS.siteElevationMasl

  const designFloodMasl =
    num(hyOut, 'designFloodLevelMasl', 'hflMasl', 'q100ElevationMasl') ??
    num(hyIn, 'designFloodLevelMasl', 'hflMasl') ??
    Math.max(tailwaterMasl + 2.0, POWERHOUSE_DEFAULTS.designFloodLevelMasl)

  // 5) Existing saved powerhouse module (resume editing)
  const { data: phRow } = await supabase
    .from('project_modules')
    .select('inputs')
    .eq('project_id', id)
    .eq('module', 'powerhouse')
    .maybeSingle()
  const saved = (phRow?.inputs ?? {}) as Partial<PowerhouseInputs>

  // 6) Compose initial inputs. Saved values take precedence over upstream
  // defaults (so the user can override and persist), but upstream is preferred
  // over POWERHOUSE_DEFAULTS so the chain stays connected.
  const initial: PowerhouseInputs = {
    qDesignM3s: saved.qDesignM3s ?? Q,
    hGrossM: saved.hGrossM ?? H_g,
    hLossIntakeM: saved.hLossIntakeM ?? h_intake,
    hLossHeadraceM: saved.hLossHeadraceM ?? h_headrace,
    hLossPenstockM: saved.hLossPenstockM ?? h_penstock,
    turbineOverride: saved.turbineOverride ?? null,
    numberOfPoles: saved.numberOfPoles ?? POWERHOUSE_DEFAULTS.numberOfPoles,
    driveSystem: saved.driveSystem ?? POWERHOUSE_DEFAULTS.driveSystem,
    powerFactor: saved.powerFactor ?? POWERHOUSE_DEFAULTS.powerFactor,
    numberOfJets: saved.numberOfJets ?? POWERHOUSE_DEFAULTS.numberOfJets,
    tailwaterMinElevationMasl: saved.tailwaterMinElevationMasl ?? tailwaterMasl,
    siteElevationMasl: saved.siteElevationMasl ?? siteMasl,
    waterTemperatureC: saved.waterTemperatureC ?? POWERHOUSE_DEFAULTS.waterTemperatureC,
    designFloodLevelMasl: saved.designFloodLevelMasl ?? designFloodMasl,
    driveEfficiencyOverride: saved.driveEfficiencyOverride ?? null,
  }

  return (
    <PowerhouseForm projectId={id} projectName={project.name as string} initial={initial} />
  )
}