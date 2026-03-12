import { z } from 'zod';

/** WhatsApp webhook query (GET verification). */
export const whatsappWebhookQuerySchema = z.object({
  'hub.mode': z.literal('subscribe').optional(),
  'hub.verify_token': z.string().optional(),
  'hub.challenge': z.string().optional(),
});

/** WhatsApp Cloud API webhook body (messages, status, etc.). */
const waContactSchema = z.object({
  wa_id: z.string().optional(),
  profile: z.object({ name: z.string().optional() }).optional(),
}).passthrough();

const waTextSchema = z.object({ body: z.string() }).passthrough();
const waImageSchema = z.object({
  id: z.string().optional(),
  mime_type: z.string().optional(),
  sha256: z.string().optional(),
  caption: z.string().optional(),
}).passthrough();
const waDocumentSchema = z.object({
  id: z.string().optional(),
  mime_type: z.string().optional(),
  sha256: z.string().optional(),
  filename: z.string().optional(),
  caption: z.string().optional(),
}).passthrough();

const waMessageSchema = z.object({
  id: z.string().optional(),
  from: z.string(),
  timestamp: z.string(),
  type: z.enum(['text', 'image', 'document', 'audio', 'video']).optional(),
  text: waTextSchema.optional(),
  image: waImageSchema.optional(),
  document: waDocumentSchema.optional(),
}).passthrough();

/** One change in entry.changes[] - has a "value" wrapper in Cloud API. */
const waChangeValueSchema = z.object({
  messaging_product: z.literal('whatsapp').optional(),
  metadata: z.object({
    display_phone_number: z.string().optional(),
    phone_number_id: z.string(),
  }).passthrough(),
  contacts: z.array(waContactSchema).optional(),
  messages: z.array(waMessageSchema).optional(),
  statuses: z.array(z.object({ id: z.string().optional() }).passthrough()).optional(),
  errors: z.array(z.object({ code: z.number(), title: z.string() }).passthrough()).optional(),
}).passthrough();

const waChangeSchema = z.object({
  field: z.string().optional(),
  value: waChangeValueSchema.optional(),
}).passthrough();

const waEntrySchema = z.object({
  id: z.string().optional(),
  changes: z.array(waChangeSchema).optional(),
}).passthrough();

export const whatsappWebhookBodySchema = z.object({
  object: z.literal('whatsapp_business_account').optional(),
  entry: z.array(waEntrySchema).optional(),
});

export type WhatsAppWebhookBody = z.infer<typeof whatsappWebhookBodySchema>;
export type WhatsAppChangeValue = z.infer<typeof waChangeValueSchema>;
export type WhatsAppMessage = z.infer<typeof waMessageSchema>;

/** Create or update WhatsApp connection (no token value in response). */
export const whatsappConnectionUpsertSchema = z.object({
  phone_number_id: z.string().min(1).max(64),
  waba_id: z.string().max(64).nullable().optional(),
  business_account_name: z.string().max(255).nullable().optional(),
  access_token_reference: z.string().max(512).nullable().optional(),
  webhook_verify_token: z.string().max(255).nullable().optional(),
  is_active: z.boolean().optional(),
});
export type WhatsAppConnectionUpsert = z.infer<typeof whatsappConnectionUpsertSchema>;
