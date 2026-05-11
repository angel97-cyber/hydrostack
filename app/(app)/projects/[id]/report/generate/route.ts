// app/(app)/projects/[id]/report/route.ts
// Day 11 · Module 09 — DFS Report Generator
// GET /projects/[id]/report → streams a complete AEPC DFS 2014 format DOCX.
//
// Lives inside the (app) route group so the Supabase session middleware
// applies. Returns 401 if no session, 404 if project not found, 400 if
// the financial module has not yet been saved (it is required to produce
// a meaningful report — see Day 11 master prompt).

import { NextResponse } from 'next/server'
import { Packer } from 'docx'
import { createClient } from '@/lib/supabase/server'
import { buildDfsReport, type ModuleMap, type ProjectRow } from '@/lib/report/dfs-builder'

export const runtime = 'nodejs' // docx + Buffer require Node runtime
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const debugMode = new URL(request.url).searchParams.get('debug') === '1'
  const supabase = await createClient()

  // ─── Auth ───
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // ─── Project (only confirmed-safe columns) ───
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name, river, district, capacity_kw, standard, status')
    .eq('id', id)
    .single<ProjectRow>()

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // ─── Module rows ───
  const { data: moduleRows, error: modulesError } = await supabase
    .from('project_modules')
    .select('module, inputs, outputs')
    .eq('project_id', id)

  if (modulesError) {
    return NextResponse.json(
      { error: 'Failed to load project modules: ' + modulesError.message },
      { status: 500 }
    )
  }

  // ── DEBUG MODE ── visit ?debug=1 in your browser to see exact DB contents
  if (debugMode) {
    return NextResponse.json({
      project: project.name,
      modules: (moduleRows ?? []).map(row => ({
        module:          row.module,
        inputs_keys:     Object.keys(row.inputs  ?? {}).length,
        outputs_keys:    Object.keys(row.outputs ?? {}).length,
        inputs_sample:   Object.keys(row.inputs  ?? {}).slice(0, 8),
        outputs_sample:  Object.keys(row.outputs ?? {}).slice(0, 8),
        inputs_raw:      row.inputs  ?? null,
        outputs_raw:     row.outputs ?? null,
      })),
    })
  }

  const mods: ModuleMap = new Map()
  for (const row of moduleRows ?? []) {
    const inputs     = (row.inputs  ?? {}) as Record<string, unknown>
    const rawOutputs = (row.outputs ?? {}) as Record<string, unknown>
    const outputsCount = Object.keys(rawOutputs).length
    const inputsCount  = Object.keys(inputs).length

    console.log(
      `[DFS] module=${row.module} ` +
      `outputs_keys=${outputsCount} inputs_keys=${inputsCount} ` +
      `first_output=${Object.keys(rawOutputs)[0] ?? 'NONE'} ` +
      `first_input=${Object.keys(inputs)[0] ?? 'NONE'}`
    )

    // Fallback: if outputs is empty, use inputs (older modules stored
    // computed values under inputs rather than outputs)
    const outputs = outputsCount > 0 ? rawOutputs : inputs
    mods.set(row.module, { inputs, outputs })
  }

  // ─── Financial gate (required) ───
  const fin = mods.get('financial')
  if (!fin || !fin.outputs || !fin.outputs.capex) {
    return NextResponse.json(
      {
        error:
          'Complete the Financial Model module before generating the report. ' +
          'Without saved financial outputs (CapEx, IRR, NPV, cashflows), ' +
          'Chapter 9 and the lender checklist cannot be produced.',
      },
      { status: 400 }
    )
  }

  // ─── Build & stream ───
  let buffer: Buffer
  try {
    const doc = buildDfsReport(project, mods)
    buffer = await Packer.toBuffer(doc)
  } catch (err: unknown) {
    console.error('[report] DFS build failed:', err)
    const message = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json(
      { error: 'Report generation failed: ' + message },
      { status: 500 }
    )
  }

  const safeName = project.name
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50) || 'project'
  const year = new Date().getFullYear()
  const filename = `DFS_${safeName}_${year}.docx`

  // Use Uint8Array for Web Response body (Next 16 Edge-compatible signature,
  // even though we forced runtime = 'nodejs' for Packer).
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store, max-age=0',
      'Content-Length': String(buffer.length),
    },
  })
}