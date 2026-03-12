import type { SupabaseClient } from '@supabase/supabase-js';
import * as catalog from './catalog.js';
import * as knowledge from './knowledge.js';
import * as orderDraft from './order-draft.js';
import * as codSettings from './cod-settings.js';

const PLATFORM_SYSTEM_PROMPT = `You are a merchant chatbot. Rules:
- Never invent products, prices, payment accounts, or QR codes. Use only the structured context provided.
- If information is not in the context, say it is unavailable. Do not guess.
- Do not leak data across merchants. Answer only from this merchant's context.
- Do not mark payment as completed. Only the system can confirm payment after verification.
- Be helpful and concise.`;

export interface AiContextInput {
  merchantId: string;
  merchantPrompt?: string | null;
  conversationId?: string | null;
  orderId?: string | null;
  customerMessage?: string;
}

export interface BuiltContext {
  systemPrompt: string;
  structuredContext: {
    products: unknown[];
    categories: unknown[];
    faqs: unknown[];
    promotions: unknown[];
    knowledgeEntries: unknown[];
    currentOrderSummary: string | null;
    paymentTargetForOrder: unknown | null;
    codSettings: unknown | null;
    shipmentForOrder: unknown | null;
    /** When conversation/order is linked to a unified customer, recent orders and interaction summary. */
    unifiedCustomerSummary: string | null;
  };
}

/**
 * Build AI runtime context from DB for one merchant. No hardcoded products/prices/accounts.
 */
