'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  calcAnchorBlock,
  buildForceTable,
  ANCHORBLOCK_DEFAULTS,
  FOUNDATION_FRICTION,
  FOUNDATION_LABELS,
  type AnchorBlockInputs,
  type FoundationType,
  type ConcreteType,
  type BendPlane,
} from '@/lib/calc/anchorblock'

interface UpstreamProps {
  diameterMm: number
  externalDiameterMm: number
  tCommercialMm: number
  designHeadM: number
  flowM3s: number
  pipeSlopeAngleDeg: number
}

interface AnchorBlockFormProps {
  projectId: string
  upstream: UpstreamProps
  saved: Partial<AnchorBlockInputs> | null
}

export default function AnchorBlockForm({ projectId, upstream, saved }: AnchorBlockFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)

  // Initial inputs: defaults overridden by saved, with upstream NEVER overridden by saved
  // (upstream is single source of truth — comes from penstock module).
  // CRITICAL: never duplicate keys in literal — spread saved BEFORE upstream override.
  const initial: AnchorBlockInputs = {
    ...ANCHORBLOCK_DEFAULTS,
    ...(saved ?? {}),
    diameterMm: upstream.diameterMm,
    externalDiameterMm: upstream.externalDiameterMm,
    tCommercialMm: upstream.tCommercialMm,
    designHeadM: upstream.designHeadM,
    flowM3s: upstream.flowM3s,
    pipeSlopeAngleDeg: upstream.pipeSlopeAngleDeg,
  }

  const [inputs, setInputs] = useState<AnchorBlockInputs>(initial)

  // Upstream-sync via useMemo overlay — NEVER setState in useEffect (Day 5/6 lesson)
  const effectiveInputs: AnchorBlockInputs = useMemo(
    () => ({
      ...inputs,
      diameterMm: upstream.diameterMm,
      externalDiameterMm: upstream.externalDiameterMm,
      tCommercialMm: upstream.tCommercialMm,
      designHeadM: upstream.designHeadM,
      flowM3s: upstream.flowM3s,
      pipeSlopeAngleDeg: upstream.pipeSlopeAngleDeg,
    }),
    [inputs, upstream.diameterMm, upstream.externalDiameterMm, upstream.tCommercialMm, upstream.designHeadM, upstream.flowM3s, upstream.pipeSlopeAngleDeg],
  )

  // Real-time recalculation
  const out = useMemo(() => calcAnchorBlock(effectiveInputs), [effectiveInputs])
  const forceTable = useMemo(() => buildForceTable(out), [out])

  // Auto-fill foundation friction when foundation type changes (UI hint)
  const muFoundation = FOUNDATION_FRICTION[effectiveInputs.foundationType]

  function update<K extends keyof AnchorBlockInputs>(key: K, value: AnchorBlockInputs[K]) {
    setSavedOk(false)
    setInputs((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setSavedOk(false)
    try {
      const { error } = await supabase.from('project_modules').upsert(
        {
          project_id: projectId,
          module: 'anchorblock',
          inputs: effectiveInputs as unknown as Record<string, unknown>,
          outputs: out as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'project_id,module' },
      )
      if (error) throw error
      setSavedOk(true)
      router.refresh()
      setTimeout(() => setSavedOk(false), 2500)
    } catch (e) {
      console.error('Save failed', e)
      alert(`Save failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  // -- Helpers for UI --
  const fmtN = (n: number, p = 1) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(p)} kN` : `${n.toFixed(0)} N`)
  const fmtKN = (n: number, p = 1) => `${(n / 1000).toFixed(p)}`

  const slidingFosTone =
    out.worstFosSliding >= 1.5
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : out.worstFosSliding >= 1.0
        ? 'text-amber-700 bg-amber-50 border-amber-300'
        : 'text-red-700 bg-red-50 border-red-300'

  const overFosTone =
    out.worstFosOverturning >= 1.5
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : out.worstFosOverturning >= 1.0
        ? 'text-amber-700 bg-amber-50 border-amber-300'
        : 'text-red-700 bg-red-50 border-red-300'

  const bearingFosTone =
    out.worstFosBearing >= 2.0
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : out.worstFosBearing >= 1.0
        ? 'text-amber-700 bg-amber-50 border-amber-300'
        : 'text-red-700 bg-red-50 border-red-300'

  return (
    <div className="space-y-10">
      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* §1 — Pipe (read-only, from Penstock module) */}
      <section>
        <SectionHeader marker="§1" title="Pipe parameters" sub="From Penstock module — read-only" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
          <ReadField label="Internal diameter d" value={effectiveInputs.diameterMm.toString()} unit="mm" />
          <ReadField label="External diameter D_o" value={effectiveInputs.externalDiameterMm.toString()} unit="mm" />
          <ReadField label="Wall thickness t" value={effectiveInputs.tCommercialMm.toString()} unit="mm" />
          <ReadField label="Design head H (incl. surge)" value={effectiveInputs.designHeadM.toFixed(1)} unit="m" />
          <ReadField label="Design flow Q" value={effectiveInputs.flowM3s.toFixed(3)} unit="m³/s" />
          <ReadField label="Velocity V = Q/A" value={out.velocityMs.toFixed(2)} unit="m/s" />
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* §2 — Bend geometry */}
      <section>
        <SectionHeader marker="§2" title="Bend geometry" sub="IS 5330:1984 §2 notation, AEPC DFS 2014 §3.3.6" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mb-4">
          <SelectField
            label="Bend plane"
            value={effectiveInputs.bendPlane}
            onChange={(v) => update('bendPlane', v as BendPlane)}
            options={[
              { value: 'vertical', label: 'Vertical (profile bend)' },
              { value: 'horizontal', label: 'Horizontal (plan bend)' },
            ]}
            hint={effectiveInputs.bendPlane === 'vertical' ? 'Δ = |α_u − α_d|' : 'Enter Δ directly'}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
          <NumberField
            label="α_u  upstream slope angle"
            value={effectiveInputs.alphaUDeg}
            onChange={(v) => update('alphaUDeg', v)}
            unit="deg"
            min={0}
            max={89}
            step={0.5}
          />
          <NumberField
            label="α_d  downstream slope angle"
            value={effectiveInputs.alphaDDeg}
            onChange={(v) => update('alphaDDeg', v)}
            unit="deg"
            min={0}
            max={89}
            step={0.5}
          />
          <NumberField
            label="Δ  deflection at bend"
            value={effectiveInputs.bendPlane === 'vertical' ? Math.abs(effectiveInputs.alphaUDeg - effectiveInputs.alphaDDeg) : effectiveInputs.deflectionAngleDeg}
            onChange={(v) => update('deflectionAngleDeg', v)}
            unit="deg"
            min={0}
            max={180}
            step={0.5}
            disabled={effectiveInputs.bendPlane === 'vertical'}
          />
          <NumberField
            label="L_u  anchor → uphill EJ"
            value={effectiveInputs.lengthUphillM}
            onChange={(v) => update('lengthUphillM', v)}
            unit="m"
            min={1}
            step={0.5}
          />
          <NumberField
            label="L_d  anchor → downhill EJ"
            value={effectiveInputs.lengthDownhillM}
            onChange={(v) => update('lengthDownhillM', v)}
            unit="m"
            min={1}
            step={0.5}
          />
          <NumberField
            label="L_pu  anchor → uphill pier"
            value={effectiveInputs.lengthToPierUphillM}
            onChange={(v) => update('lengthToPierUphillM', v)}
            unit="m"
            min={0.5}
            step={0.5}
            hint="AHEC §11.6 typical 5–6 m"
          />
          <NumberField
            label="L_pd  anchor → downhill pier"
            value={effectiveInputs.lengthToPierDownhillM}
            onChange={(v) => update('lengthToPierDownhillM', v)}
            unit="m"
            min={0.5}
            step={0.5}
          />
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* §3 — Block & foundation */}
      <section>
        <SectionHeader marker="§3" title="Block dimensions & foundation" sub="IS 5330:1984 §6, §7" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mb-4">
          <SelectField
            label="Concrete type"
            value={effectiveInputs.concreteType}
            onChange={(v) => update('concreteType', v as ConcreteType)}
            options={[
              { value: 'plain', label: 'Plain concrete (ρ = 2400 kg/m³)' },
              { value: 'plum', label: 'Plum concrete (ρ = 2300 kg/m³)' },
            ]}
          />
          <SelectField
            label="Foundation type"
            value={effectiveInputs.foundationType}
            onChange={(v) => update('foundationType', v as FoundationType)}
            options={(Object.keys(FOUNDATION_LABELS) as FoundationType[]).map((k) => ({
              value: k,
              label: `${FOUNDATION_LABELS[k]} (μ = ${FOUNDATION_FRICTION[k]})`,
            }))}
            hint={`IS 5330 §7.2: μ = ${muFoundation}`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
          <NumberField
            label="L  block length (along pipe)"
            value={effectiveInputs.blockLengthM}
            onChange={(v) => update('blockLengthM', v)}
            unit="m"
            min={0.5}
            step={0.1}
          />
          <NumberField
            label="W  block width"
            value={effectiveInputs.blockWidthM}
            onChange={(v) => update('blockWidthM', v)}
            unit="m"
            min={0.5}
            step={0.1}
          />
          <NumberField
            label="H  block height"
            value={effectiveInputs.blockHeightM}
            onChange={(v) => update('blockHeightM', v)}
            unit="m"
            min={0.5}
            step={0.1}
          />
          <NumberField
            label="Bend height above base"
            value={effectiveInputs.bendHeightAboveBaseM}
            onChange={(v) => update('bendHeightAboveBaseM', v)}
            unit="m"
            min={0.1}
            step={0.1}
            hint="Typical 0.6 · H_block (mid-height of block)"
          />
          <NumberField
            label="q_allow  allowable bearing"
            value={effectiveInputs.allowableBearingKpa}
            onChange={(v) => update('allowableBearingKpa', v)}
            unit="kPa"
            min={50}
            step={10}
            hint="Confirm by tests (IS 1904)"
          />
          <NumberField
            label="f  saddle friction coefficient"
            value={effectiveInputs.saddleFrictionCoeff}
            onChange={(v) => update('saddleFrictionCoeff', v)}
            unit="—"
            min={0.1}
            max={1.0}
            step={0.05}
            hint="IS 5330 §5.5: 0.6 steel/concrete"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4 mt-4">
          <NumberField
            label="μ  packing friction coefficient"
            value={effectiveInputs.packingFrictionCoeff}
            onChange={(v) => update('packingFrictionCoeff', v)}
            unit="—"
            min={0.1}
            max={0.5}
            step={0.01}
            hint="IS 5330 §5.5.1: 0.26"
          />
          <NumberField
            label="e  EJ packing length"
            value={effectiveInputs.packingLengthM}
            onChange={(v) => update('packingLengthM', v)}
            unit="m"
            min={0.02}
            max={0.2}
            step={0.005}
            hint="Typical 50 mm = 0.05 m"
          />
        </div>

        {/* Reducer (collapsed by default — usually 0 for Mini-HP) */}
        <details className="mt-4 border border-stone-200 rounded p-3 bg-stone-50">
          <summary className="cursor-pointer text-stone-700 font-medium">
            Reducer at anchor (optional — leave 0 for no reducer)
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-3">
            <NumberField
              label="A′  pipe area above reducer"
              value={effectiveInputs.reducerAreaUphillM2}
              onChange={(v) => update('reducerAreaUphillM2', v)}
              unit="m²"
              min={0}
              step={0.001}
              hint="0 = no reducer uphill"
            />
            <NumberField
              label="A″  pipe area below reducer"
              value={effectiveInputs.reducerAreaDownhillM2}
              onChange={(v) => update('reducerAreaDownhillM2', v)}
              unit="m²"
              min={0}
              step={0.001}
              hint="0 = no reducer downhill"
            />
          </div>
        </details>
      </section>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* §4 — Forces (IS 5330 §5.1) */}
      <section>
        <SectionHeader marker="§4" title="Force components" sub="IS 5330:1984 §5.1 — twelve loads acting on the anchor" />

        <div className="border border-stone-300 rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-100 border-b border-stone-300">
              <tr>
                <th className="px-3 py-2 text-left font-mono text-stone-700">Symbol</th>
                <th className="px-3 py-2 text-left text-stone-700">Description</th>
                <th className="px-3 py-2 text-right text-stone-700">Magnitude</th>
                <th className="px-3 py-2 text-left text-stone-700">Standard</th>
              </tr>
            </thead>
            <tbody>
              {forceTable.map((f, i) => (
                <tr key={f.symbol} className={i % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
                  <td className="px-3 py-2 font-mono text-stone-900 font-semibold">{f.symbol}</td>
                  <td className="px-3 py-2 text-stone-700">{f.label}</td>
                  <td className="px-3 py-2 text-right font-mono text-stone-900">{fmtN(f.magnitudeN, 2)}</td>
                  <td className="px-3 py-2 text-stone-600 text-xs font-mono">{f.citation}</td>
                </tr>
              ))}
              <tr className="bg-stone-200 border-t-2 border-stone-400 font-semibold">
                <td className="px-3 py-2 font-mono text-stone-900">R_bend</td>
                <td className="px-3 py-2 text-stone-700">Bend resultant: 2·F_s·sin(Δ/2) + F_d</td>
                <td className="px-3 py-2 text-right font-mono text-stone-900">{fmtN(out.bendResultantN, 1)}</td>
                <td className="px-3 py-2 text-stone-600 text-xs font-mono">IS 5330 §5.1(a,b)</td>
              </tr>
              <tr className="bg-stone-50">
                <td className="px-3 py-2 font-mono text-stone-900">W_block</td>
                <td className="px-3 py-2 text-stone-700">Block self-weight ({(out.blockVolumeM3).toFixed(2)} m³)</td>
                <td className="px-3 py-2 text-right font-mono text-stone-900">{fmtN(out.blockSelfWeightN, 1)}</td>
                <td className="px-3 py-2 text-stone-600 text-xs font-mono">ρ_c · L · W · H · g</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 text-xs">
          <div className="border border-stone-200 rounded p-3 bg-stone-50">
            <div className="text-stone-500 font-mono">f′ = 1.5·μ·w·H·e</div>
            <div className="font-mono text-stone-900">{fmtKN(out.fPrimeNm, 1)} kN/m</div>
          </div>
          <div className="border border-stone-200 rounded p-3 bg-stone-50">
            <div className="text-stone-500 font-mono">Bisector outward</div>
            <div className="font-mono text-stone-900">({out.bisectorOutwardX.toFixed(3)}, {out.bisectorOutwardY.toFixed(3)})</div>
          </div>
          <div className="border border-stone-200 rounded p-3 bg-stone-50">
            <div className="text-stone-500 font-mono">Kern limit  L/6</div>
            <div className="font-mono text-stone-900">±{out.kernLimitM.toFixed(3)} m</div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* §5 — Stability — both conditions */}
      <section>
        <SectionHeader marker="§5" title="Stability — IS 5330 §7" sub="Expanding and contracting conditions per Fig. 3 (forces 5–12 reverse direction). Worst case governs." />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {(['expanding', 'contracting'] as const).map((cond) => {
            const r = out[cond]
            return (
              <div key={cond} className="border border-stone-300 rounded-lg overflow-hidden bg-white">
                <div className="bg-stone-900 text-stone-50 px-4 py-2 font-mono text-sm font-semibold">
                  {r.conditionLabel}
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    <Row label="ΣF_x  horizontal" value={fmtKN(r.sumX_N, 2)} unit="kN" />
                    <Row label="ΣF_y  vertical (incl. block)" value={fmtKN(r.sumY_N, 2)} unit="kN" />
                    <Row label="|R|  resultant" value={fmtKN(r.resultantN, 1)} unit="kN" />
                    <Row label="M  about base centroid" value={fmtKN(r.momentAboutBaseCentroidNm, 2)} unit="kN·m" />
                    <Row label="e  eccentricity" value={r.eccentricityM.toFixed(3)} unit="m" />
                    <Row label="|e|/kern" value={r.eccentricityRatio.toFixed(3)} unit={r.withinKern ? '✓ within' : '✗ outside'} />
                    <Row label="Sliding factor (ΣH/ΣV)" value={r.slidingFactor.toFixed(3)} unit={`(μ = ${muFoundation})`} />
                    <Row label="σ_max  bearing" value={r.bearingMaxKpa.toFixed(1)} unit="kPa" />
                    <Row label="σ_min  bearing" value={r.bearingMinKpa.toFixed(1)} unit="kPa" />
                    <Row label="θ  resultant ground angle" value={r.resultantGroundAngleDeg.toFixed(1)} unit="deg" />
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>

        {/* Governing FoS panel */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FosTile
            tone={slidingFosTone}
            label="Sliding"
            value={out.worstFosSliding}
            target="≥ 1.5"
            governing={out.governingSlidingCondition}
            citation="IS 5330 §7.2"
          />
          <FosTile
            tone={overFosTone}
            label="Overturning (kern)"
            value={out.worstFosOverturning}
            target="≥ 1.5"
            governing={out.governingOverturningCondition}
            citation="IS 5330 §7.3"
          />
          <FosTile
            tone={bearingFosTone}
            label="Bearing"
            value={out.worstFosBearing}
            target="≥ 2.0"
            governing={out.governingBearingCondition}
            citation="IS 5330 §7.1"
          />
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* §6 — Warnings */}
      {out.warnings.length > 0 && (
        <section>
          <SectionHeader marker="§6" title="Design checks & advisories" />
          <div className="space-y-2">
            {out.warnings.map((w, i) => (
              <Warning key={i} severity={w.severity} message={w.message} />
            ))}
          </div>
        </section>
      )}

      {/* Save */}
      <div className="flex justify-end pt-6 border-t border-stone-200">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-stone-900 hover:bg-stone-800 disabled:bg-stone-400 text-stone-50 px-6 py-2.5 rounded font-medium flex items-center gap-2 transition-colors"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Saving…
            </>
          ) : savedOk ? (
            <>
              <CheckCircle2 className="w-4 h-4" /> Saved
            </>
          ) : (
            <>Save module</>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Reusable UI primitives ───────────────────────────────────────────────────

function SectionHeader({ marker, title, sub }: { marker: string; title: string; sub?: string }) {
  return (
    <div className="mb-4 pb-2 border-b border-stone-300">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-stone-500 text-sm">{marker}</span>
        <h2 className="text-2xl font-display text-stone-900">{title}</h2>
      </div>
      {sub && <p className="text-sm text-stone-600 mt-1 ml-8">{sub}</p>}
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step,
  hint,
  disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  unit: string
  min?: number
  max?: number
  step?: number
  hint?: string
  disabled?: boolean
}) {
  return (
    <label className="flex flex-col">
      <span className="text-sm text-stone-700 mb-1 flex items-center gap-2">
        {label} <span className="font-mono text-xs text-stone-500">[{unit}]</span>
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="border border-stone-300 rounded px-3 py-1.5 text-sm font-mono bg-white disabled:bg-stone-100 disabled:text-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
      />
      {hint && <span className="text-xs text-stone-500 mt-0.5 font-mono">{hint}</span>}
    </label>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  hint?: string
}) {
  return (
    <label className="flex flex-col">
      <span className="text-sm text-stone-700 mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-stone-300 rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="text-xs text-stone-500 mt-0.5 font-mono">{hint}</span>}
    </label>
  )
}

function ReadField({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-sm text-stone-700 mb-1 flex items-center gap-2">
        {label} <span className="font-mono text-xs text-stone-500">[{unit}]</span>
      </span>
      <div className="border border-stone-200 rounded px-3 py-1.5 text-sm font-mono bg-stone-50 text-stone-700">{value}</div>
    </div>
  )
}

function Row({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <tr className="border-b border-stone-100 last:border-b-0">
      <td className="px-4 py-2 text-stone-700 text-sm">{label}</td>
      <td className="px-4 py-2 font-mono text-right text-stone-900">{value}</td>
      <td className="px-4 py-2 font-mono text-xs text-stone-500 w-24">{unit}</td>
    </tr>
  )
}

function FosTile({
  tone,
  label,
  value,
  target,
  governing,
  citation,
}: {
  tone: string
  label: string
  value: number
  target: string
  governing: string
  citation: string
}) {
  return (
    <div className={`border-2 rounded-lg p-4 ${tone}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-lg">{label}</h3>
        <span className="font-mono text-xs">{citation}</span>
      </div>
      <div className="font-mono text-3xl font-bold mb-1">
        FoS = {value > 99 ? '∞' : value.toFixed(2)}
      </div>
      <div className="text-xs font-mono opacity-80">
        target {target} · governing: {governing}
      </div>
    </div>
  )
}

function Warning({ severity, message }: { severity: 'error' | 'warn' | 'info'; message: string }) {
  const tone =
    severity === 'error'
      ? 'border-red-300 bg-red-50 text-red-800'
      : severity === 'warn'
        ? 'border-amber-300 bg-amber-50 text-amber-800'
        : 'border-stone-300 bg-stone-50 text-stone-700'
  const Icon = severity === 'error' ? AlertCircle : severity === 'warn' ? AlertTriangle : Info
  return (
    <div className={`border rounded p-3 flex items-start gap-2 text-sm ${tone}`}>
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  )
}