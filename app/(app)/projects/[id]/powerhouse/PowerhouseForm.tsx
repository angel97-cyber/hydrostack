'use client'

// HydroStack — Module 06: Powerhouse Sizing & Turbine Selection
// app/(app)/projects/[id]/powerhouse/PowerhouseForm.tsx

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  computePowerhouse,
  TURBINE_ENVELOPES,
  type PowerhouseInputs,
  type PowerhouseOutputs,
  type TurbineType,
} from '@/lib/calc/powerhouse'

interface Props {
  projectId: string
  projectName: string
  initial: PowerhouseInputs
}

const fmt = (v: number | undefined, digits = 2): string =>
  v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(digits)

const turbineLabel = (t: TurbineType): string =>
  ({ pelton: 'Pelton', turgo: 'Turgo', crossflow: 'Crossflow', francis: 'Francis' }[t])

// ─── UI primitives ─────────────────────────────────────────────────────────

function Section({ marker, title, subtitle, children }: {
  marker: string; title: string; subtitle?: string; children: React.ReactNode
}) {
  return (
    <section className="mb-10">
      <header className="mb-4 flex items-baseline gap-3 border-b border-stone-200 pb-2">
        <span className="font-mono text-xs text-stone-400">§{marker}</span>
        <h2 className="font-display text-xl text-stone-800">{title}</h2>
        {subtitle && <span className="font-mono text-xs text-stone-400">{subtitle}</span>}
      </header>
      {children}
    </section>
  )
}

function NumField({ label, unit, value, onChange, step = 0.01, min, max, hint, disabled }: {
  label: string; unit: string; value: number
  onChange: (n: number) => void
  step?: number; min?: number; max?: number; hint?: string; disabled?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between">
        <span className="text-sm text-stone-600">{label}</span>
        <span className="font-mono text-xs text-stone-400">[{unit}]</span>
      </span>
      <input
        type="number" step={step} min={min} max={max}
        value={Number.isFinite(value) ? value : ''}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full rounded border border-stone-300 bg-white px-2 py-1.5 font-mono text-sm text-stone-800 focus:border-emerald-600 focus:outline-none disabled:bg-stone-50 disabled:text-stone-400"
      />
      {hint && <span className="mt-0.5 block font-mono text-[11px] text-stone-400">{hint}</span>}
    </label>
  )
}

function ReadOut({ label, value, unit, big }: {
  label: string; value: string; unit: string; big?: boolean
}) {
  return (
    <div className="rounded border border-stone-200 bg-stone-50 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-stone-400">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`font-mono ${big ? 'text-2xl text-emerald-700' : 'text-base text-stone-800'}`}>
          {value}
        </span>
        <span className="font-mono text-xs text-stone-400">{unit}</span>
      </div>
    </div>
  )
}

// ─── Main form ─────────────────────────────────────────────────────────────

