// HydroStack — Module 07: Energy Generation Table
// app/(app)/projects/[id]/energy/page.tsx
//
// Server component. Loads:
//   – project (only safe columns: id, name, river, district, capacity_kw, standard, status)
//   – hydrology JSONB (monthlyFlows, fdc, qMean, qMin)
//   – powerhouse JSONB (hydraulics.qDesignM3s, hydraulics.hNetM,
//                       generator.electricalPowerKw, generator.efficiencyOverall,
//                       selected turbine type)
//   – penstock JSONB (fallback for hNet via thickness.designHeadM if powerhouse
//                       hasn't been run yet)
//   – existing energy module row (resume editing)
// Composes the initial inputs and renders <EnergyForm/>.

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  ENERGY_DEFAULTS,
  defaultTechnicalMin,
  powerKw,
  type EnergyInputs,
} from '@/lib/calc/energy'
import EnergyForm from './EnergyForm'

// Next.js 16: route params are a Promise — must be awaited.
type PageProps = { params: Promise<{ id: string }> }

/** Pull a finite number from a JSONB record under any of several candidate keys. */
function num(
  obj: Record<string, unknown> | null | undefined,
  ...keys: string[]
): number | undefined {
  if (!obj) return undefined
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return undefined
}

/** Walk a nested JSONB path: nested(out, 'hydraulics', 'qDesignM3s'). */
function nested(
  obj: Record<string, unknown> | null | undefined,
  ...path: string[]
): number | undefined {
  let cur: unknown = obj
  for (const k of path) {
    if (cur && typeof cur === 'object' && k in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[k]
    } else {
      return undefined
    }
  }
  return typeof cur === 'number' && Number.isFinite(cur) ? cur : undefined
}

/** Pull an array of numbers under candidate keys. */
function numArray(
  obj: Record<string, unknown> | null | undefined,
  ...keys: string[]
): number[] | undefined {
  if (!obj) return undefined
  for (const k of keys) {
    const v = obj[k]
    if (Array.isArray(v) && v.every((x) => typeof x === 'number' && Number.isFinite(x))) {
      return v as number[]
    }
  }
  return undefined
}

/** Coerce an FDC array of various shapes into [{p,q}] (probability % in [0,100], q ≥ 0). */
function coerceFdcPoints(value: unknown): { p: number; q: number }[] {
  if (!Array.isArray(value)) return []
  const out: { p: number; q: number }[] = []
  for (const item of value) {
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>
      const p =
        typeof o.p === 'number' ? o.p :
        typeof o.probability === 'number' ? o.probability :
        typeof o.exceedance === 'number' ? o.exceedance :
        typeof o.percent === 'number' ? o.percent :
        undefined
      const q =
        typeof o.q === 'number' ? o.q :
        typeof o.flow === 'number' ? o.flow :
        typeof o.discharge === 'number' ? o.discharge :
        undefined
      if (typeof p === 'number' && typeof q === 'number' && Number.isFinite(p) && Number.isFinite(q)) {
        out.push({ p, q })
      }
    }
  }
  return out
}

/**
 * Build an FDC from common hydrology output shapes:
 *   1) outputs.fdcPoints  — array of {p,q}
 *   2) outputs.fdc        — object with q40/q60/q80/q90/q95 etc. (Day 3 shape)
 *   3) [] (caller falls back to monthly Weibull)
 */
function buildFdcFromHydrology(hyOut: Record<string, unknown> | null | undefined) {
  if (!hyOut) return []
  const explicit = coerceFdcPoints(hyOut.fdcPoints)
  if (explicit.length > 0) return explicit
  const fdc = hyOut.fdc as Record<string, unknown> | undefined
  if (!fdc) return []
  // Map known keys to exceedance percentages
  const mapping: Record<string, number> = {
    q5: 5, q10: 10, q20: 20, q30: 30, q40: 40, q50: 50,
    q60: 60, q70: 70, q75: 75, q80: 80, q85: 85, q90: 90, q95: 95,
  }
  const points: { p: number; q: number }[] = []
  for (const [key, p] of Object.entries(mapping)) {
    const v = fdc[key]
    if (typeof v === 'number' && Number.isFinite(v)) points.push({ p, q: v })
  }
  return points.sort((a, b) => a.p - b.p)
}

/** Map the powerhouse 'selected' turbine string to our typed enum. */
function coerceTurbineType(value: unknown): EnergyInputs['turbineType'] {
  if (typeof value !== 'string') return 'unknown'
  const v = value.toLowerCase()
  if (v.includes('pelton')) return 'pelton'
  if (v.includes('turgo')) return 'turgo'
  if (v.includes('cross')) return 'crossflow'
  if (v.includes('francis')) return 'francis'
  return 'unknown'
}

