'use client'

// HydroStack — Module 04: Penstock (client component)
// Real-time recalc on every keystroke. Persists to project_modules.

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, AlertCircle, Info, AlertTriangle, ArrowDownToLine } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  calculatePenstock,
  PENSTOCK_MATERIALS,
  type PenstockInput,
  type PenstockMaterial,
} from '@/lib/calc/penstock'

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  projectId:     string
  initialInputs: PenstockInput
  locked:        boolean
  alreadySaved:  boolean
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// ─── UI primitives — match hydrology / intake / headrace exactly ────────────

function SectionHeader({
  marker, title, note,
}: { marker: string; title: string; note?: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-3">
        <span
          className="text-[11px] uppercase tracking-[0.2em] text-emerald-700"
          style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
        >
          {marker}
        </span>
        <h2
          className="text-lg text-stone-900"
          style={{ fontFamily: 'var(--font-display), Georgia, serif' }}
        >
          {title}
        </h2>
      </div>
      {note && <p className="mt-1.5 text-xs text-stone-500">{note}</p>}
    </div>
  )
}

function NumField({
  label, unit, value, onChange, step = 1, min, max, hint, disabled,
}: {
  label:    string
  unit?:    string
  value:    number
  onChange: (v: number) => void
  step?:    number
  min?:     number
  max?:     number
  hint?:    string
  disabled?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-stone-700">
        {label}
        {unit && (
          <span
            className="ml-1.5 text-[10px] uppercase tracking-wider text-stone-400"
            style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
          >
            [{unit}]
          </span>
        )}
      </span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ''}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value === '' ? 0 : parseFloat(e.target.value)
          onChange(Number.isFinite(v) ? v : 0)
        }}
        className="rounded border border-stone-300 bg-white px-3 py-2 font-mono text-sm text-stone-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 disabled:bg-stone-100 disabled:text-stone-500"
      />
      {hint && <span className="text-[11px] text-stone-500">{hint}</span>}
    </label>
  )
}

function Select<T extends string>({
  label, value, options, onChange, hint, disabled,
}: {
  label:    string
  value:    T
  options:  Array<{ value: T; label: string }>
  onChange: (v: T) => void
  hint?:    string
  disabled?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-stone-700">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700 disabled:bg-stone-100 disabled:text-stone-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {hint && <span className="text-[11px] text-stone-500">{hint}</span>}
    </label>
  )
}

function Checkbox({
  label, checked, onChange, hint, disabled,
}: {
  label:    string
  checked:  boolean
  onChange: (v: boolean) => void
  hint?:    string
  disabled?: boolean
}) {
  return (
    <label className="flex items-start gap-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-600"
      />
      <span className="flex flex-col">
        <span className="text-sm text-stone-700">{label}</span>
        {hint && <span className="text-[11px] text-stone-500">{hint}</span>}
      </span>
    </label>
  )
}

function ResultRow({
  label, value, unit, precision = 3, highlight,
}: {
  label:     string
  value:     number
  unit?:     string
  precision?: number
  highlight?: 'ok' | 'warn' | 'error'
}) {
  const tone =
    highlight === 'ok'    ? 'text-emerald-800' :
    highlight === 'warn'  ? 'text-amber-700'   :
    highlight === 'error' ? 'text-red-700'     :
    'text-stone-900'
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-xs text-stone-600">{label}</span>
      <span
        className={`text-sm tabular-nums ${tone}`}
        style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
      >
        {Number.isFinite(value) ? value.toFixed(precision) : '—'}
        {unit && (
          <span className="ml-1 text-[10px] uppercase tracking-wider text-stone-400">
            {unit}
          </span>
        )}
      </span>
    </div>
  )
}

function Divider() {
  return <div className="my-3 border-t border-stone-200" />
}

// ─── Main component ──────────────────────────────────────────────────────────

const MATERIAL_OPTIONS: Array<{ value: PenstockMaterial; label: string }> =
  Object.entries(PENSTOCK_MATERIALS).map(([k, v]) => ({
    value: k as PenstockMaterial,
    label: v.label,
  }))

