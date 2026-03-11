import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateMerchantFaqBody, CreateMerchantPromotionBody, CreateMerchantKnowledgeEntryBody } from '@armai/shared';

export async function listFaqs(supabase: SupabaseClient, merchantId: string, activeOnly = true) {
  let q = supabase.from('merchant_faqs').select('*').eq('merchant_id', merchantId).order('sort_order');
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createFaq(supabase: SupabaseClient, merchantId: string, body: CreateMerchantFaqBody) {
  const { data, error } = await supabase
    .from('merchant_faqs')
    .insert({
      merchant_id: merchantId,
      question: body.question,
      answer: body.answer,
      keywords: body.keywords ?? null,
      sort_order: body.sort_order ?? 0,
      is_active: body.is_active ?? true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateFaq(supabase: SupabaseClient, merchantId: string, faqId: string, body: Partial<CreateMerchantFaqBody>) {
  const { data, error } = await supabase
    .from('merchant_faqs')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', faqId)
    .eq('merchant_id', merchantId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listPromotions(supabase: SupabaseClient, merchantId: string, activeOnly = true) {
  let q = supabase.from('merchant_promotions').select('*').eq('merchant_id', merchantId).order('created_at', { ascending: false });
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createPromotion(supabase: SupabaseClient, merchantId: string, body: CreateMerchantPromotionBody) {
  const { data, error } = await supabase
    .from('merchant_promotions')
    .insert({
      merchant_id: merchantId,
      title: body.title,
      content: body.content ?? null,
      valid_from: body.valid_from ?? null,
      valid_until: body.valid_until ?? null,
      keywords: body.keywords ?? null,
      is_active: body.is_active ?? true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updatePromotion(
  supabase: SupabaseClient,
  merchantId: string,
  promotionId: string,
  body: Partial<CreateMerchantPromotionBody>
) {
  const { data, error } = await supabase
    .from('merchant_promotions')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', promotionId)
    .eq('merchant_id', merchantId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listKnowledgeEntries(supabase: SupabaseClient, merchantId: string, opts: { type?: string; activeOnly?: boolean } = {}) {
  let q = supabase.from('merchant_knowledge_entries').select('*').eq('merchant_id', merchantId).order('priority', { ascending: false });
  if (opts.type) q = q.eq('type', opts.type);
  if (opts.activeOnly !== false) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createKnowledgeEntry(supabase: SupabaseClient, merchantId: string, body: CreateMerchantKnowledgeEntryBody) {
  const { data, error } = await supabase
    .from('merchant_knowledge_entries')
    .insert({
      merchant_id: merchantId,
      type: body.type,
      title: body.title,
      content: body.content,
      keywords: body.keywords ?? null,
      priority: body.priority ?? 0,
      is_active: body.is_active ?? true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateKnowledgeEntry(supabase: SupabaseClient, merchantId: string, entryId: string, body: Partial<CreateMerchantKnowledgeEntryBody>) {
  const { data, error } = await supabase
    .from('merchant_knowledge_entries')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', entryId)
    .eq('merchant_id', merchantId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}
