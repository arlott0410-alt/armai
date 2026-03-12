/**
 * Best-effort AI context cache. DB is source of truth.
 * Safe for Cloudflare Workers; L1 in-memory is optional optimization only.
 * Never cache: order state, payment status, shipment, COD status, payment target.
 */

export type CacheScope =
  | 'merchant_config'
  | 'products'
  | 'categories'
  | 'faqs'
  | 'promotions'
  | 'knowledge_entries'
  | 'cod_settings';

const TTL_MS: Record<CacheScope, number> = {
  merchant_config: 5 * 60 * 1000,
  products: 3 * 60 * 1000,
  categories: 3 * 60 * 1000,
  faqs: 3 * 60 * 1000,
  promotions: 3 * 60 * 1000,
  knowledge_entries: 3 * 60 * 1000,
  cod_settings: 5 * 60 * 1000,
};

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

function key(merchantId: string, scope: CacheScope): string {
  return `m:${merchantId}:${scope}`;
}

export function get<T>(merchantId: string, scope: CacheScope): T | null {
  const k = key(merchantId, scope);
  const entry = store.get(k) as CacheEntry<T> | undefined;
  if (!entry || Date.now() > entry.expiresAt) {
    if (entry) store.delete(k);
    return null;
  }
  return entry.value;
}

export function set<T>(merchantId: string, scope: CacheScope, value: T): void {
  const k = key(merchantId, scope);
  store.set(k, {
    value,
    expiresAt: Date.now() + TTL_MS[scope],
  });
}

/** Invalidate one scope for a merchant. */
export function invalidate(merchantId: string, scope: CacheScope): void {
  store.delete(key(merchantId, scope));
}

/** Invalidate all cache for a merchant (e.g. settings updated). */
export function invalidateMerchant(merchantId: string): void {
  for (const sc of Object.keys(TTL_MS) as CacheScope[]) {
    store.delete(key(merchantId, sc));
  }
}

/** Invalidate product/knowledge-related caches only. */
export function invalidateCatalogAndKnowledge(merchantId: string): void {
  invalidate(merchantId, 'products');
  invalidate(merchantId, 'categories');
  invalidate(merchantId, 'faqs');
  invalidate(merchantId, 'promotions');
  invalidate(merchantId, 'knowledge_entries');
}

/** For metrics: approximate hit check without consuming. */
export function hasValidEntry(merchantId: string, scope: CacheScope): boolean {
  return get(merchantId, scope) !== null;
}
