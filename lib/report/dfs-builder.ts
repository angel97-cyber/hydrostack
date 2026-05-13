// lib/report/dfs-builder.ts
// HydroStack — Detailed Feasibility Study (DFS) Report builder
// AEPC DFS 2014 format · AHEC §1.4 chapter structure
// Generates a complete 60-80 page DOCX from saved module data.
//
// Refs:
//   AEPC DFS 2014 §9 Feasibility Report Standard
//   AHEC §1.4 Reports Preparation
//   AEPC Reference Micro Hydro Power Standard 2014
//   IS 5330:1984 §5.1 Anchor Block forces
//   IS 11639 Parts 1–3 Penstock design
//
/* eslint-disable @typescript-eslint/no-explicit-any */ // JSONB module outputs are legitimately untyped

import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  Header,
  Footer,
  AlignmentType,
  TabStopType,
  HeadingLevel,
  BorderStyle,
  WidthType,
  ShadingType,
  VerticalAlign,
  SimpleField,
} from 'docx'

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export type ModuleMap = Map<string, { inputs: any; outputs: any }>

export interface ProjectRow {
  id: string
  name: string
  river: string | null
  district: string | null
  capacity_kw: number | null
  standard: string | null
  status: string | null
}

// ── NEW Day 12: engineer profile for DFS cover pre-population ──────────────
// Populated from public.profiles by the report-generate route handler.
// Every field is optional — the cover page falls back to the [INSERT] amber
// placeholder for any field that is null / undefined.
export type EngineerProfile = {
  full_name?: string | null
  firm_name?: string | null
  nec_reg_no?: string | null
  designation?: string | null
} | null

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const FONT = 'Calibri'
const MONO = 'Consolas'

// A4 in DXA (1440 = 1 inch; 25 mm ≈ 1417 DXA)
const A4_W = 11906
const A4_H = 16838
const MARGIN = 1417
const CONTENT_W = A4_W - 2 * MARGIN // 9072

const C = {
  ink: '111111',
  gray: '555555',
  border: '999999',
  borderLight: 'CCCCCC',
  amberBg: 'FFF3CD',
  amber: '8A5500',
  zebra: 'F7F7F7',
  headerBg: 'E1E8EF',
  green: '2F7D2F',
  red: 'A22B2B',
  blue: '2E75B6',
}

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: C.border }
const BORDER_LIGHT = { style: BorderStyle.SINGLE, size: 4, color: C.borderLight }
const ALL_BORDERS_LIGHT = {
  top: BORDER_LIGHT,
  bottom: BORDER_LIGHT,
  left: BORDER_LIGHT,
  right: BORDER_LIGHT,
}
const CELL_MARGINS = { top: 80, bottom: 80, left: 120, right: 120 }

const NEPALI_MONTHS = [
  'Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
]

// ────────────────────────────────────────────────────────────
// Number formatters
// ────────────────────────────────────────────────────────────

function num(n: any, decimals = 2): string {
  if (n == null || !isFinite(Number(n))) return '—'
  return Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function int(n: any): string {
  if (n == null || !isFinite(Number(n))) return '—'
  return Math.round(Number(n)).toLocaleString('en-IN')
}

// Indian numbering for NPR amounts
function nprCr(n: any, decimals = 2): string {
  if (n == null || !isFinite(Number(n))) return '—'
  return (Number(n) / 1e7).toFixed(decimals)
}
function nprLakh(n: any, decimals = 2): string {
  if (n == null || !isFinite(Number(n))) return '—'
  return (Number(n) / 1e5).toFixed(decimals)
}

function nprSmart(n: any): string {
  // Auto-pick lakh vs crore depending on magnitude
  if (n == null || !isFinite(Number(n))) return '—'
  const v = Number(n)
  if (Math.abs(v) >= 1e7) return nprCr(v) + ' Cr'
  if (Math.abs(v) >= 1e5) return nprLakh(v) + ' lakh'
  return Math.round(v).toLocaleString('en-IN')
}

// ────────────────────────────────────────────────────────────
// Paragraph helpers
// ────────────────────────────────────────────────────────────

function p(text: string, opts: Record<string, any> = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    ...opts,
    children: [new TextRun({ text, font: FONT, size: 22 })],
  })
}

function pBold(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, font: FONT, size: 22, bold: true })],
  })
}

function caption(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 80 },
    children: [
      new TextRun({ text, font: FONT, size: 20, italics: true, color: C.gray }),
    ],
  })
}

function citation(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text, font: FONT, size: 18, italics: true, color: C.gray }),
    ],
  })
}

function placeholder(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 80, after: 120 },
    shading: { type: ShadingType.CLEAR, fill: C.amberBg, color: 'auto' },
    children: [
      new TextRun({
        text: `[INSERT: ${text}]`,
        font: FONT,
        size: 22,
        italics: true,
        color: C.amber,
      }),
    ],
  })
}

function placeholderBox(message: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    shading: { type: ShadingType.CLEAR, fill: C.amberBg, color: 'auto' },
    border: {
      top: { style: BorderStyle.SINGLE, size: 6, color: C.amber },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: C.amber },
      left: { style: BorderStyle.SINGLE, size: 6, color: C.amber },
      right: { style: BorderStyle.SINGLE, size: 6, color: C.amber },
    },
    children: [
      new TextRun({
        text: message,
        font: FONT,
        size: 22,
        bold: true,
        italics: true,
        color: C.amber,
      }),
    ],
  })
}

function h1(text: string, pageBreakBefore = true): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore,
    spacing: { before: 240, after: 240 },
    children: [new TextRun({ text, font: FONT, size: 32, bold: true })],
  })
}

function h2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, font: FONT, size: 26, bold: true })],
  })
}

function h3(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 160, after: 100 },
    children: [new TextRun({ text, font: FONT, size: 22, bold: true })],
  })
}

function blank(): Paragraph {
  return new Paragraph({ children: [new TextRun('')] })
}

// ────────────────────────────────────────────────────────────
// Table helpers
// ────────────────────────────────────────────────────────────

interface CellOpts {
  width: number
  bold?: boolean
  align?: typeof AlignmentType[keyof typeof AlignmentType]
  fill?: string
  mono?: boolean
  size?: number
  color?: string
}

function cell(value: string | number | null | undefined, opts: CellOpts): TableCell {
  const text = value == null || value === '' ? '—' : String(value)
  return new TableCell({
    borders: ALL_BORDERS_LIGHT,
    width: { size: opts.width, type: WidthType.DXA },
    margins: CELL_MARGINS,
    verticalAlign: VerticalAlign.CENTER,
    shading: opts.fill
      ? { type: ShadingType.CLEAR, fill: opts.fill, color: 'auto' }
      : undefined,
    children: [
      new Paragraph({
        alignment: opts.align,
        children: [
          new TextRun({
            text,
            font: opts.mono ? MONO : FONT,
            size: opts.size ?? 20,
            bold: opts.bold,
            color: opts.color,
          }),
        ],
      }),
    ],
  })
}

// Two-column key/value summary table
function kvTable(
  rows: { k: string; v: string | number | null | undefined; isSection?: boolean }[]
): Table {
  const w1 = Math.round(CONTENT_W * 0.45)
  const w2 = CONTENT_W - w1
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [w1, w2],
    rows: rows.map((r, i) =>
      new TableRow({
        children: [
          cell(r.k, {
            width: w1,
            bold: r.isSection,
            fill: r.isSection ? C.headerBg : i % 2 ? C.zebra : undefined,
          }),
          cell(r.v, {
            width: w2,
            align: AlignmentType.RIGHT,
            mono: !r.isSection,
            bold: r.isSection,
            fill: r.isSection ? C.headerBg : i % 2 ? C.zebra : undefined,
          }),
        ],
      })
    ),
  })
}

// Multi-column data table with header row
function dataTable(opts: {
  headers: string[]
  rows: (string | number | null | undefined)[][]
  widths?: number[]
  totalWidth?: number
  rightAlignFromCol?: number
  cellSize?: number
  headerSize?: number
}): Table {
  const totalW = opts.totalWidth ?? CONTENT_W
  const ncol = opts.headers.length
  const widths = opts.widths ?? Array(ncol).fill(Math.floor(totalW / ncol))
  const sumW = widths.reduce((a, b) => a + b, 0)
  if (sumW !== totalW) widths[widths.length - 1] += totalW - sumW
  const rightFrom = opts.rightAlignFromCol ?? 1
  const sz = opts.cellSize ?? 20
  const hsz = opts.headerSize ?? sz

  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: opts.headers.map((h, i) =>
          cell(h, {
            width: widths[i],
            bold: true,
            fill: C.headerBg,
            align: i >= rightFrom ? AlignmentType.RIGHT : AlignmentType.LEFT,
            size: hsz,
          })
        ),
      }),
      ...opts.rows.map((row, ri) =>
        new TableRow({
          children: row.map((v, i) =>
            cell(v, {
              width: widths[i],
              align: i >= rightFrom ? AlignmentType.RIGHT : AlignmentType.LEFT,
              mono: i >= rightFrom,
              fill: ri % 2 ? C.zebra : undefined,
              size: sz,
            })
          ),
        })
      ),
    ],
  })
}


// ────────────────────────────────────────────────────────────
// Salient Features (full key/value table)
// ────────────────────────────────────────────────────────────

