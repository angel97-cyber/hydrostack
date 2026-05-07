'use client'

// HydroStack — Module 07: Energy Generation Table
// app/(app)/projects/[id]/energy/EnergyForm.tsx
//
// Client component. Real-time recalculation via useMemo (no setState in
// useEffect — Day 5 lesson). Persists inputs+outputs to project_modules.
//
// Sections:
//   §1  Hydraulic context (read-only chained values + override line)
//   §2  Operational rules (riparian release, technical minimum, availability)
//   §3  Monthly flow series (12 editable inputs)
//   §4  Monthly energy table (computed, English + Nepali months)
//   §5  Annual aggregates + firm energy
//   §6  Monthly-energy bar chart (inline SVG)
//   §7  Warnings & diagnostics

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  ArrowLeft, BarChart3, Loader2, CheckCircle2, AlertCircle,
  AlertTriangle, Info,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  computeEnergy,
  defaultTechnicalMin,
  ENGLISH_MONTHS,
  NEPALI_MONTHS,
  type EnergyInputs,
  type RiparianMethod,
} from '@/lib/calc/energy'

interface Props {
  projectId: string
  projectName: string
  projectRiver: string | null
  hasUpstreamHydrology: boolean
  hasUpstreamPowerhouse: boolean
  initial: EnergyInputs
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function EnergyForm({
  projectId,
  projectName,
  projectRiver,
  hasUpstreamHydrology,
  hasUpstreamPowerhouse,
  initial,
}: Props) {
  const [inputs, setInputs] = useState<EnergyInputs>({
  ...initial,
  qDesignM3s:   parseFloat(initial.qDesignM3s.toFixed(3)),
  hNetM:        parseFloat(initial.hNetM.toFixed(2)),
  etaOverall:   parseFloat(initial.etaOverall.toFixed(4)),
  pInstalledKw: parseFloat(initial.pInstalledKw.toFixed(2)),
  monthlyFlows: initial.monthlyFlows.map((q) => parseFloat(q.toFixed(3))),
})
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  // ─── Derived values: pure useMemo, no setState in effects ─────────────────
  const out = useMemo(() => computeEnergy(inputs), [inputs])

  // ─── Field updaters ───────────────────────────────────────────────────────
  const setField = <K extends keyof EnergyInputs>(k: K, v: EnergyInputs[K]) =>
    setInputs((s) => ({ ...s, [k]: v }))

  const setFlow = (i: number, v: number) =>
    setInputs((s) => {
      const next = [...s.monthlyFlows]
      next[i] = Number.isFinite(v) ? Math.max(0, v) : 0
      return { ...s, monthlyFlows: next }
    })

  const onMethodChange = (m: RiparianMethod) => setField('riparianMethod', m)

  // ─── Save to Supabase ─────────────────────────────────────────────────────
  const onSave = async () => {
    setSaveState('saving')
    setSaveError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('project_modules').upsert(
        {
          project_id: projectId,
          module: 'energy',
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
      const msg =
        e instanceof Error
          ? e.message
          : (e as { message?: string })?.message ??
            JSON.stringify(e) ??
            'Unknown error'
      setSaveError(msg)
      console.error('[energy save]', e)          // full object in F12 → Console
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
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
            MODULE 07 · ENERGY GENERATION TABLE
          </div>
          <h1 className="text-4xl font-display text-stone-900 mb-2">
            {projectName}
          </h1>
          {projectRiver && <p className="text-stone-600">{projectRiver}</p>}
          <p className="text-stone-700 mt-3 text-sm leading-relaxed max-w-3xl">
            Twelve-month energy generation per <span className="font-mono">AEPC DFS 2014 §3.4.9 / §4.4 / §4.5</span>,
            with Bikram Sambat calendar overlay (Magh – Poush) for AEPC submission. Monthly available flow is
            reduced by the mandatory environmental release, clamped between the technical minimum
            (<span className="font-mono">Q_min</span>) and the rated discharge (<span className="font-mono">Q_design</span>),
            and converted to power via <span className="font-mono">P = 9.81 · η · Q · H_n</span>{' '}
            (AHEC §1.3 §3.0). Firm energy is dispatched at <span className="font-mono">Q90</span>.
          </p>
        </header>

        {/* Upstream banner */}
        <UpstreamBanner
          hydro={hasUpstreamHydrology}
          power={hasUpstreamPowerhouse}
        />

        {/* §1 Hydraulic context ────────────────────────────────────────────── */}
        <Section number="§1" title="Hydraulic chain (from upstream)">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <NumberField
              label="Q_design"
              unit="m³/s"
              value={inputs.qDesignM3s}
              onChange={(v) => setField('qDesignM3s', v)}
              step={0.001}
              cite="from powerhouse"
            />
            <NumberField
              label="H_net"
              unit="m"
              value={inputs.hNetM}
              onChange={(v) => setField('hNetM', v)}
              step={0.1}
              cite="from powerhouse"
            />
            <NumberField
              label="η_overall"
              unit="–"
              value={inputs.etaOverall}
              onChange={(v) => setField('etaOverall', v)}
              step={0.01}
              cite="η_t · η_drive · η_gen"
            />
            <NumberField
              label="P_installed"
              unit="kW"
              value={inputs.pInstalledKw}
              onChange={(v) => setField('pInstalledKw', v)}
              step={0.1}
              cite="electrical"
            />
          </div>
        </Section>

        {/* §2 Operational rules ───────────────────────────────────────────── */}
        <Section number="§2" title="Operational rules">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-mono text-stone-700 block mb-1">
                Riparian release method
              </label>
              <select
                className="w-full border border-stone-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-700"
                value={inputs.riparianMethod}
                onChange={(e) => onMethodChange(e.target.value as RiparianMethod)}
              >
                <option value="aepc_min_monthly">
                  10 % of min monthly flow (AEPC §4.4 default)
                </option>
                <option value="pct_mean_annual">
                  10 % of mean annual flow (legacy practice)
                </option>
                <option value="fixed">
                  Fixed value (special hydrology)
                </option>
              </select>
              <p className="text-[11px] text-stone-500 mt-1">
                Per AEPC DFS 2014 §4.4: minimum downstream release shall be
                10 % of the minimum monthly inflow.
              </p>
            </div>

            {inputs.riparianMethod === 'fixed' && (
              <NumberField
                label="Q_riparian (fixed)"
                unit="m³/s"
                value={inputs.riparianFixedM3s}
                onChange={(v) => setField('riparianFixedM3s', v)}
                step={0.001}
              />
            )}

            <div className={inputs.riparianMethod === 'fixed' ? '' : 'md:col-start-2'}>
              <div className="border border-stone-200 bg-stone-50 px-3 py-2 text-xs">
                <div className="font-mono text-stone-500">Effective Q_riparian</div>
                <div className="font-mono text-stone-900 text-base">
                  {out.qRiparianM3s.toFixed(4)} m³/s
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-mono text-stone-700 block mb-1">
                Turbine type (sets Q_min default)
              </label>
              <select
                className="w-full border border-stone-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-700"
                value={inputs.turbineType}
                onChange={(e) => {
                  const t = e.target.value as EnergyInputs['turbineType']
                  setInputs((s) => ({
                    ...s,
                    turbineType: t,
                    technicalMinFactor: defaultTechnicalMin(t),
                  }))
                }}
              >
                <option value="pelton">Pelton (Q_min = 0.20·Q_design)</option>
                <option value="turgo">Turgo (Q_min = 0.20·Q_design)</option>
                <option value="crossflow">Crossflow (Q_min = 0.30·Q_design)</option>
                <option value="francis">Francis (Q_min = 0.30·Q_design)</option>
                <option value="unknown">Unknown / generic (0.30·Q_design)</option>
              </select>
            </div>

            <NumberField
              label="Technical min factor"
              unit="–"
              value={inputs.technicalMinFactor}
              onChange={(v) => setField('technicalMinFactor', v)}
              step={0.01}
              cite={`Q_min = ${out.qMinPlantM3s.toFixed(3)} m³/s`}
            />

            <NumberField
              label="Plant availability"
              unit="–"
              value={inputs.plantAvailability}
              onChange={(v) => setField('plantAvailability', v)}
              step={0.01}
              cite="default 0.96 per AEPC §4.4"
            />
          </div>
        </Section>

        {/* §3 Monthly flow series ─────────────────────────────────────────── */}
        <Section
          number="§3"
          title="Monthly flow series"
          subtitle="m³/s · chained from hydrology · editable for sensitivity"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {inputs.monthlyFlows.map((q, i) => (
              <div key={i}>
                <label className="text-[11px] font-mono text-stone-500 block mb-1">
                  {ENGLISH_MONTHS[i]} <span className="text-stone-400">/ {NEPALI_MONTHS[i]}</span>
                </label>
                <input
                  type="number"
                  step={0.001}
                  min={0}
                  className="w-full border border-stone-300 bg-white px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  value={q}
                  onChange={(e) => setFlow(i, Number.parseFloat(e.target.value))}
                />
              </div>
            ))}
          </div>
        </Section>

        {/* §4 Monthly energy table ────────────────────────────────────────── */}
        <Section
          number="§4"
          title="Monthly energy table"
          subtitle="Q_plant clamped between Q_min and Q_design; E = P · hours / 1000"
        >
          <div className="overflow-x-auto border border-stone-300 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-100 border-b-2 border-stone-300">
                  <Th>Month</Th>
                  <Th>Nepali</Th>
                  <Th right>Q_av [m³/s]</Th>
                  <Th right>Q_plant [m³/s]</Th>
                  <Th right>P [kW]</Th>
                  <Th right>Hours [h]</Th>
                  <Th right>E [MWh]</Th>
                  <Th right>PF [%]</Th>
                </tr>
              </thead>
              <tbody>
                {out.rows.map((r) => {
                  const isDry = r.index === out.dryMonthIndex
                  const isWet = r.index === out.wetMonthIndex
                  const tone = isWet
                    ? 'bg-emerald-50/60'
                    : isDry
                    ? 'bg-amber-50/60'
                    : ''
                  return (
                    <tr key={r.index} className={`border-b border-stone-200 ${tone}`}>
                      <Td>{r.english}</Td>
                      <Td className="text-stone-600">{r.nepali}</Td>
                      <Td right mono>{r.qAvailableM3s.toFixed(3)}</Td>
                      <Td right mono>
                        {r.qPlantM3s.toFixed(3)}
                        {r.qPlantM3s === 0 && (
                          <span className="text-stone-400"> ·off</span>
                        )}
                      </Td>
                      <Td right mono>{r.powerKw.toFixed(2)}</Td>
                      <Td right mono>{r.hoursOnline.toFixed(0)}</Td>
                      <Td right mono>
                        <strong>{r.energyMwh.toFixed(2)}</strong>
                      </Td>
                      <Td right mono>{r.plantFactorPercent.toFixed(1)}</Td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-stone-900 text-stone-50 font-mono">
                  <Td colSpan={6} className="text-right">Annual</Td>
                  <Td right>
                    <strong>{out.annualEnergyMwh.toFixed(2)} MWh</strong>
                  </Td>
                  <Td right>{out.plantFactorPercent.toFixed(1)} %</Td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="mt-2 text-[11px] font-mono text-stone-500 flex gap-4">
            <span>
              <span className="inline-block w-3 h-3 bg-emerald-50 border border-emerald-300 mr-1 align-middle" />
              Wet month — {out.rows[out.wetMonthIndex].english} / {out.rows[out.wetMonthIndex].nepali}
            </span>
            <span>
              <span className="inline-block w-3 h-3 bg-amber-50 border border-amber-300 mr-1 align-middle" />
              Dry month — {out.rows[out.dryMonthIndex].english} / {out.rows[out.dryMonthIndex].nepali}
            </span>
          </div>
        </Section>

        {/* §5 Annual aggregates ──────────────────────────────────────────── */}
        <Section number="§5" title="Annual aggregates" subtitle="Headline numbers for the financial model & lender pack">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryTile
              label="Annual energy"
              value={out.annualEnergyMwh.toFixed(2)}
              unit="MWh"
              tone="primary"
            />
            <SummaryTile
              label="Plant factor"
              value={out.plantFactorPercent.toFixed(1)}
              unit="%"
              hint={`Avg monthly LF ${out.loadFactorAveragePercent.toFixed(1)} %`}
              tone={
                out.plantFactorPercent < 35
                  ? 'warn'
                  : out.plantFactorPercent > 70
                  ? 'warn'
                  : 'ok'
              }
            />
            <SummaryTile
              label="Firm energy (Q90)"
              value={out.firmEnergyMwh.toFixed(2)}
              unit="MWh"
              hint={`P_firm ${out.firmPowerKw.toFixed(1)} kW @ Q90 ${out.q90M3s.toFixed(3)} m³/s`}
              tone={out.firmEnergyMwh === 0 ? 'warn' : 'ok'}
            />
            <SummaryTile
              label="Firm plant factor"
              value={out.firmPlantFactorPercent.toFixed(1)}
              unit="%"
              hint="dry-season utilisation"
              tone="ok"
            />
          </div>
        </Section>

        {/* §6 Monthly energy chart ──────────────────────────────────────── */}
        <Section number="§6" title="Monthly energy chart" subtitle="Visual seasonality — same scale, English & Nepali labels">
          <div className="border border-stone-300 bg-white p-4">
            <EnergyBarChart out={out} />
          </div>
        </Section>

        {/* §7 Warnings ─────────────────────────────────────────────────── */}
        <Section number="§7" title="Diagnostics">
          {out.errors.length === 0 && out.warnings.length === 0 && (
            <Warning severity="info" message="All checks passed. No warnings." />
          )}
          {out.errors.map((e, i) => (
            <Warning key={`e${i}`} severity="error" message={e} />
          ))}
          {out.warnings.map((w, i) => (
            <Warning key={`w${i}`} severity="warn" message={w} />
          ))}
        </Section>

        {/* Save bar */}
        <div className="sticky bottom-0 bg-stone-50 border-t border-stone-300 -mx-6 px-6 py-4 mt-8 flex items-center justify-between">
          <div className="text-xs font-mono text-stone-500">
            <BarChart3 className="inline w-4 h-4 mr-1 align-text-bottom" />
            Module 07 · Energy Generation Table
          </div>
          <div className="flex items-center gap-3">
            {saveError && (
              <span className="text-xs text-red-700">Save failed: {saveError}</span>
            )}
            <button
              type="button"
              onClick={onSave}
              disabled={saveState === 'saving' || out.errors.length > 0}
              className={`inline-flex items-center gap-2 px-5 py-2 text-sm font-medium border ${
                saveState === 'saved'
                  ? 'bg-emerald-700 border-emerald-800 text-white'
                  : 'bg-stone-900 border-stone-900 text-stone-50 hover:bg-stone-800'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {saveState === 'saving' && (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                </>
              )}
              {saveState === 'saved' && (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Saved
                </>
              )}
              {(saveState === 'idle' || saveState === 'error') && 'Save module'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────────────────────────────────

function UpstreamBanner({ hydro, power }: { hydro: boolean; power: boolean }) {
  if (hydro && power) return null
  const missing: string[] = []
  if (!hydro) missing.push('hydrology')
  if (!power) missing.push('powerhouse')
  return (
    <div className="border border-amber-300 bg-amber-50 text-amber-900 text-sm px-4 py-3 mb-6 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <div>
        <strong>Missing upstream:</strong> {missing.join(' & ')} module{missing.length > 1 ? 's have' : ' has'} not been saved.
        Defaults are filled in but should be replaced with values from the upstream module before this energy table is used in the DFS.
      </div>
    </div>
  )
}

function Section({
  number,
  title,
  subtitle,
  children,
}: {
  number: string
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-8">
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-mono text-stone-500 text-sm">{number}</span>
        <h2 className="font-display text-2xl text-stone-900">{title}</h2>
      </div>
      {subtitle && (
        <p className="text-xs font-mono text-stone-500 mb-3">{subtitle}</p>
      )}
      {children}
    </section>
  )
}

function NumberField({
  label,
  unit,
  value,
  onChange,
  step = 0.01,
  cite,
}: {
  label: string
  unit: string
  value: number
  onChange: (v: number) => void
  step?: number
  cite?: string
}) {
  return (
    <div>
      <label className="text-xs font-mono text-stone-700 block mb-1">
        {label} <span className="text-stone-400">[{unit}]</span>
      </label>
      <input
        type="number"
        step={step}
        className="w-full border border-stone-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-700"
        value={value}
        onChange={(e) => {
          const v = Number.parseFloat(e.target.value)
          onChange(Number.isFinite(v) ? v : 0)
        }}
      />
      {cite && <p className="text-[11px] text-stone-500 mt-0.5 font-mono">{cite}</p>}
    </div>
  )
}

function Th({
  children,
  right = false,
}: {
  children: React.ReactNode
  right?: boolean
}) {
  return (
    <th
      className={`px-3 py-2 text-[11px] font-mono uppercase tracking-wider text-stone-700 ${
        right ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  right = false,
  mono = false,
  className = '',
  colSpan,
}: {
  children: React.ReactNode
  right?: boolean
  mono?: boolean
  className?: string
  colSpan?: number
}) {
  return (
    <td
      colSpan={colSpan}
      className={`px-3 py-2 text-sm ${right ? 'text-right' : 'text-left'} ${
        mono ? 'font-mono' : ''
      } ${className}`}
    >
      {children}
    </td>
  )
}

function SummaryTile({
  label,
  value,
  unit,
  hint,
  tone,
}: {
  label: string
  value: string
  unit: string
  hint?: string
  tone: 'primary' | 'ok' | 'warn'
}) {
  const tones = {
    primary: 'bg-stone-900 text-stone-50 border-stone-900',
    ok: 'bg-white text-stone-900 border-stone-300',
    warn: 'bg-amber-50 text-amber-900 border-amber-300',
  } as const
  const labelTone = {
    primary: 'text-stone-400',
    ok: 'text-stone-500',
    warn: 'text-amber-700',
  } as const
  return (
    <div className={`border p-4 ${tones[tone]}`}>
      <div className={`text-xs font-mono uppercase tracking-wider ${labelTone[tone]}`}>
        {label}
      </div>
      <div className="text-3xl font-display mt-1">
        {value} <span className="text-base font-mono opacity-80">{unit}</span>
      </div>
      {hint && <div className="text-[11px] font-mono opacity-80 mt-1">{hint}</div>}
    </div>
  )
}

function Warning({
  severity,
  message,
}: {
  severity: 'error' | 'warn' | 'info'
  message: string
}) {
  const tone =
    severity === 'error'
      ? 'border-red-300 bg-red-50 text-red-800'
      : severity === 'warn'
      ? 'border-amber-300 bg-amber-50 text-amber-800'
      : 'border-stone-300 bg-stone-50 text-stone-700'
  const Icon =
    severity === 'error' ? AlertCircle : severity === 'warn' ? AlertTriangle : Info
  return (
    <div className={`border p-3 flex items-start gap-2 text-sm mb-2 ${tone}`}>
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Inline SVG bar chart of monthly energy
//
// Same engineering-document styling as the Day 3 hydrology FDC: cream/stone
// background, JetBrains Mono labels, deep emerald bars. Tagged with English
// AND Nepali month labels — the latter is what AEPC submission readers
// will actually look at.
// ───────────────────────────────────────────────────────────────────────────

function EnergyBarChart({ out }: { out: ReturnType<typeof computeEnergy> }) {
  const W = 760
  const H = 280
  const margin = { top: 20, right: 20, bottom: 56, left: 56 }
  const innerW = W - margin.left - margin.right
  const innerH = H - margin.top - margin.bottom

  const maxE = Math.max(...out.rows.map((r) => r.energyMwh), 1)
  // Round up to a "nice" tick. Choose 4 horizontal gridlines.
  const nice = (v: number) => {
    const exp = Math.floor(Math.log10(v))
    const f = v / Math.pow(10, exp)
    const niceF = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
    return niceF * Math.pow(10, exp)
  }
  const yMax = nice(maxE * 1.15)
  const ticks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax]

  const barW = (innerW / 12) * 0.62
  const slot = innerW / 12

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
         aria-label="Monthly energy bar chart">
      {/* Background */}
      <rect x={0} y={0} width={W} height={H} fill="#fafaf9" />

      <g transform={`translate(${margin.left}, ${margin.top})`}>
        {/* Y-axis gridlines + labels */}
        {ticks.map((t, i) => {
          const y = innerH - (t / yMax) * innerH
          return (
            <g key={i}>
              <line x1={0} y1={y} x2={innerW} y2={y} stroke="#e7e5e4" strokeDasharray={i === 0 ? '0' : '2 3'} />
              <text x={-8} y={y + 4} fontSize={10} fontFamily="ui-monospace, JetBrains Mono"
                    fill="#78716c" textAnchor="end">
                {t.toFixed(0)}
              </text>
            </g>
          )
        })}

        {/* Bars */}
        {out.rows.map((r, i) => {
          const x = i * slot + (slot - barW) / 2
          const h = (r.energyMwh / yMax) * innerH
          const y = innerH - h
          const fill =
            r.index === out.wetMonthIndex
              ? '#047857'    // emerald-700 — wet
              : r.index === out.dryMonthIndex
              ? '#d97706'    // amber-600 — dry
              : '#0f766e'    // teal-700 — normal
          return (
            <g key={r.index}>
              <rect x={x} y={y} width={barW} height={h} fill={fill} rx={1} />
              <title>
                {r.english} ({r.nepali}): {r.energyMwh.toFixed(2)} MWh — Q_plant {r.qPlantM3s.toFixed(3)} m³/s
              </title>
              {/* Value above bar */}
              <text
                x={x + barW / 2}
                y={y - 4}
                fontSize={9}
                fontFamily="ui-monospace, JetBrains Mono"
                fill="#44403c"
                textAnchor="middle"
              >
                {r.energyMwh.toFixed(0)}
              </text>
              {/* English label */}
              <text
                x={x + barW / 2}
                y={innerH + 14}
                fontSize={10}
                fontFamily="ui-monospace, JetBrains Mono"
                fill="#44403c"
                textAnchor="middle"
              >
                {r.english}
              </text>
              {/* Nepali label */}
              <text
                x={x + barW / 2}
                y={innerH + 28}
                fontSize={9}
                fontFamily="ui-monospace, JetBrains Mono"
                fill="#a8a29e"
                textAnchor="middle"
              >
                {r.nepali}
              </text>
            </g>
          )
        })}

        {/* Axis lines */}
        <line x1={0} y1={0} x2={0} y2={innerH} stroke="#78716c" />
        <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#78716c" />

        {/* Axis title */}
        <text
          x={-margin.left + 10}
          y={-6}
          fontSize={10}
          fontFamily="ui-monospace, JetBrains Mono"
          fill="#57534e"
        >
          E [MWh]
        </text>
      </g>

      {/* Footer caption */}
      <text x={W / 2} y={H - 6} fontSize={10} fontFamily="ui-monospace, JetBrains Mono"
            fill="#a8a29e" textAnchor="middle">
        Annual {out.annualEnergyMwh.toFixed(2)} MWh · plant factor {out.plantFactorPercent.toFixed(1)} %
      </text>
    </svg>
  )
}