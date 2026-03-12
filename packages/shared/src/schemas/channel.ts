import { z } from 'zod'

/** Channel type: facebook | whatsapp */
export const channelTypeSchema = z.enum(['facebook', 'whatsapp'])
export type ChannelType = z.infer<typeof channelTypeSchema>

/** Message direction */
export const messageDirectionSchema = z.enum(['inbound', 'outbound'])
export type MessageDirection = z.infer<typeof messageDirectionSchema>

/** Message type for normalized store */
export const channelMessageTypeSchema = z.enum(['text', 'image', 'file', 'interactive', 'system'])
export type ChannelMessageType = z.infer<typeof channelMessageTypeSchema>

/** Normalized message structure consumed by AI pipeline (all channels). */
export const normalizedMessageSchema = z.object({
  merchant_id: z.string().uuid(),
  channel_type: channelTypeSchema,
  customer_id: z.string(),
  message_type: channelMessageTypeSchema.default('text'),
  text: z.string().nullable(),
  media_url: z.string().url().nullable().optional(),
  timestamp: z.string().datetime(),
})
export type NormalizedMessage = z.infer<typeof normalizedMessageSchema>

/** Payload for sendChannelMessage outbound. */
export const sendChannelMessagePayloadSchema = z.object({
  text: z.string().optional(),
  media_url: z.string().url().optional(),
  message_type: channelMessageTypeSchema.default('text'),
})
export type SendChannelMessagePayload = z.infer<typeof sendChannelMessagePayloadSchema>

/** Facebook connect: frontend sends short-lived user access token. */
export const facebookConnectBodySchema = z.object({
  access_token: z.string().min(1),
})
export type FacebookConnectBody = z.infer<typeof facebookConnectBodySchema>

/** Facebook store page: selected page from connect flow. */
export const facebookStorePageBodySchema = z.object({
  page_id: z.string().min(1),
  page_name: z.string().optional(),
  page_access_token: z.string().min(1),
})
export type FacebookStorePageBody = z.infer<typeof facebookStorePageBodySchema>