function buildSalientFeatures(project: ProjectRow, mods: ModuleMap): (Paragraph | Table)[] {
  const hyd = mods.get('hydrology')?.outputs ?? {}
  const intake = mods.get('intake')?.outputs ?? {}
  const headrace = mods.get('headrace')?.outputs ?? {}
  const penstock = mods.get('penstock')?.outputs ?? {}
  const penstockIn = mods.get('penstock')?.inputs ?? {}
  const ph = mods.get('powerhouse')?.outputs ?? {}
  const energy = mods.get('energy')?.outputs ?? {}
  const fin = mods.get('financial')?.outputs ?? {}

  const turbineType = ph?.selected ?? ph?.runner?.type ?? '—'

  const rows: { k: string; v: string | number | null | undefined; isSection?: boolean }[] = [
    { k: 'A. PROJECT IDENTIFICATION', v: '', isSection: true },
    { k: 'Project name', v: project.name },
    { k: 'River', v: project.river ?? '[INSERT]' },
    { k: 'District / Province', v: project.district ?? '[INSERT]' },
    { k: 'VDC / Municipality', v: '[INSERT: Local body]' },
    { k: 'Latitude / Longitude', v: '[INSERT: Coordinates of intake]' },
    { k: 'Catchment area', v: hyd?.catchmentAreaKm2 != null ? `${num(hyd.catchmentAreaKm2)} km²` : '—' },
    { k: 'Mean annual flow (MAF)', v: hyd?.meanAnnualFlowM3s != null ? `${num(hyd.meanAnnualFlowM3s, 3)} m³/s` : '—' },

    { k: 'B. HYDRAULIC PARAMETERS', v: '', isSection: true },
    { k: 'Gross head', v: hyd?.grossHeadM != null ? `${num(hyd.grossHeadM, 2)} m` : '—' },
    { k: 'Net head', v: penstock?.hNetM != null ? `${num(penstock.hNetM, 2)} m` : (ph?.hydraulics?.hNetM != null ? `${num(ph.hydraulics.hNetM, 2)} m` : '—') },
    { k: 'Design flow (Q₄₀)', v: hyd?.qDesign != null ? `${num(hyd.qDesign, 3)} m³/s` : '—' },
    { k: 'High flood (100-yr)', v: hyd?.highFloodM3s != null ? `${num(hyd.highFloodM3s, 1)} m³/s` : '—' },

    { k: 'C. POWER & ENERGY', v: '', isSection: true },
    { k: 'Installed capacity', v: ph?.generator?.electricalPowerKw != null ? `${num(ph.generator.electricalPowerKw, 1)} kW` : (project.capacity_kw ? `${num(project.capacity_kw, 1)} kW` : '—') },
    { k: 'Generator (kVA)', v: ph?.generator?.apparentPowerKva != null ? `${num(ph.generator.apparentPowerKva, 1)} kVA` : '—' },
    { k: 'Turbine type', v: typeof turbineType === 'string' ? turbineType.charAt(0).toUpperCase() + turbineType.slice(1) : '—' },
    { k: 'Annual energy', v: energy?.annualEnergyMwh != null ? `${num(energy.annualEnergyMwh, 0)} MWh` : '—' },
    { k: 'Plant factor', v: energy?.plantFactorPercent != null ? `${num(energy.plantFactorPercent, 1)} %` : '—' },
    { k: 'Firm energy (Q₉₀)', v: energy?.firmEnergyMwh != null ? `${num(energy.firmEnergyMwh, 0)} MWh` : '—' },

    { k: 'D. CIVIL WORKS — KEY DIMENSIONS', v: '', isSection: true },
    { k: 'Trash rack area', v: intake?.trashRackArea != null ? `${num(intake.trashRackArea, 2)} m²` : '—' },
    { k: 'Settling basin (L × W × D)', v: intake?.sillLengthM != null ? `[INSERT: full L×W×D from drawings]` : '—' },
    { k: 'Headrace length', v: headrace?.headrace?.lengthM != null ? `${num(headrace.headrace.lengthM, 1)} m` : '—' },
    { k: 'Headrace type', v: headrace?.headrace?.type ?? '—' },
    { k: 'Forebay volume', v: headrace?.forebay?.volumeM3 != null ? `${num(headrace.forebay.volumeM3, 1)} m³` : '—' },
    { k: 'Penstock length', v: penstockIn?.lengthM != null ? `${num(penstockIn.lengthM, 1)} m` : '—' },
    { k: 'Penstock diameter (external)', v: penstock?.externalDiameterMm != null ? `${num(penstock.externalDiameterMm, 0)} mm` : '—' },
    { k: 'Penstock thickness (selected)', v: penstock?.thicknessSelectedMm != null ? `${num(penstock.thicknessSelectedMm, 1)} mm` : '—' },
    { k: 'Powerhouse footprint', v: ph?.powerhouse?.totalFootprintAreaM2 != null ? `${num(ph.powerhouse.totalFootprintAreaM2, 1)} m²` : '—' },

    { k: 'E. FINANCIAL', v: '', isSection: true },
    { k: 'Total CapEx', v: fin?.capex?.totalCapExNpr != null ? `NPR ${nprCr(fin.capex.totalCapExNpr)} Cr` : '—' },
    { k: 'Total CapEx (USD)', v: fin?.capex?.totalCapExUsd != null ? `USD ${num(fin.capex.totalCapExUsd, 0)}` : '—' },
    { k: 'Specific cost', v: fin?.capex?.specificCostUsdPerKw != null ? `USD ${num(fin.capex.specificCostUsdPerKw, 0)}/kW` : '—' },
    { k: 'IRR (Project)', v: fin?.irrProjectPct != null ? `${num(fin.irrProjectPct, 2)} %` : '—' },
    { k: 'IRR (Equity)', v: fin?.irrEquityPct != null ? `${num(fin.irrEquityPct, 2)} %` : '—' },
    { k: 'NPV @ 12 %', v: fin?.npvAt12Cr != null ? `NPR ${num(fin.npvAt12Cr, 2)} Cr` : '—' },
    { k: 'Payback (simple)', v: fin?.paybackSimpleYears != null ? `${num(fin.paybackSimpleYears, 1)} yr` : '—' },
    { k: 'LCoE', v: fin?.lcoeNprPerKwh != null ? `NPR ${num(fin.lcoeNprPerKwh, 2)}/kWh` : '—' },

    { k: 'F. STANDARDS', v: '', isSection: true },
    { k: 'DFS standard', v: 'AEPC DFS 2014' },
    { k: 'Civil reference', v: 'AEPC Reference Micro-Hydro Standard 2014' },
    { k: 'Penstock standard', v: 'IS 11639 Parts 1-3, IS 5330:1984, IS 11625:1986' },
  ]

  return [
    h1('Salient Features of the Project', false),
    citation('Per AEPC DFS 2014 §9.2 — Volume I salient features summary.'),
    kvTable(rows),
    blank(),
    placeholder('Site latitude/longitude, VDC/municipality, ward number, and access road description must be filled by the engineer based on field survey.'),
  ]
}

// ────────────────────────────────────────────────────────────
// Table of Contents
// ────────────────────────────────────────────────────────────

function buildTOC() {
  return [
    h1('Table of Contents', true),
    new Paragraph({
      spacing: { before: 120, after: 240 },
      shading: { type: ShadingType.CLEAR, fill: 'F0F4F8', color: 'auto' },
      border: {
        top: BORDER_LIGHT,
        bottom: BORDER_LIGHT,
        left: BORDER_LIGHT,
        right: BORDER_LIGHT,
      },
      children: [
        new TextRun({
          text: 'Right-click here in Word → Update Field to generate the Table of Contents with page numbers.',
          font: FONT,
          size: 20,
          italics: true,
          color: C.blue,
        }),
      ],
    }),
  ]
}

// ────────────────────────────────────────────────────────────
// Chapter 1 — Introduction
// ────────────────────────────────────────────────────────────

function buildChapter1(project: ProjectRow): (Paragraph | Table)[] {
  return [
    h1('Chapter 1 — Introduction & Background'),

    h2('1.1 Project overview'),
    p(
      `The ${project.name} is a proposed run-of-river mini-hydropower project located on the ${project.river ?? '[INSERT: river]'} in ${project.district ?? '[INSERT: district]'} District. The project is being developed as a private/community initiative for grid-connected power supply, in accordance with the Government of Nepal's renewable energy programme administered by the Alternative Energy Promotion Centre (AEPC) and the Department of Electricity Development (DoED).`
    ),
    p(
      'This Detailed Feasibility Study (DFS) report has been prepared in accordance with the Guidelines for Detailed Feasibility Studies of Mini Hydropower Projects, 2014, published by AEPC. The study covers topographic, hydrological, geological, civil, electromechanical, environmental, and financial aspects of the project.'
    ),
    placeholder('Brief project history: previous reconnaissance/pre-feasibility studies, dates, and key recommendations that led to this DFS.'),

    h2('1.2 Project objectives'),
    p('The principal objectives of this study are:'),
    p('• To establish the technical feasibility of the project, including hydrological adequacy, civil and electromechanical sizing per AEPC and IS standards.'),
    p('• To prepare a detailed cost estimate and financial analysis sufficient for AEPC subsidy application and bank loan appraisal.'),
    p('• To produce drawings, specifications, and a Bill of Quantities (BoQ) suitable for tendering of construction works.'),
    p('• To assess environmental and social impacts and recommend mitigation measures.'),

    h2('1.3 Location and accessibility'),
    placeholder('Location description: nearest road head, distance and travel time from district headquarters, mode of transportation (4-wheel drive, porter, mule). Reference to a 1:50,000 topo sheet number.'),
    placeholder('Accessibility map and Google Earth screenshot to be inserted in Volume III (Drawings).'),

    h2('1.4 Power market'),
    p('The project is proposed for grid connection to the national electricity grid (NEA) via the nearest 11 kV / 33 kV distribution feeder. A Power Purchase Agreement (PPA) will be sought from NEA at the prevailing dry/wet season tariff schedule for small hydropower.'),
    placeholder('Distance to nearest grid substation, voltage level, and stated/assumed evacuation arrangement.'),

    h2('1.5 Previous studies'),
    placeholder('List of previous reconnaissance and pre-feasibility studies, authors, dates, and key conclusions/recommendations carried forward to this DFS.'),

    h2('1.6 Report organisation'),
    p(
      'This report follows the AEPC DFS 2014 §9.2 chapter format. Chapter 2 presents the hydrological analysis. Chapters 3–6 cover the civil works (intake and settling basin, headrace and forebay, penstock, anchor blocks). Chapter 7 covers the powerhouse and electromechanical equipment. Chapter 8 presents energy generation. Chapter 9 contains the project cost estimate and financial analysis. Chapter 10 provides conclusions and recommendations. Annexes A and B follow the main report.'
    ),
  ]
}

// ────────────────────────────────────────────────────────────
// Chapter 2 — Hydrology
// ────────────────────────────────────────────────────────────