export default async function EnergyPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // 1) Auth
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2) Project — only confirmed-safe columns (Day 4 lesson).
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name, river, district, capacity_kw, standard, status')
    .eq('id', id)
    .single()
  if (projectError || !project) notFound()

  // 3) Upstream module rows
  const { data: rows } = await supabase
    .from('project_modules')
    .select('module, inputs, outputs')
    .eq('project_id', id)
    .in('module', ['hydrology', 'penstock', 'powerhouse', 'energy'])

  const find = (name: string) => rows?.find((r) => r.module === name) ?? null

  const hyOut = (find('hydrology')?.outputs ?? null) as Record<string, unknown> | null
  const peOut = (find('penstock')?.outputs ?? null) as Record<string, unknown> | null
  const phOut = (find('powerhouse')?.outputs ?? null) as Record<string, unknown> | null
  const energySaved = (find('energy')?.inputs ?? null) as Partial<EnergyInputs> | null

  // 4) Resolve upstream values.
  // Q_design — prefer powerhouse (which is the rated value used for sizing the
  // generator), then hydrology inputs, then defaults.
  const qDesign =
    nested(phOut, 'hydraulics', 'qDesignM3s') ??
    num(phOut, 'qDesignM3s') ??
    num(find('hydrology')?.inputs as Record<string, unknown> | null, 'qDesign', 'qDesignM3s') ??
    ENERGY_DEFAULTS.qDesignM3s

  // Net head — prefer powerhouse (final h_net after all loss chains), then
  // penstock (designHeadM), then hydrology head.netHead.
  const hNet =
    nested(phOut, 'hydraulics', 'hNetM') ??
    nested(peOut, 'thickness', 'designHeadM') ??
    nested(hyOut, 'head', 'netHead') ??
    ENERGY_DEFAULTS.hNetM

  // Overall efficiency — strict η_t · η_drive · η_gen from powerhouse.
  const etaOverall =
    nested(phOut, 'generator', 'efficiencyOverall') ??
    ENERGY_DEFAULTS.etaOverall

  // Installed power — electrical kW after generator (NOT shaft, NOT hydraulic).
  // If powerhouse hasn't run, recompute from Q·H·η as a stand-in.
  const pInstalledKw =
    nested(phOut, 'generator', 'electricalPowerKw') ??
    powerKw(qDesign, hNet, etaOverall)

  // Turbine type — used to pick technicalMinFactor default.
  const turbineType = coerceTurbineType((phOut as Record<string, unknown> | null)?.selected)

  // Monthly flow series — from hydrology. Fall back to ENERGY_DEFAULTS.
  const monthlyFlows =
    numArray(hyOut, 'monthlyFlows', 'qSeries', 'monthlyFlowM3s') ??
    ENERGY_DEFAULTS.monthlyFlows

  // FDC — for firm-energy reference.
  const fdcPoints = buildFdcFromHydrology(hyOut)

  // 5) Compose initial inputs. Saved energy-module values take precedence so
  // the engineer can override and persist. Upstream values come next, then
  // ENERGY_DEFAULTS as the final safety net.
  const initial: EnergyInputs = {
    qDesignM3s: energySaved?.qDesignM3s ?? qDesign,
    hNetM: energySaved?.hNetM ?? hNet,
    etaOverall: energySaved?.etaOverall ?? etaOverall,
    pInstalledKw: energySaved?.pInstalledKw ?? pInstalledKw,
    monthlyFlows:
      energySaved?.monthlyFlows && energySaved.monthlyFlows.length === 12
        ? energySaved.monthlyFlows
        : monthlyFlows,
    fdcPoints: energySaved?.fdcPoints ?? fdcPoints,
    riparianMethod: energySaved?.riparianMethod ?? ENERGY_DEFAULTS.riparianMethod,
    riparianFixedM3s: energySaved?.riparianFixedM3s ?? ENERGY_DEFAULTS.riparianFixedM3s,
    plantAvailability: energySaved?.plantAvailability ?? ENERGY_DEFAULTS.plantAvailability,
    technicalMinFactor:
      energySaved?.technicalMinFactor ?? defaultTechnicalMin(turbineType),
    turbineType: energySaved?.turbineType ?? turbineType,
  }

  return (
    <EnergyForm
      projectId={id}
      projectName={project.name as string}
      projectRiver={(project.river as string | null) ?? null}
      hasUpstreamHydrology={hyOut !== null}
      hasUpstreamPowerhouse={phOut !== null}
      initial={initial}
    />
  )
}