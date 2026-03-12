import type { SupabaseClient } from '@supabase/supabase-js'

export interface SubscriptionPlanRow {
  id: string
  name: string
  code: string
  price_lak: number
  features: string[]
  max_users: number | null
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

/** Public list: active plans only, ordered by sort_order. */
export async function listPlansPublic(supabase: SupabaseClient): Promise<SubscriptionPlanRow[]> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select(
      'id, name, code, price_lak, features, max_users, active, sort_order, created_at, updated_at'
    )
    .eq('active', true)
    .order('sort_order', { ascending: true })
  if (error) return []
  return (data ?? []).map((r) => ({
    ...r,
    features: Array.isArray(r.features) ? r.features : [],
  })) as SubscriptionPlanRow[]
}

/** Superadmin: list all plans. */
export async function listPlansAdmin(supabase: SupabaseClient): Promise<SubscriptionPlanRow[]> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select(
      'id, name, code, price_lak, features, max_users, active, sort_order, created_at, updated_at'
    )
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    ...r,
    features: Array.isArray(r.features) ? r.features : [],
  })) as SubscriptionPlanRow[]
}

/** Active plans only (for public/checkout). */
export async function getPlanByCode(
  supabase: SupabaseClient,
  code: string
): Promise<SubscriptionPlanRow | null> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select(
      'id, name, code, price_lak, features, max_users, active, sort_order, created_at, updated_at'
    )
    .eq('code', code)
    .eq('active', true)
    .maybeSingle()
  if (error || !data) return null
  return {
    ...data,
    features: Array.isArray(data.features) ? data.features : [],
  } as SubscriptionPlanRow
}

/** Any plan by code (for activation/webhook). */
export async function getPlanByCodeAny(
  supabase: SupabaseClient,
  code: string
): Promise<SubscriptionPlanRow | null> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select(
      'id, name, code, price_lak, features, max_users, active, sort_order, created_at, updated_at'
    )
    .eq('code', code)
    .maybeSingle()
  if (error || !data) return null
  return {
    ...data,
    features: Array.isArray(data.features) ? data.features : [],
  } as SubscriptionPlanRow
}

export async function createPlan(
  supabase: SupabaseClient,
  payload: {
    name: string
    code: string
    price_lak: number
    features: string[]
    max_users?: number | null
    active?: boolean
    sort_order?: number
  }
): Promise<SubscriptionPlanRow> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .insert({
      name: payload.name,
      code: payload.code,
      price_lak: payload.price_lak,
      features: payload.features,
      max_users: payload.max_users ?? null,
      active: payload.active ?? true,
      sort_order: payload.sort_order ?? 0,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return {
    ...data,
    features: Array.isArray(data.features) ? data.features : [],
  } as SubscriptionPlanRow
}

export async function updatePlan(
  supabase: SupabaseClient,
  id: string,
  payload: Partial<{
    name: string
    code: string
    price_lak: number
    features: string[]
    max_users: number | null
    active: boolean
    sort_order: number
  }>
): Promise<SubscriptionPlanRow> {
  const { data, error } = await supabase
    .from('subscription_plans')
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return {
    ...data,
    features: Array.isArray(data.features) ? data.features : [],
  } as SubscriptionPlanRow
}

export async function deletePlan(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('subscription_plans').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
