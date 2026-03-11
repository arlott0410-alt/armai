import { z } from 'zod';

export const billingStatusEnum = z.enum(['active', 'past_due', 'trialing', 'cancelled']);
export type BillingStatus = z.infer<typeof billingStatusEnum>;

export const merchantPlanRowSchema = z.object({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  plan_code: z.string(),
  billing_status: billingStatusEnum,
  monthly_price_usd: z.number().optional(),
  currency: z.string().optional(),
  billing_cycle: z.string().optional(),
  started_at: z.string().datetime().nullable().optional(),
  trial_ends_at: z.string().datetime().nullable().optional(),
  current_period_start: z.string().datetime().nullable().optional(),
  current_period_end: z.string().datetime().nullable().optional(),
  next_billing_at: z.string().datetime().nullable().optional(),
  last_paid_at: z.string().datetime().nullable().optional(),
  grace_until: z.string().datetime().nullable().optional(),
  cancel_at_period_end: z.boolean().optional(),
  is_auto_renew: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type MerchantPlanRow = z.infer<typeof merchantPlanRowSchema>;

export const billingEventRowSchema = z.object({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  event_type: z.string(),
  amount: z.number(),
  currency: z.string(),
  invoice_period_start: z.string().datetime().nullable().optional(),
  invoice_period_end: z.string().datetime().nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
  paid_at: z.string().datetime().nullable().optional(),
  status: z.string(),
  reference_note: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type MerchantBillingEventRow = z.infer<typeof billingEventRowSchema>;

export const internalNoteRowSchema = z.object({
  id: z.string().uuid(),
  merchant_id: z.string().uuid(),
  actor_id: z.string().uuid().nullable().optional(),
  note: z.string(),
  created_at: z.string(),
});
export type MerchantInternalNoteRow = z.infer<typeof internalNoteRowSchema>;

export const updateMerchantPlanBodySchema = z.object({
  plan_code: z.string().max(64).optional(),
  billing_status: billingStatusEnum.optional(),
  monthly_price_usd: z.number().min(0).optional(),
  currency: z.string().max(8).optional(),
  trial_ends_at: z.string().datetime().nullable().optional(),
  next_billing_at: z.string().datetime().nullable().optional(),
  last_paid_at: z.string().datetime().nullable().optional(),
  grace_until: z.string().datetime().nullable().optional(),
  cancel_at_period_end: z.boolean().optional(),
  is_auto_renew: z.boolean().optional(),
  notes: z.string().max(5000).nullable().optional(),
});
export type UpdateMerchantPlanBody = z.infer<typeof updateMerchantPlanBodySchema>;

export const createBillingEventBodySchema = z.object({
  event_type: z.string().min(1).max(64),
  amount: z.number(),
  currency: z.string().max(8).optional(),
  invoice_period_start: z.string().datetime().nullable().optional(),
  invoice_period_end: z.string().datetime().nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
  paid_at: z.string().datetime().nullable().optional(),
  status: z.string().max(32).optional(),
  reference_note: z.string().max(1000).optional(),
});
export type CreateBillingEventBody = z.infer<typeof createBillingEventBodySchema>;

export const createInternalNoteBodySchema = z.object({
  note: z.string().min(1).max(10000),
});
export type CreateInternalNoteBody = z.infer<typeof createInternalNoteBodySchema>;
