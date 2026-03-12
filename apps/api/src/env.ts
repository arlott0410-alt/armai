/**
 * Cloudflare bindings and env. All secrets from Dashboard; no hardcoding.
 */
export interface Env {
  ENVIRONMENT: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  GEMINI_API_KEY: string;
  FACEBOOK_APP_SECRET: string;
  /** Token for Facebook webhook GET verification (hub.verify_token). */
  FACEBOOK_VERIFY_TOKEN?: string;
  /** Token for WhatsApp webhook GET verification (hub.verify_token). */
  WHATSAPP_VERIFY_TOKEN?: string;
  /** Optional WhatsApp Cloud API access token (when using single app / access_token_reference). */
  WHATSAPP_ACCESS_TOKEN?: string;
  /** Optional: verify WhatsApp webhook signature (same as Facebook if same Meta app). */
  WHATSAPP_APP_SECRET?: string;
  SLIP_BUCKET: R2Bucket;
  /** Channel media (WhatsApp/Facebook images, documents). Optional; if missing, media_url may be external. */
  CHANNEL_MEDIA_BUCKET?: R2Bucket;
}
