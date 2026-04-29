'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  computeHydrology,
  MIP_REGIONS,
  MONTH_LABELS,
  type HydrologyInputs,
  type FlowMethod,
  type MipRegionId,
} from '@/lib/calc/hydrology'

// ════════════════════════════════════════════════════════════════════════════
//  HydrologyForm
//  Client component. Holds all inputs in React state, recomputes every
//  output via useMemo on every keystroke (pure, fast, no I/O).
//  Save button writes inputs+outputs JSONB to project_modules and bumps
//  the project status to in_progress on first save.
// ════════════════════════════════════════════════════════════════════════════

export default function HydrologyForm({
  projectId,
  initialInputs,
}: {
  projectId: string
  initialInputs: HydrologyInputs
}) {
  const router = useRouter()
  const [inputs, setInputs] = useState<HydrologyInputs>(initialInputs)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Real-time computation — runs synchronously every keystroke.
  const out = useMemo(() => computeHydrology(inputs), [inputs])

  // Helper: typed setter that coerces numbers cleanly
  function set<K extends keyof HydrologyInputs>(key: K, value: HydrologyInputs[K]) {
    setInputs((prev) => ({ ...prev, [key]: value }))
    if (saveStatus === 'saved') setSaveStatus('idle')
  }

  // ─── Save to Supabase ─────────────────────────────────────────────────────
  async function handleSave() {
    setSaveStatus('saving')
    setSaveError(null)
    const supabase = createClient()

    // Upsert into project_modules — composite primary key (project_id, module)
    const { error: upsertErr } = await supabase
      .from('project_modules')
      .upsert(
        {
          project_id: projectId,
          module: 'hydrology',
          inputs: inputs as unknown as Record<string, unknown>,
          outputs: out as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'project_id,module' }
      )

    if (upsertErr) {
      setSaveStatus('error')
      setSaveError(upsertErr.message)
      return
    }

    // Bump project status from 'draft' → 'in_progress' on first module save
    await supabase
      .from('projects')
      .update({ status: 'in_progress' })
      .eq('id', projectId)
      .eq('status', 'draft')

    setSaveStatus('saved')
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-10 py-10">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* ═════════════ LEFT: 2/3 — input sections ═════════════ */}
        <div className="lg:col-span-2 space-y-8">

          {/* §1 Flow analysis method ─────────────────────────────────────── */}
          <Section
            num="§1"
            title="Flow analysis method"
            note="AEPC DFS 2014 §2.4.5 — choice of method depends on catchment area and whether a site flow measurement is available."
          >
            <MethodPicker
              value={inputs.method}
              onChange={(m) => set('method', m)}
            />
          </Section>

          {/* §2 Catchment properties ─────────────────────────────────────── */}
          <Section
            num="§2"
            title="Catchment properties"
            note="Read from a 1:25,000 or 1:50,000 topo sheet. ATotal at the intake; A5000A and A3000A are the portions of that catchment below 5000 m and 3000 m elevation respectively."
          >
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5">
              <FieldNum
                label="Total catchment area"
                unit="km²"
                value={inputs.aTotal}
                onChange={(v) => set('aTotal', v)}
                hint="ATotal at intake"
              />
              <FieldNum
                label="Area below 5000 m"
                unit="km²"
                value={inputs.a5000A}
                onChange={(v) => set('a5000A', v)}
                hint="A5000A — snowline-adjusted"
              />
              <FieldNum
                label="Area below 3000 m"
                unit="km²"
                value={inputs.a3000A}
                onChange={(v) => set('a3000A', v)}
                hint="A3000A — for flood eqs."
              />
              <FieldNum
                label="Monsoon Wetness Index"
                unit="mm"
                value={inputs.mwi}
                onChange={(v) => set('mwi', v)}
                hint="WECS/DHM map · typ. 1500–3500"
              />
            </div>
          </Section>

          {/* §3 MIP-specific (only when method='mip') ─────────────────────── */}
          {inputs.method === 'mip' && (
            <Section
              num="§3"
              title="MIP refinement"
              note="AEPC POHV 2008 Appendix C2.2 — pick the hydrological region from the map of Nepal, then enter one site flow measurement (Nov–May) to anchor the unit hydrograph to reality."
            >
              <div className="space-y-5">
                <div>
                  <Label>Hydrological region</Label>
                  <select
                    className="mt-1.5 w-full bg-white border border-stone-300 rounded px-3 py-2 text-stone-900 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                    value={inputs.mipRegion}
                    onChange={(e) => set('mipRegion', Number(e.target.value) as MipRegionId)}
                  >
                    {MIP_REGIONS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5">
                  <FieldNum
                    label="Site flow measurement"
                    unit="m³/s"
                    value={inputs.mipMeasurementQ}
                    onChange={(v) => set('mipMeasurementQ', v)}
                    hint="leave 0 for unrefined estimate"
                    step={0.001}
                  />
                  <div>
                    <Label>Measurement month</Label>
                    <select
                      className="mt-1.5 w-full bg-white border border-stone-300 rounded px-3 py-2 text-stone-900 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
                      value={inputs.mipMeasurementMonth}
                      onChange={(e) => set('mipMeasurementMonth', Number(e.target.value))}
                    >
                      {MONTH_LABELS.map((m, i) => (
                        <option key={m} value={i}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <Hint>Nov–May low-flow window preferred</Hint>
                  </div>
                </div>
              </div>
            </Section>
          )}

          {/* §4 Head ─────────────────────────────────────────────────────── */}
          <Section
            num={inputs.method === 'mip' ? '§4' : '§3'}
            title="Head and losses"
            note="Gross head from intake water level to turbine centerline (surveyed). Losses are placeholders here — the Headrace and Penstock modules will compute them rigorously per Manning and Darcy-Weisbach."
          >
            <div className="grid sm:grid-cols-3 gap-x-6 gap-y-5">
              <FieldNum
                label="Gross head"
                unit="m"
                value={inputs.grossHead}
                onChange={(v) => set('grossHead', v)}
                hint="Hg, surveyed"
              />
              <FieldPct
                label="Headrace + forebay loss"
                value={inputs.headraceLossPct}
                onChange={(v) => set('headraceLossPct', v)}
                hint="placeholder, typ. 1–3%"
              />
              <FieldPct
                label="Penstock loss"
                value={inputs.penstockLossPct}
                onChange={(v) => set('penstockLossPct', v)}
                hint="placeholder, typ. 3–6%"
              />
            </div>
          </Section>

          {/* §5 Capacity ─────────────────────────────────────────────────── */}
          <Section
            num={inputs.method === 'mip' ? '§5' : '§4'}
            title="Design discharge and capacity"
            note="P = η · ρ · g · Q · H. AEPC POHV 2008 §C2.2 recommends Qdesign ≤ 0.85 · Q11mo as a hard cap for micro-hydro; for mini-hydro AEPC 2014 §2.4.6 typically uses Q40 from the FDC."
          >
            <div className="grid sm:grid-cols-3 gap-x-6 gap-y-5">
              <FieldNum
                label="Design discharge"
                unit="m³/s"
                value={inputs.qDesign}
                onChange={(v) => set('qDesign', v)}
                hint="Qdesign — typ. ≈ Q40"
                step={0.001}
              />
              <FieldNum
                label="Overall efficiency"
                unit="—"
                value={inputs.efficiency}
                onChange={(v) => set('efficiency', v)}
                hint="η_t · η_g · η_tr (≈0.80)"
                step={0.01}
                min={0}
                max={1}
              />
              <FieldNum
                label="Target capacity"
                unit="kW"
                value={inputs.targetCapacityKW}
                onChange={(v) => set('targetCapacityKW', v)}
                hint="for cross-check"
              />
            </div>

            {/* Live cross-check */}
            <div
              className="mt-5 p-3 rounded border bg-stone-50 border-stone-200 text-sm"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              <span className="text-stone-500">Calculated </span>
              <span className="text-stone-900 font-medium">{out.capacity.powerKW.toFixed(1)} kW</span>
              <span className="text-stone-400 mx-2">·</span>
              <span className="text-stone-500">target </span>
              <span className="text-stone-900 font-medium">{inputs.targetCapacityKW.toFixed(0)} kW</span>
              <span className="text-stone-400 mx-2">·</span>
              <CapacityVerdict calc={out.capacity.powerKW} target={inputs.targetCapacityKW} />
            </div>
          </Section>
        </div>

        {/* ═════════════ RIGHT: 1/3 — sticky results panel ═════════════ */}
        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-6 space-y-6">

            {/* Summary card */}
            <div className="bg-white border border-stone-200 rounded">
              <div
                className="px-5 py-3 border-b border-stone-200 bg-stone-50 text-[11px] tracking-[0.2em] uppercase text-emerald-800"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                Results · live
              </div>
              <div className="p-5">
                <ResultRow label="Q40"     value={out.q40}     unit="m³/s" />
                <ResultRow label="Q80"     value={out.q80}     unit="m³/s" />
                <ResultRow label="Q mean"  value={out.qMean}   unit="m³/s" />
                <ResultRow label="Q min"   value={out.qMin}    unit="m³/s" />
                <Divider />
                <ResultRow label="Q2 inst"   value={out.flood.q2Inst}   unit="m³/s" />
                <ResultRow label="Q100 inst" value={out.q100Inst}       unit="m³/s" emphasised />
                <Divider />
                <ResultRow label="H gross" value={out.head.grossHead} unit="m" decimals={2} />
                <ResultRow label="H loss"  value={out.head.totalLossM} unit="m" decimals={2} />
                <ResultRow label="H net"   value={out.head.netHead}   unit="m" decimals={2} />
                <Divider />
                <ResultRow label="P installed" value={out.capacity.powerKW} unit="kW" emphasised decimals={1} />
              </div>
            </div>

            {/* FDC visualisation (only for AEPC FDC method) */}
            <div className="bg-white border border-stone-200 rounded">
              <div
                className="px-5 py-3 border-b border-stone-200 bg-stone-50 text-[11px] tracking-[0.2em] uppercase text-emerald-800"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                Flow duration curve
              </div>
              <FdcChart fdc={out.fdc} />
            </div>

            {/* Save button */}
            <div className="space-y-2">
              <button
                onClick={handleSave}
                disabled={saveStatus === 'saving' || isPending}
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-800 hover:bg-emerald-900 disabled:bg-stone-400 text-white font-medium py-3 rounded transition-colors"
              >
                {saveStatus === 'saving' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : saveStatus === 'saved' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save module
                  </>
                )}
              </button>

              {saveStatus === 'error' && (
                <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{saveError ?? 'Save failed.'}</span>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ─── Monthly flow table (only for WECS/DHM and MIP) ─────────────── */}
      {out.monthlyFlows.length > 0 && (
        <div className="mt-10 bg-white border border-stone-200 rounded">
          <div
            className="px-5 py-3 border-b border-stone-200 bg-stone-50 text-[11px] tracking-[0.2em] uppercase text-emerald-800"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            Mean monthly flows
          </div>
          <div className="overflow-x-auto">
            <table
              className="w-full text-sm"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              <thead>
                <tr className="border-b border-stone-200">
                  {MONTH_LABELS.map((m) => (
                    <th key={m} className="px-3 py-2 text-stone-500 text-xs font-normal text-right">
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {out.monthlyFlows.map((q, i) => (
                    <td key={i} className="px-3 py-3 text-right text-stone-900">
                      {q.toFixed(3)}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-stone-100">
                  {out.monthlyFlows.map((_, i) => (
                    <td key={i} className="px-3 pb-2 text-right text-stone-400 text-xs">
                      m³/s
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//                              SUB-COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

function Section({
  num,
  title,
  note,
  children,
}: {
  num: string
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-white border border-stone-200 rounded">
      <div className="px-6 pt-6 pb-4 border-b border-stone-100">
        <div className="flex items-baseline gap-3">
          <span
            className="text-emerald-800 text-sm"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            {num}
          </span>
          <h2
            className="text-2xl text-stone-900"
            style={{ fontFamily: 'var(--font-display), Georgia, serif', fontWeight: 500 }}
          >
            {title}
          </h2>
        </div>
        {note && <p className="mt-2 text-sm text-stone-600 leading-relaxed">{note}</p>}
      </div>
      <div className="p-6">{children}</div>
    </section>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="block text-[11px] tracking-[0.15em] uppercase text-stone-600"
      style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
    >
      {children}
    </label>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mt-1 text-[11px] text-stone-400"
      style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
    >
      {children}
    </p>
  )
}

function FieldNum({
  label,
  unit,
  value,
  onChange,
  hint,
  step = 0.01,
  min,
  max,
}: {
  label: string
  unit: string
  value: number
  onChange: (v: number) => void
  hint?: string
  step?: number
  min?: number
  max?: number
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <Label>{label}</Label>
        <span
          className="text-[11px] text-stone-500"
          style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
        >
          [{unit}]
        </span>
      </div>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => {
          const n = parseFloat(e.target.value)
          onChange(Number.isFinite(n) ? n : 0)
        }}
        className="mt-1.5 w-full bg-white border border-stone-300 rounded px-3 py-2 text-stone-900 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
        style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
      />
      {hint && <Hint>{hint}</Hint>}
    </div>
  )
}

/**
 * Percentage field — stores a fraction (0..1) but displays as % to the user.
 * e.g. 0.04 in state ↔ "4" in the input box.
 */
function FieldPct({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  hint?: string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <Label>{label}</Label>
        <span
          className="text-[11px] text-stone-500"
          style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
        >
          [%]
        </span>
      </div>
      <input
        type="number"
        step={0.1}
        min={0}
        max={100}
        value={Number.isFinite(value) ? +(value * 100).toFixed(2) : ''}
        onChange={(e) => {
          const n = parseFloat(e.target.value)
          onChange(Number.isFinite(n) ? n / 100 : 0)
        }}
        className="mt-1.5 w-full bg-white border border-stone-300 rounded px-3 py-2 text-stone-900 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
        style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
      />
      {hint && <Hint>{hint}</Hint>}
    </div>
  )
}

function MethodPicker({
  value,
  onChange,
}: {
  value: FlowMethod
  onChange: (v: FlowMethod) => void
}) {
  const options: { id: FlowMethod; title: string; sub: string; cite: string }[] = [
    {
      id: 'aepc_fdc',
      title: 'AEPC 2014 FDC equations',
      sub: 'Direct Q% at standard exceedances. No site measurement needed.',
      cite: '§2.4.6',
    },
    {
      id: 'wecs_dhm',
      title: 'WECS/DHM (Hydest)',
      sub: '12 monthly flows by regression. Catchment > 100 km².',
      cite: '§2.4.5.2',
    },
    {
      id: 'mip',
      title: 'MIP method',
      sub: 'Regional unit hydrograph + 1 site measurement (Nov–May). Catchment < 100 km².',
      cite: '§2.4.5.1',
    },
  ]
  return (
    <div className="grid gap-3">
      {options.map((opt) => (
        <button
          type="button"
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={
            'text-left border rounded px-4 py-3 transition-colors ' +
            (value === opt.id
              ? 'border-emerald-700 bg-emerald-50/40 ring-1 ring-emerald-700'
              : 'border-stone-200 bg-white hover:border-stone-400')
          }
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-stone-900 font-medium">{opt.title}</span>
            <span
              className="text-[11px] text-emerald-800"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              AEPC {opt.cite}
            </span>
          </div>
          <p className="mt-1 text-sm text-stone-600">{opt.sub}</p>
        </button>
      ))}
    </div>
  )
}

function CapacityVerdict({ calc, target }: { calc: number; target: number }) {
  if (target <= 0) return <span className="text-stone-500">no target</span>
  const ratio = calc / target
  if (ratio >= 0.95 && ratio <= 1.05) {
    return <span className="text-emerald-800">within ±5%</span>
  }
  if (ratio < 0.95) {
    return (
      <span className="text-amber-700">
        under by {((1 - ratio) * 100).toFixed(1)}%
      </span>
    )
  }
  return (
    <span className="text-amber-700">
      over by {((ratio - 1) * 100).toFixed(1)}%
    </span>
  )
}

function ResultRow({
  label,
  value,
  unit,
  decimals = 3,
  emphasised = false,
}: {
  label: string
  value: number
  unit: string
  decimals?: number
  emphasised?: boolean
}) {
  return (
    <div
      className="flex items-baseline justify-between py-1.5"
      style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
    >
      <span className="text-stone-500 text-sm">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span
          className={
            emphasised
              ? 'text-emerald-800 text-lg font-medium'
              : 'text-stone-900 font-medium'
          }
        >
          {Number.isFinite(value) ? value.toFixed(decimals) : '—'}
        </span>
        <span className="text-stone-400 text-xs">{unit}</span>
      </span>
    </div>
  )
}

function Divider() {
  return <div className="my-2 border-t border-stone-100" />
}

/**
 * SVG flow duration curve.
 * X axis = % exceedance (0..100), Y axis = log10(Q).
 * Plots the 8 standard ordinates from aepcFdc(), connected linearly.
 */
function FdcChart({ fdc }: { fdc: ReturnType<typeof computeHydrology>['fdc'] }) {
  const points: [number, number][] = [
    [0,   fdc.q0],
    [5,   fdc.q5],
    [20,  fdc.q20],
    [40,  fdc.q40],
    [60,  fdc.q60],
    [80,  fdc.q80],
    [95,  fdc.q95],
    [100, fdc.q100],
  ]

  const W = 320
  const H = 200
  const PAD_L = 40
  const PAD_R = 12
  const PAD_T = 12
  const PAD_B = 28

  const positiveQ = points.map(([, q]) => q).filter((q) => q > 0)
  if (positiveQ.length === 0) {
    return (
      <div className="p-6 text-sm text-stone-400 text-center">
        Enter catchment properties to see the FDC.
      </div>
    )
  }
  const qMax = Math.max(...positiveQ)
  const qMin = Math.min(...positiveQ)
  // Log scale, bounded so a single zero ordinate doesn't break it
  const logMin = Math.log10(Math.max(qMin, qMax / 1000))
  const logMax = Math.log10(qMax)
  const range = logMax - logMin || 1

  const xOf = (p: number) => PAD_L + (p / 100) * (W - PAD_L - PAD_R)
  const yOf = (q: number) => {
    const lq = Math.log10(Math.max(q, qMax / 1000))
    return PAD_T + (1 - (lq - logMin) / range) * (H - PAD_T - PAD_B)
  }

  const path = points
    .map(([p, q], i) => `${i === 0 ? 'M' : 'L'} ${xOf(p).toFixed(1)} ${yOf(q).toFixed(1)}`)
    .join(' ')

  return (
    <div className="p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}>
        {/* Grid */}
        {[0, 25, 50, 75, 100].map((p) => (
          <line key={p} x1={xOf(p)} x2={xOf(p)} y1={PAD_T} y2={H - PAD_B} stroke="#e7e5e4" strokeWidth={1} />
        ))}
        {/* Axes */}
        <line x1={PAD_L} x2={W - PAD_R} y1={H - PAD_B} y2={H - PAD_B} stroke="#a8a29e" strokeWidth={1} />
        <line x1={PAD_L} x2={PAD_L}     y1={PAD_T}     y2={H - PAD_B} stroke="#a8a29e" strokeWidth={1} />
        {/* Q axis labels (log) */}
        <text x={6} y={yOf(qMax) + 4} fontSize="9" fill="#78716c">{qMax.toFixed(2)}</text>
        <text x={6} y={yOf(Math.max(qMin, qMax / 1000)) + 4} fontSize="9" fill="#78716c">
          {Math.max(qMin, qMax / 1000).toFixed(3)}
        </text>
        <text x={6} y={PAD_T - 2} fontSize="8" fill="#78716c">m³/s</text>
        {/* X axis labels */}
        {[0, 25, 50, 75, 100].map((p) => (
          <text key={p} x={xOf(p)} y={H - PAD_B + 14} fontSize="9" fill="#78716c" textAnchor="middle">
            {p}%
          </text>
        ))}
        <text x={(PAD_L + W - PAD_R) / 2} y={H - 4} fontSize="9" fill="#78716c" textAnchor="middle">
          % time exceeded
        </text>
        {/* Curve */}
        <path d={path} fill="none" stroke="#065f46" strokeWidth={1.75} />
        {/* Points */}
        {points.map(([p, q], i) => (
          <circle key={i} cx={xOf(p)} cy={yOf(q)} r={2.5} fill="#065f46" />
        ))}
        {/* Q40 + Q80 reference markers */}
        <line x1={xOf(40)} x2={xOf(40)} y1={PAD_T} y2={H - PAD_B} stroke="#065f46" strokeDasharray="2 3" strokeWidth={0.75} opacity={0.5} />
        <line x1={xOf(80)} x2={xOf(80)} y1={PAD_T} y2={H - PAD_B} stroke="#065f46" strokeDasharray="2 3" strokeWidth={0.75} opacity={0.5} />
        <text x={xOf(40) + 3} y={PAD_T + 9} fontSize="8" fill="#065f46">Q40</text>
        <text x={xOf(80) + 3} y={PAD_T + 9} fontSize="8" fill="#065f46">Q80</text>
      </svg>
    </div>
  )
}