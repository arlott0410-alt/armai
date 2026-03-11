import { createMiddleware } from 'hono/factory';
import type { Env } from '../env.js';
import { getSupabaseAdmin, getSupabaseAnon } from '../lib/supabase.js';
import { correlationId } from '../lib/errors.js';

export type AuthContext = {
  userId: string;
  email: string | null;
  role: 'super_admin' | 'merchant_admin';
  merchantIds: string[];
  accessToken: string;
};

/**
 * Resolves Bearer token with Supabase Auth, loads profile + merchant_members,
 * and sets auth context. Does not enforce role; use role middleware after.
 */
export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: { auth: AuthContext; correlationId: string } }>(async (c, next) => {
  const correlation = c.req.header('x-correlation-id') ?? correlationId();
  c.set('correlationId', correlation);

  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return c.json({ error: 'Unauthorized', code: 'MISSING_TOKEN', correlationId: correlation }, 401);
  }

  try {
    const supabase = getSupabaseAnon(c.env, token);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return c.json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN', correlationId: correlation }, 401);
    }

    const admin = getSupabaseAdmin(c.env);
    const { data: profile, error: profileError } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profileError) {
      return c.json({
        error: 'Profile lookup failed',
        code: 'PROFILE_ERROR',
        detail: profileError.message,
        correlationId: correlation,
      }, 500);
    }
    const role = (profile?.role as 'super_admin' | 'merchant_admin') ?? 'merchant_admin';

    const { data: members, error: membersError } = await admin.from('merchant_members').select('merchant_id').eq('user_id', user.id);
    if (membersError) {
      return c.json({
        error: 'Merchant members lookup failed',
        code: 'MEMBERS_ERROR',
        detail: membersError.message,
        correlationId: correlation,
      }, 500);
    }
    const merchantIds = (members ?? []).map((m) => m.merchant_id);

    const auth: AuthContext = {
      userId: user.id,
      email: user.email ?? null,
      role,
      merchantIds,
      accessToken: token,
    };
    c.set('auth', auth);
    await next();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({
      error: 'Auth failed',
      code: 'AUTH_ERROR',
      detail: message,
      correlationId: correlation,
    }, 500);
  }
});

/**
 * Require super_admin. Use after authMiddleware.
 */
export const requireSuperAdmin = createMiddleware<{ Variables: { auth: AuthContext } }>(async (c, next) => {
  const auth = c.get('auth');
  if (auth.role !== 'super_admin') {
    return c.json({ error: 'Forbidden', code: 'REQUIRES_SUPER_ADMIN' }, 403);
  }
  await next();
});

/**
 * Require merchant context: merchant_id in path or first merchant of user.
 * Sets merchantId in variables. Use after authMiddleware.
 */
export const resolveMerchant = createMiddleware<{ Variables: { auth: AuthContext; merchantId: string } }>(async (c, next) => {
  const auth = c.get('auth');
  const pathMerchantId = c.req.param('merchantId');
  let merchantId: string;
  if (pathMerchantId) {
    if (!auth.merchantIds.includes(pathMerchantId) && auth.role !== 'super_admin') {
      return c.json({ error: 'Forbidden', code: 'MERCHANT_ACCESS_DENIED' }, 403);
    }
    merchantId = pathMerchantId;
  } else {
    if (auth.merchantIds.length === 0 && auth.role !== 'super_admin') {
      return c.json({ error: 'Forbidden', code: 'NO_MERCHANT' }, 403);
    }
    merchantId = auth.merchantIds[0];
  }
  c.set('merchantId', merchantId);
  await next();
});

/**
 * Require merchant_admin (or super_admin) and merchant context.
 */
export const requireMerchantAdmin = createMiddleware<{ Variables: { auth: AuthContext; merchantId: string } }>(async (c, next) => {
  const auth = c.get('auth');
  if (auth.role !== 'merchant_admin' && auth.role !== 'super_admin') {
    return c.json({ error: 'Forbidden', code: 'REQUIRES_MERCHANT_ACCESS' }, 403);
  }
  await next();
});
