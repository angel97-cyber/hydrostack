'use client'

// HydroStack — Module 03: Headrace & Forebay (client component)
// Real-time recalc on every keystroke. Persists to project_modules.

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  calculateHeadrace,
  CONDUIT_LIBRARY,
  RACK_BAR_SHAPE_LABELS,
  type HeadraceInput,
  type ConduitType,
  type SectionShape,
  type RackBarShape,
  type TurbineKind,
} from '@/lib/calc/headrace'

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  projectId:     string
  initialInputs: HeadraceInput
  qDesign:       number
  locked:        boolean
  alreadySaved:  boolean
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// ─── UI primitives — match hydrology / intake module exactly ─────────────────

function SectionHeader({ marker, title, note }: { marker: string; title: string; note?: string }) {
  return (
    <div className="mb-4 border-b border-stone-200 pb-2">
      <div className="flex items-baseline gap-3">
        <span
          className="text-[10px] uppercase tracking-[0.2em] text-stone-400"
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
      {note && <p className="mt-2 text-xs text-stone-500">{note}</p>}
    </div>
  )
}

function NumField({
  label, unit, value, onChange, step = 'any', min, max, hint, disabled,
}: {
  label:    string
  unit:     string
  value:    number
  onChange: (v: number) => void
  step?:    number | string
  min?:     number
  max?:     number
  hint?:    string
  disabled?: boolean
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
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value === '' ? 0 : parseFloat(e.target.value)
          onChange(Number.isFinite(v) ? v : 0)
        }}
        className="rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700 disabled:bg-stone-100 disabled:text-stone-500"
        style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
      />
      {hint && <span className="text-[11px] text-stone-500">{hint}</span>}
    </label>
  )
}

function SelectField<T extends string>({
  label, value, onChange, options, hint, disabled,
}: {
  label:    string
  value:    T
  onChange: (v: T) => void
  options:  Array<{ value: T; label: string }>
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
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="text-[11px] text-stone-500">{hint}</span>}
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
        {unit && <span className="ml-1 text-[10px] uppercase tracking-wider text-stone-400">{unit}</span>}
      </span>
    </div>
  )
}

function Divider() {
  return <div className="my-2 border-t border-stone-200" />
}

// ─── Main component ──────────────────────────────────────────────────────────

