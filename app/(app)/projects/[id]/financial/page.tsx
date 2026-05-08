// HydroStack — Module 08: Financial Model (server component)
// app/(app)/projects/[id]/financial/page.tsx
//
// Reads upstream JSONB from energy + powerhouse + penstock modules and
// composes the initial inputs object for the client form. Locks the form
// with a "complete prerequisites first" notice if either energy or
// powerhouse module hasn't been saved yet.
//
// CRITICAL — confirmed JSONB key names (Day 9 + Day 7 verified):
//   energy.outputs:
//     annualEnergyMwh, firmEnergyMwh, plantFactorPercent
//     rows[12].{english, nepali, energyMwh, qPlantM3s, powerKw}
//   powerhouse.outputs:
//     selected (turbine type string)
//     generator.electricalPowerKw, generator.standardKvaSelected
//     hydraulics.qDesignM3s, hydraulics.hNetM
//     layout.totalFootprintAreaM2  (or footprint.totalAreaM2 — dual-read)
//   penstock.outputs:
//     totalWeightKgPerM, externalDiameterMm, hNetM, installedCapacityKw
//   penstock.inputs:
//     lengthM, grossHead, slopeAngleDeg, qDesign

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import FinancialForm from './FinancialForm'
import {
  FINANCIAL_DEFAULTS,
  type FinancialInputs,
  type TurbineType,
} from '@/lib/calc/financial'

// ─── Helpers (defensive readers — past chats taught us silent fallbacks
//     are the #1 module-handoff bug; we log when keys are missing) ─────────

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x)

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

function nestedNum(
  obj: Record<string, unknown> | null | undefined,
  ...path: string[]
): number | undefined {
  let cur: unknown = obj
  for (const p of path) {
    if (!isObj(cur)) return undefined
    cur = cur[p]
  }
  return typeof cur === 'number' && Number.isFinite(cur) ? cur : undefined
}

function str(
  obj: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string | undefined {
  if (!obj) return undefined
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string') return v
  }
  return undefined
}

const VALID_TURBINES = new Set<TurbineType>(['pelton', 'turgo', 'crossflow', 'francis'])
function coerceTurbine(s: string | undefined): TurbineType | undefined {
  if (!s) return undefined
  const lc = s.toLowerCase().trim()
  return VALID_TURBINES.has(lc as TurbineType) ? (lc as TurbineType) : undefined
}

