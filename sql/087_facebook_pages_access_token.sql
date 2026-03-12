-- ArmAI: Store long-lived page access token for Facebook Messenger (send API).
-- Used when merchant connects a Page via OAuth; token required for sending messages.

alter table public.facebook_pages
  add column if not exists page_access_token text;

comment on column public.facebook_pages.page_access_token is 'Long-lived Page Access Token for sending messages via Graph API.';
