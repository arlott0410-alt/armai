import { Hono } from 'hono';
import type { Env } from '../../env.js';
import { getSupabaseAdmin } from '../../lib/supabase.js';

const app = new Hono<{
  Bindings: Env;
  Variables: { auth: import('../../middleware/auth.js').AuthContext; merchantId: string };
}>();

/** GET /merchant/operations/feed — events, escalations, ambiguous shipment images. */
app.get('/feed', async (c) => {
  const supabase = getSupabaseAdmin(c.env);
  const merchantId = c.get('merchantId');
  const limit = Math.min(Number(c.req.query('limit')) || 50, 100);

  const [events, ambiguousImages, awaitingImages] = await Promise.all([
    supabase
      .from('telegram_operation_events')
      .select('id, merchant_id, related_order_id, related_shipment_image_id, event_type, event_note, actor_type, actor_id, created_at')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('shipment_images')
      .select('id, merchant_id, order_id, source, processing_status, created_at, telegram_message_id')
      .eq('merchant_id', merchantId)
      .eq('processing_status', 'ambiguous')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('shipment_images')
      .select('id, merchant_id, order_id, source, processing_status, created_at, telegram_message_id')
      .eq('merchant_id', merchantId)
      .eq('processing_status', 'awaiting_order_reference')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  return c.json({
    events: events.data ?? [],
    ambiguous_shipment_images: ambiguousImages.data ?? [],
    awaiting_order_reference: awaitingImages.data ?? [],
  });
});

export default app;