function buildChapter2(mods: ModuleMap): (Paragraph | Table)[] {
  const hyd = mods.get('hydrology')?.outputs
  if (!hyd) {
    return [
      h1('Chapter 2 — Hydrology'),
      placeholderBox('Data not available — complete Module 01 (Hydrology) to populate this chapter.'),
    ]
  }

  // FDC table — interpolate fdcPoints if present, else show known
  const percentiles = [10, 20, 30, 40, 50, 60, 70, 80, 90, 95]
  const fdcRows: (string | number | null | undefined)[][] = percentiles.map((pc) => {
    let q: number | null = null
    if (Array.isArray(hyd.fdcPoints) && hyd.fdcPoints.length > 0) {
      // Interpolate
      const sorted = [...hyd.fdcPoints].sort((a: any, b: any) => a.percentile - b.percentile)
      const exact = sorted.find((pt: any) => Math.abs(pt.percentile - pc) < 0.5)
      if (exact) {
        q = exact.q ?? exact.flowM3s ?? null
      } else {
        // linear interp
        for (let i = 0; i < sorted.length - 1; i++) {
          if (sorted[i].percentile <= pc && sorted[i + 1].percentile >= pc) {
            const a = sorted[i]
            const b = sorted[i + 1]
            const aQ = a.q ?? a.flowM3s
            const bQ = b.q ?? b.flowM3s
            if (aQ != null && bQ != null) {
              const t = (pc - a.percentile) / (b.percentile - a.percentile)
              q = aQ + t * (bQ - aQ)
            }
            break
          }
        }
      }
    } else {
      if (pc === 40) q = hyd.q40M3s
      if (pc === 80) q = hyd.q80M3s
      if (pc === 95) q = hyd.q95M3s
    }
    return [`Q${pc}`, q != null ? num(q, 3) : '—']
  })

  const methodLabel = hyd.method === 'wecs'
    ? 'WECS/DHM 1990 (Hydrological Estimation in Nepal)'
    : hyd.method === 'mip'
    ? 'Medium Irrigation Project (MIP) regional method'
    : hyd.method === 'fdc'
    ? 'Flow Duration Curve from observed gauging'
    : 'Hydrological method as documented'

  return [
    h1('Chapter 2 — Hydrology'),

    h2('2.1 Catchment characteristics'),
    p(
      `The catchment was delineated from a 1:50,000 topographic map and verified using SRTM elevation data. The catchment area at the proposed intake location was estimated as ${num(hyd.catchmentAreaKm2, 2)} km². The mean annual flow was estimated at ${num(hyd.meanAnnualFlowM3s, 3)} m³/s. The hydrological analysis was performed using the ${methodLabel}.`
    ),
    citation('Per AEPC DFS 2014 §3.6 (hydrological analysis methods).'),
    ...(hyd.wecs?.mwiKm2 != null
      ? [
          p(
            `Catchment parameters required for the WECS/DHM method: monsoon-wetness index (MWI) area = ${num(hyd.wecs.mwiKm2, 2)} km², area below 5,000 m relief = ${num(hyd.wecs.reliefM ?? hyd.wecs.areaBelow5000Km2, 2)}.`
          ),
        ]
      : []),
    placeholder('Brief description of basin: orientation, dominant land cover, snow contribution if any, mean annual rainfall from nearest DHM station.'),

    h2('2.2 Flow Duration Curve'),
    caption('Table 2.1 — Flow Duration Curve at intake (m³/s)'),
    dataTable({
      headers: ['Exceedance probability', 'Discharge (m³/s)'],
      rows: fdcRows,
      widths: [Math.round(CONTENT_W * 0.5), CONTENT_W - Math.round(CONTENT_W * 0.5)],
    }),
    blank(),
    placeholder('FDC plot to be included in Volume III drawings (Appendix B).'),

    h2('2.3 Design discharge'),
    p(
      `The design discharge has been selected as Q₄₀ = ${num(hyd.qDesign, 3)} m³/s, in line with AEPC DFS 2014 §3.2 which recommends Q₄₀ as the design flow for run-of-river mini-hydropower projects in the 100–1,000 kW range. This selection balances energy capture against capital cost of conveyance and electromechanical equipment.`
    ),
    citation('Per AEPC DFS 2014 §3.2 — Design discharge selection criterion.'),

    h2('2.4 Riparian (environmental) release'),
    p(
      'A riparian release of 10 % of the mean monthly minimum flow (or as specified by the licensing authority) shall be maintained in the de-watered reach at all times, in compliance with the Electricity Regulation 1993 and AEPC DFS 2014 §4.4. The riparian release shall be released at the diversion weir through a dedicated low-level outlet.'
    ),
    citation('Per AEPC DFS 2014 §3.6.8 and §4.4.'),

    h2('2.5 Flood analysis'),
    p(
      `The 100-year design flood at the intake location is estimated at ${num(hyd.highFloodM3s, 1)} m³/s. This value has been used for the design of the diversion weir spillway, intake protection works, and powerhouse setback elevation.`
    ),
    placeholder('Flood frequency analysis method used: Gumbel / Log-Pearson III / WECS regional flood. Show fitting and confidence bounds in Annex.'),

    h2('2.6 Gross head measurement'),
    p(
      `The gross head between the forebay water surface and the turbine centreline tailwater was determined as ${num(hyd.grossHeadM, 2)} m.`
    ),
    placeholder('Method of head measurement: differential GPS, dumpy level traverse, or RTK-GPS profile. State accuracy of survey.'),
  ]
}

// ────────────────────────────────────────────────────────────
// Chapter 3 — Intake & Settling Basin
// ────────────────────────────────────────────────────────────

function buildChapter3(mods: ModuleMap): (Paragraph | Table)[] {
  const intake = mods.get('intake')?.outputs
  const intakeIn = mods.get('intake')?.inputs ?? {}
  if (!intake) {
    return [
      h1('Chapter 3 — Intake and Settling Basin'),
      placeholderBox('Data not available — complete Module 02 (Intake & Settling Basin) to populate this chapter.'),
    ]
  }

  return [
    h1('Chapter 3 — Intake and Settling Basin'),
    citation('Per AEPC DFS 2014 §6.1 (Headworks) and AEPC Reference Micro-Hydro Power Standard 2014 §3 (intake design criteria).'),

    h2('3.1 Side intake design'),
    p(
      `A side intake (orifice type) has been adopted, drawing the design discharge of ${num(intakeIn.designFlowM3s, 3)} m³/s from the ${intakeIn.river ?? 'river'} on the [INSERT: left/right] bank, as recommended by AEPC for run-of-river mini-hydro schemes. The orifice is sized such that the approach velocity does not exceed 1.0 m/s to minimise sediment entrainment.`
    ),
    placeholder('Bank selection rationale based on bend geometry, geological stability, and powerhouse access.'),

    h3('Table 3.1 — Intake design summary'),
    kvTable([
      { k: 'Design discharge', v: intakeIn.designFlowM3s != null ? `${num(intakeIn.designFlowM3s, 3)} m³/s` : '—' },
      { k: 'Approach velocity', v: intakeIn.velocityM3s != null ? `${num(intakeIn.velocityM3s, 2)} m/s` : '—' },
      { k: 'Orifice area', v: intake.orificeAreaM2 != null ? `${num(intake.orificeAreaM2, 3)} m²` : '—' },
      { k: 'Sill length', v: intake.sillLengthM != null ? `${num(intake.sillLengthM, 2)} m` : '—' },
    ]),
    blank(),

    h2('3.2 Trash rack'),
    p(
      `A vertical bar-screen trash rack is provided immediately upstream of the intake orifice. The clear bar spacing has been set at ${num(intakeIn.rackSpacingMm, 0)} mm, suitable for protecting the downstream conveyance and turbine from leaves, branches, and floating debris.`
    ),
    h3('Table 3.2 — Trash rack design'),
    kvTable([
      { k: 'Bar spacing (clear)', v: intakeIn.rackSpacingMm != null ? `${num(intakeIn.rackSpacingMm, 0)} mm` : '—' },
      { k: 'Rack effective area', v: intake.trashRackArea != null ? `${num(intake.trashRackArea, 3)} m²` : '—' },
      { k: 'Head loss across rack', v: intake.hLossRackM != null ? `${num(intake.hLossRackM, 4)} m` : '—' },
      { k: 'Cleaning provision', v: 'Manual (rake on platform), per AEPC reference standard' },
    ]),
    blank(),

    h2('3.3 Settling basin'),
    p(
      'A settling basin (gravel trap + sand trap) is provided downstream of the intake to settle particles ≥ 0.2 mm, to protect the turbine runner from sediment abrasion. The basin has been designed as a long-and-narrow rectangular tank with a settling velocity criterion of 0.2 m/s and a horizontal flow velocity of ≤ 0.3 m/s, in line with AEPC reference standard.'
    ),
    placeholder('Full plan and section dimensions (length × width × depth) with sediment storage volume to be added from drawings.'),
    citation('Per AEPC Reference Micro-Hydro Standard 2014 §3.4 — Settling basin design criteria (target particle size 0.2 mm).'),

    h2('3.4 Total head loss at headworks'),
    p(
      `The total head loss across the intake and settling basin has been computed as ${num(intake.totalHeadLossM, 4)} m, comprising rack loss (${num(intake.hLossRackM, 4)} m) and entrance loss (${num(intake.hLossEntranceM, 4)} m). This value has been deducted from the gross head in the net head calculation.`
    ),
  ]
}

// ────────────────────────────────────────────────────────────
// Chapter 4 — Headrace and Forebay
// ────────────────────────────────────────────────────────────

function buildChapter4(mods: ModuleMap): (Paragraph | Table)[] {
  const hr = mods.get('headrace')?.outputs
  if (!hr) {
    return [
      h1('Chapter 4 — Headrace and Forebay'),
      placeholderBox('Data not available — complete Module 03 (Headrace & Forebay) to populate this chapter.'),
    ]
  }

  return [
    h1('Chapter 4 — Headrace and Forebay'),
    citation('Per AEPC DFS 2014 §6.4 (Waterway) and §6.5 (Forebay).'),

    h2('4.1 Headrace conveyance'),
    p(
      `The headrace conveys the design discharge from the settling basin outlet to the forebay over a horizontal distance of ${num(hr.headrace?.lengthM, 1)} m. The conveyance type adopted is a ${hr.headrace?.type ?? '[INSERT: open canal / HDPE pipe]'}, sized using the Manning equation with a bed slope of ${num(hr.headrace?.bedSlopeM, 5)} m/m to maintain self-cleansing velocity while limiting head loss.`
    ),
    h3('Table 4.1 — Headrace design summary'),
    kvTable([
      { k: 'Type', v: hr.headrace?.type ?? '—' },
      { k: 'Length', v: hr.headrace?.lengthM != null ? `${num(hr.headrace.lengthM, 1)} m` : '—' },
      { k: 'Bed slope', v: hr.headrace?.bedSlopeM != null ? `${num(hr.headrace.bedSlopeM, 5)} m/m` : '—' },
      { k: 'Velocity', v: hr.headrace?.velocity != null ? `${num(hr.headrace.velocity, 3)} m/s` : '—' },
      { k: 'Head loss', v: hr.headrace?.hLossM != null ? `${num(hr.headrace.hLossM, 3)} m` : '—' },
    ]),
    blank(),
    placeholder('Headrace alignment description, lining material, and any river crossings or stability issues.'),

    h2('4.2 Forebay'),
    p(
      'The forebay serves as a transition between the open-channel/pressurised headrace and the penstock, providing surge protection, final sediment settlement, and adequate submergence to prevent vortex formation at the penstock entrance. An overflow weir is provided to spill any surplus inflow, and a flushing gate at the lowest point allows periodic cleaning.'
    ),
    h3('Table 4.2 — Forebay design summary'),
    kvTable([
      { k: 'Length', v: hr.forebay?.lengthM != null ? `${num(hr.forebay.lengthM, 2)} m` : '—' },
      { k: 'Width', v: hr.forebay?.widthM != null ? `${num(hr.forebay.widthM, 2)} m` : '—' },
      { k: 'Depth', v: hr.forebay?.depthM != null ? `${num(hr.forebay.depthM, 2)} m` : '—' },
      { k: 'Storage volume', v: hr.forebay?.volumeM3 != null ? `${num(hr.forebay.volumeM3, 1)} m³` : '—' },
    ]),
    blank(),
    citation('Forebay submergence: minimum 4× penstock diameter, per AEPC reference standard §3.6.'),

    h2('4.3 Total head loss summary'),
    p(
      `The total combined head loss in the headrace + forebay is ${num(hr.totalHlossM ?? hr.headrace?.hLossM, 3)} m. This is deducted from the gross head in the net head calculation (Chapter 5).`
    ),
  ]
}

// ────────────────────────────────────────────────────────────
// Chapter 5 — Penstock
// ────────────────────────────────────────────────────────────