// ─── Page ────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function FinancialPage({ params }: PageProps) {
  // Next.js 16: params is a Promise
  const { id } = await params

  const supabase = await createClient()

  // 1) Project (only confirmed-safe columns; selecting unknown columns
  //    triggers a Postgres error that surfaces as 404 — the Day 1 bug)
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name, river, district, capacity_kw, standard, status')
    .eq('id', id)
    .single()
  if (projectError || !project) notFound()

  // 2) All module rows for this project (single roundtrip)
  const { data: modules } = await supabase
    .from('project_modules')
    .select('module, inputs, outputs')
    .eq('project_id', id)

  const findOut = (name: string) =>
    (modules?.find((m) => m.module === name)?.outputs ?? null) as Record<string, unknown> | null
  const findIn = (name: string) =>
    (modules?.find((m) => m.module === name)?.inputs ?? null) as Record<string, unknown> | null

  const energyOut = findOut('energy')
  const powerhouseOut = findOut('powerhouse')
  const penstockOut = findOut('penstock')
  const penstockIn = findIn('penstock')
  const financialSaved = findIn('financial') as Partial<FinancialInputs> | null

  // 3) Lock check: energy + powerhouse are required upstream
  const hasEnergy = energyOut !== null
  const hasPowerhouse = powerhouseOut !== null

  if (!hasEnergy || !hasPowerhouse) {
    return (
      <LockedNotice
        projectId={id}
        projectName={project.name as string}
        hasEnergy={hasEnergy}
        hasPowerhouse={hasPowerhouse}
      />
    )
  }

  // 4) Read upstream JSONB. Log keys to terminal so missing-key bugs are
  //    immediately visible (per Day 7 lesson).
  if (process.env.NODE_ENV !== 'production') {
    console.log('[financial] energy keys:', energyOut ? Object.keys(energyOut) : 'NONE')
    console.log('[financial] powerhouse keys:', powerhouseOut ? Object.keys(powerhouseOut) : 'NONE')
    console.log('[financial] penstock keys:', penstockOut ? Object.keys(penstockOut) : 'NONE')
    console.log('[financial] penstock inputs keys:', penstockIn ? Object.keys(penstockIn) : 'NONE')
  }

  // ── From energy.outputs ──
  const annualEnergyMwh =
    num(energyOut, 'annualEnergyMwh') ?? FINANCIAL_DEFAULTS.annualEnergyMwh
  const firmEnergyMwh =
    num(energyOut, 'firmEnergyMwh') ?? FINANCIAL_DEFAULTS.firmEnergyMwh

  // monthly energy + month names (English) from rows[12]
  const rows = Array.isArray(energyOut?.rows) ? (energyOut!.rows as unknown[]) : []
  const monthlyEnergyMwh: number[] = []
  const monthsEnglish: string[] = []
  if (rows.length === 12) {
    for (const r of rows) {
      if (isObj(r)) {
        monthlyEnergyMwh.push((typeof r.energyMwh === 'number') ? r.energyMwh : 0)
        monthsEnglish.push(typeof r.english === 'string' ? r.english : '')
      }
    }
  }
  const finalMonthlyEnergy =
    monthlyEnergyMwh.length === 12 && monthsEnglish.length === 12
      ? monthlyEnergyMwh
      : FINANCIAL_DEFAULTS.monthlyEnergyMwh
  const finalMonthsEnglish =
    monthsEnglish.length === 12 && monthsEnglish.every((s) => s)
      ? monthsEnglish
      : FINANCIAL_DEFAULTS.monthsEnglish

  // ── From powerhouse.outputs ──
  const pInstalledKw =
    nestedNum(powerhouseOut, 'generator', 'electricalPowerKw') ??
    num(powerhouseOut, 'installedCapacityKw', 'pInstalledKw') ??
    (project.capacity_kw as number | null) ??
    FINANCIAL_DEFAULTS.pInstalledKw

  // Bug fix: use apparentPowerKva (actual computed kVA = P_e / cos φ) as
  // primary, not standardKvaSelected which snaps to the nearest commercial
  // frame size and caps at the largest entry in the library (2000 kVA).
  // For a 5 MW plant, apparentPowerKva = 5967 kVA; standardKvaSelected = 2000.
  const generatorKva =
    nestedNum(powerhouseOut, 'generator', 'apparentPowerKva') ??
    nestedNum(powerhouseOut, 'generator', 'standardKvaSelected') ??
    FINANCIAL_DEFAULTS.generatorKva

  const turbine =
    coerceTurbine(str(powerhouseOut, 'selected', 'turbineType', 'turbine')) ??
    FINANCIAL_DEFAULTS.turbine

  const hNet =
    nestedNum(powerhouseOut, 'hydraulics', 'hNetM') ??
    num(powerhouseOut, 'hNetM') ??
    num(penstockOut, 'hNetM') ??
    FINANCIAL_DEFAULTS.hNetM

  const powerhouseFootprintM2 =
    nestedNum(powerhouseOut, 'layout', 'totalFootprintAreaM2') ??
    nestedNum(powerhouseOut, 'footprint', 'totalAreaM2') ??
    nestedNum(powerhouseOut, 'layout', 'totalAreaM2') ??
    FINANCIAL_DEFAULTS.powerhouseFootprintM2

  // ── From penstock ──
  const penstockTotalWeightKgPerM =
    num(penstockOut, 'pipeWeightKgPerM') ??
    num(penstockOut, 'steelWeightKgPerM') ??
    FINANCIAL_DEFAULTS.penstockTotalWeightKgPerM
  const penstockExternalDiameterMm =
    num(penstockOut, 'externalDiameterMm') ??
    FINANCIAL_DEFAULTS.penstockExternalDiameterMm

  const hGross =
    num(penstockIn, 'grossHead') ??
    nestedNum(powerhouseOut, 'hydraulics', 'hGrossM') ??
    100

  // Penstock length: prefer saved penstock input; fall back to H_gross/sin(slope)
  const slopeDeg = num(penstockIn, 'slopeAngleDeg') ?? 45
  const slopeRad = (slopeDeg * Math.PI) / 180
  const fallbackLength = Math.sin(slopeRad) > 0 ? hGross / Math.sin(slopeRad) : hGross
  const penstockLengthM =
    num(penstockIn, 'lengthM') ?? fallbackLength

  // 5) Compose initial inputs. Saved financial-module values take precedence
  //    so the engineer can override and persist. Upstream values come next,
  //    FINANCIAL_DEFAULTS as the final safety net.
  const initial: FinancialInputs = {
    ...FINANCIAL_DEFAULTS,
    ...(financialSaved ?? {}),

    // Always re-derive upstream values from latest module saves (override any
    // stale values in financialSaved). The engineer should see fresh inputs
    // when upstream changes.
    pInstalledKw,
    hNetM: hNet,
    turbine,
    generatorKva,
    annualEnergyMwh,
    firmEnergyMwh,
    monthlyEnergyMwh: finalMonthlyEnergy,
    monthsEnglish: finalMonthsEnglish,
    penstockTotalWeightKgPerM,
    penstockExternalDiameterMm,
    penstockLengthM:
      financialSaved?.penstockLengthM ?? penstockLengthM,
    hGrossM: hGross,
    powerhouseFootprintM2,
  }

  return (
    <FinancialForm
      projectId={id}
      projectName={project.name as string}
      projectRiver={(project.river as string | null) ?? null}
      initial={initial}
    />
  )
}

