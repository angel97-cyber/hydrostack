// ════════════════════════════════════════════════════════════════════════════
//  GET /projects/[id]/report/generate
//
//  Builds the AEPC DFS 2014 report as a Word document and streams it back.
//
//  Auth, project lookup, and module fetch as before. NEW for Day 12: also
//  fetch the engineer profile so the cover page can show real preparer
//  details instead of the [INSERT: …] placeholder.
//
//  Debug mode (?debug=1) returns the raw module JSONB without building
//  the doc — keep this for inspecting actual DB keys when modules drift.
// ════════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { Packer } from 'docx'
import { createClient } from '@/lib/supabase/server'
import {
  buildDfsReport,
  type ModuleMap,
  type ProjectRow,
  type EngineerProfile,
} from '@/lib/report/dfs-builder'
import { shouldWatermark } from '@/lib/billing/plans'

export const runtime = 'nodejs' // docx + Buffer require Node runtime
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const url = new URL(request.url)
  const debugMode = url.searchParams.get('debug') === '1'

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
      { status: 500 },
    )
  }

  const mods: ModuleMap = new Map()
  for (const row of moduleRows ?? []) {
    mods.set(row.module, {
      inputs: row.inputs ?? {},
      outputs: row.outputs ?? {},
    })
  }

  // ─── Engineer profile (cover-page metadata) ───
  // Profile row is auto-created by the on_auth_user_created trigger. We
  // tolerate a missing row in case the migration hasn't been applied yet —
  // the builder falls back to the [INSERT: …] placeholder.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, firm_name, nec_reg_no, designation, plan')
    .eq('id', user.id)
    .maybeSingle()

  const engineerProfile: EngineerProfile = profile ?? null
  const watermark = shouldWatermark(profile?.plan ?? 'beta')

  // ─── Debug mode — return raw DB shape, no doc build ───
  if (debugMode) {
    return NextResponse.json(
      {
        project,
        engineerProfile,
        modules: Object.fromEntries(mods),
        availableModuleKeys: Array.from(mods.keys()),
      },
      { status: 200 },
    )
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
      { status: 400 },
    )
  }

  // ─── Build & stream ───
  let buffer: Buffer
  try {
    const doc = buildDfsReport(project, mods, engineerProfile, watermark)
    buffer = await Packer.toBuffer(doc)
  } catch (err: unknown) {
    console.error('[report] DFS build failed:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Report generation failed: ' + message },
      { status: 500 },
    )
  }

  const safeName = (project.name || 'project')
    .replace(/[^\w\-]+/g, '_')
    .slice(0, 60)
  const filename = `${safeName}-DFS-AEPC2014.docx`

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}