export function HeadraceForm({ projectId, initialInputs, qDesign, locked, alreadySaved }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [inputs, setInputs] = useState<HeadraceInput>(initialInputs)
  const [saveState, setSaveState] = useState<SaveState>(alreadySaved ? 'saved' : 'idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  function set<K extends keyof HeadraceInput>(key: K, value: HeadraceInput[K]) {
    setInputs((prev) => ({ ...prev, [key]: value }))
    if (saveState === 'saved') setSaveState('idle')
  }

  // When conduit type changes, auto-fill Manning's n midpoint AND
  // snap the cross-section to one allowed by that conduit type.
  function setConduitType(t: ConduitType) {
    const spec = CONDUIT_LIBRARY[t]
    setInputs((prev) => ({
      ...prev,
      conduitType: t,
      manningN:    spec.nDefault,
      shape:       spec.sections.includes(prev.shape) ? prev.shape : spec.sections[0],
    }))
    if (saveState === 'saved') setSaveState('idle')
  }

  // qDesign is a prop — compose at call time, never sync into state (avoids setState-in-effect).
  const out = useMemo(() => calculateHeadrace({ ...inputs, qDesign }), [inputs, qDesign])

  const conduit = CONDUIT_LIBRARY[inputs.conduitType]
  const sectionOptions = (
    [
      { value: 'rectangular' as SectionShape, label: 'Rectangular' },
      { value: 'trapezoidal' as SectionShape, label: 'Trapezoidal' },
      { value: 'circular'    as SectionShape, label: 'Circular (full pipe)' },
    ] as Array<{ value: SectionShape; label: string }>
  ).filter((s) => conduit.sections.includes(s.value))

  // ── Save ────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (locked) return
    setSaveState('saving')
    setSaveError(null)
    const supabase = createClient()

    const { error } = await supabase.from('project_modules').upsert(
      {
        project_id: projectId,
        module:     'headrace',
        inputs:     { ...inputs, qDesign } as unknown as Record<string, unknown>,
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

  const errors = out.warnings.filter((w) => w.severity === 'error')
  const warns  = out.warnings.filter((w) => w.severity === 'warn')
  const infos  = out.warnings.filter((w) => w.severity === 'info')

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-12 gap-8">

      {/* ════ LEFT: inputs ══════════════════════════════════════════════════ */}
      <div className="col-span-12 space-y-6 lg:col-span-7">

        {/* §1 design flow (read-only) */}
        <section className="rounded border border-stone-200 bg-white p-6">
          <SectionHeader
            marker="§1"
            title="Design flow"
            note="Pulled from hydrology module — edit there to change."
          />
          <div className="grid grid-cols-2 gap-3">
            <ResultRow
              label="Q design"
              value={qDesign}
              unit="m³/s"
              precision={3}
              highlight={qDesign > 0 ? 'ok' : 'error'}
            />
          </div>
        </section>

        {/* §2 conduit type */}
        <section className="rounded border border-stone-200 bg-white p-6">
          <SectionHeader
            marker="§2"
            title="Conduit type"
            note="AHEC §8.2.4 Table 8 / §8.5.3.4 — Manning's n auto-fills to midpoint of recommended range; override if site conditions justify."
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectField<ConduitType>
              label="Type"
              value={inputs.conduitType}
              onChange={setConduitType}
              options={(Object.keys(CONDUIT_LIBRARY) as ConduitType[]).map((k) => ({
                value: k,
                label: CONDUIT_LIBRARY[k].label,
              }))}
              hint={conduit.hint}
            />
            <NumField
              label="Manning's n"
              unit="—"
              value={inputs.manningN}
              onChange={(v) => set('manningN', v)}
              step={0.0005}
              min={0.005}
              max={0.05}
              hint={`AHEC range: ${conduit.nMin} – ${conduit.nMax}`}
            />
          </div>
        </section>

        {/* §3 geometry */}
        <section className="rounded border border-stone-200 bg-white p-6">
          <SectionHeader
            marker="§3"
            title="Cross-section &amp; slope"
            note="Open-channel geometry uses A = (b + z·y)·y, P = b + 2y·√(1+z²). Manning's V = (1/n)·R^(2/3)·S^(½)."
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SelectField<SectionShape>
              label="Shape"
              value={inputs.shape}
              onChange={(v) => set('shape', v)}
              options={sectionOptions}
            />

            {inputs.shape === 'circular' ? (
              <NumField
                label="Pipe diameter D"
                unit="m"
                value={inputs.pipeDiameter}
                onChange={(v) => set('pipeDiameter', v)}
                step={0.05}
                min={0.05}
              />
            ) : (
              <NumField
                label="Base width b"
                unit="m"
                value={inputs.baseWidth}
                onChange={(v) => set('baseWidth', v)}
                step={0.05}
                min={0.1}
              />
            )}

            {inputs.shape === 'trapezoidal' && (
              <NumField
                label="Side slope z"
                unit="H:V"
                value={inputs.sideSlope}
                onChange={(v) => set('sideSlope', v)}
                step={0.1}
                min={0}
                max={3}
                hint="0 = vertical wall, 1 = 45°"
              />
            )}

            {inputs.shape !== 'circular' && (
              <NumField
                label="Flow depth y"
                unit="m"
                value={inputs.flowDepth}
                onChange={(v) => set('flowDepth', v)}
                step={0.05}
                min={0.05}
              />
            )}

            <NumField
              label="Bed slope S"
              unit="m/m"
              value={inputs.bedSlope}
              onChange={(v) => set('bedSlope', v)}
              step={0.0001}
              min={0.0001}
              max={0.05}
              hint="Typical 1:500 to 1:2000"
            />
            <NumField
              label="Length L"
              unit="m"
              value={inputs.length}
              onChange={(v) => set('length', v)}
              step={10}
              min={1}
            />
            {inputs.shape !== 'circular' && (
              <NumField
                label="Freeboard"
                unit="m"
                value={inputs.freeboard}
                onChange={(v) => set('freeboard', v)}
                step={0.05}
                min={0}
                hint="AEPC §3.3.5.1(f): ≥ min(0.30 m, ½y)"
              />
            )}
          </div>

          <Divider />

          {/* live geometry results */}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <ResultRow label="Area A"           value={out.area}            unit="m²"   precision={3} />
            <ResultRow label="Wetted P"         value={out.wettedPerimeter} unit="m"    precision={3} />
            <ResultRow label="Hyd. radius R"    value={out.hydraulicRadius} unit="m"    precision={3} />
            <ResultRow label="Top width T"      value={out.topWidth}        unit="m"    precision={3} />
            <ResultRow label="Velocity V"       value={out.velocity}        unit="m/s"  precision={2}
              highlight={out.velocity < 0.30 || out.velocity > conduit.vMax ? 'warn' : 'ok'} />
            <ResultRow label="Capacity Q"       value={out.qCapacity}       unit="m³/s" precision={3}
              highlight={out.capacityRatio < 1.10 ? 'error' : out.capacityRatio > 1.30 ? 'warn' : 'ok'} />
            <ResultRow label="Q / Q_design"     value={out.capacityRatio}   unit="—"    precision={2} />
            <ResultRow label="Froude Fr"        value={out.froude}          unit="—"    precision={2}
              highlight={out.flowRegime === 'subcritical' ? 'ok' : 'error'} />
          </div>
        </section>

        {/* §4 head loss */}
        <section className="rounded border border-stone-200 bg-white p-6">
          <SectionHeader
            marker="§4"
            title="Head loss"
            note="Friction: hf = V²·n²·L / R^(4/3) (Manning). Minor: h = ΣK·V²/(2g)."
          />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <NumField label="Bend count"         unit="—"  value={inputs.bendCount}  onChange={(v) => set('bendCount',  v)} step={1} min={0} />
            <NumField label="K per bend"         unit="—"  value={inputs.kBendEach}  onChange={(v) => set('kBendEach',  v)} step={0.05} min={0} hint="0.10–0.30 typical" />
            <NumField label="K entrance"         unit="—"  value={inputs.kEntrance}  onChange={(v) => set('kEntrance',  v)} step={0.05} min={0} hint="0.5 sharp, 0.05 bell" />
            <NumField label="K exit"             unit="—"  value={inputs.kExit}      onChange={(v) => set('kExit',      v)} step={0.05} min={0} hint="1.0 sudden expansion" />
          </div>

          <Divider />

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <ResultRow label="h friction"   value={out.hFriction} unit="m" precision={3} />
            <ResultRow label="h minor"      value={out.hMinor}    unit="m" precision={3} />
            <ResultRow label="h headrace"   value={out.hHeadrace} unit="m" precision={3} highlight="ok" />
          </div>
        </section>

        {/* §5 forebay */}
        <section className="rounded border border-stone-200 bg-white p-6">
          <SectionHeader
            marker="§5"
            title="Forebay"
            note="AEPC DFS 2014 §3.3.4.3: active storage ≥ 15·Q. AHEC §9.3(c): mean velocity < 0.5 m/s. Submergence per AHEC §7.5 / AEPC §3.3.5.2(d)."
          />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <NumField label="Length"      unit="m" value={inputs.forebayLength}    onChange={(v) => set('forebayLength',    v)} step={0.5} min={1} />
            <NumField label="Width"       unit="m" value={inputs.forebayWidth}     onChange={(v) => set('forebayWidth',     v)} step={0.5} min={1} />
            <NumField label="Active depth" unit="m" value={inputs.forebayDepth}    onChange={(v) => set('forebayDepth',     v)} step={0.1} min={0.5} hint="Above penstock crown" />
            <NumField label="Freeboard"   unit="m" value={inputs.forebayFreeboard} onChange={(v) => set('forebayFreeboard', v)} step={0.05} min={0} hint="≥ min(0.30 m, ½d)" />
            <NumField label="Penstock Ø"   unit="m" value={inputs.penstockDiameter} onChange={(v) => set('penstockDiameter', v)} step={0.05} min={0.05} hint="At bell-mouth" />
          </div>

          <Divider />

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <ResultRow label="Active V"            value={out.forebayActiveStorageM3}         unit="m³"  precision={1}
              highlight={out.forebayActiveStorageM3 >= out.forebayActiveStorageRequiredM3 ? 'ok' : 'error'} />
            <ResultRow label="Required (15·Q)"     value={out.forebayActiveStorageRequiredM3} unit="m³"  precision={1} />
            <ResultRow label="Residence τ"          value={out.forebayResidenceTimeS}          unit="s"   precision={1} />
            <ResultRow label="Mean V"              value={out.forebayMeanVelocity}            unit="m/s" precision={2}
              highlight={out.forebayMeanVelocity > 0.5 ? 'warn' : 'ok'} />
            <ResultRow label="Penstock V"          value={out.penstockVelocity}                unit="m/s" precision={2} />
            <ResultRow label="Submergence req."    value={out.submergenceRequiredM}            unit="m"   precision={2}
              highlight={out.submergenceOk ? 'ok' : 'error'} />
            <ResultRow label="Submergence prov."   value={out.submergenceProvidedM}            unit="m"   precision={2}
              highlight={out.submergenceOk ? 'ok' : 'error'} />
            <ResultRow label="Freeboard req."      value={out.forebayFreeboardRequired}       unit="m"   precision={2}
              highlight={out.forebayFreeboardOk ? 'ok' : 'warn'} />
          </div>
        </section>

        {/* §6 fine trashrack */}
        <section className="rounded border border-stone-200 bg-white p-6">
          <SectionHeader
            marker="§6"
            title="Fine trashrack at penstock entry"
            note="AEPC Reference Std 2014 §3.1.1.2: spacing = ½ nozzle Ø (Pelton) / ½ runner-blade clearance (Crossflow/Francis). IS:11388-1995 Kirschmer head loss."
          />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <SelectField<TurbineKind>
              label="Turbine type"
              value={inputs.turbineType}
              onChange={(v) => set('turbineType', v)}
              options={[
                { value: 'pelton',    label: 'Pelton' },
                { value: 'crossflow', label: 'Crossflow' },
                { value: 'francis',   label: 'Francis' },
                { value: 'unknown',   label: 'Not selected' },
              ]}
            />
            {inputs.turbineType === 'pelton' ? (
              <NumField
                label="Nozzle Ø"
                unit="mm"
                value={inputs.nozzleDiameter}
                onChange={(v) => set('nozzleDiameter', v)}
                step={5}
                min={10}
                hint="Drives recommended bar spacing"
              />
            ) : (
              <NumField
                label="Runner blade clearance"
                unit="mm"
                value={inputs.runnerClearance}
                onChange={(v) => set('runnerClearance', v)}
                step={5}
                min={5}
                hint="Drives recommended bar spacing"
              />
            )}
            <NumField
              label="Bar spacing s"
              unit="mm"
              value={inputs.rackBarSpacing}
              onChange={(v) => set('rackBarSpacing', v)}
              step={1}
              min={5}
              hint={`AEPC rec: ${out.rackRecommendedSpacingMm.toFixed(1)} mm`}
            />
            <NumField
              label="Bar thickness t"
              unit="mm"
              value={inputs.rackBarThickness}
              onChange={(v) => set('rackBarThickness', v)}
              step={1}
              min={3}
            />
            <NumField
              label="Approach velocity"
              unit="m/s"
              value={inputs.rackVelocity}
              onChange={(v) => set('rackVelocity', v)}
              step={0.05}
              min={0.1}
              max={2}
              hint="AEPC band: 0.6–1.0 m/s"
            />
            <NumField
              label="Inclination α"
              unit="deg"
              value={inputs.rackInclination}
              onChange={(v) => set('rackInclination', v)}
              step={1}
              min={30}
              max={90}
              hint="≈ 70° (1:3 H:V) per AEPC"
            />
            <SelectField<RackBarShape>
              label="Bar shape"
              value={inputs.rackBarShape}
              onChange={(v) => set('rackBarShape', v)}
              options={(Object.keys(RACK_BAR_SHAPE_LABELS) as RackBarShape[]).map((k) => ({
                value: k,
                label: RACK_BAR_SHAPE_LABELS[k],
              }))}
            />
          </div>

          <Divider />

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <ResultRow label="AEPC rec. spacing"  value={out.rackRecommendedSpacingMm} unit="mm" precision={1}
              highlight={out.rackSpacingOk ? 'ok' : 'warn'} />
            <ResultRow label="Open-area ratio"    value={out.rackOpenAreaRatio}        unit="—"  precision={2} />
            <ResultRow label="hr (Kirschmer)"     value={out.rackHeadLossKirschmer * 1000} unit="mm" precision={1} highlight="ok" />
          </div>
        </section>

      </div>

      {/* ════ RIGHT: sticky results + save ══════════════════════════════════ */}
      <aside className="col-span-12 lg:col-span-5">
        <div className="space-y-6 lg:sticky lg:top-6">

          {/* Live results card */}
          <div className="rounded border border-stone-200 bg-white">
            <div
              className="border-b border-stone-200 bg-stone-50 px-5 py-3 text-[11px] uppercase tracking-[0.2em] text-emerald-800"
              style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
            >
              Results · live
            </div>
            <div className="p-5">
              <ResultRow label="Velocity"    value={out.velocity}         unit="m/s" precision={2}
                highlight={out.velocity < 0.30 ? 'warn' : out.velocity > conduit.vMax ? 'error' : 'ok'} />
              <ResultRow label="Capacity"    value={out.qCapacity}        unit="m³/s" precision={3}
                highlight={out.capacityRatio < 1.10 ? 'error' : 'ok'} />
              <ResultRow label="Froude"      value={out.froude}           unit="—"   precision={2}
                highlight={out.flowRegime === 'subcritical' ? 'ok' : 'error'} />
              <Divider />
              <ResultRow label="h friction"  value={out.hFriction} unit="m" precision={3} />
              <ResultRow label="h minor"     value={out.hMinor}    unit="m" precision={3} />
              <ResultRow label="h headrace"  value={out.hHeadrace} unit="m" precision={3} highlight="ok" />
              <Divider />
              <ResultRow label="Forebay V"   value={out.forebayActiveStorageM3} unit="m³" precision={1}
                highlight={out.forebayActiveStorageM3 >= out.forebayActiveStorageRequiredM3 ? 'ok' : 'error'} />
              <ResultRow label="Required"    value={out.forebayActiveStorageRequiredM3} unit="m³" precision={1} />
              <ResultRow label="Submergence" value={out.submergenceProvidedM} unit="m" precision={2}
                highlight={out.submergenceOk ? 'ok' : 'error'} />
              <Divider />
              <ResultRow label="hr fine rack" value={out.rackHeadLossKirschmer * 1000} unit="mm" precision={1} />
            </div>
          </div>

          {/* Validation panel */}
          {(errors.length + warns.length + infos.length) > 0 && (
            <div className="rounded-md border border-stone-200 bg-white p-5">
              <div
                className="mb-3 text-[10px] uppercase tracking-widest text-stone-500"
                style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
              >
                Validation
              </div>
              <ul className="space-y-2 text-sm">
                {errors.map((wn) => (
                  <li key={wn.code} className="border-l-2 border-red-600 pl-3 text-red-700">
                    <span
                      className="text-[10px] uppercase tracking-wider"
                      style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                    >
                      Error
                    </span>
                    <p>{wn.message}</p>
                  </li>
                ))}
                {warns.map((wn) => (
                  <li key={wn.code} className="border-l-2 border-amber-500 pl-3 text-amber-800">
                    <span
                      className="text-[10px] uppercase tracking-wider"
                      style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                    >
                      Warn
                    </span>
                    <p>{wn.message}</p>
                  </li>
                ))}
                {infos.map((wn) => (
                  <li key={wn.code} className="border-l-2 border-stone-400 pl-3 text-stone-600">
                    <span
                      className="text-[10px] uppercase tracking-wider"
                      style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
                    >
                      Info
                    </span>
                    <p>{wn.message}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Save button */}
          <div className="space-y-2">
            <button
              onClick={handleSave}
              disabled={locked || saveState === 'saving' || isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded bg-emerald-800 py-3 font-medium text-white transition-colors hover:bg-emerald-900 disabled:bg-stone-400"
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

        </div>
      </aside>
    </div>
  )
}