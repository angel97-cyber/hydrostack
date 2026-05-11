// app/(app)/projects/[id]/report/page.tsx
// Day 11 · Module 09 — DFS Report download page.
// Server component renders module-completion checklist + handoff to a
// client button that streams the DOCX.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DownloadButton } from './download-button'

const MODULES: { key: string; label: string; chapter: string; required?: boolean }[] = [
  { key: 'hydrology', label: 'Hydrology', chapter: 'Chapter 2' },
  { key: 'intake', label: 'Intake & Settling Basin', chapter: 'Chapter 3' },
  { key: 'headrace', label: 'Headrace & Forebay', chapter: 'Chapter 4' },
  { key: 'penstock', label: 'Penstock', chapter: 'Chapter 5' },
  { key: 'anchorblock', label: 'Anchor Block', chapter: 'Chapter 6' },
  { key: 'powerhouse', label: 'Powerhouse & Turbine', chapter: 'Chapter 7' },
  { key: 'energy', label: 'Annual Energy', chapter: 'Chapter 8' },
  { key: 'financial', label: 'Financial Model', chapter: 'Chapter 9', required: true },
]

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Confirmed-safe columns only (per Days 1–10 learnings)
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name, river, district, capacity_kw, standard, status')
    .eq('id', id)
    .single()

  if (projectError || !project) notFound()

  const { data: moduleRows } = await supabase
    .from('project_modules')
    .select('module')
    .eq('project_id', id)

  const completed = new Set((moduleRows ?? []).map((r) => r.module))
  const completedCount = MODULES.filter((m) => completed.has(m.key)).length
  const financialReady = completed.has('financial')

  return (
    <div className="min-h-screen bg-stone-50 px-6 py-10 md:px-12">
      <div className="mx-auto max-w-4xl">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm">
          <Link
            href={`/projects/${project.id}`}
            className="text-stone-500 hover:text-stone-900"
          >
            ← Back to {project.name}
          </Link>
        </nav>

        {/* Header */}
        <header className="mb-10 border-b border-stone-200 pb-6">
          <p className="font-mono text-xs uppercase tracking-wider text-stone-500">
            Module 09
          </p>
          <h1 className="mt-1 font-serif text-4xl text-stone-900">
            Detailed Feasibility Study Report
          </h1>
          <p className="mt-3 max-w-2xl text-stone-600">
            Generates a complete{' '}
            <span className="font-medium">AEPC DFS 2014 format</span> Word
            document (~60–80 pages) from the data you have already saved across
            the eight design modules. Open in Word, add your firm letterhead, PE
            stamp, and site photos, then submit to AEPC / DoED / lender.
          </p>
        </header>

        {/* Project summary */}
        <section className="mb-8 rounded-md border border-stone-200 bg-white p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <h2 className="font-serif text-2xl text-stone-900">
                {project.name}
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                {project.river ? `${project.river} River` : '—'}
                {project.district ? ` · ${project.district}` : ''}
              </p>
            </div>
            {project.capacity_kw != null && (
              <p className="font-mono text-sm text-stone-700">
                {Number(project.capacity_kw).toFixed(1)} kW
              </p>
            )}
          </div>
        </section>

        {/* Module completion checklist */}
        <section className="mb-8 rounded-md border border-stone-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-xl text-stone-900">
              Module completion
            </h2>
            <span className="font-mono text-sm text-stone-500">
              {completedCount} / {MODULES.length}
            </span>
          </div>

          <ul className="divide-y divide-stone-100">
            {MODULES.map((m) => {
              const done = completed.has(m.key)
              return (
                <li
                  key={m.key}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={[
                        'flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold',
                        done
                          ? 'bg-emerald-600 text-white'
                          : m.required
                            ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-400'
                            : 'bg-stone-100 text-stone-400',
                      ].join(' ')}
                    >
                      {done ? '✓' : m.required ? '!' : '·'}
                    </span>
                    <div>
                      <p
                        className={[
                          'text-sm',
                          done ? 'text-stone-900' : 'text-stone-500',
                        ].join(' ')}
                      >
                        {m.label}
                        {m.required && !done && (
                          <span className="ml-2 font-mono text-xs text-amber-700">
                            REQUIRED
                          </span>
                        )}
                      </p>
                      <p className="font-mono text-xs text-stone-400">
                        {m.chapter}
                      </p>
                    </div>
                  </div>
                  {!done && (
                    <Link
                      href={`/projects/${project.id}`}
                      className="text-xs text-stone-500 underline-offset-2 hover:text-stone-900 hover:underline"
                    >
                      complete →
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        {/* Required-module warning */}
        {!financialReady && (
          <div className="mb-8 rounded-md border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">
              The Financial Model module is required.
            </p>
            <p className="mt-1">
              Without saved financial outputs (CapEx, IRR, NPV, cashflows),
              Chapter 9 and the lender checklist cannot be produced. Other
              missing modules will render as styled placeholders for the
              engineer to complete in Word.
            </p>
          </div>
        )}

        {/* Download */}
        <section className="mb-8 rounded-md border border-stone-200 bg-white p-6">
          <h2 className="font-serif text-xl text-stone-900">
            Generate &amp; download
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            The report is built on every download — it always reflects your
            most recently saved module data. Expected size: roughly 60–80
            pages, A4. After opening in Word, right-click the Table of Contents
            and choose <em>Update Field</em> to populate page numbers.
          </p>

          <div className="mt-6">
            <DownloadButton
              projectId={project.id}
              projectName={project.name}
              disabled={!financialReady}
            />
          </div>
        </section>

        {/* What's inside */}
        <section className="rounded-md border border-stone-200 bg-white p-6">
          <h2 className="font-serif text-xl text-stone-900">
            What&apos;s in the report
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Per AEPC DFS 2014 §9.2 — Volume I main report format.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-stone-700">
            <li>• Cover page, salient features table, table of contents</li>
            <li>• Chapter 1 — Introduction &amp; background</li>
            <li>• Chapter 2 — Hydrology (FDC, design discharge, riparian, flood)</li>
            <li>• Chapter 3 — Intake &amp; settling basin</li>
            <li>• Chapter 4 — Headrace &amp; forebay</li>
            <li>• Chapter 5 — Penstock (IS 11639 / IS 5330 / IS 11625)</li>
            <li>• Chapter 6 — Anchor blocks (12 IS 5330 forces, 3 stability checks)</li>
            <li>• Chapter 7 — Powerhouse &amp; electromechanical</li>
            <li>• Chapter 8 — Energy generation (12-month table)</li>
            <li>• Chapter 9 — Financial analysis (BoQ, cashflow, sensitivity, lender checklist)</li>
            <li>• Chapter 10 — Conclusions &amp; recommendations</li>
            <li>• Annex A — One-page parameters summary</li>
            <li>• Annex B — Full 30-year cashflow (landscape)</li>
          </ul>
        </section>
      </div>
    </div>
  )
}