'use client'

// HydroStack — Module 02: Intake & Settling Basin (client component)
// Real-time recalc on every keystroke. Persists to project_modules.

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  calculateIntake,
  RACK_BAR_SHAPE_FACTORS,
  RACK_BAR_SHAPE_LABELS,
  type IntakeInput,
  type RackBarShape,
} from '@/lib/calc/intake'

// ─── Types ────────────────────────────────────────────────────────────────────

interface HydroSummary {
  qDesign:  number
  grossHead: number
  q40: number | null
  q80: number | null
}

interface Props {
  projectId:    string
  initialInputs: IntakeInput
  hydroSummary:  HydroSummary
  locked:        boolean
  alreadySaved:  boolean
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// ─── Primitive UI helpers (match hydrology module aesthetic exactly) ───────────

function SectionHeader({ marker, title }: { marker: string; title: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-3 border-b border-stone-200 pb-2">
      <span
        className="text-[10px] tracking-[0.2em] uppercase text-stone-400"
        style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
      >
        {marker}
      </span>
      <h2
        className="text-xl text-stone-900"
        style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
      >
        {title}
      </h2>
    </div>
  )
}

function NumField({
  label, unit, value, onChange, step = 'any', min, max, hint, disabled,
}: {
  label: string; unit: string; value: number
  onChange: (v: number) => void
  step?: number | string; min?: number; max?: number
  hint?: string; disabled?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between">
        <span className="text-sm text-stone-700">{label}</span>
        <span
          className="text-[10px] uppercase tracking-wider text-stone-400"
          style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
        >
          [{unit}]
        </span>
      </span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        step={step} min={min} max={max} disabled={disabled}
        onChange={(e) => {
          const v = e.target.value === '' ? 0 : parseFloat(e.target.value)
          onChange(Number.isFinite(v) ? v : 0)
        }}
        className="rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 disabled:bg-stone-100 disabled:text-stone-400"
        style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
      />
      {hint && <span className="text-xs text-stone-500">{hint}</span>}
    </label>
  )
}

function ResultRow({
  label, value, unit, tone = 'normal', precision = 3,
}: {
  label: string
  value: number | string
  unit?: string
  tone?: 'normal' | 'ok' | 'warn' | 'error'
  precision?: number
}) {
  const fmt = typeof value === 'number'
    ? (Number.isFinite(value) ? value.toFixed(precision) : '—')
    : value
  const cls =
    tone === 'error' ? 'text-red-700'
    : tone === 'warn'  ? 'text-amber-700'
    : tone === 'ok'    ? 'text-emerald-700'
    : 'text-stone-900'
  return (
    <div className="flex items-baseline justify-between border-b border-stone-100 py-1.5 last:border-b-0">
      <span className="text-sm text-stone-500">{label}</span>
      <span
        className={`text-sm tabular-nums ${cls}`}
        style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
      >
        {fmt}
        {unit && (
          <span className="ml-1 text-[10px] uppercase tracking-wider text-stone-400">
            {unit}
          </span>
        )}
      </span>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function IntakeForm({
  projectId, initialInputs, hydroSummary, locked, alreadySaved,
}: Props) {
  const router = useRouter()
  const [inputs, setInputs] = useState<IntakeInput>(initialInputs)
  const [saveState, setSaveState]   = useState<SaveState>('idle')
  const [saveError, setSaveError]   = useState<string | null>(null)
  const [, startTransition]         = useTransition()

  function set<K extends keyof IntakeInput>(key: K, value: IntakeInput[K]) {
    setInputs((prev) => ({ ...prev, [key]: value }))
    setSaveState('idle')
  }

  const out = useMemo(() => calculateIntake(inputs), [inputs])

  // ── Save ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (locked) return
    setSaveState('saving')
    setSaveError(null)
    const supabase = createClient()

    const { error } = await supabase.from('project_modules').upsert(
      {
        project_id: projectId,
        module:     'intake',
        inputs:     inputs  as unknown as Record<string, unknown>,
        outputs:    out     as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id,module' },
    )
    if (error) { setSaveState('error'); setSaveError(error.message); return }

    await supabase
      .from('projects')
      .update({ status: 'in_progress' })
      .eq('id', projectId)
      .eq('status', 'draft')

    setSaveState('saved')
    startTransition(() => router.refresh())
  }

  const errors = out.warnings.filter((w) => w.severity === 'error')
  const warns  = out.warnings.filter((w) => w.severity === 'warn')
  const infos  = out.warnings.filter((w) => w.severity === 'info')

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-12 gap-8">

      {/* ════ LEFT: inputs ══════════════════════════════════════════════════ */}
      <div className="col-span-12 space-y-6 lg:col-span-7">

        {/* §1 Design flow */}
        <section className="rounded border border-stone-200 bg-white p-6">
          <SectionHeader marker="§1" title="Design flow" />
          <div className="grid grid-cols-2 gap-3 mb-4">
            <ResultRow label="Q design"   value={hydroSummary.qDesign}   unit="m³/s" precision={3} tone="ok" />
            <ResultRow label="Gross head" value={hydroSummary.grossHead} unit="m"    precision={1} />
            {hydroSummary.q40 !== null && <ResultRow label="Q₄₀" value={hydroSummary.q40} unit="m³/s" precision={3} />}
            {hydroSummary.q80 !== null && <ResultRow label="Q₈₀" value={hydroSummary.q80} unit="m³/s" precision={3} />}
          </div>
          <p className="text-xs text-stone-400 mb-4">
            Pulled from hydrology module — edit there to change.
          </p>
          <NumField
            label="Flushing margin" unit="—"
            value={inputs.flushingMargin}
            onChange={(v) => set('flushingMargin', v)}
            step={0.01} min={0} max={0.5}
            hint="AEPC DFS 2014 §3.3.3: 0.10–0.20 (10–20% extra for continuous flushing)"
            disabled={locked}
          />
        </section>

        {/* §2 Grain size — auto-computed, read-only */}
        <section className="rounded border border-stone-200 bg-white p-6">
          <SectionHeader marker="§2" title="Design grain size" />
          <div className="rounded bg-stone-50 p-4 space-y-1">
            <ResultRow label="Head band"        value={out.grainHeadBand}       precision={0} />
            <ResultRow label="Particle d"        value={out.designGrainSize_mm}  unit="mm"  precision={2} tone="ok" />
            <ResultRow label="Trap efficiency"   value={out.trapEfficiency_pct}  unit="%"   precision={0} />
          </div>
          <p className="mt-3 text-xs text-stone-400">
            AEPC DFS Guidelines 2014 §3.3.4.2 Table 3.1 — finer particles settled
            at higher heads to protect turbine runners from abrasion damage.
          </p>
        </section>

        {/* §3 Settling velocity */}
        <section className="rounded border border-stone-200 bg-white p-6">
          <SectionHeader marker="§3" title="Settling velocity — Stokes" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <NumField label="ρ sediment" unit="kg/m³"
              value={inputs.rhoSediment} onChange={(v) => set('rhoSediment', v)}
              step={10} hint="Quartz sand default 2650" disabled={locked} />
            <NumField label="ρ water" unit="kg/m³"
              value={inputs.rhoWater} onChange={(v) => set('rhoWater', v)}
              step={1} disabled={locked} />
            <NumField label="μ water" unit="Pa·s"
              value={inputs.muWater} onChange={(v) => set('muWater', v)}
              step={0.0001} hint="0.001 at 20°C · 0.0013 at 10°C" disabled={locked} />
          </div>
          <div className="mt-4 rounded bg-stone-50 p-4 space-y-1">
            <ResultRow label="Vs Stokes" value={out.settlingVelocityStokes * 1000} unit="mm/s" precision={2} tone="ok" />
            <ResultRow label="Re particle" value={out.reynoldsParticle} precision={3}
              tone={out.isStokesValid ? 'ok' : 'warn'} />
            <ResultRow label="AHEC V_through limit" value={out.ahecFlowThroughLimit} unit="m/s" precision={3} />
          </div>
        </section>

        {/* §4 Settling basin */}
        <section className="rounded border border-stone-200 bg-white p-6">
          <SectionHeader marker="§4" title="Settling basin geometry" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <NumField label="Basin width W" unit="m"
              value={inputs.basinWidth} onChange={(v) => set('basinWidth', v)}
              step={0.1} min={0.3} hint="Recommend 1.5–3× flow depth" disabled={locked} />
            <NumField label="Flow depth D" unit="m"
              value={inputs.basinFlowDepth} onChange={(v) => set('basinFlowDepth', v)}
              step={0.1} min={0.3} hint="AEPC: 1.0–2.0 m typical" disabled={locked} />
            <NumField label="Sludge depth" unit="m"
              value={inputs.basinSludgeDepth} onChange={(v) => set('basinSludgeDepth', v)}
              step={0.05} min={0.2} hint="Dead storage zone (12 h budget)" disabled={locked} />
            <NumField label="Freeboard" unit="m"
              value={inputs.basinFreeBoard} onChange={(v) => set('basinFreeBoard', v)}
              step={0.05} min={0.15} disabled={locked} />
          </div>
        </section>

        {/* §5 Trash rack */}
        <section className="rounded border border-stone-200 bg-white p-6">
          <SectionHeader marker="§5" title="Coarse trashrack at intake" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <NumField label="Bar spacing b" unit="mm"
              value={inputs.rackBarSpacing} onChange={(v) => set('rackBarSpacing', v)}
              step={5} min={10} max={150} hint="AEPC coarse: ≤ 75 mm" disabled={locked} />
            <NumField label="Bar thickness t" unit="mm"
              value={inputs.rackBarThickness} onChange={(v) => set('rackBarThickness', v)}
              step={1} min={5} max={25} hint="MS flat 8–12 mm typical" disabled={locked} />
            <NumField label="Approach velocity" unit="m/s"
              value={inputs.rackApproachVelocity} onChange={(v) => set('rackApproachVelocity', v)}
              step={0.05} min={0.3} max={1.2} hint="AEPC: < 1.0 m/s coarse rack" disabled={locked} />
            <NumField label="Inclination α" unit="°"
              value={inputs.rackInclinationDeg} onChange={(v) => set('rackInclinationDeg', v)}
              step={1} min={45} max={90} hint="AEPC 3V:1H ≈ 71.6°" disabled={locked} />
            <label className="col-span-2 flex flex-col gap-1">
              <span className="flex items-baseline justify-between">
                <span className="text-sm text-stone-700">Bar shape</span>
                <span
                  className="text-[10px] uppercase tracking-wider text-stone-400"
                  style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                >
                  [K_shape]
                </span>
              </span>
              <select
                value={inputs.rackBarShape}
                onChange={(e) => set('rackBarShape', e.target.value as RackBarShape)}
                disabled={locked}
                className="rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-600 focus:outline-none disabled:bg-stone-100"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                {(Object.keys(RACK_BAR_SHAPE_FACTORS) as RackBarShape[]).map((shape) => (
                  <option key={shape} value={shape}>{RACK_BAR_SHAPE_LABELS[shape]}</option>
                ))}
              </select>
              <span className="text-xs text-stone-400">IS:11388-1995 / AEPC DFS 2014 Fig. 3.6</span>
            </label>
          </div>
        </section>

        {/* Save bar */}
        <div className="flex items-center justify-between rounded border border-stone-200 bg-stone-100 px-6 py-4">
          <div
            className="text-[11px] uppercase tracking-wider text-stone-500"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            {saveState === 'saved'  && '✓ Saved'}
            {saveState === 'saving' && 'Saving…'}
            {saveState === 'error'  && <span className="text-red-700">Error: {saveError}</span>}
            {saveState === 'idle'   && (alreadySaved ? 'Unsaved changes' : 'Not yet saved')}
          </div>
          <button
            type="button" onClick={handleSave}
            disabled={locked || saveState === 'saving'}
            className="rounded bg-emerald-700 px-6 py-2 text-xs uppercase tracking-wider text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            {alreadySaved ? 'Update module' : 'Save module'}
          </button>
        </div>
      </div>

      {/* ════ RIGHT: sticky results ══════════════════════════════════════════ */}
      <aside className="col-span-12 lg:col-span-5">
        <div className="sticky top-6 space-y-4">

          {/* Diversion */}
          <div className="rounded border border-stone-200 bg-white p-5">
            <div
              className="mb-3 text-[10px] uppercase tracking-widest text-stone-400"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              Diversion
            </div>
            <ResultRow label="Q diverted" value={out.qDiverted} unit="m³/s" precision={3} tone="ok" />
            <ResultRow label="Q flushing" value={out.qFlushing} unit="m³/s" precision={3} />
          </div>

          {/* Basin */}
          <div className="rounded border border-stone-200 bg-white p-5">
            <div
              className="mb-3 text-[10px] uppercase tracking-widest text-stone-400"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              Basin · Camp criterion
            </div>
            <ResultRow label="Surface area As" value={out.surfaceArea}    unit="m²" precision={2} />
            <ResultRow label="Length L"         value={out.basinLength}   unit="m"  precision={2} tone="ok" />
            <ResultRow label="Total depth"      value={out.basinTotalDepth} unit="m" precision={2} />
            <ResultRow label="V basin"
              value={out.flowVelocity} unit="m/s" precision={3}
              tone={out.flowVelocity > out.scourLimitVelocity ? 'warn' : 'ok'} />
            <ResultRow label="Scour limit"      value={out.scourLimitVelocity} unit="m/s" precision={3} />
            <ResultRow label="Overflow rate Q/As" value={out.overflowRate * 1000} unit="mm/s" precision={2} />
            <ResultRow label="Froude no."
              value={out.froudeNumber} precision={3}
              tone={out.froudeNumber >= 1 ? 'error' : out.froudeNumber > 0.5 ? 'warn' : 'ok'} />
            <ResultRow label="L/W"
              value={out.lwRatio} precision={1}
              tone={out.lwRatio < 4 || out.lwRatio > 10 ? 'warn' : 'ok'} />
            <ResultRow label="Sludge storage"  value={out.sedimentStorageVolume} unit="m³" precision={2} />
          </div>

          {/* Rack */}
          <div className="rounded border border-stone-200 bg-white p-5">
            <div
              className="mb-3 text-[10px] uppercase tracking-widest text-stone-400"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              Trashrack
            </div>
            <ResultRow label="Gross area"    value={out.rackGrossArea}         unit="m²" precision={2} />
            <ResultRow label="Net area"      value={out.rackNetArea}           unit="m²" precision={2} />
            <ResultRow label="Open ratio φ"  value={out.blockageRatio}         precision={3} />
            <ResultRow label="V net"         value={out.rackVelocityNet}       unit="m/s" precision={3} />
            <ResultRow label="K shape"       value={out.rackKShape}            precision={2} />
            <ResultRow label="hr Kirschmer"  value={out.rackHeadLossKirschmer * 1000} unit="mm" precision={1} tone="ok" />
            <ResultRow label="hr AHEC"       value={out.rackHeadLossAhec * 1000}      unit="mm" precision={1} />
          </div>

          {/* Validation */}
          {out.warnings.length > 0 && (
            <div className="rounded border border-stone-200 bg-white p-5">
              <div
                className="mb-3 text-[10px] uppercase tracking-widest text-stone-400"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                Validation
              </div>
              <ul className="space-y-2 text-sm">
                {errors.map((w) => (
                  <li key={w.code} className="border-l-2 border-red-600 pl-3 text-red-700">
                    <span
                      className="text-[10px] uppercase tracking-wider"
                      style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                    >Error · </span>{w.message}
                  </li>
                ))}
                {warns.map((w) => (
                  <li key={w.code} className="border-l-2 border-amber-500 pl-3 text-amber-800">
                    <span
                      className="text-[10px] uppercase tracking-wider"
                      style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                    >Warn · </span>{w.message}
                  </li>
                ))}
                {infos.map((w) => (
                  <li key={w.code} className="border-l-2 border-stone-300 pl-3 text-stone-600">
                    <span
                      className="text-[10px] uppercase tracking-wider"
                      style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                    >Info · </span>{w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