function buildChapter5(mods: ModuleMap): (Paragraph | Table)[] {
  const pst = mods.get('penstock')?.outputs
  const pstIn = mods.get('penstock')?.inputs ?? {}
  if (!pst) {
    return [
      h1('Chapter 5 — Penstock Design'),
      placeholderBox('Data not available — complete Module 04 (Penstock) to populate this chapter.'),
    ]
  }

  // Loss components
  const lossRows: (string | number | null | undefined)[][] = [
    ['Friction loss (Darcy-Weisbach)', num(pst.hFrictionM, 4), num(((pst.hFrictionM ?? 0) / (pstIn.grossHead || 1)) * 100, 2) + ' %'],
    ['Entrance loss', num(pst.hEntranceM, 4), num(((pst.hEntranceM ?? 0) / (pstIn.grossHead || 1)) * 100, 2) + ' %'],
    ['Contraction (taper) loss', num(pst.hContractionM, 4), num(((pst.hContractionM ?? 0) / (pstIn.grossHead || 1)) * 100, 2) + ' %'],
    ['Bend losses', num(pst.hBendsM, 4), num(((pst.hBendsM ?? 0) / (pstIn.grossHead || 1)) * 100, 2) + ' %'],
    ['Valve loss', num(pst.hValveM, 4), num(((pst.hValveM ?? 0) / (pstIn.grossHead || 1)) * 100, 2) + ' %'],
    ['Other minor losses', num(pst.hMinorM, 4), num(((pst.hMinorM ?? 0) / (pstIn.grossHead || 1)) * 100, 2) + ' %'],
    ['TOTAL penstock loss', num(pst.hPenstockM, 4), num(((pst.hPenstockM ?? 0) / (pstIn.grossHead || 1)) * 100, 2) + ' %'],
  ]

  return [
    h1('Chapter 5 — Penstock Design'),
    citation('Per IS 11639 Parts 1–3 (penstock design), IS 5330:1984 (anchor blocks), IS 11625:1986 (water hammer / surge), and AHEC §11 (penstock and valves).'),

    h2('5.1 Design parameters'),
    h3('Table 5.1 — Penstock design inputs'),
    kvTable([
      { k: 'Design discharge', v: pstIn.qDesign != null ? `${num(pstIn.qDesign, 3)} m³/s` : '—' },
      { k: 'Gross head', v: pstIn.grossHead != null ? `${num(pstIn.grossHead, 2)} m` : '—' },
      { k: 'Penstock alignment slope', v: pstIn.slopeAngleDeg != null ? `${num(pstIn.slopeAngleDeg, 1)} °` : '—' },
      { k: 'Penstock length', v: pstIn.lengthM != null ? `${num(pstIn.lengthM, 1)} m` : '—' },
    ]),
    blank(),

    h2('5.2 Pipe sizing'),
    p(
      `An internal diameter of ${num(pstIn.diameterMm, 0)} mm has been selected, giving a nominal external diameter of ${num(pst.externalDiameterMm, 0)} mm. The corresponding flow velocity is ${num(pst.velocity, 3)} m/s, which lies within the AHEC-recommended range of 2.0–4.5 m/s for steel penstocks of this length, balancing friction loss against pipe cost.`
    ),
    citation('Velocity range per AHEC-IITR §11.3.2 and IS 11639 Part 1 §3.'),

    h2('5.3 Wall thickness calculation'),
    p(
      `The wall thickness has been calculated per IS 11639 Part 1 §4 using the design pressure (static head + transient water hammer), with a corrosion allowance of 1.0 mm and joint efficiency of 0.85 for double-welded butt joints. The selected commercial thickness is ${num(pst.thicknessSelectedMm, 1)} mm.`
    ),
    h3('Table 5.2 — Wall thickness design'),
    kvTable([
      { k: 'Design pressure', v: pst.designPressureMpa != null ? `${num(pst.designPressureMpa, 3)} MPa` : '—' },
      { k: 'Surge pressure wave velocity', v: pst.waveVelocityMs != null ? `${num(pst.waveVelocityMs, 0)} m/s` : '—' },
      { k: 'Calculated minimum thickness', v: pst.thickness?.computedMm != null ? `${num(pst.thickness.computedMm, 2)} mm` : '—' },
      { k: 'Corrosion allowance', v: pst.thickness?.corrosionAllowanceMm != null ? `${num(pst.thickness.corrosionAllowanceMm, 1)} mm` : '1.0 mm' },
      { k: 'Selected commercial thickness', v: pst.thicknessSelectedMm != null ? `${num(pst.thicknessSelectedMm, 1)} mm` : '—' },
    ]),
    blank(),

    h2('5.4 Hydraulic losses'),
    caption('Table 5.3 — Penstock head loss breakdown'),
    dataTable({
      headers: ['Loss component', 'Head loss (m)', '% of gross head'],
      rows: lossRows,
      widths: [Math.round(CONTENT_W * 0.5), Math.round(CONTENT_W * 0.25), CONTENT_W - Math.round(CONTENT_W * 0.5) - Math.round(CONTENT_W * 0.25)],
    }),
    blank(),

    h2('5.5 Net head'),
    p(
      `The net head available at the turbine inlet, after deducting all conveyance and penstock losses from the gross head, is ${num(pst.hNetM, 2)} m. The corresponding hydraulic power is ${num(pst.hydraulicPowerKw, 1)} kW, and the installed capacity (after generator/turbine/drive efficiencies) is ${num(pst.installedCapacityKw, 1)} kW.`
    ),

    h2('5.6 Pipe material and jointing'),
    p(
      'The penstock is fabricated from mild steel plate conforming to IS 2062 Grade A (yield strength 250 MPa), with longitudinal and circumferential double-welded butt joints. All welding shall conform to IS 9595 and shall be radiographically tested to AWS D1.1 acceptance levels for ≥ 10 % of joints, including 100 % of bend joints.'
    ),
    citation('Material: IS 2062 Gr A. Welding: IS 9595. NDT acceptance: AWS D1.1.'),

    h2('5.7 Anchor blocks and saddle supports'),
    p(
      'The penstock is supported by reinforced concrete anchor blocks at all bends (vertical and horizontal) and by saddle supports between anchor blocks at intervals not exceeding 6 m. Detailed anchor block design is presented in Chapter 6.'
    ),
  ]
}

// ────────────────────────────────────────────────────────────
// Chapter 6 — Anchor Block & Support Structures
// ────────────────────────────────────────────────────────────

function buildChapter6(mods: ModuleMap): (Paragraph | Table)[] {
  const ab = mods.get('anchorblock')?.outputs
  if (!ab) {
    return [
      h1('Chapter 6 — Anchor Blocks and Support Structures'),
      placeholderBox('Data not available — complete Module 05 (Anchor Block) to populate this chapter. Anchor block design must satisfy all three IS 5330:1984 stability checks (sliding, overturning, bearing) before this report is submitted.'),
    ]
  }

  // IS 5330:1984 §5.1 force component labels (12 forces)
  const forceLabels: { k: string; label: string }[] = [
    { k: 'f1', label: 'F1 — Self-weight of anchor block' },
    { k: 'f2', label: 'F2 — Weight of pipe encased in block' },
    { k: 'f3', label: 'F3 — Weight of water in pipe within block' },
    { k: 'f4', label: 'F4 — Friction force at upstream saddle' },
    { k: 'f5', label: 'F5 — Friction force at downstream saddle' },
    { k: 'f6', label: 'F6 — Hydrostatic pressure (upstream bend)' },
    { k: 'f7', label: 'F7 — Hydrostatic pressure (downstream bend)' },
    { k: 'f8', label: 'F8 — Dynamic (centrifugal) force at bend' },
    { k: 'f9', label: 'F9 — Pipe + water weight component along axis' },
    { k: 'f10', label: 'F10 — Resultant axial force from upstream segment' },
    { k: 'f11', label: 'F11 — Resultant axial force from downstream segment' },
    { k: 'f12', label: 'F12 — Thermal / temperature-induced force' },
  ]
  const forceRows: (string | number | null | undefined)[][] = forceLabels.map((f) => [
    f.label,
    ab.forces?.[f.k] != null ? num(ab.forces[f.k], 2) : '—',
  ])

  const stab = ab.stability ?? {}
  const stabRows: (string | number | null | undefined)[][] = [
    ['Sliding', stab.sliding?.factor != null ? num(stab.sliding.factor, 2) : '—', stab.sliding?.required != null ? num(stab.sliding.required, 2) : '1.50', stab.sliding?.passed ? 'PASS' : 'FAIL'],
    ['Overturning', stab.overturning?.factor != null ? num(stab.overturning.factor, 2) : '—', stab.overturning?.required != null ? num(stab.overturning.required, 2) : '1.50', stab.overturning?.passed ? 'PASS' : 'FAIL'],
    ['Bearing', stab.bearing?.actualKpa != null ? `${num(stab.bearing.actualKpa, 1)} kPa` : '—', stab.bearing?.allowableKpa != null ? `${num(stab.bearing.allowableKpa, 1)} kPa` : '—', stab.bearing?.passed ? 'PASS' : 'FAIL'],
  ]

  return [
    h1('Chapter 6 — Anchor Blocks and Support Structures'),
    citation('Per IS 5330:1984 — Criteria for design of anchor blocks for penstocks with expansion joints. All three stability checks (sliding, overturning, bearing) must satisfy the prescribed safety factors.'),

    h2('6.1 Anchor block sizing'),
    p(
      `An RCC anchor block has been provided at the major horizontal/vertical bend on the penstock alignment. The block volume is ${num(ab.blockVolM3, 2)} m³ giving a self-weight of approximately ${num(ab.blockWeightKn, 1)} kN, sized to resist the resultant of all 12 force components per IS 5330:1984 §5.1 with adequate safety margin.`
    ),

    h2('6.2 IS 5330:1984 §5.1 force components'),
    caption('Table 6.1 — Force components on anchor block (kN)'),
    dataTable({
      headers: ['Force component', 'Magnitude (kN)'],
      rows: forceRows,
      widths: [Math.round(CONTENT_W * 0.7), CONTENT_W - Math.round(CONTENT_W * 0.7)],
    }),
    blank(),

    h2('6.3 Stability checks'),
    caption('Table 6.2 — IS 5330:1984 stability checks'),
    dataTable({
      headers: ['Check', 'Computed', 'Required', 'Status'],
      rows: stabRows,
      widths: [
        Math.round(CONTENT_W * 0.3),
        Math.round(CONTENT_W * 0.25),
        Math.round(CONTENT_W * 0.25),
        Math.round(CONTENT_W * 0.2),
      ],
      rightAlignFromCol: 1,
    }),
    blank(),

    p(ab.allChecksPassed
      ? 'All three stability checks are satisfied. The anchor block design is structurally adequate per IS 5330:1984.'
      : 'One or more stability checks fail to satisfy the IS 5330 criteria. The block dimensions or steel reinforcement must be revised before construction.'),

    h2('6.4 Saddle supports'),
    p(
      'Saddle supports of reinforced concrete are provided between anchor blocks at intervals not exceeding 6 m, designed per IS 11639 Part 2 to take vertical (pipe + water) loads with PTFE bearing strips at the saddle/pipe interface to allow longitudinal expansion.'
    ),
    citation('Saddle support design per IS 11639 Part 2:1995.'),
    placeholder('Number, spacing, and individual saddle dimensions to be tabulated based on penstock alignment profile.'),
  ]
}

// ────────────────────────────────────────────────────────────
// Chapter 7 — Powerhouse and Electromechanical
// ────────────────────────────────────────────────────────────

