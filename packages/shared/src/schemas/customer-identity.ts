import { z } from 'zod';

export const merchantCustomerStatusSchema = z.enum(['active', 'archived', 'blocked']);
export type MerchantCustomerStatus = z.infer<typeof merchantCustomerStatusSchema>;

export const customerIdentityEventTypeSchema = z.enum([
  'identity_created',
  'auto_linked',
  'manually_linked',
  'manually_unlinked',
  'merge_rejected',
]);
export type CustomerIdentityEventType = z.infer<typeof customerIdentityEventTypeSchema>;

export const customerIdentityActorTypeSchema = z.enum(['system', 'merchant_admin', 'support']);
export type CustomerIdentityActorType = z.infer<typeof customerIdentityActorTypeSchema>;

export const linkIdentitiesBodySchema = z.object({
  channel_identity_id: z.string().uuid(),
  merchant_customer_id: z.string().uuid(),
});
export type LinkIdentitiesBody = z.infer<typeof linkIdentitiesBodySchema>;

export const unlinkIdentityBodySchema = z.object({
  channel_identity_id: z.string().uuid(),
});
export type UnlinkIdentityBody = z.infer<typeof unlinkIdentityBodySchema>;

export const updateMerchantCustomerBodySchema = z.object({
  primary_display_name: z.string().max(255).nullable().optional(),
  phone_number: z.string().max(64).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: merchantCustomerStatusSchema.optional(),
});
export type UpdateMerchantCustomerBody = z.infer<typeof updateMerchantCustomerBodySchema>;

export const createMerchantCustomerBodySchema = z.object({
  primary_display_name: z.string().max(255).nullable().optional(),
  phone_number: z.string().max(64).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  link_channel_identity_id: z.string().uuid().nullable().optional(),
});
export type CreateMerchantCustomerBody = z.infer<typeof createMerchantCustomerBodySchema>;
