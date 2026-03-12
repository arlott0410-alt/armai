import { Hono } from 'hono';
import type { Env } from '../../env.js';
import { getSupabaseAdmin } from '../../lib/supabase.js';
import { processBankNotification } from '../../services/bank-notification-pipeline.js';

const app = new Hono<{ Bindings: Env }>();

app.post('/:merchantId', async (c) => {
  const merchantId = c.req.param('merchantId');
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return c.json({ error: 'Invalid JSON' }, 400);
  }
  const supabase = getSupabaseAdmin(c.env);
  const rawMeta = {
    source_app_package: (body as Record<string, unknown>).source_app_package as string | undefined,
    source_app_label: (body as Record<string, unknown>).source_app_label as string | undefined,
    device_id: (body as Record<string, unknown>).device_id as string | undefined,
    device_label: (body as Record<string, unknown>).device_label as string | undefined,
    notification_title: (body as Record<string, unknown>).notification_title as string | undefined,
    notification_subtitle: (body as Record<string, unknown>).notification_subtitle as string | undefined,
    raw_message: (body as Record<string, unknown>).raw_message as string | undefined,
    locale: (body as Record<string, unknown>).locale as string | undefined,
  };
  const result = await processBankNotification(supabase, {
    merchantId,
    body: body as Record<string, unknown>,
    rawEventMeta: rawMeta,
  });
  if (!result.ok) {
    return c.json({ error: result.error ?? 'Processing failed' }, 400);
  }
  return c.json({ ok: true, bankTransactionId: result.bankTransactionId ?? undefined });
});

export default app;
