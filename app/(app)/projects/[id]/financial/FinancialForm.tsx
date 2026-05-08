'use client'

// HydroStack — Module 08: Financial Model (client form)
// app/(app)/projects/[id]/financial/FinancialForm.tsx
//
// Client component. Real-time recalculation via useMemo (no setState in
// useEffect — Day 5 lesson). Persists inputs+outputs to project_modules.
//
// Sections:
//   §1  Upstream inputs (read-only context)
//   §2  CapEx breakdown (12-line editable, NPR | USD | %)
//   §3  OpEx + tariff (O&M %, royalty/tax gate, NEA tariff overrides)
//   §4  Financing (subsidy, debt toggle, D:E, interest, tenor, disbursement)
//   §5  Headline metrics (4 tiles + sub-row)
//   §6  Cashflow table (collapsible, 30+ rows, sign-coloured)
//   §7  One-way sensitivity (6 scenarios)
//   §8  Warnings + AEPC lender checklist

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  ArrowLeft, Loader2, CheckCircle2, AlertCircle, AlertTriangle, Info,
  ChevronDown, ChevronRight, RotateCw,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  computeFinancial,
  FINANCIAL_DEFAULTS,
  type FinancialInputs,
  type FinancialOutputs,
} from '@/lib/calc/financial'

interface Props {
  projectId: string
  projectName: string
  projectRiver: string | null
  initial: FinancialInputs
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// ─── Number formatting helpers (Indian numbering for NPR — lakh/crore) ──────

const fmt = (n: number, digits = 2): string =>
  Number.isFinite(n) ? n.toFixed(digits) : '—'

function formatNpr(
  n: number, units: 'auto' | 'lakh' | 'cr' | 'raw' = 'auto',
): string {
  if (!Number.isFinite(n)) return '—'
  if (units === 'raw') return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
  const abs = Math.abs(n)
  const useCr = units === 'cr' || (units === 'auto' && abs >= 1e7)
  if (useCr) return `${(n / 1e7).toFixed(2)} cr`
  return `${(n / 1e5).toFixed(2)} lakh`
}

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

const formatPct = (n: number, digits = 1): string =>
  Number.isFinite(n) ? `${n.toFixed(digits)} %` : '—'

const isFin = Number.isFinite

// ─── Small UI primitives (matches Day 5-9 style) ────────────────────────────

function Section({
  marker, title, subtitle, children,
}: { marker: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <header className="mb-4 flex items-baseline gap-3 border-b border-stone-300 pb-2">
        <span className="font-mono text-xs text-stone-500">§{marker}</span>
        <h2 className="font-display text-xl text-stone-900">{title}</h2>
        {subtitle && (
          <span className="font-mono text-xs text-stone-500">{subtitle}</span>
        )}
      </header>
      <div>{children}</div>
    </section>
  )
}

function NumField({
  label, unit, value, onChange, step = 0.01, min, max, hint, disabled,
}: {
  label: string
  unit: string
  value: number
  onChange: (n: number) => void
  step?: number
  min?: number
  max?: number
  hint?: string
  disabled?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between">
        <span className="text-sm text-stone-700">{label}</span>
        <span className="font-mono text-xs text-stone-500">[{unit}]</span>
      </span>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : 0}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full rounded border border-stone-300 bg-white px-3 py-2 font-mono text-sm focus:border-stone-600 focus:outline-none disabled:bg-stone-100 disabled:text-stone-500"
      />
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </label>
  )
}

function ReadOnlyField({
  label, unit, value,
}: { label: string; unit: string; value: string }) {
  return (
    <div className="block">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm text-stone-700">{label}</span>
        <span className="font-mono text-xs text-stone-500">[{unit}]</span>
      </div>
      <div className="rounded border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-sm text-stone-900">
        {value}
      </div>
    </div>
  )
}

// ─── CapEx table row helpers ────────────────────────────────────────────────

