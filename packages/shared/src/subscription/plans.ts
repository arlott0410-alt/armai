/**
 * Enterprise subscription plan definitions for Laos SaaS ($50–$300 USD/month).
 */

export const PLAN_CODES = ['basic', 'pro'] as const
export type PlanCode = (typeof PLAN_CODES)[number]

export const SUBSCRIPTION_PLAN_CATALOG: Record<
  PlanCode,
  {
    code: PlanCode
    nameKey: string
    monthlyPriceUsd: number
    features: string[]
    maxUsers: number | null
    supportLevel: string
  }
> = {
  basic: {
    code: 'basic',
    nameKey: 'plan.basic',
    monthlyPriceUsd: 50,
    features: ['Core AI features', 'Limited users (3)', 'Email support'],
    maxUsers: 3,
    supportLevel: 'email',
  },
  pro: {
    code: 'pro',
    nameKey: 'plan.pro',
    monthlyPriceUsd: 300,
    features: ['Advanced AI', 'Unlimited users', 'Analytics', 'Priority support'],
    maxUsers: null,
    supportLevel: 'priority',
  },
}

export function getPlanByCode(code: string): (typeof SUBSCRIPTION_PLAN_CATALOG)[PlanCode] | null {
  if (code === 'basic' || code === 'pro') return SUBSCRIPTION_PLAN_CATALOG[code]
  return null
}
