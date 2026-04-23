export type Standard = 'AEPC_NP' | 'MNRE_IN' | 'GENERIC'
export type ProjectStatus = 'draft' | 'in_progress' | 'complete'
export type ModuleType = 'hydrology' | 'intake' | 'settling' | 'headrace' | 'forebay' | 'penstock' | 'anchor' | 'powerhouse' | 'energy' | 'financial'
export type ArtifactKind = 'dfs_pdf' | 'dxf_pack' | 'excel_export'
export type UserRole = 'owner' | 'member' | 'viewer'

export interface Organization {
  id: string
  name: string
  country: string
  created_at: string
}

export interface Profile {
  id: string
  org_id: string
  role: UserRole
  full_name: string | null
  phone: string | null
  pan_number: string | null
  organizations?: Organization
}

export interface Project {
  id: string
  org_id: string
  name: string
  river: string | null
  district: string | null
  capacity_kw: number | null
  standard: Standard
  status: ProjectStatus
  created_by: string
  created_at: string
}

export interface ProjectModule {
  project_id: string
  module: ModuleType
  inputs: Record<string, unknown>
  outputs: Record<string, unknown>
  updated_at: string
}

export interface Artifact {
  id: string
  project_id: string
  kind: ArtifactKind
  storage_path: string
  created_at: string
}

export interface Subscription {
  org_id: string
  plan: string
  rail: string
  status: string
  current_period_end: string
  external_ref: string
}