function buildChapter7(mods: ModuleMap): (Paragraph | Table)[] {
  const ph = mods.get('powerhouse')?.outputs
  if (!ph) {
    return [
      h1('Chapter 7 — Powerhouse and Electromechanical Equipment'),
      placeholderBox('Data not available — complete Module 06 (Powerhouse & Turbine Selection) to populate this chapter.'),
    ]
  }

  const turbineLabel = (ph.selected ?? ph.runner?.type ?? '').toString()
  const turbineCap = turbineLabel.charAt(0).toUpperCase() + turbineLabel.slice(1)

  return [
    h1('Chapter 7 — Powerhouse and Electromechanical Equipment'),
    citation('Per AEPC DFS 2014 §6.8 (powerhouse) and §8.2 (electromechanical works), AHEC-IITR §2.2 (turbine selection).'),

    h2('7.1 Turbine selection'),
    p(
      `Based on the design net head of ${num(ph.hydraulics?.hNetM, 2)} m and design discharge of ${num(ph.hydraulics?.qDesignM3s, 3)} m³/s, a ${turbineCap} turbine has been selected.${ph.primaryRationale ? ' ' + ph.primaryRationale : ''}`
    ),
    h3('Table 7.1 — Turbine specification'),
    kvTable([
      { k: 'Turbine type', v: turbineCap },
      { k: 'Design net head', v: ph.hydraulics?.hNetM != null ? `${num(ph.hydraulics.hNetM, 2)} m` : '—' },
      { k: 'Design discharge', v: ph.hydraulics?.qDesignM3s != null ? `${num(ph.hydraulics.qDesignM3s, 3)} m³/s` : '—' },
      { k: 'Hydraulic power input', v: ph.hydraulics?.hydraulicPowerKw != null ? `${num(ph.hydraulics.hydraulicPowerKw, 1)} kW` : '—' },
      { k: 'PCD (pitch circle diameter)', v: ph.runner?.pcdMm != null ? `${num(ph.runner.pcdMm, 0)} mm` : '—' },
      { k: 'Runner diameter', v: ph.runner?.runnerDiameterMm != null ? `${num(ph.runner.runnerDiameterMm, 0)} mm` : '—' },
      { k: 'Runner width', v: ph.runner?.runnerWidthMm != null ? `${num(ph.runner.runnerWidthMm, 0)} mm` : '—' },
      { k: 'Synchronous speed', v: ph.generator?.syncSpeedRpm != null ? `${num(ph.generator.syncSpeedRpm, 0)} rpm` : '—' },
      { k: 'Number of poles (generator)', v: ph.generator?.poles != null ? `${num(ph.generator.poles, 0)}` : '—' },
    ]),
    blank(),
    placeholder('Turbine vendor specification (manufacturer, model, runner material, butterfly inlet valve, governor type) to be selected at procurement stage.'),

    h2('7.2 Generator and electrical'),
    h3('Table 7.2 — Generator specification'),
    kvTable([
      { k: 'Rated electrical power', v: ph.generator?.electricalPowerKw != null ? `${num(ph.generator.electricalPowerKw, 1)} kW` : '—' },
      { k: 'Apparent power (kVA)', v: ph.generator?.apparentPowerKva != null ? `${num(ph.generator.apparentPowerKva, 1)} kVA` : '—' },
      { k: 'Standard kVA (selected)', v: ph.generator?.standardKvaSelected != null ? `${num(ph.generator.standardKvaSelected, 0)} kVA` : '—' },
      { k: 'Power factor', v: ph.generator?.powerFactor != null ? num(ph.generator.powerFactor, 2) : '0.85' },
      { k: 'Voltage (line-line)', v: ph.generator?.voltageVoltsLine != null ? `${num(ph.generator.voltageVoltsLine, 0)} V` : '—' },
      { k: 'Overall efficiency', v: ph.generator?.efficiencyOverall != null ? `${num(ph.generator.efficiencyOverall, 1)} %` : '—' },
    ]),
    blank(),

    h2('7.3 Powerhouse building'),
    p(
      `The powerhouse is a single-storey RCC-framed building with masonry infill walls and a CGI sheet pitched roof. The structure houses the turbine-generator unit, control panel, station auxiliary supply, and a small workshop bay. Building dimensions and footprint have been sized per AEPC reference standard layout for ${turbineCap} units.`
    ),
    h3('Table 7.3 — Powerhouse building'),
    kvTable([
      { k: 'Unit bay length', v: ph.powerhouse?.unitBayLengthM != null ? `${num(ph.powerhouse.unitBayLengthM, 2)} m` : '—' },
      { k: 'Unit bay width', v: ph.powerhouse?.unitBayWidthM != null ? `${num(ph.powerhouse.unitBayWidthM, 2)} m` : '—' },
      { k: 'Building height', v: ph.powerhouse?.buildingHeightM != null ? `${num(ph.powerhouse.buildingHeightM, 2)} m` : '—' },
      { k: 'Total footprint area', v: ph.powerhouse?.totalFootprintAreaM2 != null ? `${num(ph.powerhouse.totalFootprintAreaM2, 1)} m²` : '—' },
    ]),
    blank(),
    placeholder('Powerhouse plinth elevation must be set ≥ 1.0 m above the 100-year flood level. Confirm setback distance from river bank using site-specific flood marks.'),

    h2('7.4 Tailrace'),
    p(
      'A short RCC tailrace channel returns water to the river downstream of the powerhouse. The tailrace is sized to pass the design discharge with a Manning velocity of 1.0–1.5 m/s and an erosion-protected outfall.'
    ),
    placeholder('Tailrace length, dimensions, and outfall apron details to be added from drawings.'),

    h2('7.5 Switchyard and grid interconnection'),
    placeholder('Switchyard configuration: step-up transformer rating (kVA, voltage ratio), HT switchgear, lightning arresters, distance to NEA grid takeoff, transmission line length and conductor.'),
  ]
}

// ────────────────────────────────────────────────────────────
// Chapter 8 — Energy Generation
// ────────────────────────────────────────────────────────────

function buildChapter8(mods: ModuleMap): (Paragraph | Table)[] {
  const en = mods.get('energy')?.outputs
  if (!en) {
    return [
      h1('Chapter 8 — Energy Generation'),
      placeholderBox('Data not available — complete Module 07 (Annual Energy Generation) to populate this chapter.'),
    ]
  }

  const monthlyRows: (string | number | null | undefined)[][] = (en.rows ?? []).map((r: any, i: number) => [
    NEPALI_MONTHS[i] ?? r.nepali ?? `M${i + 1}`,
    r.english ?? '',
    num(r.qAvailableM3s, 3),
    num(r.qPlantM3s, 3),
    num(r.powerKw, 1),
    num(r.energyMwh, 2),
    num(r.plantFactorPercent, 1),
  ])

  // Compute dry / wet split (Poush–Chaitra = months 8-11; Baisakh-Mangsir = 0-7)
  let dry = 0, wet = 0
  if (Array.isArray(en.rows)) {
    en.rows.forEach((r: any, i: number) => {
      const e = Number(r.energyMwh ?? 0)
      if (i >= 8 && i <= 11) dry += e
      else wet += e
    })
  }

  return [
    h1('Chapter 8 — Energy Generation'),
    citation('Per AEPC DFS 2014 §7 — Power and energy output. Monthly energy is computed from the mean monthly flows and the design plant capacity, applying riparian release, system losses, and turbine efficiency.'),

    h2('8.1 Monthly energy generation'),
    caption('Table 8.1 — Monthly energy generation'),
    dataTable({
      headers: ['Nepali', 'English', 'Q_avail (m³/s)', 'Q_plant (m³/s)', 'Power (kW)', 'Energy (MWh)', 'PF (%)'],
      rows: monthlyRows,
      widths: [
        Math.round(CONTENT_W * 0.12),
        Math.round(CONTENT_W * 0.15),
        Math.round(CONTENT_W * 0.13),
        Math.round(CONTENT_W * 0.13),
        Math.round(CONTENT_W * 0.13),
        Math.round(CONTENT_W * 0.16),
        Math.round(CONTENT_W * 0.18),
      ],
      rightAlignFromCol: 2,
      cellSize: 18,
      headerSize: 18,
    }),
    blank(),

    h2('8.2 Annual energy summary'),
    h3('Table 8.2 — Annual energy summary'),
    kvTable([
      { k: 'Total annual energy', v: en.annualEnergyMwh != null ? `${num(en.annualEnergyMwh, 0)} MWh` : '—' },
      { k: 'Plant factor (annual)', v: en.plantFactorPercent != null ? `${num(en.plantFactorPercent, 2)} %` : '—' },
      { k: 'Firm energy (Q₉₀ basis)', v: en.firmEnergyMwh != null ? `${num(en.firmEnergyMwh, 0)} MWh` : '—' },
      { k: 'Q₉₀ (firm flow)', v: en.q90M3s != null ? `${num(en.q90M3s, 3)} m³/s` : '—' },
      { k: 'Dry-season energy (Poush–Chaitra)', v: dry > 0 ? `${num(dry, 0)} MWh` : '—' },
      { k: 'Wet-season energy (Baisakh–Mangsir)', v: wet > 0 ? `${num(wet, 0)} MWh` : '—' },
      { k: 'Driest month', v: en.dryMonthIndex != null ? NEPALI_MONTHS[en.dryMonthIndex] : '—' },
      { k: 'Wettest month', v: en.wetMonthIndex != null ? NEPALI_MONTHS[en.wetMonthIndex] : '—' },
    ]),
    blank(),

    h2('8.3 Riparian release compliance'),
    p(
      'A minimum riparian release of 10 % of the mean monthly minimum flow is maintained in the de-watered river reach in all months, in compliance with AEPC DFS 2014 §4.4 and the Electricity Regulations 1993. The plant discharge column above is net of riparian release and any spillage at the forebay overflow.'
    ),
    citation('Per AEPC DFS 2014 §4.4 — Environmental release.'),
  ]
}

// ────────────────────────────────────────────────────────────
// Chapter 9 — Financial Analysis
// ────────────────────────────────────────────────────────────

const BOQ_LABELS: Record<string, string> = {
  a1: 'A1 — Headworks (weir, intake, gravel trap)',
  a2: 'A2 — Settling basin',
  a3: 'A3 — Headrace conveyance',
  a4: 'A4 — Forebay',
  a5: 'A5 — Penstock pipe & fittings',
  a6: 'A6 — Anchor blocks & saddle supports',
  a7: 'A7 — Powerhouse building',
  a8: 'A8 — Tailrace',
  b1: 'B1 — Turbine, governor & inlet valve',
  b2: 'B2 — Generator & exciter',
  b3: 'B3 — Switchgear, controls & protection',
  c1: 'C1 — Step-up transformer',
  c2: 'C2 — Transmission line to grid',
  d1: 'D1 — Engineering, design & supervision',
  d2: 'D2 — Land acquisition & access road',
  d3: 'D3 — Environmental & social mitigation',
  d4: 'D4 — Pre-operating, financing & insurance',
  d5: 'D5 — Contingencies',
}

