/**
 * Multi-channel customer identity: unified merchant customer + channel identities.
 * Safe linking (auto on exact phone match; manual by merchant); full audit trail.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChannelType } from '@armai/shared';
import type { CustomerIdentityActorType, CustomerIdentityEventType } from '@armai/shared';

/** Normalize phone for matching: digits only, optional leading 0/66 strip to canonical. */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (phone == null || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  return digits;
}

/** Get or create customer_channel_identity; update last_seen_at and optional phone/display name. */
export async function getOrCreateChannelIdentity(
  supabase: SupabaseClient,
  p: {
    merchantId: string;
    channelType: ChannelType;
    externalUserId: string;
    channelDisplayName?: string | null;
    phoneNumber?: string | null;
    profileImageUrl?: string | null;
  }
): Promise<{ id: string; merchantCustomerId: string | null }> {
  const now = new Date().toISOString();
  const normPhone = normalizePhone(p.phoneNumber);

  const { data: existing } = await supabase
    .from('customer_channel_identities')
    .select('id, merchant_customer_id')
    .eq('merchant_id', p.merchantId)
    .eq('channel_type', p.channelType)
    .eq('external_user_id', p.externalUserId)
    .single();

  if (existing) {
    await supabase
      .from('customer_channel_identities')
      .update({
        last_seen_at: now,
        channel_display_name: p.channelDisplayName ?? undefined,
        phone_number: p.phoneNumber ?? undefined,
        normalized_phone: normPhone ?? undefined,
        profile_image_url: p.profileImageUrl ?? undefined,
        updated_at: now,
      })
      .eq('id', existing.id);
    return { id: existing.id, merchantCustomerId: existing.merchant_customer_id };
  }

  const { data: inserted, error } = await supabase
    .from('customer_channel_identities')
    .insert({
      merchant_id: p.merchantId,
      channel_type: p.channelType,
      external_user_id: p.externalUserId,
      channel_display_name: p.channelDisplayName ?? null,
      phone_number: p.phoneNumber ?? null,
      normalized_phone: normPhone,
      profile_image_url: p.profileImageUrl ?? null,
      first_seen_at: now,
      last_seen_at: now,
      updated_at: now,
    })
    .select('id, merchant_customer_id')
    .single();

  if (error) throw new Error(error.message);
  await recordIdentityEvent(supabase, {
    merchantId: p.merchantId,
    channelIdentityId: inserted!.id,
    eventType: 'identity_created',
    actorType: 'system',
  });
  return { id: inserted!.id, merchantCustomerId: inserted!.merchant_customer_id };
}

/** Record an identity event for audit. */
export async function recordIdentityEvent(
  supabase: SupabaseClient,
  p: {
    merchantId: string;
    merchantCustomerId?: string | null;
    channelIdentityId?: string | null;
    eventType: CustomerIdentityEventType;
    previousMerchantCustomerId?: string | null;
    newMerchantCustomerId?: string | null;
    reason?: string | null;
    actorType: CustomerIdentityActorType;
    actorId?: string | null;
  }
): Promise<void> {
  const { error } = await supabase.from('customer_identity_events').insert({
    merchant_id: p.merchantId,
    merchant_customer_id: p.merchantCustomerId ?? null,
    channel_identity_id: p.channelIdentityId ?? null,
    event_type: p.eventType,
    previous_merchant_customer_id: p.previousMerchantCustomerId ?? null,
    new_merchant_customer_id: p.newMerchantCustomerId ?? null,
    reason: p.reason ?? null,
    actor_type: p.actorType,
    actor_id: p.actorId ?? null,
  });
  if (error) throw new Error(error.message);
}

/**
 * Auto-link by exact normalized phone: if this identity has normalized_phone and
 * exactly one merchant_customer with same normalized_phone exists (and is active), link.
 * Returns linked merchant_customer_id or null.
 */