// ─── Locked-notice component ─────────────────────────────────────────────────

function LockedNotice({
  projectId, projectName, hasEnergy, hasPowerhouse,
}: {
  projectId: string; projectName: string
  hasEnergy: boolean; hasPowerhouse: boolean
}) {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {projectName}
        </Link>
        <header className="mb-8 pb-6 border-b-2 border-stone-300">
          <div className="font-mono text-xs text-stone-500 mb-2">
            MODULE 08 · FINANCIAL MODEL
          </div>
          <h1 className="text-4xl font-display text-stone-900 mb-2">
            {projectName}
          </h1>
        </header>
        <div className="bg-amber-50 border border-amber-300 rounded-md p-6">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-lg text-stone-900 mb-2">
                Complete prerequisites first
              </h2>
              <p className="text-sm text-stone-700 leading-relaxed mb-4">
                The financial model derives capacity, energy, turbine type
                and powerhouse footprint from upstream design modules.
                Complete the modules below before opening the financial section.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className={hasPowerhouse ? 'text-emerald-700' : 'text-amber-700'}>
                    {hasPowerhouse ? '✓' : '○'}
                  </span>
                  <Link
                    href={`/projects/${projectId}/powerhouse`}
                    className="underline decoration-dotted text-stone-900 hover:text-emerald-700"
                  >
                    Module 06 — Powerhouse &amp; Turbine
                  </Link>
                  {!hasPowerhouse && (
                    <span className="text-xs text-stone-500 ml-2">
                      (provides P_installed, turbine, generator kVA)
                    </span>
                  )}
                </li>
                <li className="flex items-center gap-2">
                  <span className={hasEnergy ? 'text-emerald-700' : 'text-amber-700'}>
                    {hasEnergy ? '✓' : '○'}
                  </span>
                  <Link
                    href={`/projects/${projectId}/energy`}
                    className="underline decoration-dotted text-stone-900 hover:text-emerald-700"
                  >
                    Module 07 — Energy Generation Table
                  </Link>
                  {!hasEnergy && (
                    <span className="text-xs text-stone-500 ml-2">
                      (provides annual + monthly energy series for revenue)
                    </span>
                  )}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}