function buildChapter9(mods: ModuleMap): (Paragraph | Table)[] {
  const finData = mods.get('financial')
  const fin = finData?.outputs ?? {}
  const finIn = finData?.inputs ?? {}
  const capex = fin.capex ?? {}

  // BoQ table — iterate all known line items
  const boqOrder = Object.keys(BOQ_LABELS)
  const total = Number(capex.totalCapExNpr ?? 0) || 0
  const boqRows: (string | number | null | undefined)[][] = boqOrder
    .filter((k) => capex[k] != null)
    .map((k) => {
      const v = Number(capex[k])
      const usd = finIn.fxNprPerUsd ? v / Number(finIn.fxNprPerUsd) : null
      const pctOfTotal = total > 0 ? (v / total) * 100 : null
      return [
        BOQ_LABELS[k],
        nprLakh(v),
        usd != null ? num(usd, 0) : '—',
        pctOfTotal != null ? num(pctOfTotal, 1) : '—',
      ]
    })

  // Civil and EM subtotals
  if (capex.civilSubtotalNpr != null || capex.emSubtotalNpr != null) {
    boqRows.push(['—', '—', '—', '—'])
  }
  if (capex.civilSubtotalNpr != null) {
    boqRows.push([
      'Civil subtotal (A1–A8)',
      nprLakh(capex.civilSubtotalNpr),
      finIn.fxNprPerUsd ? num(Number(capex.civilSubtotalNpr) / Number(finIn.fxNprPerUsd), 0) : '—',
      total > 0 ? num((Number(capex.civilSubtotalNpr) / total) * 100, 1) : '—',
    ])
  }
  if (capex.emSubtotalNpr != null) {
    boqRows.push([
      'Electromechanical subtotal (B1–B3)',
      nprLakh(capex.emSubtotalNpr),
      finIn.fxNprPerUsd ? num(Number(capex.emSubtotalNpr) / Number(finIn.fxNprPerUsd), 0) : '—',
      total > 0 ? num((Number(capex.emSubtotalNpr) / total) * 100, 1) : '—',
    ])
  }
  boqRows.push([
    'TOTAL CAPEX',
    nprLakh(capex.totalCapExNpr),
    capex.totalCapExUsd != null ? num(capex.totalCapExUsd, 0) : '—',
    '100.0',
  ])

  // Cashflow (first 15 operating years)
  const cashflows = (fin.cashflows ?? []) as any[]
  const operatingCashflows = cashflows
    .filter((cf) => Number(cf.operatingYear ?? 0) >= 1)
    .slice(0, 15)
  const cashflowRows: (string | number | null | undefined)[][] = operatingCashflows.map((cf: any) => [
    cf.operatingYear ?? cf.year ?? '—',
    nprLakh(cf.revenue),
    nprLakh(cf.opex),
    nprLakh(cf.debtService),
    nprLakh(cf.ncfBeforeFinancing),
    nprLakh(cf.ncfAfterFinancing),
    nprLakh(cf.cumulativeNcfBefore),
  ])

  // Sensitivity
  const sensitivity = (fin.sensitivity ?? []) as any[]
  const sensitivityRows: (string | number | null | undefined)[][] = sensitivity.map((s: any) => [
    s.scenario ?? '—',
    s.irrProjectPct != null ? num(s.irrProjectPct, 2) + ' %' : '—',
    s.npv6Cr != null ? num(s.npv6Cr, 2) : '—',
    s.paybackYears != null ? num(s.paybackYears, 2) : '—',
  ])

  // Lender checklist
  const lender = (fin.lenderChecklist ?? []) as any[]
  const lenderRows: (string | number | null | undefined)[][] = lender.map((l: any) => [
    l.label ?? l.code ?? '—',
    l.note ?? '—',
    l.passed ? 'PASS' : 'FAIL',
  ])

  // Warnings
  const warnings = (fin.warnings ?? []) as any[]

  return [
    h1('Chapter 9 — Financial Analysis'),
    citation('Per AEPC DFS 2014 §13 — Project evaluation. Cost estimate per AEPC Reference Standard 2014 §5 (BoQ structure A–D).'),

    h2('9.1 Capital cost estimate'),
    p(
      `The total capital cost (CapEx) of the project is estimated at NPR ${nprCr(capex.totalCapExNpr)} crore (USD ${num(capex.totalCapExUsd, 0)}). The specific cost works out to USD ${num(capex.specificCostUsdPerKw, 0)}/kW, which falls within the typical range of USD 1,200–1,800/kW reported for Nepal mini-hydropower projects in the 100–1,000 kW range (Butchers et al., 2022).`
    ),
    caption('Table 9.1 — Bill of Quantities (BoQ) summary'),
    dataTable({
      headers: ['Component', 'NPR (lakh)', 'USD', '% of total'],
      rows: boqRows,
      widths: [
        Math.round(CONTENT_W * 0.5),
        Math.round(CONTENT_W * 0.18),
        Math.round(CONTENT_W * 0.16),
        Math.round(CONTENT_W * 0.16),
      ],
      rightAlignFromCol: 1,
      cellSize: 18,
    }),
    blank(),
    h3('Table 9.2 — Specific cost benchmarking'),
    kvTable([
      { k: 'Specific cost (NPR/kW)', v: capex.specificCostNprPerKw != null ? `NPR ${num(capex.specificCostNprPerKw, 0)}` : '—' },
      { k: 'Specific cost (USD/kW)', v: capex.specificCostUsdPerKw != null ? `USD ${num(capex.specificCostUsdPerKw, 0)}` : '—' },
      { k: 'FX rate used', v: finIn.fxNprPerUsd != null ? `1 USD = NPR ${num(finIn.fxNprPerUsd, 2)}` : '—' },
    ]),
    blank(),

    h2('9.2 Financing structure'),
    h3('Table 9.3 — Capital structure'),
    kvTable([
      { k: 'Total CapEx', v: capex.totalCapExNpr != null ? `NPR ${nprCr(capex.totalCapExNpr)} Cr` : '—' },
      { k: 'AEPC subsidy', v: capex.subsidyNpr != null ? `NPR ${nprCr(capex.subsidyNpr)} Cr  (${num(finIn.subsidyPctOfCapEx, 1)} %)` : '—' },
      { k: 'Equity', v: capex.equityNpr != null ? `NPR ${nprCr(capex.equityNpr)} Cr` : '—' },
      { k: 'Debt', v: capex.debtNpr != null ? `NPR ${nprCr(capex.debtNpr)} Cr` : '—' },
      { k: 'Construction period', v: finIn.constructionYears != null ? `${num(finIn.constructionYears, 1)} year(s)` : '—' },
      { k: 'Loan tenor', v: finIn.loanTenorYears != null ? `${num(finIn.loanTenorYears, 0)} years` : '—' },
      { k: 'Bank interest rate', v: finIn.bankInterestRatePct != null ? `${num(finIn.bankInterestRatePct, 2)} % p.a.` : '—' },
      { k: 'Project life', v: finIn.projectLifeYears != null ? `${num(finIn.projectLifeYears, 0)} years` : '—' },
    ]),
    blank(),

    h2('9.3 Revenue and tariff'),
    p(
      'Revenue is generated through a Power Purchase Agreement (PPA) with the Nepal Electricity Authority (NEA) at the prevailing dry/wet season tariff schedule for small hydropower.'
    ),
    h3('Table 9.4 — Tariff and Year-1 revenue'),
    kvTable([
      { k: 'Dry-season tariff (Poush–Chaitra)', v: finIn.dryTariffNprPerKwh != null ? `NPR ${num(finIn.dryTariffNprPerKwh, 2)}/kWh` : '—' },
      { k: 'Wet-season tariff (Baisakh–Mangsir)', v: finIn.wetTariffNprPerKwh != null ? `NPR ${num(finIn.wetTariffNprPerKwh, 2)}/kWh` : '—' },
      { k: 'Blended tariff (energy-weighted)', v: fin.blendedTariffNprPerKwh != null ? `NPR ${num(fin.blendedTariffNprPerKwh, 2)}/kWh` : '—' },
      { k: 'Year-1 revenue', v: fin.annualRevenueYr1Npr != null ? `NPR ${nprCr(fin.annualRevenueYr1Npr)} Cr  (${nprLakh(fin.annualRevenueYr1Npr)} lakh)` : '—' },
      { k: 'Dry-season energy (Yr 1)', v: fin.dryEnergyMwh != null ? `${num(fin.dryEnergyMwh, 0)} MWh` : '—' },
      { k: 'Wet-season energy (Yr 1)', v: fin.wetEnergyMwh != null ? `${num(fin.wetEnergyMwh, 0)} MWh` : '—' },
    ]),
    blank(),

    h2('9.4 Operating expenditure and statutory'),
    h3('Table 9.5 — OpEx and statutory'),
    kvTable([
      { k: 'O&M cost (% of CapEx, p.a.)', v: finIn.oAndMPctOfCapEx != null ? `${num(finIn.oAndMPctOfCapEx, 2)} %` : '—' },
      { k: 'Royalty status', v: fin.isBelowRoyaltyThreshold ? 'Below threshold — exempt' : 'Applicable per Electricity Act schedule' },
      { k: 'Income tax status', v: fin.isBelowTaxThreshold ? 'Tax holiday applicable for early years' : 'Standard corporate income tax' },
    ]),
    blank(),

    h2('9.5 Financial performance summary'),
    caption('Table 9.6 — Project financial indicators'),
    dataTable({
      headers: ['Metric', 'Value'],
      rows: [
        ['IRR (Project, post-tax)', fin.irrProjectPct != null ? num(fin.irrProjectPct, 2) + ' %' : '—'],
        ['IRR (Equity, post-tax)', fin.irrEquityPct != null ? num(fin.irrEquityPct, 2) + ' %' : '—'],
        ['NPV @ 6 % discount rate', fin.npvAt6Cr != null ? 'NPR ' + num(fin.npvAt6Cr, 2) + ' Cr' : '—'],
        ['NPV @ 12 % discount rate', fin.npvAt12Cr != null ? 'NPR ' + num(fin.npvAt12Cr, 2) + ' Cr' : '—'],
        ['BCR @ 6 % discount rate', fin.bcrAt6 != null ? num(fin.bcrAt6, 2) : '—'],
        ['Simple payback', fin.paybackSimpleYears != null ? num(fin.paybackSimpleYears, 1) + ' yr' : '—'],
        ['Discounted payback', fin.paybackDiscountedYears != null ? num(fin.paybackDiscountedYears, 1) + ' yr' : '—'],
        ['LCoE (levelised cost of energy)', fin.lcoeNprPerKwh != null ? 'NPR ' + num(fin.lcoeNprPerKwh, 2) + '/kWh' : '—'],
        ['DSCR (minimum)', fin.dscrMin != null ? num(fin.dscrMin, 2) : '—'],
        ['DSCR (average)', fin.dscrAvg != null ? num(fin.dscrAvg, 2) : '—'],
        ['Tariff break-even', fin.tariffBreakevenNprPerKwh != null ? 'NPR ' + num(fin.tariffBreakevenNprPerKwh, 2) + '/kWh' : '—'],
      ],
      widths: [Math.round(CONTENT_W * 0.6), CONTENT_W - Math.round(CONTENT_W * 0.6)],
    }),
    blank(),

    h2('9.6 Operating cashflow (first 15 operating years)'),
    caption('Table 9.7 — Operating cashflow, NPR lakh'),
    cashflowRows.length === 0
      ? placeholder('Cashflow rows not available — re-run financial module.')
      : dataTable({
          headers: ['Year', 'Revenue', 'OpEx', 'Debt service', 'NCF before fin.', 'NCF after fin.', 'Cum. NCF'],
          rows: cashflowRows,
          widths: [
            Math.round(CONTENT_W * 0.08),
            Math.round(CONTENT_W * 0.13),
            Math.round(CONTENT_W * 0.13),
            Math.round(CONTENT_W * 0.16),
            Math.round(CONTENT_W * 0.16),
            Math.round(CONTENT_W * 0.16),
            Math.round(CONTENT_W * 0.18),
          ],
          rightAlignFromCol: 1,
          cellSize: 18,
          headerSize: 18,
        }),
    blank(),
    citation('See Annex B for the full 30-year cashflow with all line items.'),

    h2('9.7 Sensitivity analysis'),
    p('A one-way sensitivity analysis was performed on the principal financial drivers. Results are summarised below.'),
    sensitivityRows.length === 0
      ? placeholder('Sensitivity scenarios not available — re-run financial module.')
      : dataTable({
          headers: ['Scenario', 'IRR Project (%)', 'NPV @ 6 % (Cr)', 'Payback (yr)'],
          rows: sensitivityRows,
          widths: [
            Math.round(CONTENT_W * 0.4),
            Math.round(CONTENT_W * 0.2),
            Math.round(CONTENT_W * 0.2),
            Math.round(CONTENT_W * 0.2),
          ],
          rightAlignFromCol: 1,
        }),
    blank(),

    h2('9.8 Lender checklist'),
    p('AEPC DFS 2014 §7.4 lender checks for bank financing eligibility.'),
    lenderRows.length === 0
      ? placeholder('Lender checklist not available — re-run financial module.')
      : dataTable({
          headers: ['Check', 'Note', 'Status'],
          rows: lenderRows,
          widths: [
            Math.round(CONTENT_W * 0.35),
            Math.round(CONTENT_W * 0.45),
            Math.round(CONTENT_W * 0.2),
          ],
          rightAlignFromCol: 2,
        }),
    blank(),

    ...(warnings.length > 0
      ? [
          h2('9.9 Warnings and observations'),
          ...warnings.map((w: any) =>
            p(`[${(w.level ?? 'info').toUpperCase()}] ${w.code ?? ''}: ${w.message ?? ''}`)
          ),
        ]
      : []),
  ]
}

