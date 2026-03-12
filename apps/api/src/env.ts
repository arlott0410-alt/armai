/**
 * Cloudflare bindings and env. All secrets from Dashboard; no hardcoding.
 */
export interface Env {
  ENVIRONMENT: string
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
  GEMINI_API_KEY: string
  FACEBOOK_APP_SECRET: string
  /** Facebook App ID (for token exchange and SDK). */
  FACEBOOK_APP_ID?: string
  /** Token for Facebook webhook GET verification (hub.verify_token). */
  FACEBOOK_VERIFY_TOKEN?: string
  /** Token for WhatsApp webhook GET verification (hub.verify_token). */
  WHATSAPP_VERIFY_TOKEN?: string
  /** Optional WhatsApp Cloud API access token (when using single app / access_token_reference). */
  WHATSAPP_ACCESS_TOKEN?: string
  /** Optional: verify WhatsApp webhook signature (same as Facebook if same Meta app). */
  WHATSAPP_APP_SECRET?: string
  /** Meta App ID for WhatsApp OAuth (can be same as FACEBOOK_APP_ID if same app). */
  META_APP_ID?: string
  /** Meta App secret for WhatsApp OAuth token exchange. */
  META_APP_SECRET?: string
  /** Base URL of the Worker (e.g. https://api.armai.com) for OAuth redirect_uri. */
  WORKER_URL?: string
  SLIP_BUCKET: R2Bucket
  /** KV for system_settings cache (e.g. subscription_bank). Reduces Supabase reads. */
  SETTINGS_KV?: KVNamespace
  /** Channel media (WhatsApp/Facebook images, documents). Optional; if missing, media_url may be external. */
  CHANNEL_MEDIA_BUCKET?: R2Bucket
  /** Stripe secret key for subscription payments (global cards). Optional; use BCEL OnePay for Laos. */
  STRIPE_SECRET_KEY?: string
  /** Stripe webhook signing secret for /api/webhooks/payment. */
  STRIPE_WEBHOOK_SECRET?: string
  /** BCEL OnePay API base URL (Laos). */
  BCEL_ONEPAY_API_URL?: string
  /** BCEL OnePay merchant/API credentials. */
  BCEL_ONEPAY_MERCHANT_ID?: string
  BCEL_ONEPAY_SECRET_KEY?: string
}
