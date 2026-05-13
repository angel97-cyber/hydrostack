// Single source of truth for plan tiers, limits, pricing, watermark policy.
// Used by gating logic, admin actions, pricing page, billing page, report builder.

export const PLAN_LIMITS = {
  beta:       { projectLimit: 999, label: 'Beta',       priceNPR: null,  watermark: false },
  student:    { projectLimit: 2,   label: 'Student',    priceNPR: null,  watermark: true  },
  solo:       { projectLimit: 10,  label: 'Solo',       priceNPR: 2500,  watermark: false },
  studio:     { projectLimit: 999, label: 'Studio',     priceNPR: 9000,  watermark: false },
  enterprise: { projectLimit: 999, label: 'Enterprise', priceNPR: 25000, watermark: false },
} as const

export type PlanName = keyof typeof PLAN_LIMITS

export const PAID_PLANS: PlanName[] = ['solo', 'studio', 'enterprise']

export function getProjectLimit(plan: string): number {
  return PLAN_LIMITS[plan as PlanName]?.projectLimit ?? 999
}

export function shouldWatermark(plan: string): boolean {
  return PLAN_LIMITS[plan as PlanName]?.watermark ?? false
}

export function getPlanLabel(plan: string): string {
  return PLAN_LIMITS[plan as PlanName]?.label ?? plan
}

export function getPlanPrice(plan: string): number | null {
  return PLAN_LIMITS[plan as PlanName]?.priceNPR ?? null
}

export function isPaidPlan(plan: string): boolean {
  return PAID_PLANS.includes(plan as PlanName)
}

// Plans the user can upgrade TO, given their current plan.
export function getUpgradeOptions(currentPlan: string): PlanName[] {
  const order: PlanName[] = ['beta', 'student', 'solo', 'studio', 'enterprise']
  const currentIdx = order.indexOf(currentPlan as PlanName)
  if (currentIdx < 0) return ['solo', 'studio', 'enterprise']
  return order.slice(currentIdx + 1).filter(p => p !== 'student') as PlanName[]
}