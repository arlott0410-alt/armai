/**
 * WhatsApp incoming message: build AI context, call Gemini, return reply text for sending.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Env } from '../env.js'
import * as aiContext from './ai-context.js'
import { getSupabaseAdmin } from '../lib/supabase.js'

/** Generate one reply using Gemini from merchant context + customer message. */
export async function generateWhatsAppReply(
  supabase: SupabaseClient,
  apiKey: string,
  p: {
    merchantId: string
    conversationId: string
    customerMessage: string
  }
): Promise<string | null> {
  const { merchantId, conversationId, customerMessage } = p
  if (!customerMessage?.trim()) return null

  const { data: settings } = await supabase
    .from('merchant_settings')
    .select('ai_system_prompt')
    .eq('merchant_id', merchantId)
    .single()
  const merchantPrompt = settings?.ai_system_prompt ?? null

  const built = await aiContext.buildAiContext(supabase, {
    merchantId,
    merchantPrompt,
    conversationId,
    useConversationSummary: true,
    customerMessage: customerMessage.trim(),
  })

  const contextBlob = JSON.stringify(built.structuredContext, null, 0).slice(0, 12000)
  const userContent = `Structured context (use only this data, do not invent):\n${contextBlob}\n\nCustomer message:\n${customerMessage.trim()}\n\nReply in one short message (no JSON, no markdown).`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userContent }] }],
        systemInstruction: { parts: [{ text: built.systemPrompt }] },
        generationConfig: {
          maxOutputTokens: 512,
          temperature: 0.3,
        },
      }),
    }
  )
  if (!res.ok) return null
  const data = (await res.json().catch(() => ({}))) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  return text ?? null
}

/** Load merchant ID and run auto-reply for one WhatsApp message; returns reply text or null. */
export async function getReplyForIncomingWhatsApp(
  env: Env,
  p: {
    merchantId: string
    conversationId: string
    customerMessage: string
  }
): Promise<string | null> {
  const apiKey = env.GEMINI_API_KEY
  if (!apiKey) return null
  const supabase = getSupabaseAdmin(env)
  return generateWhatsAppReply(supabase, apiKey, p)
}