export async function tryAutoLinkByPhone(
  supabase: SupabaseClient,
  p: {
    merchantId: string;
    channelIdentityId: string;
    normalizedPhone: string | null;
  }
): Promise<string | null> {
  if (!p.normalizedPhone?.trim()) return null;

  const { data: existingLink } = await supabase
    .from('customer_channel_identities')
    .select('merchant_customer_id')
    .eq('id', p.channelIdentityId)
    .eq('merchant_id', p.merchantId)
    .single();
  if (existingLink?.merchant_customer_id) return existingLink.merchant_customer_id;

  const { data: customers } = await supabase
    .from('merchant_customers')
    .select('id')
    .eq('merchant_id', p.merchantId)
    .eq('normalized_phone', p.normalizedPhone.trim())
    .eq('status', 'active');
  const list = customers ?? [];
  if (list.length !== 1) return null;

  const merchantCustomerId = list[0].id;
  await supabase
    .from('customer_channel_identities')
    .update({
      merchant_customer_id: merchantCustomerId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', p.channelIdentityId)
    .eq('merchant_id', p.merchantId);

  await recordIdentityEvent(supabase, {
    merchantId: p.merchantId,
    merchantCustomerId,
    channelIdentityId: p.channelIdentityId,
    eventType: 'auto_linked',
    newMerchantCustomerId: merchantCustomerId,
    reason: 'Exact normalized phone match',
    actorType: 'system',
  });
  return merchantCustomerId;
}

/**
 * Manual link: merchant confirms linking channel_identity to merchant_customer.
 * Validates both belong to merchant.
 */
export async function linkIdentityToCustomer(
  supabase: SupabaseClient,
  p: {
    merchantId: string;
    channelIdentityId: string;
    merchantCustomerId: string;
    actorId: string | null;
  }
): Promise<void> {
  const [{ data: ident }, { data: cust }] = await Promise.all([
    supabase
      .from('customer_channel_identities')
      .select('id, merchant_customer_id')
      .eq('id', p.channelIdentityId)
      .eq('merchant_id', p.merchantId)
      .single(),
    supabase
      .from('merchant_customers')
      .select('id')
      .eq('id', p.merchantCustomerId)
      .eq('merchant_id', p.merchantId)
      .single(),
  ]);
  if (!ident) throw new Error('Channel identity not found');
  if (!cust) throw new Error('Merchant customer not found');

  const previous = ident.merchant_customer_id ?? null;
  await supabase
    .from('customer_channel_identities')
    .update({
      merchant_customer_id: p.merchantCustomerId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', p.channelIdentityId)
    .eq('merchant_id', p.merchantId);

  await recordIdentityEvent(supabase, {
    merchantId: p.merchantId,
    merchantCustomerId: p.merchantCustomerId,
    channelIdentityId: p.channelIdentityId,
    eventType: 'manually_linked',
    previousMerchantCustomerId: previous,
    newMerchantCustomerId: p.merchantCustomerId,
    reason: 'Manual link by merchant',
    actorType: 'merchant_admin',
    actorId: p.actorId,
  });
}

/**
 * Manual unlink: remove merchant_customer_id from channel identity.
 */
export async function unlinkIdentity(
  supabase: SupabaseClient,
  p: {
    merchantId: string;
    channelIdentityId: string;
    actorId: string | null;
  }
): Promise<void> {
  const { data: ident } = await supabase
    .from('customer_channel_identities')
    .select('id, merchant_customer_id')
    .eq('id', p.channelIdentityId)
    .eq('merchant_id', p.merchantId)
    .single();
  if (!ident) throw new Error('Channel identity not found');

  const previous = ident.merchant_customer_id ?? null;
  await supabase
    .from('customer_channel_identities')
    .update({
      merchant_customer_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', p.channelIdentityId)
    .eq('merchant_id', p.merchantId);

  await recordIdentityEvent(supabase, {
    merchantId: p.merchantId,
    merchantCustomerId: previous,
    channelIdentityId: p.channelIdentityId,
    eventType: 'manually_unlinked',
    previousMerchantCustomerId: previous,
    reason: 'Manual unlink by merchant',
    actorType: 'merchant_admin',
    actorId: p.actorId,
  });
}

/** Create a new merchant_customer and optionally link a channel identity. */
export async function createMerchantCustomer(
  supabase: SupabaseClient,
  p: {
    merchantId: string;
    primaryDisplayName?: string | null;
    phoneNumber?: string | null;
    notes?: string | null;
  }
): Promise<string> {
  const norm = normalizePhone(p.phoneNumber);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('merchant_customers')
    .insert({
      merchant_id: p.merchantId,
      primary_display_name: p.primaryDisplayName ?? null,
      phone_number: p.phoneNumber ?? null,
      normalized_phone: norm,
      notes: p.notes ?? null,
      status: 'active',
      updated_at: now,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data!.id;
}
