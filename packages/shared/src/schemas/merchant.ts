import { z } from 'zod';

export const createMerchantBodySchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  admin_email: z.string().email(),
  admin_password: z.string().min(6, 'Password at least 6 characters'),
  admin_full_name: z.string().max(255).optional(),
  /** ISO 3166-1 alpha-2 (e.g. LA, TH). Default TH. */
  default_country: z.string().length(2).transform((s) => s.toUpperCase()).optional(),
  /** ISO 4217 (e.g. LAK, THB). Default derived from default_country if not set. */
  default_currency: z.string().length(3).transform((s) => s.toUpperCase()).optional(),
});

export type CreateMerchantBody = z.infer<typeof createMerchantBodySchema>;

export const updateMerchantSettingsBodySchema = z.object({
  ai_system_prompt: z.string().max(10000).nullable().optional(),
  bank_parser_id: z.string().uuid().nullable().optional(),
  webhook_verify_token: z.string().max(255).nullable().optional(),
  auto_send_shipping_confirmation: z.boolean().optional(),
  telegram_notify_order_paid: z.boolean().optional(),
  telegram_allow_shipment_confirmation: z.boolean().optional(),
  telegram_allow_ai_escalation: z.boolean().optional(),
  telegram_require_authorized_admins: z.boolean().optional(),
  telegram_auto_send_shipment_confirmation: z.boolean().optional(),
});

export type UpdateMerchantSettingsBody = z.infer<typeof updateMerchantSettingsBodySchema>;