export async function buildAiContext(supabase: SupabaseClient, input: AiContextInput): Promise<BuiltContext> {
  const { merchantId, merchantPrompt, conversationId, orderId } = input;
  const [products, categories, faqs, promotions, knowledgeEntries, codSettingsRow] = await Promise.all([
    catalog.listProducts(supabase, merchantId, { status: 'active', aiVisibleOnly: true }),
    catalog.listCategories(supabase, merchantId, true),
    knowledge.listFaqs(supabase, merchantId, true),
    knowledge.listPromotions(supabase, merchantId, true),
    knowledge.listKnowledgeEntries(supabase, merchantId, { activeOnly: true }),
    codSettings.getMerchantCodSettings(supabase, merchantId),
  ]);
  let currentOrderSummary: string | null = null;
  let paymentTargetForOrder: unknown = null;
  let shipmentContext: unknown = null;
  const resolveOrderId = orderId ?? (conversationId ? (await supabase
    .from('orders')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  ).data?.id : null);
  if (resolveOrderId) {
    const target = await orderDraft.getOrderPaymentTarget(supabase, merchantId, resolveOrderId);
    paymentTargetForOrder = target;
    const { data: order } = await supabase.from('orders').select('id, status, amount, payment_status, fulfillment_status').eq('id', resolveOrderId).eq('merchant_id', merchantId).single();
    if (order) {
      const { data: orderItems } = await supabase.from('order_items').select('product_name_snapshot, quantity, unit_price, total_price').eq('order_id', resolveOrderId);
      const lines = (orderItems ?? []).map((i) => `${i.product_name_snapshot} x${i.quantity} = ${i.total_price}`).join('; ');
      let summary = `Order ${order.id} (${order.status}), payment: ${order.payment_status}, fulfillment: ${order.fulfillment_status ?? 'n/a'}. Amount: ${order.amount}. Items: ${lines}`;
      const { data: latestShipment } = await supabase
        .from('order_shipments')
        .select('courier_name, tracking_number, tracking_url, shipped_at, shipping_note, shipment_status')
        .eq('order_id', resolveOrderId)
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestShipment) {
        shipmentContext = {
          order_number: order.id,
          payment_status: order.payment_status,
          fulfillment_status: order.fulfillment_status,
          courier_name: latestShipment.courier_name,
          tracking_number: latestShipment.tracking_number,
          tracking_url: latestShipment.tracking_url,
          shipped_at: latestShipment.shipped_at,
          shipping_note: latestShipment.shipping_note,
          shipment_status: latestShipment.shipment_status,
        };
        summary += ` Shipment: courier ${latestShipment.courier_name ?? 'n/a'}, tracking ${latestShipment.tracking_number ?? 'n/a'}, shipped_at ${latestShipment.shipped_at ?? 'n/a'}.`;
      }
      currentOrderSummary = summary;
    }
  }
  if (!currentOrderSummary && conversationId) {
    const { data: recentOrder } = await supabase
      .from('orders')
      .select('id, status, amount, payment_status, fulfillment_status')
      .eq('merchant_id', merchantId)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recentOrder) {
      const target = await orderDraft.getOrderPaymentTarget(supabase, merchantId, recentOrder.id);
      paymentTargetForOrder = target;
      const { data: latestShipment } = await supabase
        .from('order_shipments')
        .select('courier_name, tracking_number, tracking_url, shipped_at, shipping_note, shipment_status')
        .eq('order_id', recentOrder.id)
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestShipment) {
        shipmentContext = {
          order_number: recentOrder.id,
          payment_status: recentOrder.payment_status,
          fulfillment_status: recentOrder.fulfillment_status,
          courier_name: latestShipment.courier_name,
          tracking_number: latestShipment.tracking_number,
          tracking_url: latestShipment.tracking_url,
          shipped_at: latestShipment.shipped_at,
          shipping_note: latestShipment.shipping_note,
          shipment_status: latestShipment.shipment_status,
        };
      }
      currentOrderSummary = `Latest order: ${recentOrder.id} (${recentOrder.status}), payment ${recentOrder.payment_status}, fulfillment ${recentOrder.fulfillment_status ?? 'n/a'}, amount ${recentOrder.amount}.`;
    }
  }
  let unifiedCustomerSummary: string | null = null;
  const merchantCustomerIdFromConversation = conversationId
    ? (await supabase.from('conversations').select('merchant_customer_id').eq('id', conversationId).eq('merchant_id', merchantId).single()).data?.merchant_customer_id
    : null;
  const merchantCustomerIdFromOrder = resolveOrderId
    ? (await supabase.from('orders').select('merchant_customer_id').eq('id', resolveOrderId).eq('merchant_id', merchantId).single()).data?.merchant_customer_id
    : null;
  const linkedCustomerId = merchantCustomerIdFromConversation ?? merchantCustomerIdFromOrder ?? null;
  if (linkedCustomerId) {
    const [ordersByCustomer, lastMessage] = await Promise.all([
      supabase
        .from('orders')
        .select('id, status, amount, payment_status, created_at')
        .eq('merchant_id', merchantId)
        .eq('merchant_customer_id', linkedCustomerId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('channel_messages')
        .select('channel_type, direction, text_content, created_at')
        .eq('merchant_id', merchantId)
        .eq('merchant_customer_id', linkedCustomerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const orderLines = (ordersByCustomer.data ?? []).map((o) => `Order ${o.id}: ${o.status}, ${o.payment_status}, amount ${o.amount}`).join('. ');
    const lastLine = lastMessage.data
      ? `Last activity: ${lastMessage.data.channel_type} ${lastMessage.data.direction} at ${lastMessage.data.created_at}${lastMessage.data.text_content ? `: "${lastMessage.data.text_content.slice(0, 80)}..."` : ''}.`
      : '';
    unifiedCustomerSummary = [orderLines, lastLine].filter(Boolean).join(' ') || 'Unified customer has linked channel identities.';
  }

  const merchantSection = merchantPrompt ? `\n\nMerchant instructions:\n${merchantPrompt}` : '';
  const systemPrompt = PLATFORM_SYSTEM_PROMPT + merchantSection;
  return {
    systemPrompt,
    structuredContext: {
      products,
      categories,
      faqs,
      promotions,
      knowledgeEntries,
      currentOrderSummary,
      paymentTargetForOrder,
      codSettings: codSettingsRow ? {
        enable_cod: codSettingsRow.enable_cod,
        cod_min_order_amount: codSettingsRow.cod_min_order_amount,
        cod_max_order_amount: codSettingsRow.cod_max_order_amount,
        cod_fee_amount: codSettingsRow.cod_fee_amount,
        require_phone_for_cod: codSettingsRow.require_phone_for_cod,
        require_full_address_for_cod: codSettingsRow.require_full_address_for_cod,
        cod_requires_manual_confirmation: codSettingsRow.cod_requires_manual_confirmation,
        cod_notes_for_ai: codSettingsRow.cod_notes_for_ai,
      } : null,
      shipmentForOrder: shipmentContext,
      unifiedCustomerSummary,
    },
  };
}