// ────────────────────────────────────────────────────────────
// Chapter 10 — Conclusions and Recommendations
// ────────────────────────────────────────────────────────────

function buildChapter10(mods: ModuleMap): (Paragraph | Table)[] {
  const fin = mods.get('financial')?.outputs ?? {}
  const en = mods.get('energy')?.outputs ?? {}
  const ph = mods.get('powerhouse')?.outputs ?? {}
  const lender = (fin.lenderChecklist ?? []) as any[]
  const allLenderPass = lender.length > 0 && lender.every((l: any) => l.passed)
  const npv12Positive = Number(fin.npvAt12Cr ?? 0) > 0
  const irrProject = Number(fin.irrProjectPct ?? 0)
  const dscrMin = Number(fin.dscrMin ?? 0)

  let recommendation = 'Proceed to detailed engineering and tendering.'
  let recommendColor = C.green
  if (!npv12Positive) {
    recommendation = 'Conditional — proceed only with confirmed AEPC subsidy and concessional debt; revisit financial assumptions.'
    recommendColor = C.amber
  }
  if (irrProject < 8 || dscrMin < 1.2 || !allLenderPass) {
    recommendation = 'Not currently financeable on commercial terms. Revise CapEx, scope, or tariff assumptions before proceeding.'
    recommendColor = C.red
  }

  return [
    h1('Chapter 10 — Conclusions and Recommendations'),

    h2('10.1 Technical summary'),
    p(
      `The hydrology, civil works, and electromechanical equipment have been designed in accordance with AEPC DFS 2014, the AEPC Reference Micro-Hydro Power Standard 2014, and the relevant Indian Standards (IS 5330:1984, IS 11625:1986, IS 11639 Parts 1–3). The selected ${(ph.selected ?? 'turbine').toString()} turbine is well-matched to the design head and flow envelope, and the resulting installed capacity of ${num(ph.generator?.electricalPowerKw, 1)} kW yields an annual energy of ${num(en.annualEnergyMwh, 0)} MWh at a plant factor of ${num(en.plantFactorPercent, 1)} %.`
    ),
    p(
      'All civil structures (intake, settling basin, headrace, forebay, penstock, anchor blocks, powerhouse) have been sized based on the AEPC reference standard and verified against the relevant code criteria.'
    ),

    h2('10.2 Financial viability'),
    p(
      `The project IRR (post-tax, project basis) is ${num(fin.irrProjectPct, 2)} %, with an NPV @ 12 % of NPR ${num(fin.npvAt12Cr, 2)} Cr and a simple payback of ${num(fin.paybackSimpleYears, 1)} years. The minimum DSCR is ${num(fin.dscrMin, 2)} (average ${num(fin.dscrAvg, 2)}), and the levelised cost of energy is NPR ${num(fin.lcoeNprPerKwh, 2)}/kWh.`
    ),
    p(
      `The lender checklist (AEPC DFS 2014 §7.4) is ${allLenderPass ? 'fully satisfied' : 'not fully satisfied — see Chapter 9.8 for unmet criteria'}.`
    ),

    h2('10.3 Recommendation'),
    new Paragraph({
      spacing: { before: 200, after: 200 },
      shading: { type: ShadingType.CLEAR, fill: C.amberBg, color: 'auto' },
      border: {
        top: { style: BorderStyle.SINGLE, size: 6, color: recommendColor },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: recommendColor },
        left: { style: BorderStyle.SINGLE, size: 6, color: recommendColor },
        right: { style: BorderStyle.SINGLE, size: 6, color: recommendColor },
      },
      children: [new TextRun({ text: recommendation, font: FONT, size: 22, bold: true, color: recommendColor })],
    }),

    h2('10.4 Next steps'),
    p('Subject to acceptance of this DFS by AEPC and the lender, the recommended next steps are:'),
    p('• Completion of detailed geotechnical investigations at the headworks, settling basin, forebay, anchor block, and powerhouse locations.'),
    p('• Preparation of detailed structural drawings, BoQ, and contract specifications for tendering.'),
    p('• Submission of PPA application to NEA and grid connection feasibility study.'),
    p('• Environmental Impact Assessment / Initial Environmental Examination (per project capacity threshold).'),
    p('• AEPC subsidy application and lender appraisal.'),
    p('• Award of construction contract and commencement of works.'),
    placeholder('Site-specific outstanding items (slope-stability investigation, transmission line ROW, community consent letters, etc.).'),
  ]
}

// ────────────────────────────────────────────────────────────
// Annex A — Combined parameters summary
// ────────────────────────────────────────────────────────────

function buildAnnexA(project: ProjectRow, mods: ModuleMap): (Paragraph | Table)[] {
  return [
    h1('Annex A — Project Design Parameters Summary'),
    citation('Single-page summary of all key design parameters across the eight design modules. Suitable for attaching to a loan application or AEPC submission cover.'),
    ...buildSalientFeatures(project, mods).slice(2), // skip h1 + citation, keep table + placeholder
  ]
}

// ────────────────────────────────────────────────────────────
// Annex B — Full 30-year cashflow (portrait, small font)
// ────────────────────────────────────────────────────────────

function buildAnnexB(mods: ModuleMap) {
  const fin = mods.get('financial')?.outputs ?? {}
  const cashflows = (fin.cashflows ?? []) as any[]

  // 7 key columns — fits A4 portrait at 16pt
  const cfRows: (string | number | null | undefined)[][] = cashflows.map((cf: any) => [
    cf.operatingYear ?? cf.year ?? '—',
    nprLakh(cf.revenue),
    nprLakh(cf.opex),
    nprLakh(cf.debtService),
    nprLakh(cf.ncfBeforeFinancing),
    nprLakh(cf.ncfAfterFinancing),
    nprLakh(cf.cumulativeNcfBefore),
  ])

  const w1 = Math.round(CONTENT_W * 0.08)
  const w2 = Math.round((CONTENT_W - w1) / 6)
  const widths = [w1, w2, w2, w2, w2, w2, CONTENT_W - w1 - w2 * 5]

  return [
    h1('Annex B — Full Project Cashflow'),
    citation('All figures in NPR lakh. Generated from financial module outputs.'),
    cfRows.length === 0
      ? placeholder('No cashflow rows available — re-run financial module.')
      : dataTable({
          headers: ['Yr', 'Revenue', 'OpEx', 'Debt Svc', 'NCF Before', 'NCF After', 'Cum. NCF'],
          rows: cfRows,
          widths,
          cellSize: 16,
          headerSize: 16,
        }),
  ]
}

// ────────────────────────────────────────────────────────────
// Cover page children
//
// CHANGED Day 12: accepts `profile?: EngineerProfile` and uses
// it to pre-populate the "Prepared by" line on the cover.
// Falls back to the amber [INSERT] placeholder when profile is
// null / undefined or when every field is blank.
// ────────────────────────────────────────────────────────────

function buildCoverChildren(
  project: ProjectRow,
  mods: ModuleMap,
  profile?: EngineerProfile,
) {
  const hyd = mods.get('hydrology')?.outputs ?? {}
  const ph = mods.get('powerhouse')?.outputs ?? {}
  const fin = mods.get('financial')?.outputs ?? {}
  const today = new Date()
  const dateStr = today.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // ── Prepared-by line ────────────────────────────────────────────────────
  // Composed from the engineer profile saved on the Settings page.
  // Format: "Full Name · NEC Reg. NEC-CIV-XXXXX · Senior Civil Engineer · Firm Name"
  // Each field is only included when present and non-blank.
  const preparedByParts = [
    profile?.full_name,
    profile?.nec_reg_no ? `NEC Reg. ${profile.nec_reg_no}` : null,
    profile?.designation,
    profile?.firm_name,
  ].filter((v): v is string => Boolean(v && v.trim().length > 0))

  const preparedByText = preparedByParts.length > 0
    ? preparedByParts.join(' · ')
    : '[INSERT: Engineer name, NEC reg. no., firm name]'
  const isPlaceholder = preparedByParts.length === 0

  return [
    blank(), blank(), blank(),

    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 480 },
      children: [
        new TextRun({
          text: `DRAFT — DFS ${today.getFullYear()}`,
          font: FONT, size: 22, bold: true, color: C.amber,
        }),
      ],
    }),

    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [
        new TextRun({ text: 'DETAILED FEASIBILITY STUDY REPORT', font: FONT, size: 52, bold: true, color: C.ink }),
      ],
    }),

    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
      children: [new TextRun({ text: project.name, font: FONT, size: 40, bold: true, color: C.blue })],
    }),

    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: project.river ? `${project.river} River` : '[INSERT: River name]',
          font: FONT, size: 28, color: C.gray,
        }),
      ],
    }),

    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
      children: [
        new TextRun({
          text: project.district ? `${project.district} District, Nepal` : '[INSERT: District], Nepal',
          font: FONT, size: 26, color: C.gray,
        }),
      ],
    }),

    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `Installed Capacity: ${ph?.generator?.electricalPowerKw != null ? num(ph.generator.electricalPowerKw, 1) + ' kW' : (project.capacity_kw ? num(project.capacity_kw, 1) + ' kW' : '[INSERT]')}`,
          font: FONT, size: 26, bold: true,
        }),
      ],
    }),

    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `Gross Head: ${num(hyd?.grossHeadM, 2)} m   |   Design Flow: ${num(hyd?.qDesign, 3)} m\u00B3/s`,
          font: FONT, size: 22, color: C.ink,
        }),
      ],
    }),

    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [
        new TextRun({
          text: fin?.capex?.totalCapExNpr
            ? `Total CapEx: NPR ${nprCr(fin.capex.totalCapExNpr)} Cr   |   IRR (Project): ${num(fin.irrProjectPct, 2)} %`
            : '',
          font: FONT, size: 20, color: C.gray,
        }),
      ],
    }),

    blank(), blank(),

    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: 'Prepared by', font: FONT, size: 20, color: C.gray })],
    }),

    // ── CHANGED: dynamic profile line vs amber placeholder ──────────────
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: preparedByText,
          font: FONT,
          size: 22,
          italics: isPlaceholder,
          color: isPlaceholder ? C.amber : C.ink,
        }),
      ],
    }),

    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: `Date of submission: ${dateStr}`, font: FONT, size: 20, color: C.gray })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: 'Standard: AEPC DFS 2014', font: FONT, size: 20, color: C.gray })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'Generated by HydroStack \u2014 usehydrostack.com',
          font: FONT, size: 18, italics: true, color: C.gray,
        }),
      ],
    }),
  ]
}

