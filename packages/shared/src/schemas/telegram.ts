import { z } from 'zod';

/** Telegram admin role. */
export const TELEGRAM_ADMIN_ROLES = ['owner', 'admin', 'operator'] as const;
export type TelegramAdminRole = (typeof TELEGRAM_ADMIN_ROLES)[number];

export const telegramConnectionPatchSchema = z.object({
  bot_token_encrypted_or_bound_reference: z.string().max(512).nullable().optional(),
  telegram_group_id: z.string().min(1).max(128).optional(),
  telegram_group_title: z.string().max(255).nullable().optional(),
  is_active: z.boolean().optional(),
});
export type TelegramConnectionPatch = z.infer<typeof telegramConnectionPatchSchema>;

export const telegramAdminCreateSchema = z.object({
  telegram_user_id: z.string().min(1).max(64),
  telegram_username: z.string().max(128).nullable().optional(),
  telegram_display_name: z.string().max(255).nullable().optional(),
  role: z.enum(TELEGRAM_ADMIN_ROLES).optional(),
});
export type TelegramAdminCreate = z.infer<typeof telegramAdminCreateSchema>;

export const telegramAdminPatchSchema = z.object({
  telegram_username: z.string().max(128).nullable().optional(),
  telegram_display_name: z.string().max(255).nullable().optional(),
  role: z.enum(TELEGRAM_ADMIN_ROLES).optional(),
  is_active: z.boolean().optional(),
});
export type TelegramAdminPatch = z.infer<typeof telegramAdminPatchSchema>;

export const linkShipmentImageOrderSchema = z.object({
  order_id: z.string().uuid(),
});
export type LinkShipmentImageOrder = z.infer<typeof linkShipmentImageOrderSchema>;