export function PenstockForm({
  projectId, initialInputs, locked, alreadySaved,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [inputs, setInputs] = useState<PenstockInput>(initialInputs)
  const [saveState, setSaveState] = useState<SaveState>(alreadySaved ? 'saved' : 'idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  // Upstream fields are always taken from server-rendered initialInputs (read-only).
  // Overlaid at compute time — no setState-in-effect needed.
  const effectiveInputs = useMemo<PenstockInput>(() => ({
    ...inputs,
    qDesign:     initialInputs.qDesign,
    grossHead:   initialInputs.grossHead,
    hIntakeLoss: initialInputs.hIntakeLoss,
    hHeadrace:   initialInputs.hHeadrace,
  }), [
    inputs,
    initialInputs.qDesign,
    initialInputs.grossHead,
    initialInputs.hIntakeLoss,
    initialInputs.hHeadrace,
  ])

  function set<K extends keyof PenstockInput>(key: K, value: PenstockInput[K]) {
    setInputs((prev) => ({ ...prev, [key]: value }))
    if (saveState === 'saved') setSaveState('idle')
  }

  // Material change → auto-fill Manning's n + corrosion allowance defaults.
  function setMaterial(m: PenstockMaterial) {
    const spec = PENSTOCK_MATERIALS[m]
    setInputs((prev) => ({
      ...prev,
      material:    m,
      manningN:    spec.manningN,
      corrosionMm: spec.defaultCorrosionMm,
    }))
    if (saveState === 'saved') setSaveState('idle')
  }

  const out = useMemo(() => calculatePenstock(effectiveInputs), [effectiveInputs])

  // ── Save ────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (locked) return
    setSaveState('saving')
    setSaveError(null)
    const supabase = createClient()

    const { error } = await supabase.from('project_modules').upsert(
      {
        project_id: projectId,
        module:     'penstock',
        inputs:     effectiveInputs as unknown as Record<string, unknown>,
        outputs:    out    as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id,module' },
    )
    if (error) {
      setSaveState('error')
      setSaveError(error.message)
      return
    }

    await supabase
      .from('projects')
      .update({ status: 'in_progress' })
      .eq('id', projectId)
      .eq('status', 'draft')

    setSaveState('saved')
    startTransition(() => router.refresh())
  }

  // Apply an empirical-formula diameter suggestion to the input field
  function applyDiameter(D_m: number) {
    if (D_m > 0) set('diameterMm', Math.round(D_m * 1000))
  }

  const errors = out.warnings.filter((w) => w.severity === 'error')
  const warns  = out.warnings.filter((w) => w.severity === 'warn')
  const infos  = out.warnings.filter((w) => w.severity === 'info')

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-12 gap-8">

      {/* ════ LEFT: inputs ═══════════════════════════════════════════════ */}
      <div className="col-span-12 space-y-6 lg:col-span-7">

        {/* §1 design flow & head (read-only) */}
        <section className="rounded border border-stone-200 bg-white p-6">
          <SectionHeader
            marker="§1"
            title="Design flow & head"
            note="Pulled from upstream modules — edit there to change."
          />
          <div className="grid grid-cols-2 gap-3">
            <ResultRow
              label="Q design"
              value={effectiveInputs.qDesign}
              unit="m³/s"
              precision={3}
              highlight={inputs.qDesign > 0 ? 'ok' : 'error'}
            />
            <ResultRow
              label="Gross head"
              value={effectiveInputs.grossHead}
              unit="m"
              precision={1}
              highlight={inputs.grossHead > 0 ? 'ok' : 'error'}
            />
            <ResultRow
              label="h intake loss"
              value={effectiveInputs.hIntakeLoss}
              unit="m"
              precision={3}
            />
            <ResultRow
              label="h headrace loss"
              value={effectiveInputs.hHeadrace}
              unit="m"
              precision={3}
            />
            <ResultRow
              label="Static head at penstock inlet"
              value={effectiveInputs.grossHead - effectiveInputs.hIntakeLoss - effectiveInputs.hHeadrace}
              unit="m"
              precision={2}
              highlight="ok"
            />
          </div>
        </section>

        {/* §2 material & geometry */}
        <section className="rounded border border-stone-200 bg-white p-6">
          <SectionHeader
            marker="§2"
            title="Material & geometry"
            note="Diameter is editable. The empirical-formula panel on the right shows Sarkaria, Bier and Fahlbusch suggestions — click any value to apply it."
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              label="Pipe material"
              value={inputs.material}
              options={MATERIAL_OPTIONS}
              onChange={setMaterial}
              hint={PENSTOCK_MATERIALS[inputs.material].notes}
              disabled={locked}
            />
            <NumField
              label="Internal diameter D" unit="mm"
              value={inputs.diameterMm}
              onChange={(v) => set('diameterMm', v)}
              step={10} min={50}
              hint="AEPC trial: 41 · Q[l/s]^0.38 mm"
              disabled={locked}
            />
            <NumField
              label="Total length L" unit="m"
              value={inputs.lengthM}
              onChange={(v) => set('lengthM', v)}
              step={5} min={1}
              hint="Along-pipe length, intake → turbine valve"
              disabled={locked}
            />
            <NumField
              label="Slope angle β" unit="°"
              value={inputs.slopeAngleDeg}
              onChange={(v) => set('slopeAngleDeg', v)}
              step={1} min={0} max={89}
              hint="From site profile — used by anchor block module"
              disabled={locked}
            />
            <NumField
              label="Manning's n" unit="—"
              value={inputs.manningN}
              onChange={(v) => set('manningN', v)}
              step={0.001} min={0.005}
              hint={`IS 11625: ${inputs.material === 'ms_is2062' ? '0.008–0.012 (steel)' : '0.009–0.012 (smooth)'}`}
              disabled={locked}
            />
            <Checkbox
              label="Buried in solid rock (a = 1425 m/s)"
              checked={inputs.rockEmbedded}
              onChange={(v) => set('rockEmbedded', v)}
              hint="IS 11639 Pt 2 §5.1.3 (ii) — rigid-wall surge celerity"
              disabled={locked}
            />
          </div>
        </section>

        {/* §3 thickness & pressure */}
        <section className="rounded border border-stone-200 bg-white p-6">
          <SectionHeader
            marker="§3"
            title="Wall thickness & water-hammer pressure"
            note="Iteratively solves t given surge ΔH: Joukowski (T_c = 0 or T_c ≤ 2L/a) or Michaud (T_c > 2L/a). Wave speed a = 1425/√(1 + D/(100·t)) per IS 11639 Pt 2 §5.1.3. Hoop stress S = P·r/t per IS 11639 Pt 1 §6.1.1. σ_allow = min(UTS/3, ½·fy) per §9.1.1."
          />
          {out.thickness.closureMode === 'joukowski' && inputs.closureTimeS === 0 && (
            <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              <strong>Conservative design (Joukowski instantaneous closure).</strong> Enter your governor valve closure time T_c above to use the Michaud formula — this typically reduces wall thickness significantly for T_c &gt; {out.thickness.criticalTimeS.toFixed(2)} s.
            </div>
          )}
          {out.thickness.closureMode === 'michaud' && (
            <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
              <strong>Michaud gradual closure applied</strong> (T_c = {inputs.closureTimeS} s &gt; T_critical = {out.thickness.criticalTimeS.toFixed(2)} s). ΔH reduced from Joukowski worst-case — verify T_c with turbine manufacturer governor spec.
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <NumField
              label="Corrosion allowance" unit="mm"
              value={inputs.corrosionMm}
              onChange={(v) => set('corrosionMm', v)}
              step={0.5} min={0}
              hint={`Default ${PENSTOCK_MATERIALS[inputs.material].defaultCorrosionMm} mm for this material. IS 11639 §8.3 says paint instead — Nepal practice keeps 1.5 mm for MS.`}
              disabled={locked}
            />
            <NumField
              label="Thickness override" unit="mm"
              value={inputs.thicknessOverrideMm}
              onChange={(v) => set('thicknessOverrideMm', v)}
              step={0.5} min={0}
              hint="0 = auto-pick next commercial plate"
              disabled={locked}
            />
            <NumField
              label="Governor closure time T_c" unit="s"
              value={inputs.closureTimeS}
              onChange={(v) => set('closureTimeS', v)}
              step={1} min={0}
              hint="0 = Joukowski (worst-case, conservative). Enter governor T_c to use Michaud gradual-closure formula. T_critical = 2L/a shown below."
              disabled={locked}
            />
          </div>

          <Divider />

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-3">
            <ResultRow label="Wave celerity a"        value={out.thickness.waveCelerity}     unit="m/s"  precision={0} />
            <ResultRow label="T_critical (2L/a)"        value={out.thickness.criticalTimeS}    unit="s"    precision={2} />
            <ResultRow
              label={out.thickness.closureMode === 'michaud' ? 'Michaud ΔH (gradual)' : 'Joukowski ΔH (instant)'}
              value={out.thickness.surgeHeadM}
              unit="m"
              precision={1}
              highlight={out.thickness.closureMode === 'michaud' ? 'ok' : 'warn'}
            />
            <ResultRow label="Design head H_d"          value={out.thickness.designHeadM}      unit="m"    precision={1} />
            <ResultRow label="Design pressure P_d"      value={out.thickness.designPressureMpa} unit="MPa" precision={2} />
            <ResultRow label="σ_allow (normal)"         value={out.thickness.allowableStressMpa} unit="MPa" precision={0} />
            <ResultRow label="t structural (req)"       value={out.thickness.tReqMm}           unit="mm"   precision={2} />
            <ResultRow label="t min IS 11639 §8.2"      value={out.thickness.tMinMm}           unit="mm"   precision={2} />
            <ResultRow label="t design"                 value={out.thickness.tDesignMm}        unit="mm"   precision={2} highlight="ok" />
            <ResultRow label="t commercial plate"       value={out.thickness.tCommercialMm}    unit="mm"   precision={0} highlight="ok" />
          </div>
        </section>

        {/* §4 hydraulic losses */}
        <section className="rounded border border-stone-200 bg-white p-6">
          <SectionHeader
            marker="§4"
            title="Hydraulic head losses"
            note="Friction: hf = V²·n²·L / R^(4/3) (Manning, AHEC §11.5.2.3). Minor: ΣK · V²/(2g) (AHEC §11.5.2.x)."
          />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <NumField
              label="K entrance" unit="—"
              value={inputs.kEntrance}
              onChange={(v) => set('kEntrance', v)}
              step={0.05} min={0}
              hint="0.5 sharp · 0.05 bell-mouth"
              disabled={locked}
            />
            <NumField
              label="Bend count" unit="—"
              value={inputs.bendCount}
              onChange={(v) => set('bendCount', v)}
              step={1} min={0}
              hint="Number of bends in the alignment"
              disabled={locked}
            />
            <NumField
              label="K per bend" unit="—"
              value={inputs.kBendEach}
              onChange={(v) => set('kBendEach', v)}
              step={0.05} min={0}
              hint="0.10 (R/D≥4, smooth) · 0.30 (sharp 90°)"
              disabled={locked}
            />
            <NumField
              label="K valve" unit="—"
              value={inputs.kValve}
              onChange={(v) => set('kValve', v)}
              step={0.05} min={0}
              hint="Butterfly fully open ≈ 0.2"
              disabled={locked}
            />
            <NumField
              label="K contraction" unit="—"
              value={inputs.kContraction}
              onChange={(v) => set('kContraction', v)}
              step={0.05} min={0}
              hint="0.1 (10° flare) · 0.5 (sudden)"
              disabled={locked}
            />
          </div>

          <Divider />

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <ResultRow label="Velocity V"          value={out.velocity}         unit="m/s" precision={2}
              highlight={out.velocity >= 2 && out.velocity <= 4 ? 'ok' :
                         out.velocity > 4 && out.velocity <= out.bierPermissibleVelocity ? 'warn' :
                         out.velocity > out.bierPermissibleVelocity ? 'error' : 'warn'} />
            <ResultRow label="V²/(2g) head"          value={out.velocityHeadM}    unit="m"   precision={3} />
            <ResultRow label="Bier perm. V"           value={out.bierPermissibleVelocity} unit="m/s" precision={2} />
            <ResultRow label="h friction"            value={out.hFrictionM}       unit="m"   precision={3} />
            <ResultRow label="h entrance"            value={out.hEntranceM}       unit="m"   precision={3} />
            <ResultRow label="h bends"               value={out.hBendsM}          unit="m"   precision={3} />
            <ResultRow label="h valve"               value={out.hValveM}          unit="m"   precision={3} />
            <ResultRow label="h contraction"         value={out.hContractionM}    unit="m"   precision={3} />
            <ResultRow label="h penstock total"      value={out.hPenstockM}       unit="m"   precision={3} highlight="ok" />
            <ResultRow label="% of gross head"        value={out.headLossPctOfGross} unit="%" precision={2}
              highlight={out.headLossPctOfGross <= 5 ? 'ok' :
                         out.headLossPctOfGross <= 7 ? 'warn' : 'error'} />
          </div>
        </section>

        {/* §5 net head & power */}
        <section className="rounded border border-stone-200 bg-white p-6">
          <SectionHeader
            marker="§5"
            title="Net head & installed capacity"
            note="P = η_overall · ρ·g·Q·H_net where H_net = H_gross − Σ(losses). η_overall = η_turbine · η_generator · η_transformer."
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <NumField
              label="η overall" unit="—"
              value={inputs.etaOverall}
              onChange={(v) => set('etaOverall', v)}
              step={0.01} min={0.5} max={0.95}
              hint="Typical Mini-HP: 0.75–0.82 (η_t·η_g·η_tx)"
              disabled={locked}
            />
          </div>
          <Divider />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <ResultRow label="H net" value={out.hNetM} unit="m" precision={2} highlight={out.hNetM > 0 ? 'ok' : 'error'} />
            <ResultRow label="Hydraulic kW" value={out.hydraulicPowerKw} unit="kW" precision={1} />
            <ResultRow label="Installed kW" value={out.installedCapacityKw} unit="kW" precision={1} highlight="ok" />
          </div>
        </section>

      </div>

      {/* ════ RIGHT: rolling results & diameter suggestions ═══════════════ */}
      <aside className="col-span-12 space-y-6 lg:col-span-5">

        {/* Diameter suggestion panel */}
        <section className="sticky top-6 rounded border border-stone-200 bg-white p-6">
          <SectionHeader
            marker="§2′"
            title="Diameter — empirical suggestions"
            note="Click any value to apply it to the design diameter."
          />
          <div className="space-y-2">
            <DiameterRow
              label="AEPC DFS 2014 §3.4.1"
              D_m={out.diameterAEPC_m}
              onApply={() => applyDiameter(out.diameterAEPC_m)}
              disabled={locked}
            />
            <DiameterRow
              label="Sarkaria 1958 (Q-form)"
              D_m={out.diameterSarkaria_m}
              onApply={() => applyDiameter(out.diameterSarkaria_m)}
              disabled={locked}
            />
            <DiameterRow
              label="Bier USBR-1958"
              D_m={out.diameterBier1958_m}
              onApply={() => applyDiameter(out.diameterBier1958_m)}
              disabled={locked}
            />
            <DiameterRow
              label="Fahlbusch (steel)"
              D_m={out.diameterFahlbuschSteel_m}
              onApply={() => applyDiameter(out.diameterFahlbuschSteel_m)}
              disabled={locked}
            />
            <DiameterRow
              label="Fahlbusch (concrete)"
              D_m={out.diameterFahlbuschConcrete_m}
              onApply={() => applyDiameter(out.diameterFahlbuschConcrete_m)}
              disabled={locked}
            />
            <DiameterRow
              label="Bier-1949 minimum (V_perm cap)"
              D_m={out.diameterBier1949_m}
              onApply={() => applyDiameter(out.diameterBier1949_m)}
              disabled={locked}
            />
          </div>
          <Divider />
          <div className="grid grid-cols-2 gap-2">
            <ResultRow label="Selected D" value={inputs.diameterMm} unit="mm" precision={0} highlight="ok" />
            <ResultRow label="External D (D + 2t)" value={out.externalDiameterMm} unit="mm" precision={0} />
            <ResultRow label="V at selected D" value={out.velocity} unit="m/s" precision={2}
              highlight={out.velocity >= 2 && out.velocity <= 4 ? 'ok' : 'warn'} />
            <ResultRow label="Pipe weight" value={out.pipeWeightKgPerM} unit="kg/m" precision={1} />
            <ResultRow label="Water weight" value={out.waterWeightKgPerM} unit="kg/m" precision={1} />
            <ResultRow label="Total" value={out.totalWeightKgPerM} unit="kg/m" precision={1} />
          </div>
        </section>

        {/* Warnings */}
        {(errors.length + warns.length + infos.length > 0) && (
          <section className="space-y-3">
            {errors.map((w, i) => (
              <div key={`e${i}`} className="flex items-start gap-2 rounded border border-red-300 bg-red-50 px-4 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-700" />
                <p className="text-sm text-red-900">{w.message}</p>
              </div>
            ))}
            {warns.map((w, i) => (
              <div key={`w${i}`} className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" />
                <p className="text-sm text-amber-900">{w.message}</p>
              </div>
            ))}
            {infos.map((w, i) => (
              <div key={`i${i}`} className="flex items-start gap-2 rounded border border-stone-200 bg-stone-50 px-4 py-3">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-stone-600" />
                <p className="text-sm text-stone-800">{w.message}</p>
              </div>
            ))}
          </section>
        )}

        {/* Save */}
        <section className="rounded border border-stone-200 bg-white p-6">
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={locked || saveState === 'saving'}
              className="inline-flex items-center justify-center gap-2 rounded bg-stone-900 px-5 py-2.5 text-sm font-medium text-stone-50 shadow-sm transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
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
              <p className="text-xs text-red-700">Save failed: {saveError}</p>
            )}
            {locked && (
              <p className="text-xs text-stone-500">
                Save disabled until hydrology module is completed.
              </p>
            )}
          </div>
        </section>
      </aside>
    </div>
  )
}

// ─── Local sub-components ────────────────────────────────────────────────────

function DiameterRow({
  label, D_m, onApply, disabled,
}: {
  label: string
  D_m:   number
  onApply: () => void
  disabled?: boolean
}) {
  const D_mm = D_m * 1000
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-xs text-stone-700">{label}</span>
      <div className="flex items-baseline gap-2">
        <span
          className="text-sm tabular-nums text-stone-900"
          style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
        >
          {Number.isFinite(D_mm) && D_mm > 0 ? D_mm.toFixed(0) : '—'}
          <span className="ml-1 text-[10px] uppercase tracking-wider text-stone-400">mm</span>
        </span>
        <button
          type="button"
          onClick={onApply}
          disabled={disabled || !Number.isFinite(D_mm) || D_mm <= 0}
          className="inline-flex items-center gap-1 rounded border border-stone-300 px-2 py-0.5 text-[10px] uppercase tracking-wider text-stone-600 transition hover:border-emerald-700 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
          title="Apply this diameter"
        >
          <ArrowDownToLine className="h-3 w-3" />
          Use
        </button>
      </div>
    </div>
  )
}