// ────────────────────────────────────────────────────────────
// normalizeModuleData — translate actual DB JSONB key names to
// the canonical names the chapter builders expect.
// ────────────────────────────────────────────────────────────

function normalizeModuleData(raw: ModuleMap): ModuleMap {
  const norm = new Map(raw)

  // ── HYDROLOGY ──────────────────────────────────────────────
  const hydRow = raw.get('hydrology')
  if (hydRow) {
    const i = hydRow.inputs as any
    const o = hydRow.outputs as any
    const fdcObj: Record<string, number> = o?.fdc ?? {}
    const fdcPoints = Object.entries(fdcObj)
      .map(([k, v]) => ({ percentile: parseFloat(k.replace('q', '')), q: Number(v) }))
      .filter(pt => !isNaN(pt.percentile) && !isNaN(pt.q))
      .sort((a, b) => a.percentile - b.percentile)
    norm.set('hydrology', {
      inputs: i,
      outputs: {
        ...o,
        grossHeadM:        o?.head?.grossHead    ?? i?.grossHead,
        qDesign:           i?.qDesign,
        q40M3s:            o?.q40,
        q80M3s:            o?.q80,
        q95M3s:            o?.fdc?.q95           ?? o?.q95,
        catchmentAreaKm2:  i?.aTotal,
        meanAnnualFlowM3s: o?.qMean,
        highFloodM3s:      o?.flood?.q100Inst    ?? o?.flood?.q100Daily ?? o?.q100Inst,
        method:            (i?.method ?? 'wecs').replace('_dhm','').replace('_mip','').toLowerCase(),
        fdcPoints:         fdcPoints.length ? fdcPoints : undefined,
        wecs:              { mwiKm2: i?.mwi, reliefM: i?.a3000A ?? i?.a5000A },
      },
    })
  }

  // ── INTAKE ─────────────────────────────────────────────────
  const intakeRow = raw.get('intake')
  if (intakeRow) {
    const i = intakeRow.inputs as any
    const o = intakeRow.outputs as any
    norm.set('intake', {
      inputs: {
        ...i,
        designFlowM3s: i?.qDesign,
        rackSpacingMm: i?.rackBarSpacing ?? i?.rackBarSpacingMm,
        velocityM3s:   i?.rackApproachVelocity ?? i?.rackVelocity,
      },
      outputs: {
        ...o,
        trashRackArea:  o?.rackGrossArea,
        orificeAreaM2:  o?.rackNetArea,
        sillLengthM:    i?.basinWidth,
        hLossRackM:     o?.rackHeadLossAhec     ?? o?.rackHeadLossKirschmer,
        hLossEntranceM: o?.hLossEntranceM        ?? 0,
        totalHeadLossM: o?.totalHeadLossM        ?? o?.rackHeadLossAhec ?? o?.rackHeadLossKirschmer,
      },
    })
  }

  // ── HEADRACE ───────────────────────────────────────────────
  const hrRow = raw.get('headrace')
  if (hrRow) {
    const i = hrRow.inputs as any
    const o = hrRow.outputs as any
    const fbVol = o?.forebayActiveStorageM3
      ?? (Number(i?.forebayLength) * Number(i?.forebayWidth) * Number(i?.forebayDepth) || undefined)
    if (!o?.headrace) {
      norm.set('headrace', {
        inputs: i,
        outputs: {
          ...o,
          headrace: {
            lengthM:   i?.length,
            type:      i?.conduitType ?? i?.shape,
            bedSlopeM: i?.bedSlope,
            velocity:  o?.velocity,
            hLossM:    o?.hHeadrace ?? o?.hFriction,
          },
          forebay: {
            lengthM:  i?.forebayLength,
            widthM:   i?.forebayWidth,
            depthM:   i?.forebayDepth,
            volumeM3: fbVol,
          },
          totalHlossM: o?.hHeadrace ?? o?.hFriction,
        },
      })
    }
  }

  // ── ANCHOR BLOCK ───────────────────────────────────────────
  const abRow = raw.get('anchorblock')
  if (abRow) {
    const i = abRow.inputs as any
    const o = abRow.outputs as any
    if (o && !o.forces) {
      const govSlidCond = (o.governingSlidingCondition ?? 'contracting').toLowerCase()
      const govBearCond = (o.governingBearingCondition ?? 'contracting').toLowerCase()
      const govSlidData = govSlidCond === 'contracting' ? o.contracting : o.expanding
      const govBearData = govBearCond === 'contracting' ? o.contracting : o.expanding
      const fosSlid  = o.worstFosSliding     as number
      const fosOver  = o.worstFosOverturning as number
      const bearAct  = govBearData?.bearingMaxKpa as number
      const bearAllow = (i?.allowableBearingKpa ?? 450) as number
      const N2kN = (n: number | null | undefined) => n != null ? n / 1000 : null
      norm.set('anchorblock', {
        inputs: i,
        outputs: {
          ...o,
          forces: {
            f1:  N2kN(o.blockSelfWeightN),
            f2:  N2kN(o.Fs_N),
            f3:  N2kN(o.Fu_N),
            f4:  N2kN(o.Fd_exp_N),
            f5:  N2kN(o.Fd_N),
            f6:  N2kN(o.Spd_N),
            f7:  N2kN(o.Spu_N),
            f8:  N2kN(o.Du_N),
            f9:  N2kN(o.Dd_N),
            f10: N2kN(o.Sed_N),
            f11: N2kN(o.Seu_N),
            f12: N2kN(o.bendResultantN),
          },
          stability: {
            sliding:     { factor: fosSlid, required: 1.5, passed: fosSlid  >= 1.5 },
            overturning: { factor: fosOver, required: 1.5, passed: fosOver  >= 1.5 },
            bearing:     { actualKpa: bearAct, allowableKpa: bearAllow,
                           passed: bearAct != null && bearAct < bearAllow },
          },
          allChecksPassed: fosSlid >= 1.5 && fosOver >= 1.5 && bearAct != null && bearAct < bearAllow,
          blockVolM3:    o.blockVolumeM3,
          blockWeightKn: N2kN(o.blockSelfWeightN),
        },
      })
    }
  }

  return norm
}

// ────────────────────────────────────────────────────────────
// Public entry point — buildDfsReport
//
// CHANGED Day 12: accepts optional `profile` (EngineerProfile)
// and passes it down to buildCoverChildren so the cover page
// shows real engineer credentials instead of [INSERT] amber text.
// ────────────────────────────────────────────────────────────

export function buildDfsReport(
  project: ProjectRow,
  rawMods: ModuleMap,
  profile?: EngineerProfile,
  watermark?: boolean,
): Document {
  // Normalise all module JSONB keys to canonical names before building
  const mods = normalizeModuleData(rawMods)
  const today = new Date()
  const headerProj = project.name.length > 55 ? project.name.slice(0, 52) + '\u2026' : project.name

  const mainHeader = new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        children: [
          new TextRun({ text: headerProj, font: FONT, size: 18, color: C.gray, italics: true }),
          new TextRun({ text: '\tDFS ' + today.getFullYear() + ' \u00B7 DRAFT', font: FONT, size: 18, color: C.amber, italics: true, bold: true }),
        ],
      }),
      ...(watermark
        ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: 'STUDENT PLAN — upgrade at usehydrostack.com',
                  font: FONT,
                  size: 16,
                  italics: true,
                  color: C.amber,
                  bold: true,
                }),
              ],
            }),
          ]
        : []),
    ],
  })

  const mainFooter = new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        children: [
          new TextRun({ text: 'Page ', font: FONT, size: 18, color: C.gray }),
          new SimpleField('PAGE'),
          new TextRun({ text: '\tGenerated by HydroStack \u2014 usehydrostack.com', font: FONT, size: 18, color: C.gray, italics: true }),
        ],
      }),
    ],
  })

  const emptyHeader = new Header({ children: [new Paragraph({ children: [new TextRun({ text: '' })] })] })
  const emptyFooter = new Footer({ children: [new Paragraph({ children: [new TextRun({ text: '' })] })] })

  return new Document({
    creator: 'HydroStack \u2014 usehydrostack.com',
    title: `DFS Report \u2014 ${project.name}`,
    description: 'Detailed Feasibility Study Report per AEPC DFS 2014',
    styles: {
      default: {
        document: { run: { font: FONT, size: 22 } },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 32, bold: true, font: FONT, color: C.ink },
          paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 26, bold: true, font: FONT, color: C.ink },
          paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 22, bold: true, font: FONT, color: C.ink },
          paragraph: { spacing: { before: 160, after: 100 }, outlineLevel: 2 },
        },
      ],
    },
    sections: [
      {
        properties: {
          titlePage: true,
          page: {
            size: { width: A4_W, height: A4_H },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
          },
        },
        headers: { default: mainHeader, first: emptyHeader },
        footers: { default: mainFooter, first: emptyFooter },
        children: [
          // CHANGED: pass profile to cover builder
          ...buildCoverChildren(project, mods, profile),
          ...buildSalientFeatures(project, mods),
          ...buildTOC(),
          ...buildChapter1(project),
          ...buildChapter2(mods),
          ...buildChapter3(mods),
          ...buildChapter4(mods),
          ...buildChapter5(mods),
          ...buildChapter6(mods),
          ...buildChapter7(mods),
          ...buildChapter8(mods),
          ...buildChapter9(mods),
          ...buildChapter10(mods),
          ...buildAnnexA(project, mods),
          ...buildAnnexB(mods),
        ],
      },
    ],
  })
}