export default function PowerhouseForm({ projectId, projectName, initial }: Props) {
  const [inputs, setInputs] = useState<PowerhouseInputs>(initial)
  const [saving, startTransition] = useTransition()
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const router = useRouter()

  const out: PowerhouseOutputs = useMemo(() => computePowerhouse(inputs), [inputs])

  function update<K extends keyof PowerhouseInputs>(key: K, value: PowerhouseInputs[K]) {
    setInputs((p) => ({ ...p, [key]: value }))
  }

  async function handleSave() {
    setSaveError(null)
    startTransition(async () => {
      try {
        const supabase = createClient()
        const { error } = await supabase
          .from('project_modules')
          .upsert(
            {
              project_id: projectId,
              module: 'powerhouse',
              inputs: inputs as unknown as Record<string, unknown>,
              outputs: out as unknown as Record<string, unknown>,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'project_id,module' },
          )
        if (error) throw error
        setSavedAt(new Date())
        router.refresh()
      } catch (e: unknown) {
        setSaveError(e instanceof Error ? e.message : 'Save failed')
      }
    })
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-6xl px-6 py-8">

        {/* Header */}
        <header className="mb-8 border-b border-stone-300 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-xs uppercase tracking-widest text-stone-400">Module 06 · Powerhouse</div>
              <h1 className="font-display text-3xl text-stone-800">Powerhouse Sizing &amp; Turbine Selection</h1>
              <div className="mt-1 font-mono text-xs text-stone-400">
                Project: <span className="text-stone-600">{projectName}</span>
                <span className="mx-2 text-stone-300">·</span>
                AEPC DFS 2014 §3.3.7 / §3.4.7 · AEPC POHV 2008 · AHEC §12 · Reference MH Standard 2014
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              {savedAt && !saveError && (
                <span className="font-mono text-xs text-emerald-600">Saved {savedAt.toLocaleTimeString()}</span>
              )}
              {saveError && <span className="font-mono text-xs text-red-600">⚠ {saveError}</span>}
              <button
                onClick={handleSave}
                disabled={saving || out.errors.length > 0}
                className="rounded bg-stone-800 px-4 py-2 font-mono text-xs uppercase tracking-wide text-stone-50 hover:bg-stone-700 disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save module'}
              </button>
            </div>
          </div>
        </header>

        {/* §1 Hydraulics */}
        <Section marker="1" title="Hydraulics" subtitle="chained from upstream modules — overridable">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <NumField label="Design flow Q" unit="m³/s" value={inputs.qDesignM3s}
              step={0.01} onChange={(n) => update('qDesignM3s', n)} hint="from penstock / hydrology" />
            <NumField label="Gross head H_g" unit="m" value={inputs.hGrossM}
              step={0.1} onChange={(n) => update('hGrossM', n)} hint="from penstock / hydrology" />
            <NumField label="Power factor cos φ" unit="–" value={inputs.powerFactor}
              step={0.01} min={0.5} max={1.0} onChange={(n) => update('powerFactor', n)}
              hint="generator design (typ. 0.85)" />
            <NumField label="Loss · intake + settling" unit="m" value={inputs.hLossIntakeM}
              step={0.01} onChange={(n) => update('hLossIntakeM', n)} />
            <NumField label="Loss · headrace + forebay" unit="m" value={inputs.hLossHeadraceM}
              step={0.01} onChange={(n) => update('hLossHeadraceM', n)} />
            <NumField label="Loss · penstock" unit="m"
              value={parseFloat(inputs.hLossPenstockM.toFixed(3))}
              step={0.01} onChange={(n) => update('hLossPenstockM', n)} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <ReadOut label="Σ losses" value={fmt(out.hydraulics.hLossTotalM)} unit="m" />
            <ReadOut label="Net head H_n" value={fmt(out.hydraulics.hNetM)} unit="m" big />
            <ReadOut label="Hydraulic power ρgQH_n" value={fmt(out.hydraulics.hydraulicPowerKw, 1)} unit="kW" big />
            <ReadOut label="Loss fraction"
              value={fmt((out.hydraulics.hLossTotalM / Math.max(out.hydraulics.hGrossM, 1e-9)) * 100, 1)}
              unit="%" />
          </div>
        </Section>

        {/* §2 Turbine Selection */}
        <Section marker="2" title="Turbine Selection" subtitle="AEPC POHV 2008 envelopes · AEPC DFS 2014 Table 3.2 / 3.4">
          <div className="overflow-x-auto rounded border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-stone-200 bg-stone-100 font-mono text-[11px] uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Envelope (H, Q)</th>
                  <th className="px-3 py-2 text-right">η typical</th>
                  <th className="px-3 py-2 text-right">ns range</th>
                  <th className="px-3 py-2 text-right">Fit margin</th>
                  <th className="px-3 py-2 text-left">Disposition</th>
                  <th className="px-3 py-2 text-center">Use</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {out.candidates.map((c) => {
                  const env = TURBINE_ENVELOPES[c.type]
                  const isSelected = c.type === out.selected
                  return (
                    <tr key={c.type} className={`border-b border-stone-100 ${isSelected ? 'bg-emerald-50' : ''}`}>
                      <td className="px-3 py-2">
                        <span className="font-display text-base text-stone-800">{turbineLabel(c.type)}</span>
                        {c.type === out.primary && (
                          <span className="ml-2 rounded bg-emerald-700 px-1.5 py-0.5 font-mono text-[10px] uppercase text-emerald-50">primary</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-stone-500">
                        H {env.hMin}–{env.hMax} m · Q {env.qMin}–{env.qMax} m³/s
                      </td>
                      <td className="px-3 py-2 text-right text-stone-600">{(c.efficiencyTypical * 100).toFixed(0)} %</td>
                      <td className="px-3 py-2 text-right text-xs text-stone-500">{env.nsMin}–{env.nsMax}</td>
                      <td className="px-3 py-2 text-right">
                        {c.fits
                          ? <span className="text-emerald-700">{(c.fitMargin * 100).toFixed(0)} %</span>
                          : <span className="text-stone-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-stone-500">{c.reason}</td>
                      <td className="px-3 py-2 text-center">
                        <input type="radio" name="turbineSelect" checked={isSelected} disabled={!c.fits}
                          onChange={() => update('turbineOverride', c.type === out.primary ? null : c.type)}
                          className="accent-emerald-700" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-sm text-stone-600">
            <span className="font-display text-stone-800">Recommendation:</span>{' '}
            <span className="font-mono text-emerald-700">{turbineLabel(out.primary)}</span>
            {out.alternatives.length > 0 && (
              <span className="text-stone-400"> · alternatives: {out.alternatives.map(turbineLabel).join(', ')}</span>
            )}
          </div>
          <p className="mt-1 text-xs italic text-stone-500">{out.primaryRationale}</p>
          {inputs.turbineOverride && inputs.turbineOverride !== out.primary && (
            <p className="mt-2 font-mono text-xs text-amber-700">
              ⚠ Override active — using {turbineLabel(inputs.turbineOverride)}.{' '}
              <button onClick={() => update('turbineOverride', null)} className="underline">reset</button>
            </p>
          )}
        </Section>

        {/* §3 Runner Sizing — site-context inputs (Tailwater, Site elevation, Water temperature)
            belong in §4 only. They were previously duplicated here for Francis; that block
            has been removed. §3 contains only computed runner geometry readouts. */}
        <Section marker="3" title="Runner Sizing & Speeds" subtitle={`${turbineLabel(out.selected)} · AEPC DFS 2014 §3.4.7`}>
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <span className="mb-1 flex items-baseline justify-between">
                <span className="text-sm text-stone-600">Generator poles</span>
                <span className="font-mono text-xs text-stone-400">[–]</span>
              </span>
              <select value={inputs.numberOfPoles}
                onChange={(e) => update('numberOfPoles', parseInt(e.target.value))}
                className="w-full rounded border border-stone-300 bg-white px-2 py-1.5 font-mono text-sm text-stone-800 focus:border-emerald-600 focus:outline-none">
                {[2, 4, 6, 8, 10, 12, 14, 16].map((p) => (
                  <option key={p} value={p}>{p}-pole · {(60 * 50 / (p / 2)).toFixed(0)} rpm sync</option>
                ))}
              </select>
              <span className="mt-0.5 block font-mono text-[11px] text-stone-400">50 Hz Nepal grid</span>
            </div>
            <div>
              <span className="mb-1 flex items-baseline justify-between">
                <span className="text-sm text-stone-600">Drive system</span>
                <span className="font-mono text-xs text-stone-400">[–]</span>
              </span>
              <select value={inputs.driveSystem}
                onChange={(e) => update('driveSystem', e.target.value as PowerhouseInputs['driveSystem'])}
                className="w-full rounded border border-stone-300 bg-white px-2 py-1.5 font-mono text-sm text-stone-800 focus:border-emerald-600 focus:outline-none">
                <option value="direct">Direct coupling · η ≈ 0.99</option>
                <option value="vbelt">V-belt · η ≈ 0.95</option>
                <option value="flat-belt">Flat belt · η ≈ 0.93</option>
                <option value="gearbox">Gearbox · η ≈ 0.97</option>
              </select>
              <span className="mt-0.5 block font-mono text-[11px] text-stone-400">AEPC DFS 2014 §3.4.8.3</span>
            </div>
            {(out.selected === 'pelton' || out.selected === 'turgo') && (
              <NumField label="Number of jets" unit="–" value={inputs.numberOfJets}
                step={1} min={1} max={6} onChange={(n) => update('numberOfJets', Math.round(n))}
                hint="horizontal-shaft Pelton: max 2 (AEPC §3.4.7.1)" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ReadOut label="Sync speed (gen)" value={fmt(out.runner.syncSpeedRpm, 0)} unit="rpm" />
            <ReadOut label="Turbine speed" value={fmt(out.runner.turbineSpeedRpm, 0)} unit="rpm" />
            <ReadOut label="Runaway speed" value={fmt(out.runner.runawaySpeedRpm, 0)} unit="rpm" />
            <ReadOut label="Specific speed ns" value={fmt(out.runner.specificSpeedNs, 1)} unit="(metric)" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {(out.selected === 'pelton' || out.selected === 'turgo') && (<>
              <ReadOut label="PCD" value={fmt(out.runner.pcdMm, 0)} unit="mm" big />
              <ReadOut label="Jet diameter" value={fmt(out.runner.jetDiameterMm, 1)} unit="mm" />
              <ReadOut label="Jet velocity" value={fmt(out.runner.jetVelocityMs, 1)} unit="m/s" />
              <ReadOut label="PCD / d_jet" value={fmt(out.runner.pcdJetRatio, 1)} unit="target 10–14" />
            </>)}
            {out.selected === 'crossflow' && (<>
              <ReadOut label="Runner D" value={fmt(out.runner.runnerDiameterMm, 0)} unit="mm" big />
              <ReadOut label="Runner width B" value={fmt(out.runner.runnerWidthMm, 0)} unit="mm" big />
              <ReadOut label="Jet thickness" value={fmt(out.runner.jetThicknessMm, 1)} unit="mm" />
              <ReadOut label="Width safety" value="+20 %" unit="AEPC" />
            </>)}
            {out.selected === 'francis' && (<>
              <ReadOut label="Outlet D₃" value={fmt(out.runner.runnerD3Mm, 0)} unit="mm" big />
              <ReadOut label="Inlet D₁" value={fmt(out.runner.inletDiameterMm, 0)} unit="mm" />
              <ReadOut label="Runner height b" value={fmt(out.runner.runnerHeightBMm, 0)} unit="mm" />
              <ReadOut label="Thoma σ" value={fmt(out.runner.thomaSigma, 4)} unit="–" />
              <ReadOut label="Spiral case A" value={fmt(out.runner.spiralCaseAMm, 0)} unit="mm" />
              <ReadOut label="Spiral case B" value={fmt(out.runner.spiralCaseBMm, 0)} unit="mm" />
              <ReadOut label="Draft tube P" value={fmt(out.runner.draftTubePMm, 0)} unit="mm" />
              <ReadOut label="Setting elevation" value={fmt(out.runner.settingElevationMasl, 2)} unit="m a.s.l." big />
            </>)}
          </div>
        </Section>

        {/* §4 Generator & Powerhouse Layout
            FIX: All four site-context inputs (Tailwater, HFL, Site elevation, Water temperature)
            are in this section only. Francis cavitation duplicate in §3 has been removed.
            Grid changed to md:grid-cols-4 to accommodate four inputs on one row. */}
        <Section marker="4" title="Generator & Powerhouse Layout" subtitle="AHEC §12 · Reference MH Standard 2014 §2.3.1.7">
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <NumField
              label="Tailwater min elev."
              unit="m a.s.l."
              value={inputs.tailwaterMinElevationMasl}
              step={0.5}
              onChange={(n) => update('tailwaterMinElevationMasl', n)}
            />
            <NumField
              label="Design flood level (HFL)"
              unit="m a.s.l."
              value={inputs.designFloodLevelMasl}
              step={0.1}
              onChange={(n) => update('designFloodLevelMasl', n)}
              hint="100-yr (≥30 kW) or 50-yr (<30 kW)"
            />
            <NumField
              label="Site elevation"
              unit="m a.s.l."
              value={inputs.siteElevationMasl}
              step={1}
              onChange={(n) => update('siteElevationMasl', n)}
            />
            <NumField
              label="Water temperature"
              unit="°C"
              value={inputs.waterTemperatureC}
              step={1}
              min={0}
              max={40}
              onChange={(n) => update('waterTemperatureC', n)}
              hint="vapor pressure for Francis cavitation"
            />
          </div>

          <p className="mb-2 font-mono text-xs uppercase tracking-wide text-stone-400">Generator</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ReadOut label="Shaft power" value={fmt(out.generator.shaftPowerKw, 1)} unit="kW" />
            <ReadOut label="Drive η" value={fmt(out.generator.efficiencyDrive * 100, 1)} unit="%" />
            <ReadOut label="Generator η" value={fmt(out.generator.efficiencyGenerator * 100, 1)} unit="%" />
            <ReadOut label="Overall plant η" value={fmt(out.generator.efficiencyOverall * 100, 1)} unit="%" />
            <ReadOut label="Electrical power P_e" value={fmt(out.generator.electricalPowerKw, 1)} unit="kW" big />
            <ReadOut label="Apparent power" value={fmt(out.generator.apparentPowerKva, 1)} unit="kVA" />
            <ReadOut label="Standard generator" value={fmt(out.generator.standardKvaSelected, 0)} unit="kVA" big />
            <ReadOut label="Voltage" value={fmt(out.generator.voltageVoltsLine, 0)} unit="V (line)" />
          </div>

          <p className="mb-2 mt-6 font-mono text-xs uppercase tracking-wide text-stone-400">Powerhouse footprint</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <ReadOut label="Unit bay L" value={fmt(out.powerhouse.unitBayLengthM, 2)} unit="m" />
            <ReadOut label="Unit bay W" value={fmt(out.powerhouse.unitBayWidthM, 2)} unit="m" />
            <ReadOut label="Unit bay area" value={fmt(out.powerhouse.unitBayAreaM2, 1)} unit="m²" />
            <ReadOut label="Service bay" value={fmt(out.powerhouse.serviceBayAreaM2, 1)} unit="m²" />
            <ReadOut label="Control room" value={fmt(out.powerhouse.controlRoomAreaM2, 1)} unit="m²" />
            <ReadOut label="Transformer pad" value={fmt(out.powerhouse.transformerPadAreaM2, 1)} unit="m²" />
            <ReadOut label="Total covered area" value={fmt(out.powerhouse.totalFootprintAreaM2, 1)} unit="m²" big />
            <ReadOut label="Building height" value={fmt(out.powerhouse.buildingHeightM, 2)} unit="m" />
            <ReadOut label="Approach level" value={fmt(out.powerhouse.requiredApproachElevationMasl, 2)} unit="m a.s.l." />
            <ReadOut label="Above HFL" value={`+${fmt(out.powerhouse.approachAboveHflM, 2)}`} unit="m" />
          </div>
        </Section>

        {/* §5 Warnings */}
        <Section marker="5" title="Warnings & Diagnostics">
          {out.errors.length > 0 && (
            <div className="mb-4 rounded border-l-4 border-red-600 bg-red-50 p-3">
              <div className="mb-1 font-mono text-sm text-red-700">Errors — calculation invalid</div>
              <ul className="list-disc space-y-1 pl-5 font-mono text-xs text-red-700">
                {out.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          {out.warnings.length === 0 && out.errors.length === 0 && (
            <div className="rounded border-l-4 border-emerald-600 bg-emerald-50 p-3">
              <div className="font-mono text-sm text-emerald-700">No warnings — design within all standard envelopes.</div>
            </div>
          )}
          {out.warnings.length > 0 && (
            <div className="rounded border-l-4 border-amber-500 bg-amber-50 p-3">
              <div className="mb-2 font-mono text-sm text-amber-700">
                {out.warnings.length} warning{out.warnings.length > 1 ? 's' : ''} — review before DFS submission
              </div>
              <ul className="list-disc space-y-1 pl-5 font-mono text-xs text-amber-700">
                {out.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </Section>

        <footer className="mt-8 border-t border-stone-200 pt-3 text-center font-mono text-[11px] text-stone-400">
          AEPC DFS 2014 §3.3.7 / §3.4.7 · AEPC POHV 2008 · AEPC Reference MH Standard 2014 · AHEC §12 · IS 12800
        </footer>

      </div>
    </div>
  )
}