function CapExRow({
  code, label, value, override, onOverride, onReset, total, fx, alwaysOverride,
}: {
  code: string
  label: string
  value: number
  override: number | undefined
  onOverride: (v: number) => void
  onReset: () => void
  total: number
  fx: number
  alwaysOverride?: boolean
}) {
  const isOverridden = alwaysOverride || override !== undefined
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <tr className="border-b border-stone-100 hover:bg-stone-50">
      <td className="py-2 pr-3 font-mono text-xs text-stone-500">{code}</td>
      <td className="py-2 pr-3 text-stone-800">{label}</td>
      <td className="py-1 px-3">
        <div className="flex items-center justify-end gap-1">
          <input
            type="number"
            step={1000}
            min={0}
            value={isOverridden ? Math.round(value) : Math.round(value)}
            onChange={(e) => onOverride(parseFloat(e.target.value) || 0)}
            className={`w-36 rounded border px-2 py-1 text-right font-mono text-xs focus:outline-none ${
              isOverridden
                ? 'border-amber-400 bg-amber-50 focus:border-amber-600'
                : 'border-stone-200 bg-white focus:border-stone-500'
            }`}
          />
          {isOverridden && !alwaysOverride && (
            <button
              type="button"
              onClick={onReset}
              title="Reset to formula default"
              className="text-stone-400 hover:text-stone-700"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
      <td className="py-2 px-3 text-right font-mono text-stone-700 text-xs">
        {formatUsd(value / fx)}
      </td>
      <td className="py-2 pl-3 text-right font-mono text-stone-700 text-xs">
        {pct.toFixed(1)}
      </td>
    </tr>
  )
}

function ComputedRow({
  code, label, npr, total, fx,
}: {
  code: string; label: string; npr: number; total: number; fx: number
}) {
  const pct = total > 0 ? (npr / total) * 100 : 0
  return (
    <tr className="border-b border-stone-100 bg-stone-50">
      <td className="py-2 pr-3 font-mono text-xs text-stone-500">{code}</td>
      <td className="py-2 pr-3 text-stone-700 italic">{label}</td>
      <td className="py-2 px-3 text-right font-mono text-stone-800 text-xs">
        {formatUsd(npr)}
      </td>
      <td className="py-2 px-3 text-right font-mono text-stone-700 text-xs">
        {formatUsd(npr / fx)}
      </td>
      <td className="py-2 pl-3 text-right font-mono text-stone-700 text-xs">
        {pct.toFixed(1)}
      </td>
    </tr>
  )
}

function SubtotalRow({
  label, npr, total, fx,
}: { label: string; npr: number; total: number; fx: number }) {
  const pct = total > 0 ? (npr / total) * 100 : 0
  return (
    <tr className="border-y border-stone-300 bg-stone-100">
      <td colSpan={2} className="py-2 px-3 font-display text-sm text-stone-900">
        {label}
      </td>
      <td className="py-2 px-3 text-right font-mono font-semibold text-stone-900 text-sm">
        {formatNpr(npr)}
      </td>
      <td className="py-2 px-3 text-right font-mono text-stone-800 text-xs">
        {formatUsd(npr / fx)}
      </td>
      <td className="py-2 pl-3 text-right font-mono text-stone-800 text-xs">
        {pct.toFixed(1)} %
      </td>
    </tr>
  )
}

// ─── Headline metric tile ───────────────────────────────────────────────────

function MetricTile({
  label, value, unit, sublabel, tone,
}: {
  label: string
  value: string
  unit: string
  sublabel?: string
  tone: 'pos' | 'neg' | 'neutral'
}) {
  const toneClass =
    tone === 'pos'
      ? 'border-emerald-300 bg-emerald-50'
      : tone === 'neg'
      ? 'border-amber-300 bg-amber-50'
      : 'border-stone-200 bg-stone-50'
  return (
    <div className={`rounded-md border-2 ${toneClass} p-4`}>
      <div className="font-mono text-xs text-stone-500 mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="font-display text-2xl text-stone-900">{value}</span>
        <span className="font-mono text-xs text-stone-500">{unit}</span>
      </div>
      {sublabel && (
        <div className="mt-1 font-mono text-xs text-stone-600">{sublabel}</div>
      )}
    </div>
  )
}

// ─── Main form ──────────────────────────────────────────────────────────────

export default function FinancialForm({
  projectId, projectName, projectRiver, initial,
}: Props) {
  const [inputs, setInputs] = useState<FinancialInputs>(initial)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showCashflow, setShowCashflow] = useState(false)

  // Real-time recalc — useMemo, never useEffect (Day 5 lesson)
  const out: FinancialOutputs = useMemo(() => computeFinancial(inputs), [inputs])

  const setField = <K extends keyof FinancialInputs>(k: K, v: FinancialInputs[K]) =>
    setInputs((s) => ({ ...s, [k]: v }))

  const resetCapExLine = (key: keyof FinancialInputs) =>
    setInputs((s) => ({ ...s, [key]: undefined as unknown as never }))

  const setDisbursement = (idx: number, v: number) =>
    setInputs((s) => {
      const next = [...s.disbursementSchedule]
      next[idx] = isFin(v) ? Math.max(0, v) : 0
      return { ...s, disbursementSchedule: next }
    })

  // Save to Supabase
  const onSave = async () => {
    setSaveState('saving')
    setSaveError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('project_modules').upsert(
        {
          project_id: projectId,
          module: 'financial',
          inputs: inputs as unknown as Record<string, unknown>,
          outputs: out as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'project_id,module' },
      )
      if (error) throw error
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch (e) {
      setSaveState('error')
      setSaveError(e instanceof Error ? e.message : 'Unknown error')
    }
  }

  const totalCapex = out.capex.totalCapExNpr
  const fx = inputs.fxNprPerUsd
  const disbursementSum =
    inputs.disbursementSchedule.reduce((a, b) => a + b, 0) * 100

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {projectName}
        </Link>

        {/* Header */}
        <header className="mb-8 pb-6 border-b-2 border-stone-300">
          <div className="font-mono text-xs text-stone-500 mb-2">
            MODULE 08 · FINANCIAL MODEL
          </div>
          <h1 className="text-4xl font-display text-stone-900 mb-2">
            {projectName}
          </h1>
          {projectRiver && <p className="text-stone-600">{projectRiver}</p>}
          <p className="text-stone-700 mt-3 text-sm leading-relaxed max-w-3xl">
            CapEx · OpEx · IRR · NPV · LCoE · DSCR per{' '}
            <span className="font-mono">AEPC DFS 2014 §5 / §7</span> and{' '}
            <span className="font-mono">AHEC §1.5 / §1.6</span>. NEA PPA tariff
            per AEPC Table 7.1 (NPR 8.40 dry / 4.80 wet, 3 % escalation 5 yr,
            25-yr PPA term). Royalty &amp; income-tax exemptions apply per
            Electricity Act 2065 §21 and Income Tax Act 2058 for projects
            ≤ 1000 kW.
          </p>
        </header>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Main column */}
          <div className="lg:col-span-9">

            {/* ═══ §1 Upstream inputs ═══ */}
            <Section
              marker="1"
              title="Upstream inputs"
              subtitle="from powerhouse + energy + penstock modules"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ReadOnlyField label="Installed capacity" unit="kW"
                  value={fmt(inputs.pInstalledKw, 1)} />
                <ReadOnlyField label="Net head" unit="m"
                  value={fmt(inputs.hNetM, 1)} />
                <ReadOnlyField label="Turbine type" unit="—"
                  value={inputs.turbine[0].toUpperCase() + inputs.turbine.slice(1)} />
                <ReadOnlyField label="Generator" unit="kVA"
                  value={fmt(inputs.generatorKva, 0)} />
                <ReadOnlyField label="Annual energy" unit="MWh"
                  value={fmt(inputs.annualEnergyMwh, 1)} />
                <ReadOnlyField label="Dry energy (Dec-Mar)" unit="MWh"
                  value={fmt(out.dryEnergyMwh, 1)} />
                <ReadOnlyField label="Wet energy (Apr-Nov)" unit="MWh"
                  value={fmt(out.wetEnergyMwh, 1)} />
                <ReadOnlyField label="Firm energy (Q90)" unit="MWh"
                  value={fmt(inputs.firmEnergyMwh, 1)} />
              </div>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <ReadOnlyField label="Penstock weight" unit="kg/m"
                  value={fmt(inputs.penstockTotalWeightKgPerM, 1)} />
                <ReadOnlyField label="Penstock length" unit="m"
                  value={fmt(inputs.penstockLengthM, 0)} />
                <ReadOnlyField label="Powerhouse" unit="m²"
                  value={fmt(inputs.powerhouseFootprintM2, 1)} />
                <NumField label="FX rate" unit="NPR/USD"
                  value={inputs.fxNprPerUsd}
                  onChange={(v) => setField('fxNprPerUsd', v)}
                  step={0.5} min={50} max={250}
                  hint="Default 133.5 (May 2024 market)" />
              </div>
            </Section>

            {/* ═══ §2 CapEx breakdown ═══ */}
            <Section
              marker="2"
              title="CapEx breakdown"
              subtitle="AEPC DFS 2014 §5 BoQ format · 12 editable line items"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-stone-300">
                      <th className="text-left py-2 pr-3 font-display text-stone-700 w-12">#</th>
                      <th className="text-left py-2 pr-3 font-display text-stone-700">Description</th>
                      <th className="text-right py-2 px-3 font-display text-stone-700 w-44">NPR</th>
                      <th className="text-right py-2 px-3 font-display text-stone-700 w-28">USD</th>
                      <th className="text-right py-2 pl-3 font-display text-stone-700 w-16">% of total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <CapExRow code="A1" label="Headworks (weir + intake + gravel trap)"
                      value={out.capex.a1HeadworksNpr} override={inputs.a1HeadworksNpr}
                      onOverride={(v) => setField('a1HeadworksNpr', v)}
                      onReset={() => resetCapExLine('a1HeadworksNpr')}
                      total={totalCapex} fx={fx} />
                    <CapExRow code="A2" label="Settling basin"
                      value={out.capex.a2SettlingNpr} override={inputs.a2SettlingNpr}
                      onOverride={(v) => setField('a2SettlingNpr', v)}
                      onReset={() => resetCapExLine('a2SettlingNpr')}
                      total={totalCapex} fx={fx} />
                    <CapExRow code="A3" label="Headrace canal/pipe"
                      value={out.capex.a3HeadraceNpr} override={inputs.a3HeadraceNpr}
                      onOverride={(v) => setField('a3HeadraceNpr', v)}
                      onReset={() => resetCapExLine('a3HeadraceNpr')}
                      total={totalCapex} fx={fx} />
                    <CapExRow code="A4" label="Forebay"
                      value={out.capex.a4ForebayNpr} override={inputs.a4ForebayNpr}
                      onOverride={(v) => setField('a4ForebayNpr', v)}
                      onReset={() => resetCapExLine('a4ForebayNpr')}
                      total={totalCapex} fx={fx} />
                    <CapExRow code="A5"
                      label={`Penstock (${inputs.penstockLengthM.toFixed(0)} m × ${inputs.penstockTotalWeightKgPerM.toFixed(0)} kg/m × NPR ${inputs.steelRateNprPerKg}/kg)`}
                      value={out.capex.a5PenstockNpr} override={inputs.a5PenstockNpr}
                      onOverride={(v) => setField('a5PenstockNpr', v)}
                      onReset={() => resetCapExLine('a5PenstockNpr')}
                      total={totalCapex} fx={fx} />
                    <CapExRow code="A6" label="Anchor blocks + saddle supports"
                      value={out.capex.a6AnchorsNpr} override={inputs.a6AnchorsNpr}
                      onOverride={(v) => setField('a6AnchorsNpr', v)}
                      onReset={() => resetCapExLine('a6AnchorsNpr')}
                      total={totalCapex} fx={fx} />
                    <CapExRow code="A7" label="Powerhouse building (RCC)"
                      value={out.capex.a7PowerhouseNpr} override={inputs.a7PowerhouseNpr}
                      onOverride={(v) => setField('a7PowerhouseNpr', v)}
                      onReset={() => resetCapExLine('a7PowerhouseNpr')}
                      total={totalCapex} fx={fx} />
                    <CapExRow code="A8" label="Tailrace channel"
                      value={out.capex.a8TailraceNpr} override={inputs.a8TailraceNpr}
                      onOverride={(v) => setField('a8TailraceNpr', v)}
                      onReset={() => resetCapExLine('a8TailraceNpr')}
                      total={totalCapex} fx={fx} />
                    <SubtotalRow label="A. CIVIL WORKS"
                      npr={out.capex.civilSubtotalNpr} total={totalCapex} fx={fx} />
                    <CapExRow code="B1"
                      label={`Turbine + governor + inlet valve (Butchers 2022 Eq.${inputs.turbine === 'pelton' || inputs.turbine === 'turgo' ? '3' : '2'})`}
                      value={out.capex.b1TurbineNpr} override={inputs.b1TurbineNpr}
                      onOverride={(v) => setField('b1TurbineNpr', v)}
                      onReset={() => resetCapExLine('b1TurbineNpr')}
                      total={totalCapex} fx={fx} />
                    <CapExRow code="B2"
                      label={`Generator + AVR + exciter (${inputs.generatorKva.toFixed(0)} kVA × NPR ${inputs.generatorRateNprPerKva.toLocaleString()}/kVA)`}
                      value={out.capex.b2GeneratorNpr} override={inputs.b2GeneratorNpr}
                      onOverride={(v) => setField('b2GeneratorNpr', v)}
                      onReset={() => resetCapExLine('b2GeneratorNpr')}
                      total={totalCapex} fx={fx} />
                    <CapExRow code="B3" label="Switchgear + control panel + metering"
                      value={out.capex.b3SwitchgearNpr} override={inputs.b3SwitchgearNpr}
                      onOverride={(v) => setField('b3SwitchgearNpr', v)}
                      onReset={() => resetCapExLine('b3SwitchgearNpr')}
                      total={totalCapex} fx={fx} />
                    <SubtotalRow label="B. ELECTROMECHANICAL"
                      npr={out.capex.emSubtotalNpr} total={totalCapex} fx={fx} />
                    <CapExRow code="C1"
                      label={`Transmission line (${inputs.transmissionLengthKm} km × ${inputs.transmissionVoltageKv} kV)`}
                      value={out.capex.c1TransmissionNpr} override={inputs.c1TransmissionNpr}
                      onOverride={(v) => setField('c1TransmissionNpr', v)}
                      onReset={() => resetCapExLine('c1TransmissionNpr')}
                      total={totalCapex} fx={fx} />
                    <CapExRow code="C2"
                      label={`Access road (${inputs.accessRoadLengthKm} km, ${inputs.accessRoadTerrain === 'jeepTrack' ? 'jeep track' : 'blasting'})`}
                      value={out.capex.c2AccessRoadNpr} override={inputs.c2AccessRoadNpr}
                      onOverride={(v) => setField('c2AccessRoadNpr', v)}
                      onReset={() => resetCapExLine('c2AccessRoadNpr')}
                      total={totalCapex} fx={fx} />
                    <SubtotalRow label="C. TRANSMISSION + ACCESS"
                      npr={out.capex.cSubtotalNpr} total={totalCapex} fx={fx} />
                    <ComputedRow code="D1"
                      label={`Engineering + supervision (${inputs.d1EngineeringSupervisionPct} % of A+B+C)`}
                      npr={out.capex.d1EngineeringNpr} total={totalCapex} fx={fx} />
                    <ComputedRow code="D2"
                      label={`Contingency (${inputs.d2ContingencyPct} % of A+B+C+D1)`}
                      npr={out.capex.d2ContingencyNpr} total={totalCapex} fx={fx} />
                    <CapExRow code="D3" label="Land acquisition + compensation"
                      value={out.capex.d3LandAcquisitionNpr} override={inputs.d3LandAcquisitionNpr}
                      onOverride={(v) => setField('d3LandAcquisitionNpr', v)}
                      onReset={() => setField('d3LandAcquisitionNpr', FINANCIAL_DEFAULTS.d3LandAcquisitionNpr)}
                      total={totalCapex} fx={fx} alwaysOverride />
                    <CapExRow code="D4" label="Environmental mitigation"
                      value={out.capex.d4EnvironmentalNpr} override={inputs.d4EnvironmentalNpr}
                      onOverride={(v) => setField('d4EnvironmentalNpr', v)}
                      onReset={() => setField('d4EnvironmentalNpr', FINANCIAL_DEFAULTS.d4EnvironmentalNpr)}
                      total={totalCapex} fx={fx} alwaysOverride />
                    <ComputedRow code="D5"
                      label={`IDC capitalized (${inputs.bankInterestRatePct} % × ½ × ${inputs.constructionYears} yr × debt)`}
                      npr={out.capex.d5IdcNpr} total={totalCapex} fx={fx} />
                    <SubtotalRow label="D. INDIRECT"
                      npr={out.capex.dSubtotalNpr} total={totalCapex} fx={fx} />
                    <tr className="border-t-2 border-stone-700 bg-stone-100">
                      <td colSpan={2} className="py-3 px-3 font-display text-base text-stone-900">
                        TOTAL CAPEX
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-stone-900">
                        {formatNpr(out.capex.totalCapExNpr, 'cr')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-stone-900">
                        {formatUsd(out.capex.totalCapExUsd)}
                      </td>
                      <td className="py-3 pl-3 text-right font-mono text-stone-900">100 %</td>
                    </tr>
                    <tr className="bg-stone-50">
                      <td colSpan={2} className="py-2 px-3 text-xs text-stone-600">
                        Specific cost · NPR {out.capex.specificCostNprPerKw.toLocaleString('en-IN', { maximumFractionDigits: 0 })}/kW · USD {out.capex.specificCostUsdPerKw.toFixed(0)}/kW
                      </td>
                      <td colSpan={3} className="py-2 px-3 text-right text-xs text-stone-600">
                        Poudel 2022 Nepal mean: ~USD 5,074/kW
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* CapEx auxiliary fields */}
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <NumField label="Steel rate (A5)" unit="NPR/kg"
                  value={inputs.steelRateNprPerKg}
                  onChange={(v) => setField('steelRateNprPerKg', v)}
                  step={5} min={50}
                  hint="Rolled MS plate (Butchers 2022)" />
                <NumField label="Powerhouse rate (A7)" unit="NPR/m²"
                  value={inputs.powerhouseRateNprPerM2}
                  onChange={(v) => setField('powerhouseRateNprPerM2', v)}
                  step={1000} min={5000}
                  hint="RCC, hill construction" />
                <NumField label="Generator rate (B2)" unit="NPR/kVA"
                  value={inputs.generatorRateNprPerKva}
                  onChange={(v) => setField('generatorRateNprPerKva', v)}
                  step={500} min={5000}
                  hint="Synchronous, Nepal market" />
                <NumField label="Transmission length" unit="km"
                  value={inputs.transmissionLengthKm}
                  onChange={(v) => setField('transmissionLengthKm', v)}
                  step={0.5} min={0} />
                <label className="block">
                  <span className="mb-1 flex items-baseline justify-between">
                    <span className="text-sm text-stone-700">Transmission voltage</span>
                    <span className="font-mono text-xs text-stone-500">[kV]</span>
                  </span>
                  <select
                    value={inputs.transmissionVoltageKv}
                    onChange={(e) => setField('transmissionVoltageKv', parseInt(e.target.value, 10) as 11 | 33)}
                    className="w-full rounded border border-stone-300 bg-white px-3 py-2 font-mono text-sm focus:border-stone-600 focus:outline-none"
                  >
                    <option value={11}>11 kV (NPR 2.5 M/km)</option>
                    <option value={33}>33 kV (NPR 4.5 M/km)</option>
                  </select>
                </label>
                <NumField label="Access road length" unit="km"
                  value={inputs.accessRoadLengthKm}
                  onChange={(v) => setField('accessRoadLengthKm', v)}
                  step={0.5} min={0} />
                <label className="block">
                  <span className="mb-1 flex items-baseline justify-between">
                    <span className="text-sm text-stone-700">Access road terrain</span>
                    <span className="font-mono text-xs text-stone-500">[—]</span>
                  </span>
                  <select
                    value={inputs.accessRoadTerrain}
                    onChange={(e) => setField('accessRoadTerrain', e.target.value as 'jeepTrack' | 'blasting')}
                    className="w-full rounded border border-stone-300 bg-white px-3 py-2 font-mono text-sm focus:border-stone-600 focus:outline-none"
                  >
                    <option value="jeepTrack">Jeep track (NPR 3.5 M/km)</option>
                    <option value="blasting">Blasting (NPR 6.0 M/km)</option>
                  </select>
                </label>
                <NumField label="Engineering + supervision" unit="%"
                  value={inputs.d1EngineeringSupervisionPct}
                  onChange={(v) => setField('d1EngineeringSupervisionPct', v)}
                  step={0.5} min={0} max={20}
                  hint="AEPC §5 — typical 6 %" />
                <NumField label="Contingency" unit="%"
                  value={inputs.d2ContingencyPct}
                  onChange={(v) => setField('d2ContingencyPct', v)}
                  step={0.5} min={0} max={25}
                  hint="AEPC §5.11 weighted ≈ 9 %" />
              </div>
            </Section>

            {/* ═══ §3 OpEx + tariff ═══ */}
            <Section
              marker="3"
              title="OpEx and tariff"
              subtitle="AEPC DFS 2014 §5.13 / §1.6.1 / Table 7.1"
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <NumField label="O&M (yr-1, % of CapEx)" unit="%"
                  value={inputs.oAndMPctOfCapEx}
                  onChange={(v) => setField('oAndMPctOfCapEx', v)}
                  step={0.1} min={0.5} max={5}
                  hint={`AEPC §5.13: 1.5–3.0 % typical`} />
                <NumField label="Insurance" unit="%"
                  value={inputs.insurancePctOfCapEx}
                  onChange={(v) => setField('insurancePctOfCapEx', v)}
                  step={0.1} min={0} max={2}
                  hint="AEPC §7.3: 0.5 % standard" />
                <NumField label="O&M escalation" unit="%/yr"
                  value={inputs.oAndMEscalationPct}
                  onChange={(v) => setField('oAndMEscalationPct', v)}
                  step={0.5} min={0} max={15}
                  hint="Nepal construction inflation ~6 %" />
                <NumField label="Land lease" unit="NPR/yr"
                  value={inputs.landLeaseNprPerYear}
                  onChange={(v) => setField('landLeaseNprPerYear', v)}
                  step={5000} min={0} />
                <NumField label="NEA wheeling" unit="NPR/yr"
                  value={inputs.wheelingNprPerYear}
                  onChange={(v) => setField('wheelingNprPerYear', v)}
                  step={5000} min={0} />
                <NumField label="Bank interest rate" unit="% p.a."
                  value={inputs.bankInterestRatePct}
                  onChange={(v) => setField('bankInterestRatePct', v)}
                  step={0.5} min={4} max={20}
                  hint="Nepal development bank typical" />
              </div>

              <div className="mt-6 border-t border-stone-200 pt-6">
                <h3 className="font-display text-base text-stone-900 mb-3">
                  NEA PPA tariff (AEPC DFS 2014 Table 7.1)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <NumField label="Dry tariff base" unit="NPR/kWh"
                    value={inputs.dryTariffNprPerKwh}
                    onChange={(v) => setField('dryTariffNprPerKwh', v)}
                    step={0.05} min={0}
                    hint="Poush–Chaitra (Dec–Mar)" />
                  <NumField label="Wet tariff base" unit="NPR/kWh"
                    value={inputs.wetTariffNprPerKwh}
                    onChange={(v) => setField('wetTariffNprPerKwh', v)}
                    step={0.05} min={0}
                    hint="Baisakh–Mangsir (Apr–Nov)" />
                  <NumField label="Tariff escalation" unit="%/yr"
                    value={inputs.tariffEscalationPct}
                    onChange={(v) => setField('tariffEscalationPct', v)}
                    step={0.5} min={0} max={10}
                    hint="3 % flat for 5 yrs (AEPC)" />
                  <NumField label="Escalation years" unit="yr"
                    value={inputs.tariffEscalationYears}
                    onChange={(v) => setField('tariffEscalationYears', v)}
                    step={1} min={0} max={25} />
                  <NumField label="PPA term" unit="yr"
                    value={inputs.ppaTermYears}
                    onChange={(v) => setField('ppaTermYears', v)}
                    step={1} min={5} max={30}
                    hint="AEPC §1.6.1: 25 yr" />
                  <NumField label="Post-PPA tariff" unit="× plateau"
                    value={inputs.postPpaTariffFraction}
                    onChange={(v) => setField('postPpaTariffFraction', v)}
                    step={0.05} min={0} max={1.5}
                    hint="Captive sale assumption" />
                </div>
              </div>

              {/* Royalty / tax gate notice */}
              <div className={`mt-6 rounded-md border p-4 text-sm ${
                out.isBelowRoyaltyThreshold
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-300 text-stone-900'
              }`}>
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="font-display">
                      Royalty &amp; tax · {inputs.pInstalledKw.toFixed(0)} kW
                    </strong>
                    <span className="block mt-1 text-xs leading-relaxed">
                      {out.isBelowRoyaltyThreshold ? (
                        <>
                          Project ≤ 1000 kW · royalty exempt permanently
                          (Electricity Act 2065 §21) · income tax exempt permanently
                          (Income Tax Act 2058). Both lines are zero across the cashflow
                          horizon.
                        </>
                      ) : (
                        <>
                          Project &gt; 1000 kW · royalty applies (capacity:
                          NPR {inputs.royaltyOver1MW.capacityFirst15NprPerKw}/kW yr 1–15,
                          NPR {inputs.royaltyOver1MW.capacityAfter15NprPerKw}/kW yr 16+ · energy:{' '}
                          {inputs.royaltyOver1MW.energyFirst15Pct} % yr 1–15,{' '}
                          {inputs.royaltyOver1MW.energyAfter15Pct} % yr 16+).
                          Income tax: 0 % first 10 yrs (RE incentive), then 25 % on net taxable income.
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Yr-1 revenue diagnostics */}
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <ReadOnlyField label="Annual revenue (yr-1, full energy)" unit="NPR lakh"
                  value={fmt(out.annualRevenueYr1Npr / 1e5, 2)} />
                <ReadOnlyField label="Blended tariff" unit="NPR/kWh"
                  value={fmt(out.blendedTariffNprPerKwh, 2)} />
                <ReadOnlyField label="O&M yr-1" unit="NPR lakh"
                  value={fmt((out.capex.totalCapExNpr * inputs.oAndMPctOfCapEx / 100) / 1e5, 2)} />
                <ReadOnlyField label="Insurance yr-1" unit="NPR lakh"
                  value={fmt((out.capex.totalCapExNpr * inputs.insurancePctOfCapEx / 100) / 1e5, 2)} />
              </div>
            </Section>

            {/* ═══ §4 Financing ═══ */}
            <Section
              marker="4"
              title="Financing structure"
              subtitle="AEPC RE Subsidy Policy 2069 · AHEC §1.6 §4.4"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <NumField label="Subsidy" unit="% of CapEx"
                  value={inputs.subsidyPctOfCapEx}
                  onChange={(v) => setField('subsidyPctOfCapEx', v)}
                  step={1} min={0} max={80}
                  hint="AEPC RE 2069: 40 % default, 60 % cap" />
                <NumField label="Construction years" unit="yr"
                  value={inputs.constructionYears}
                  onChange={(v) => setField('constructionYears', v)}
                  step={1} min={1} max={3} />
                <NumField label="Project life" unit="yr"
                  value={inputs.projectLifeYears}
                  onChange={(v) => setField('projectLifeYears', v)}
                  step={1} min={20} max={35}
                  hint="Default 30 (AEPC accepts 25)" />
                <NumField label="Loan tenor (post-COD)" unit="yr"
                  value={inputs.loanTenorYears}
                  onChange={(v) => setField('loanTenorYears', v)}
                  step={1} min={5} max={20} />
              </div>

              <div className="mb-6">
                <label className="inline-flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    checked={inputs.debtEnabled}
                    onChange={(e) => setField('debtEnabled', e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-display text-stone-900">
                    Debt financing enabled
                  </span>
                </label>
                {inputs.debtEnabled && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <NumField label="Debt fraction" unit="× (CapEx − subsidy)"
                      value={inputs.debtFraction}
                      onChange={(v) => setField('debtFraction', v)}
                      step={0.05} min={0} max={0.9}
                      hint="AHEC §4.4: 0.70 standard" />
                    <ReadOnlyField label="Debt" unit="NPR cr"
                      value={fmt(out.capex.debtNpr / 1e7, 2)} />
                    <ReadOnlyField label="Equity" unit="NPR cr"
                      value={fmt(out.capex.equityNpr / 1e7, 2)} />
                  </div>
                )}
              </div>

              <div className="mb-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                <ReadOnlyField label="Subsidy" unit="NPR cr"
                  value={fmt(out.capex.subsidyNpr / 1e7, 2)} />
                <ReadOnlyField label="Net CapEx (after subsidy)" unit="NPR cr"
                  value={fmt(out.capex.netCapExNpr / 1e7, 2)} />
                <ReadOnlyField label="Subsidy split"
                  unit="—"
                  value={`${(inputs.subsidyAtCodFraction * 100).toFixed(0)}% COD / ${(inputs.subsidyAtPovFraction * 100).toFixed(0)}% POV`} />
              </div>

              {/* Disbursement schedule */}
              <div className="border-t border-stone-200 pt-4 mt-4">
                <h3 className="font-display text-base text-stone-900 mb-3">
                  CapEx disbursement schedule
                </h3>
                <p className="text-xs text-stone-600 mb-3">
                  Default {inputs.constructionYears}-year construction with{' '}
                  {inputs.disbursementSchedule.length}-period split (final period
                  may overlap with COD year for commissioning costs).
                </p>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {inputs.disbursementSchedule.map((d, i) => (
                    <NumField key={i}
                      label={`Year ${i}`}
                      unit="fraction"
                      value={d}
                      onChange={(v) => setDisbursement(i, v)}
                      step={0.05} min={0} max={1} />
                  ))}
                </div>
                <div className={`mt-2 font-mono text-xs ${
                  Math.abs(disbursementSum - 100) < 0.5
                    ? 'text-stone-600' : 'text-amber-700'
                }`}>
                  Sum: {disbursementSum.toFixed(1)} %
                  {Math.abs(disbursementSum - 100) >= 0.5 && ' ⚠ should equal 100 %'}
                </div>
              </div>
            </Section>

            {/* ═══ §5 Headline metrics ═══ */}
            <Section
              marker="5"
              title="Headline metrics"
              subtitle="AEPC §7.4 financial parameters · AHEC §1.6"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <MetricTile
                  label="IRR PROJECT (FIRR)"
                  value={isFin(out.irrProjectPct) ? out.irrProjectPct.toFixed(1) : 'N/A'}
                  unit="%"
                  sublabel={isFin(out.irrProjectPct)
                    ? (out.irrProjectPct >= 12 ? '✓ ≥ 12 % hurdle' : '✗ below 12 % hurdle')
                    : 'no real IRR'}
                  tone={isFin(out.irrProjectPct) && out.irrProjectPct >= 12 ? 'pos'
                    : isFin(out.irrProjectPct) ? 'neg' : 'neutral'}
                />
                <MetricTile
                  label="NPV @ 12 %"
                  value={isFin(out.npvAt12Cr) ? out.npvAt12Cr.toFixed(2) : '—'}
                  unit="NPR cr"
                  sublabel={out.npvAt12Cr > 0 ? 'positive' : 'negative'}
                  tone={out.npvAt12Cr > 0 ? 'pos' : 'neg'}
                />
                <MetricTile
                  label="PAYBACK (simple)"
                  value={isFin(out.paybackSimpleYears) ? out.paybackSimpleYears.toFixed(1) : 'N/A'}
                  unit="yr"
                  sublabel={isFin(out.paybackDiscountedYears)
                    ? `${out.paybackDiscountedYears.toFixed(1)} yr discounted`
                    : 'no discounted payback'}
                  tone={isFin(out.paybackSimpleYears) && out.paybackSimpleYears < 15 ? 'pos' : 'neg'}
                />
                <MetricTile
                  label="LCoE @ 6 %"
                  value={isFin(out.lcoeNprPerKwh) ? out.lcoeNprPerKwh.toFixed(2) : '—'}
                  unit="NPR/kWh"
                  sublabel={`vs NEA wet ${inputs.wetTariffNprPerKwh.toFixed(2)}`}
                  tone={out.lcoeNprPerKwh < inputs.wetTariffNprPerKwh ? 'pos' : 'neg'}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ReadOnlyField label="IRR Equity (EIRR)" unit="%"
                  value={isFin(out.irrEquityPct) ? formatPct(out.irrEquityPct) : 'N/A'} />
                <ReadOnlyField label="NPV @ 6 %" unit="NPR cr"
                  value={fmt(out.npvAt6Cr, 2)} />
                <ReadOnlyField label="BCR @ 6 %" unit="ratio"
                  value={isFin(out.bcrAt6) ? out.bcrAt6.toFixed(2) : '—'} />
                <ReadOnlyField label="Tariff break-even" unit="NPR/kWh"
                  value={isFin(out.tariffBreakevenNprPerKwh)
                    ? out.tariffBreakevenNprPerKwh.toFixed(2) : 'N/A'} />
                {inputs.debtEnabled && (
                  <>
                    <ReadOnlyField label="DSCR min" unit="×"
                      value={isFin(out.dscrMin) ? out.dscrMin.toFixed(2) : '—'} />
                    <ReadOnlyField label="DSCR avg" unit="×"
                      value={isFin(out.dscrAvg) ? out.dscrAvg.toFixed(2) : '—'} />
                  </>
                )}
              </div>
            </Section>

            {/* ═══ §6 Cashflow table (collapsible) ═══ */}
            <Section
              marker="6"
              title="Cashflow table"
              subtitle={`${out.cashflows.length} years · NPR lakh`}
            >
              <button
                type="button"
                onClick={() => setShowCashflow(!showCashflow)}
                className="mb-3 inline-flex items-center gap-2 text-sm text-stone-700 hover:text-stone-900"
              >
                {showCashflow
                  ? <ChevronDown className="w-4 h-4" />
                  : <ChevronRight className="w-4 h-4" />}
                {showCashflow ? 'Collapse' : 'Expand'} year-by-year cashflow
              </button>

              {showCashflow && (
                <div className="overflow-x-auto rounded border border-stone-200">
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-stone-100">
                      <tr className="border-b border-stone-300">
                        <th className="px-2 py-2 text-right font-display text-stone-700">Yr</th>
                        <th className="px-2 py-2 text-right font-display text-stone-700">OpYr</th>
                        <th className="px-2 py-2 text-right font-display text-stone-700">CapEx</th>
                        <th className="px-2 py-2 text-right font-display text-stone-700">Subsidy</th>
                        <th className="px-2 py-2 text-right font-display text-stone-700">Revenue</th>
                        <th className="px-2 py-2 text-right font-display text-stone-700">OpEx</th>
                        <th className="px-2 py-2 text-right font-display text-stone-700">Roy.</th>
                        <th className="px-2 py-2 text-right font-display text-stone-700">Tax</th>
                        <th className="px-2 py-2 text-right font-display text-stone-700">Debt Svc</th>
                        <th className="px-2 py-2 text-right font-display text-stone-700">NCF Bef.</th>
                        <th className="px-2 py-2 text-right font-display text-stone-700">NCF Aft.</th>
                        <th className="px-2 py-2 text-right font-display text-stone-700">Cum Bef.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {out.cashflows.map((c) => {
                        const cell = (n: number) => (n / 1e5).toFixed(1)
                        const sign = (n: number) =>
                          n > 0 ? 'text-emerald-700' : n < 0 ? 'text-amber-700' : 'text-stone-500'
                        return (
                          <tr key={c.year}
                              className={`border-b border-stone-100 ${
                                c.operatingYear === 0 ? 'bg-stone-50' : ''
                              }`}>
                            <td className="px-2 py-1 text-right font-mono text-stone-500">{c.year}</td>
                            <td className="px-2 py-1 text-right font-mono text-stone-700">
                              {c.operatingYear || '—'}
                            </td>
                            <td className={`px-2 py-1 text-right font-mono ${sign(-c.capexOutflow)}`}>
                              {c.capexOutflow > 0 ? `−${cell(c.capexOutflow)}` : '—'}
                            </td>
                            <td className={`px-2 py-1 text-right font-mono ${sign(c.subsidyReceipt)}`}>
                              {c.subsidyReceipt > 0 ? cell(c.subsidyReceipt) : '—'}
                            </td>
                            <td className="px-2 py-1 text-right font-mono text-stone-800">
                              {c.revenue > 0 ? cell(c.revenue) : '—'}
                            </td>
                            <td className="px-2 py-1 text-right font-mono text-stone-800">
                              {c.opex > 0 ? cell(c.opex) : '—'}
                            </td>
                            <td className="px-2 py-1 text-right font-mono text-stone-800">
                              {c.royalty > 0 ? cell(c.royalty) : '—'}
                            </td>
                            <td className="px-2 py-1 text-right font-mono text-stone-800">
                              {c.taxPayable > 0 ? cell(c.taxPayable) : '—'}
                            </td>
                            <td className="px-2 py-1 text-right font-mono text-stone-800">
                              {c.debtService > 0 ? cell(c.debtService) : '—'}
                            </td>
                            <td className={`px-2 py-1 text-right font-mono font-semibold ${sign(c.ncfBeforeFinancing)}`}>
                              {cell(c.ncfBeforeFinancing)}
                            </td>
                            <td className={`px-2 py-1 text-right font-mono font-semibold ${sign(c.ncfAfterFinancing)}`}>
                              {cell(c.ncfAfterFinancing)}
                            </td>
                            <td className={`px-2 py-1 text-right font-mono ${sign(c.cumulativeNcfBefore)}`}>
                              {cell(c.cumulativeNcfBefore)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* ═══ §7 Sensitivity ═══ */}
            <Section
              marker="7"
              title="One-way sensitivity"
              subtitle="±20 % tariff/CapEx · −10 % energy"
            >
              <div className="overflow-x-auto rounded border border-stone-200">
                <table className="w-full text-sm border-collapse">
                  <thead className="bg-stone-100">
                    <tr className="border-b border-stone-300">
                      <th className="text-left py-2 px-3 font-display text-stone-700">Scenario</th>
                      <th className="text-right py-2 px-3 font-display text-stone-700">IRR project</th>
                      <th className="text-right py-2 px-3 font-display text-stone-700">NPV @ 6 %</th>
                      <th className="text-right py-2 px-3 font-display text-stone-700">Payback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {out.sensitivity.map((s, idx) => (
                      <tr
                        key={idx}
                        className={`border-b border-stone-100 ${
                          s.scenario === 'Base case' ? 'bg-stone-50 font-semibold' : ''
                        }`}
                      >
                        <td className="py-2 px-3 text-stone-800">{s.scenario}</td>
                        <td className={`py-2 px-3 text-right font-mono ${
                          isFin(s.irrProjectPct)
                            ? s.irrProjectPct >= 12 ? 'text-emerald-700' : 'text-amber-700'
                            : 'text-stone-500'
                        }`}>
                          {isFin(s.irrProjectPct) ? `${s.irrProjectPct.toFixed(1)} %` : 'N/A'}
                        </td>
                        <td className={`py-2 px-3 text-right font-mono ${
                          s.npv6Cr > 0 ? 'text-emerald-700' : 'text-amber-700'
                        }`}>
                          {fmt(s.npv6Cr, 2)} cr
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-stone-700">
                          {isFin(s.paybackYears) ? `${s.paybackYears.toFixed(1)} yr` : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* ═══ §8 Warnings + lender checklist ═══ */}
            <Section
              marker="8"
              title="Warnings & AEPC lender checklist"
              subtitle="AEPC §7.4 financial viability criteria"
            >
              <div className="grid md:grid-cols-2 gap-6">
                {/* Warnings */}
                <div>
                  <h3 className="font-display text-base text-stone-900 mb-3">
                    Diagnostic warnings
                  </h3>
                  {out.warnings.length === 0 ? (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                      <CheckCircle2 className="inline w-4 h-4 mr-2" />
                      No warnings — financial parameters within typical envelopes.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {out.warnings.map((w, i) => (
                        <li
                          key={i}
                          className={`rounded-md border p-3 text-sm ${
                            w.level === 'critical'
                              ? 'border-amber-400 bg-amber-50 text-stone-900'
                              : w.level === 'warn'
                              ? 'border-amber-200 bg-amber-50 text-stone-800'
                              : 'border-stone-200 bg-stone-50 text-stone-700'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {w.level === 'critical' ? (
                              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-700" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
                            )}
                            <div>
                              <span className="font-mono text-xs text-stone-500">
                                {w.code}
                              </span>
                              <p className="mt-0.5">{w.message}</p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Lender checklist */}
                <div>
                  <h3 className="font-display text-base text-stone-900 mb-3">
                    Lender checklist
                  </h3>
                  <ul className="space-y-1.5">
                    {out.lenderChecklist.map((c, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <span className={`font-mono mt-0.5 ${
                          c.passed ? 'text-emerald-700' : 'text-amber-700'
                        }`}>
                          {c.passed ? '✓' : '✗'}
                        </span>
                        <div className="flex-1">
                          <div className="text-stone-800">{c.label}</div>
                          <div className="font-mono text-xs text-stone-500">{c.note}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Section>
          </div>

          {/* ─── Sidebar ─── */}
          <aside className="lg:col-span-3">
            <div className="lg:sticky lg:top-6 space-y-6">
              {/* Headline summary */}
              <div className="rounded-md border border-stone-300 bg-white p-4">
                <h3 className="font-display text-sm text-stone-700 mb-3 pb-2 border-b border-stone-200">
                  Summary
                </h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-stone-600">Total CapEx</dt>
                    <dd className="font-mono text-stone-900">
                      {formatNpr(out.capex.totalCapExNpr, 'cr')}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-stone-600">Specific cost</dt>
                    <dd className="font-mono text-stone-900">
                      USD {out.capex.specificCostUsdPerKw.toFixed(0)}/kW
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-stone-600">Subsidy</dt>
                    <dd className="font-mono text-stone-900">
                      {formatNpr(out.capex.subsidyNpr, 'cr')}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-stone-600">Equity</dt>
                    <dd className="font-mono text-stone-900">
                      {formatNpr(out.capex.equityNpr, 'cr')}
                    </dd>
                  </div>
                  {inputs.debtEnabled && (
                    <div className="flex justify-between">
                      <dt className="text-stone-600">Debt</dt>
                      <dd className="font-mono text-stone-900">
                        {formatNpr(out.capex.debtNpr, 'cr')}
                      </dd>
                    </div>
                  )}
                  <div className="border-t border-stone-200 pt-2 flex justify-between">
                    <dt className="text-stone-600">IRR project</dt>
                    <dd className={`font-mono font-semibold ${
                      isFin(out.irrProjectPct)
                        ? out.irrProjectPct >= 12 ? 'text-emerald-700' : 'text-amber-700'
                        : 'text-stone-500'
                    }`}>
                      {isFin(out.irrProjectPct) ? `${out.irrProjectPct.toFixed(1)} %` : 'N/A'}
                    </dd>
                  </div>
                  {inputs.debtEnabled && (
                    <div className="flex justify-between">
                      <dt className="text-stone-600">IRR equity</dt>
                      <dd className={`font-mono font-semibold ${
                        isFin(out.irrEquityPct)
                          ? out.irrEquityPct >= 15 ? 'text-emerald-700' : 'text-amber-700'
                          : 'text-stone-500'
                      }`}>
                        {isFin(out.irrEquityPct) ? `${out.irrEquityPct.toFixed(1)} %` : 'N/A'}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-stone-600">NPV @ 12 %</dt>
                    <dd className={`font-mono ${
                      out.npvAt12Cr > 0 ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      {fmt(out.npvAt12Cr, 2)} cr
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-stone-600">LCoE</dt>
                    <dd className="font-mono text-stone-900">
                      NPR {fmt(out.lcoeNprPerKwh, 2)}/kWh
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-stone-600">Payback</dt>
                    <dd className="font-mono text-stone-900">
                      {isFin(out.paybackSimpleYears)
                        ? `${out.paybackSimpleYears.toFixed(1)} yr` : 'N/A'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Save button */}
              <div className="rounded-md border border-stone-300 bg-white p-4">
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saveState === 'saving' || Math.abs(disbursementSum - 100) >= 0.5}
                  className="w-full inline-flex items-center justify-center gap-2 rounded bg-stone-900 px-4 py-2.5 text-sm font-display text-stone-50 hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
                >
                  {saveState === 'saving' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : saveState === 'saved' ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Saved
                    </>
                  ) : (
                    'Save module'
                  )}
                </button>
                {saveError && (
                  <p className="mt-2 text-xs text-amber-700">
                    Save failed: {saveError}
                  </p>
                )}
                {Math.abs(disbursementSum - 100) >= 0.5 && (
                  <p className="mt-2 text-xs text-amber-700">
                    Disbursement schedule sums to {disbursementSum.toFixed(1)} % —
                    must equal 100 % to save.
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}