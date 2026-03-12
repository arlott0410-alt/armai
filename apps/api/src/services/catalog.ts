import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreateProductCategoryBody, CreateProductBody, CreateProductVariantBody, CreateProductKeywordBody } from '@armai/shared';
import * as contextCache from './ai-context-cache.js';

export async function listCategories(supabase: SupabaseClient, merchantId: string, activeOnly = true) {
  let q = supabase.from('product_categories').select('*').eq('merchant_id', merchantId).order('sort_order');
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createCategory(supabase: SupabaseClient, merchantId: string, body: CreateProductCategoryBody) {
  const { data, error } = await supabase
    .from('product_categories')
    .insert({
      merchant_id: merchantId,
      name: body.name,
      description: body.description ?? null,
      sort_order: body.sort_order ?? 0,
      is_active: body.is_active ?? true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  contextCache.invalidateCatalogAndKnowledge(merchantId);
  return data;
}

export async function updateCategory(supabase: SupabaseClient, merchantId: string, categoryId: string, body: Partial<CreateProductCategoryBody>) {
  const { data, error } = await supabase
    .from('product_categories')
    .update({
      ...body,
      updated_at: new Date().toISOString(),
    })
    .eq('id', categoryId)
    .eq('merchant_id', merchantId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  contextCache.invalidateCatalogAndKnowledge(merchantId);
  return data;
}

export async function listProducts(supabase: SupabaseClient, merchantId: string, opts: { categoryId?: string; status?: string; aiVisibleOnly?: boolean } = {}) {
  let q = supabase.from('products').select('*').eq('merchant_id', merchantId).order('created_at', { ascending: false });
  if (opts.categoryId) q = q.eq('category_id', opts.categoryId);
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.aiVisibleOnly) q = q.eq('ai_visible', true).eq('status', 'active');
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getProduct(supabase: SupabaseClient, merchantId: string, productId: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('merchant_id', merchantId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createProduct(supabase: SupabaseClient, merchantId: string, body: CreateProductBody) {
  const { data, error } = await supabase
    .from('products')
    .insert({
      merchant_id: merchantId,
      category_id: body.category_id ?? null,
      name: body.name,
      slug: body.slug,
      description: body.description ?? null,
      base_price: body.base_price,
      sale_price: body.sale_price ?? null,
      currency: body.currency ?? 'THB',
      sku: body.sku ?? null,
      status: body.status ?? 'active',
      requires_manual_confirmation: body.requires_manual_confirmation ?? false,
      ai_visible: body.ai_visible ?? true,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  contextCache.invalidateCatalogAndKnowledge(merchantId);
  return data;
}

export async function updateProduct(supabase: SupabaseClient, merchantId: string, productId: string, body: Partial<CreateProductBody>) {
  const { data, error } = await supabase
    .from('products')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .eq('merchant_id', merchantId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  contextCache.invalidateCatalogAndKnowledge(merchantId);
  return data;
}

export async function listVariants(supabase: SupabaseClient, merchantId: string, productId: string) {
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('merchant_id', merchantId)
    .eq('product_id', productId)
    .order('created_at');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createVariant(supabase: SupabaseClient, merchantId: string, body: CreateProductVariantBody) {
  const { data, error } = await supabase
    .from('product_variants')
    .insert({
      merchant_id: merchantId,
      product_id: body.product_id,
      name: body.name,
      option_value_1: body.option_value_1 ?? null,
      option_value_2: body.option_value_2 ?? null,
      option_value_3: body.option_value_3 ?? null,
      price_override: body.price_override ?? null,
      stock_qty: body.stock_qty ?? null,
      status: body.status ?? 'active',
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listKeywords(supabase: SupabaseClient, merchantId: string, productId?: string) {
  let q = supabase.from('product_keywords').select('*').eq('merchant_id', merchantId);
  if (productId) q = q.eq('product_id', productId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createKeyword(supabase: SupabaseClient, merchantId: string, body: CreateProductKeywordBody) {
  const { data, error } = await supabase
    .from('product_keywords')
    .insert({ merchant_id: merchantId, product_id: body.product_id, keyword: body.keyword })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteKeyword(supabase: SupabaseClient, merchantId: string, keywordId: string) {
  const { error } = await supabase.from('product_keywords').delete().eq('id', keywordId).eq('merchant_id', merchantId);
  if (error) throw new Error(error.message);
}

/** Search products by keyword (for AI retrieval). */
export async function searchProductsByKeyword(supabase: SupabaseClient, merchantId: string, query: string) {
  const normalized = query.toLowerCase().trim();
  if (!normalized) return [];
  const { data: kwRows } = await supabase
    .from('product_keywords')
    .select('product_id')
    .eq('merchant_id', merchantId)
    .ilike('keyword', `%${normalized}%`);
  const productIds = [...new Set((kwRows ?? []).map((r) => r.product_id))];
  if (productIds.length === 0) return [];
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .eq('ai_visible', true)
    .in('id', productIds);
  return products ?? [];
}
