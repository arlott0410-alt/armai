# เอกสารรวมระบบ ArmAI

เอกสารฉบับนี้รวบรวมสถาปัตยกรรม โมเดลข้อมูล API การติดตั้ง และการใช้งานของระบบ ArmAI ให้อยู่ในที่เดียว และอัปเดตให้ตรงกับระบบปัจจุบัน (รวม Enterprise Laos, Multi-channel, COD, Bank scoping, Conversation router, Telegram operations)

---

## สารบัญ

1. [ภาพรวมและสถาปัตยกรรม](#1-ภาพรวมและสถาปัตยกรรม)
2. [โมเดลข้อมูล (Data Model)](#2-โมเดลข้อมูล-data-model)
3. [การยืนยันตัวตนและบทบาท (Auth & Roles)](#3-การยืนยันตัวตนและบทบาท-auth--roles)
4. [API และเส้นทาง (Routes)](#4-api-และเส้นทาง-routes)
5. [Workspace ของ Merchant](#5-workspace-ของ-merchant)
6. [ระบบ Super Admin](#6-ระบบ-super-admin)
7. [Billing และ Enterprise UX](#7-billing-และ-enterprise-ux)
8. [Commerce / Knowledge Extension](#8-commerce--knowledge-extension)
9. [Design System และ UI](#9-design-system-และ-ui)
10. [การ Deploy](#10-การ-deploy)
11. [คู่มือติดตั้งและตั้งค่า](#11-คู่มือติดตั้งและตั้งค่า)
12. [การทดสอบ](#12-การทดสอบ)
13. [Checklist ความสอดคล้อง](#13-checklist-ความสอดคล้อง)
14. [หัวข้อเพิ่มเติม (Router, COD, Bank, Telegram, Laos, Scaling)](#14-หัวข้อเพิ่มเติม)

---

## 1. ภาพรวมและสถาปัตยกรรม

### ภาพรวม

ArmAI เป็น multi-tenant SaaS บนโดเมนเดียว หนึ่ง codebase รองรับหลาย merchant แยกข้อมูลตาม tenant (merchant) ทั้งที่ชั้น database (RLS) และ application รองรับตลาดลาว (LAK, +856) และไทย (THB, 66) ด้วย merchant-level default country/currency

### Stack

| ส่วน                       | เทคโนโลยี                                              |
| -------------------------- | ------------------------------------------------------ |
| Backend/API                | Cloudflare Workers, Hono, TypeScript                   |
| Database / Auth / Realtime | Supabase (Postgres, Auth, Realtime, RLS)               |
| File storage               | Cloudflare R2 (slip images, channel media)             |
| AI                         | Gemini (slip extraction)                               |
| Frontend                   | Vite + React + TypeScript (deploy บน Cloudflare Pages) |

### Control Plane

- Super admin: KPIs, รายการ merchant, สร้าง merchant (รวม default_country / default_currency)
- Merchant provisioning: สร้าง auth user (Supabase Admin API), แถว merchant, membership, settings
- Billing: merchant_plans, merchants.billing_status
- Audit logs, support access logs
- Support (God mode): อ่านข้อมูล merchant แบบ read-only มี audit ไม่มีการ impersonate session

### Data Plane

- Webhooks: Facebook, WhatsApp, Telegram, Bank (ต่อ merchant)
- Conversation router: rule-first แล้วค่อย AI; รองรับ Lao/Thai/English greetings
- AI / slip extraction (Gemini)
- Bank: parser profiles, account scoping (strict/relaxed), matching เฉพาะ scoped
- Orders: prepaid (slip → bank match) และ COD (shipping → shipped → collected)
- Payment method switch: หนึ่งวิธีต่อ order; บันทึกใน order_payment_method_events
- Customer identity: รองรับหลายช่องทาง; phone แยกตาม country (Laos +856/020, Thailand 66/0)

### Multi-tenancy

- ตารางธุรกิจมี `merchant_id`
- RLS: merchant_admin เห็นเฉพาะ merchant ที่ตัวเองเป็น member; super_admin ใช้ได้ตาม policy
- `merchant_members` เชื่อม user ↔ merchant (many-to-many)
- API resolve tenant จาก path หรือ merchant แรกของ user แล้วตรวจสิทธิก่อนใช้

### ความปลอดภัย

- ไม่ใช้ service role key ใน browser
- Admin/sensitive ผ่าน Worker + auth + role middleware
- Secrets ผ่าน Cloudflare bindings/env
- RLS deny-by-default; กำหนด policy ชัดเจนต่อตาราง
- Webhook ตรวจ signature ตามที่ตั้งค่า

---

## 2. โมเดลข้อมูล (Data Model)

### Core (รากของ tenant)

| ตาราง             | คำอธิบาย                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| profiles          | ขยาย auth.users; id = auth.users.id; role = super_admin \| merchant_admin                                          |
| merchants         | ต้นทาง tenant; slug ไม่ซ้ำ; billing_status; **default_country**, **default_currency** (ISO; สำหรับ Laos/Thailand)  |
| merchant_members  | (merchant_id, user_id) + role; many-to-many                                                                        |
| merchant_settings | ต่อ merchant: ai*system_prompt, bank_parser_id, webhook_verify_token, auto_send_shipping_confirmation, telegram*\* |

### Business (มี merchant_id ทั้งหมด)

| ตาราง                            | คำอธิบาย                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| facebook_pages                   | (merchant_id, page_id) สำหรับ webhook routing                                                     |
| webhook_events                   | raw events; merchant_id เป็น null ได้สำหรับ verification                                          |
| conversations                    | หนึ่งต่อ (merchant, channel, external customer); รองรับ multi-channel                             |
| message_buffers                  | ข้อความรอ flush / aggregate                                                                       |
| messages                         | ไทม์ไลน์ข้อความ (inbound/outbound)                                                                |
| orders                           | status, payment_method, payment_status, fulfillment_status; conversation_id, merchant_customer_id |
| order_slips                      | รูป slip ใน R2 + ผล AI; detected*receiver*\*                                                      |
| order_items                      | line items; product_id, variant_id, snapshot ชื่อ/ราคา                                            |
| order_payment_targets            | บัญชีที่ assign ให้ order; expected_amount, **expected_currency**, is_active, invalidation        |
| order_shipping_details           | ที่อยู่/ข้อมูลจัดส่ง                                                                              |
| order_cod_details                | COD amount, fee, cod_status; is_active, superseded_at เมื่อสลับวิธีชำระ                           |
| order_payment_method_events      | ประวัติการสลับ payment method (from_method, to_method, switch_result)                             |
| order_shipments                  | การจัดส่ง; tracking, courier, shipment_status                                                     |
| order_fulfillment_events         | เหตุการณ์ fulfillment (packed, shipped, delivered)                                                |
| bank_configs                     | mapping bank/parser ต่อ merchant; bank_connections, payment_account_id, match_mode                |
| bank_parser_profiles             | bank_code, parser_family, parser_version, detection_pattern                                       |
| bank_raw_notification_events     | raw payload จาก bank webhook; retention_class, retained_until                                     |
| bank_transactions                | รายการที่ parse แล้ว; scope_status (scoped/ambiguous/out_of_scope), payment_account_id            |
| bank_transaction_processing_logs | log การ parse และ scoping ต่อ event                                                               |
| matching_results                 | เชื่อม order + bank_transaction; score, status; confirmed + business rule → paid                  |

### Commerce / Knowledge (มี merchant_id)

| ตาราง                          | คำอธิบาย                                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| product_categories             | หมวดสินค้า; sort_order, is_active                                                                                      |
| products                       | name, slug, base_price, sale_price, **currency**, status, ai_visible, is_cod_allowed, requires_manual_cod_confirmation |
| product_variants               | option values, price_override, stock_qty                                                                               |
| product_keywords               | คำค้นสำหรับ AI                                                                                                         |
| merchant_faqs                  | Q&A สำหรับ AI                                                                                                          |
| merchant_promotions            | โปรโมชัน; valid_from/until, keywords, is_active                                                                        |
| merchant_knowledge_entries     | type, title, content, keywords, priority                                                                               |
| merchant_payment_accounts      | bank_code, account_number, account_holder_name, **currency**, is_primary, is_active, sort_order                        |
| merchant_payment_account_rules | (optional) routing rules                                                                                               |
| merchant_cod_settings          | enable_cod, min/max amount, fee, cod_requires_manual_confirmation                                                      |

### Channels & Customer Identity

| ตาราง                         | คำอธิบาย                                                               |
| ----------------------------- | ---------------------------------------------------------------------- |
| channels, channel_connections | ช่องทาง (facebook, whatsapp, telegram) ต่อ merchant                    |
| channel_messages              | ข้อความรวมทุกช่องทาง (normalized)                                      |
| channel_customers             | ลูกค้าต่อช่องทาง                                                       |
| merchant_customers            | ลูกค้ารวมของ merchant; **normalized_phone** (country-aware)            |
| customer_channel_identities   | เชื่อม merchant_customer กับช่องทาง; normalized_phone สำหรับ auto-link |
| customer_identity_events      | audit การ link/unlink                                                  |

### Telegram Operations

| ตาราง                     | คำอธิบาย                                                             |
| ------------------------- | -------------------------------------------------------------------- |
| telegram_connections      | bot token, group ID ต่อ merchant                                     |
| telegram_admins           | Telegram user ID ที่อนุญาต                                           |
| telegram_messages         | raw updates (retention)                                              |
| telegram_operation_events | order_paid_notified, shipment_image_received, ai_escalation_sent ฯลฯ |
| shipment_images           | รูป slip/waybill จาก dashboard หรือ Telegram; link กับ order         |

### AI & Router

| ตาราง                  | คำอธิบาย                                            |
| ---------------------- | --------------------------------------------------- |
| conversation_summaries | สรุปต่อ conversation ลด token                       |
| ai_usage_events        | บันทึกว่าใช้ template / retrieval / ai / escalation |

### Observability & Billing

| ตาราง                        | คำอธิบาย                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| merchant_dashboard_summaries | สรุป KPI ต่อ merchant (orders_today, pending_payment, paid_today, ready_to_ship ฯลฯ) |
| super_dashboard_summaries    | สรุประดับระบบ (MRR, active_merchants, due_soon ฯลฯ)                                  |
| ai_logs                      | job type, entity, success, metadata                                                  |
| audit_logs                   | การกระทำ super/support                                                               |
| support_access_logs          | แต่ละครั้งที่เข้า support                                                            |
| merchant_plans               | แผน/สถานะ billing; currency, trial_ends_at, next_billing_at                          |
| merchant_billing_events      | เหตุการณ์ billing ต่อ merchant                                                       |
| merchant_internal_notes      | หมายเหตุภายใน (super เท่านั้น)                                                       |

### Enums

- **Order status:** pending, slip_uploaded, slip_extracted, bank_pending_match, probable_match, paid, manual_review, cancelled
- **Payment method:** prepaid_bank_transfer, prepaid_qr, cod
- **Payment status:** unpaid, pending_transfer, slip_uploaded, pending_bank_match, paid, cod_pending_confirmation, cod_ready_to_ship, cod_shipped, cod_collected, cod_failed, cod_cancelled
- **Matching result status:** unmatched, auto_matched, probable_match, manual_review, confirmed, rejected
- **Fulfillment status:** pending_fulfillment, packed, shipped, delivered, delivery_failed, cancelled

---

## 3. การยืนยันตัวตนและบทบาท (Auth & Roles)

### Login

- หน้า login เดียว: `/login`
- Supabase Auth: `signInWithPassword(email, password)` จาก frontend
- Session เก็บโดย Supabase client; ใช้ access token กับ API

### Session

- Frontend ส่ง `Authorization: Bearer <access_token>` ทุก request
- Worker: อ่าน Bearer → ตรวจด้วย Supabase `getUser(token)` → โหลด profiles.role และ merchant_members
- ไม่ sign out อัตโนมัติเมื่อ 401 เว้นแต่ response บอกชัดว่า session ไม่ถูกต้อง

### บทบาท

- **super_admin:** เจ้าของระบบ; เข้า Control Plane และ Support; สร้าง merchant; ดู tenant ใดก็ได้ (support = read-only)
- **merchant_admin:** ลูกค้า merchant; เข้าได้เฉพาะ merchant ที่ตัวเองเป็น member

### Route guards

- **Super admin เท่านั้น:** `/api/super/*`, `/api/support/*` — requireSuperAdmin
- **Merchant:** `/api/merchant/*`, `/api/settings`, `/api/orders` — authMiddleware → resolveMerchant → requireMerchantAdmin

### Support (God) mode

- Super admin เริ่ม support session ตาม merchant_id; บันทึกใน support_access_logs
- Support เป็น read-only; หน้าเว็บแสดงแบนเนอร์ "Read-only support mode"

---

## 4. API และเส้นทาง (Routes)

Base URL ของ API ลงท้ายด้วย `/api`

### Health

- `GET /api/health` — สถานะ API (ไม่ต้อง auth)

### Auth

- `GET /api/auth/me` — ข้อมูล user ปัจจุบัน (userId, email, role, merchantIds)

### Super Admin

- `GET /api/super/dashboard` — KPIs, revenue, billingHealth, setupHealth, recentActivity
- `GET /api/super/merchants` — รายการ merchant (ขยายฟิลด์ รวม default_country, default_currency)
- `GET /api/super/merchants/:id` — รายละเอียด merchant
- `PATCH /api/super/merchants/:id` — อัปเดต billing_status / plan
- `POST /api/super/merchants` — สร้าง merchant (body: name, slug, admin_email, admin_password, **default_country**, **default_currency**; สร้าง user, membership, settings, merchant_plans ใช้ currency ตาม merchant)
- `GET /api/super/merchants/:id/billing` — รายการ billing events
- `POST /api/super/merchants/:id/billing` — สร้าง billing event
- `GET /api/super/merchants/:id/notes`, `POST /api/super/merchants/:id/notes` — internal notes
- `GET /api/super/billing/events?merchantId=` — billing events
- `GET /api/super/audit?limit=` — audit logs
- `GET /api/super/channel-metrics` — สถิติช่องทาง (WhatsApp ฯลฯ)
- `POST /api/support/start` — เริ่ม support session (body: merchantId)

### Support

- `GET /api/support/merchants/:merchantId/orders` — orders ของ merchant (read-only)
- `GET /api/support/merchants/:merchantId/settings` — settings ของ merchant (read-only)

### Merchant

- `GET /api/merchant/dashboard` — **merchantId, merchant** (รวม default_country, default_currency), settings, summary, readiness
- `GET /api/merchant/readiness` — readiness checklist
- `GET /api/merchant/channels` — สรุป Facebook/WhatsApp connections
- `GET /api/merchant/orders?status=&fulfillment_status=&limit=` — รายการ orders
- `GET /api/merchant/orders/:orderId` — รายละเอียด order (รวม payment_target, shipments, fulfillment_events, cod_details)
- `POST /api/merchant/orders/:orderId/payment-method/switch` — สลับวิธีชำระ (body: desired_method, requested_by?)
- `POST /api/merchant/orders/:orderId/cod/confirm` — ยืนยัน COD
- `POST /api/merchant/orders/:orderId/cod/mark-shipped`, mark-collected, mark-failed
- `GET /api/merchant/orders/:orderId/shipments`, `POST /api/merchant/orders/:orderId/shipments` — shipments
- `PATCH /api/merchant/shipments/:shipmentId` — อัปเดต shipment
- `POST /api/merchant/shipments/:shipmentId/send-confirmation` — ส่งการยืนยันการจัดส่งให้ลูกค้า
- `GET /api/merchant/bank-sync?limit=` — bank_transactions + matching_results
- `GET /api/merchant/operations/feed` — feed เหตุการณ์ Telegram / shipment images
- `GET /api/merchant/telegram`, `PATCH /api/merchant/telegram` — การเชื่อมต่อ Telegram
- `GET/POST/PATCH /api/merchant/telegram/admins` — Telegram admins
- `POST /api/merchant/telegram/test` — ส่งข้อความทดสอบ
- `GET /api/merchant/customers` — รายการ merchant_customers
- `GET /api/merchant/customers/:id` — รายละเอียดลูกค้า
- `PATCH /api/merchant/customers/:id` — แก้ไขลูกค้า (phone → normalize ตาม merchant default_country)
- `GET /api/merchant/customer-identities` — รายการ channel identities; suggestions สำหรับ link
- `POST /api/merchant/customer-identities/link`, `POST /api/merchant/customer-identities/unlink`
- `GET /api/merchant/payment-method-settings` — COD settings
- `PATCH /api/merchant/payment-method-settings` — อัปเดต COD
- `POST /api/merchant/ai/context` — build AI context; ถ้าส่ง lastMessageText จะผ่าน router และอาจได้ responseMode + text (template/retrieval)
- `GET /api/merchant/ai/metrics` — router metrics (24h)

#### Products

- `GET /api/merchant/products?categoryId=&status=`, `GET /api/merchant/products/search?q=`
- `GET /api/merchant/products/:productId`, `POST /api/merchant/products`, `PATCH /api/merchant/products/:productId`
- `GET/POST /api/merchant/products/:productId/variants`, `GET/POST/DELETE /api/merchant/products/:productId/keywords`

#### Categories

- `GET /api/merchant/categories?activeOnly=`, `POST /api/merchant/categories`, `PATCH /api/merchant/categories/:categoryId`

#### Knowledge

- `GET/POST/PATCH /api/merchant/knowledge/faqs`, `GET/POST/PATCH /api/merchant/knowledge/entries`

#### Promotions

- `GET /api/merchant/promotions?activeOnly=`, `POST /api/merchant/promotions`, `PATCH /api/merchant/promotions/:promotionId`

#### Payment accounts

- `GET /api/merchant/payment-accounts?activeOnly=`, `GET /api/merchant/payment-accounts/:accountId`, `POST /api/merchant/payment-accounts`, `PATCH /api/merchant/payment-accounts/:accountId`

### Settings (merchant_admin)

- `GET /api/settings`, `PATCH /api/settings` — ai*system_prompt, bank_parser_id, webhook_verify_token, auto_send_shipping_confirmation, telegram*\* ฯลฯ

### Orders (merchant_admin)

- `POST /api/orders/confirm-match` — ยืนยัน/ปฏิเสธ matching (body: matching_result_id, confirm)
- `POST /api/orders/draft` — สร้าง draft order + items + payment target (body: conversationId?, items[], customerPsid?, customerName?)

### Webhooks (ไม่ใช้ Bearer แบบ user)

- `GET/POST /api/webhooks/facebook` — Facebook webhook (verify + events)
- `POST /api/webhooks/bank/:merchantId` — Bank webhook ต่อ merchant
- `POST /api/webhooks/telegram/:merchantId` — Telegram updates (bot)
- `GET/POST /api/webhooks/whatsapp` — WhatsApp Business (verify + messages)

---

## 5. Workspace ของ Merchant

Merchant จัดการข้อมูลของตัวเองผ่านหน้าเว็บได้ครบ (CRUD) โดยไม่กระทบ auth, tenant isolation, webhook, slip หรือ matching

### หน้าที่มี

- **Dashboard** — สรุป orders, payment, readiness; ใช้ default_currency จาก merchant สำหรับการแสดงผล
- **Orders** — รายการ orders; filter ตาม status, payment_method, fulfillment_status; เปิด order detail → payment method switch, COD confirm, shipments, send confirmation
- **Bank Sync** — bank transactions + matching results; เลือก bank + payment account; strict/relaxed mode; ทดสอบ parser & scoping
- **Products** — สร้าง/แก้ไข/ลิสต์ products; currency ใช้ default จาก merchant (LAK/THB)
- **Categories** — สร้าง/แก้ไข/ลิสต์ categories
- **Knowledge** — FAQs และ Entries
- **Promotions** — สร้าง/แก้ไข/ลิสต์ promotions
- **Payment accounts** — สร้าง/แก้ไข/ลิสต์บัญชี; currency ใช้ default จาก merchant
- **Telegram** — การเชื่อมต่อกลุ่ม, bot token, webhook URL, admins, ทดสอบ
- **Operations** — feed เหตุการณ์และรูป shipment รอ link
- **Customers** — รายการลูกค้า; แก้ไข phone (normalize ตามประเทศของ merchant)
- **Channels** — สรุป Facebook / WhatsApp
- **Settings** — AI prompt, bank parser, webhook token; COD (enable, min/max, fee, manual confirmation); Telegram (notify paid, shipment, escalation, auto-send confirmation)

### ฟิลด์หลักที่รองรับ

- **Product:** category_id, name, slug, description, base_price, sale_price, **currency** (ตาม merchant default), sku, status, requires_manual_confirmation, ai_visible, is_cod_allowed, requires_manual_cod_confirmation
- **Payment account:** bank_code, account_number, account_holder_name, **currency** (ตาม merchant default), is_primary, is_active, sort_order, notes
- **Settings:** ai_system_prompt, bank_parser_id, webhook_verify_token, auto_send_shipping_confirmation, telegram_notify_order_paid, telegram_allow_shipment_confirmation, telegram_allow_ai_escalation, telegram_require_authorized_admins, telegram_auto_send_shipment_confirmation; COD settings

### Components ร่วม (Merchant)

- FormModal, SaveCancelFooter, FieldGroup (merchant)
- FormSection, FieldHint, DataTableShell (ui)

---

## 6. ระบบ Super Admin

### Navigation

- Overview (dashboard)
- Merchants (ตาราง + สร้าง merchant **รวม default country/currency**)
- Billing (billing events)
- Support (โหมด read-only ต่อ merchant)
- Audit (activity log)

### Overview Dashboard

- KPI: MRR, Active merchants, Trialing, Past due, Due in 7 days, New this month, Activation ready
- Revenue, Billing health (overdue, due soon, trial ending)
- Setup health (merchant ที่ขาด products / payment account / AI prompt)
- Recent activity

### Merchant detail

- สรุป merchant, แผน, billing, notes, billing events, support access history
- ปุ่มเปิด Support (read-only)

---

## 7. Billing และ Enterprise UX

### merchant_plans (ขยาย)

ฟิลด์: monthly_price_usd, **currency** (ตาม merchant default เมื่อสร้าง), billing_cycle, trial_ends_at, current_period_start/end, next_billing_at, last_paid_at, grace_until, cancel_at_period_end, is_auto_renew, notes

### merchant_billing_events

- event*type, amount, **currency** (ตาม merchant default ถ้าไม่ส่ง), invoice_period*\*, due_at, paid_at, status, reference_note
- RLS: super อ่าน/เขียน; member อ่านได้ตาม policy

### merchant_internal_notes

- RLS: super เท่านั้น (merchant ไม่เห็น)

### SQL migrations (Billing)

- 019_billing_expansion, 020–022 (indexes, RLS, policies)

การสร้าง merchant ใหม่: สร้าง auth user, merchant (**default_country, default_currency** จาก body หรือ TH/THB), merchant_members, merchant_settings, **merchant_plans** (currency จาก getMerchantDefaultCurrency)

---

## 8. Commerce / Knowledge Extension

### วัตถุประสงค์

- AI รู้ products, ราคา, บัญชีรับโอน, FAQs, โปรโมชัน, knowledge entries **จาก database เท่านั้น**
- ราคาและสกุลเงินมาจาก merchant default หรือ product/account; ไม่ hardcode THB/LAK ใน logic หลัก
- Slip verification และ bank matching ใช้ expected payment account; account scoping ใช้เฉพาะธุรกรรมที่ scoped

### AI context และ Conversation Router

- Router: รับ normalized event (ข้อความ, สถานะ order/shipment/COD จาก DB) → routeCategory (greeting, product_inquiry, payment_slip_related, shipping_question ฯลฯ) และ responseMode (template | retrieval | ai | escalation)
- รองรับ Lao (sabaidee, ສະບາຍດີ), Thai, English greetings → template
- Cache (best-effort): products, categories, faqs, promotions, knowledge_entries, cod_settings (TTL); order/payment/shipment อ่านจาก DB เสมอ
- buildAiContext รวม: platform prompt, merchant prompt, products, categories, faqs, promotions, knowledge entries, order summary, payment target

### Slip และ matching

- Slip extraction (Gemini) ส่งคืน detected*receiver*\* เก็บใน order_slips
- Bank: parser profiles, account scoping (scoped/ambiguous/out_of_scope); เฉพาะ scoped เข้า matching
- Matching score มี receiverAccountScore เมื่อมี expected account

### SQL (extension)

- 011–018: catalog, knowledge, payment, order_items, order_payment_targets, extension alters/indexes/RLS
- 078_merchant_defaults: merchants.default_country, default_currency (backfill TH/THB)

---

## 9. Design System และ UI

### Theme (apps/web)

- **Luxury palette**: primary #D4AF37 (gold), secondary #1A1A1A (velvet black), accent #FFFFFF; gradients linear-gradient(#D4AF37, #B8860B)
- **Fonts**: Phetsarath OT (Lao enterprise), IBM Plex Sans, Noto Sans Lao/Thai
- **spacing** (xs–xxl), **typography** (pageTitle, sectionTitle, body, bodySmall, caption) สำหรับ layout และ hierarchy
- **Dark mode**: class `.dark` on document; CSS vars in `index.css`

### PWA (apps/web)

- **vite-plugin-pwa**: manifest (name ArmAI, short_name, theme_color #000000), `registerType: 'autoUpdate'`, Workbox caching (assets + API NetworkFirst)
- **Offline**: Sonner toast when offline/back online; key routes/assets cached
- **Install prompt**: `PWAInstallPrompt` listens for `beforeinstallprompt`, shows install toast (Sonner)
- **public/manifest.json**: start_url `/`, display `standalone`, icons 192/512; **public/icons/**: icon-192.png, icon-512.png

### Responsive navigation

- **Desktop (≥768px)**: Fixed sidebar 240px, collapsible (72px); gold active state, hover glow
- **Mobile (<768px)**: Bottom drawer (`MobileDrawer`); trigger = hamburger in navbar; Framer Motion slide-up; Escape to close, aria-label
- **Layouts**: `SuperLayout`, `MerchantLayout` use `useMediaQuery('(min-width: 768px)')` to switch sidebar vs drawer; menu items localized (i18n), support dark mode

### Components (apps/web/src/components/ui)

- **Card**, **CardHeader**, **CardBody** — container และ section
- **StatCard** — KPI
- **Badge**, **StatusBadge**, **StatusChip**, **FulfillmentStatusBadge**
- **Section**, **SectionHeader** — section กับ title, description, action
- **EmptyState** — title, description, action (ปุ่ม CTA)
- **PageShell** — title, description, breadcrumb, actions, children
- **PanelCard** — title, subtitle, action, children
- **FormSection**, **FieldHint** — group ฟอร์ม และคำอธิบายฟิลด์
- **DataTableShell** — toolbar + loading/empty + เนื้อหาตาราง
- **CopyField**, **WizardStepCard**, **SetupProgressBar**, **ActionFooter**
- **ActivityFeed**, **RevenueChart**, **MerchantTable**
- **IntegrationOverviewCard**, **TestResultPanel**, **InlineInstructionList**

### Merchant components (apps/web/src/components/merchant)

- **FormModal**, **SaveCancelFooter**, **FieldGroup**

---

## 10. การ Deploy

### สิ่งที่ต้องมี

- บัญชี Cloudflare, โปรเจกต์ push ขึ้น GitHub
- Supabase project + รัน SQL ครบ (001–078 ตามลำดับ)
- Node.js 18+

### Build

- รากโปรเจกต์: `npm install`, `npm run build` (shared, api, web)
- API: `npm run build -w apps/api` (Wrangler dry-run)
- Web: `npm run build -w apps/web` → โฟลเดอร์ `apps/web/dist`

### Cloudflare Workers (API)

- สร้าง Worker; ผูก R2: **SLIP_BUCKET**, **CHANNEL_MEDIA_BUCKET**
- Secrets/Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, FACEBOOK_APP_SECRET, FACEBOOK_VERIFY_TOKEN (optional)
- ตั้ง route/domain เช่น api.armai.com

### Cloudflare Pages (Web)

- Build: `npm install && npm run build -w packages/shared && npm run build -w apps/web`
- Output: `apps/web/dist`
- Env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL

### ตรวจสอบหลัง deploy

- เปิด `https://<worker-url>/api/health` → ได้ ok, service, environment
- เปิดหน้าเว็บ → Login ด้วย super_admin

---

## 11. คู่มือติดตั้งและตั้งค่า

### ลำดับการรัน SQL ใน Supabase

รันตามลำดับหมายเลข:

- 001_extensions → 002_enums → 003_tables_core → 004_tables_business → 005–010
- 011_catalog_tables → 012_knowledge_tables → 013_payment_accounts → 014_order_items_and_targets → 015–018
- 019_billing_expansion → 020–022
- 029–047 (bank sync, parser profiles, connections, scoping)
- 048–053 (fulfillment, shipments, COD, auto-send shipping)
- 054–059 (Telegram)
- 060–061 (dashboard summaries)
- 062_retention_support → 063_performance_indexes
- 064–068 (channels, WhatsApp, channel_messages)
- 069–073 (merchant_customers, customer_channel_identities, identity events)
- 074–077 (conversation_summaries, ai_usage_events, router indexes/RLS)
- **078_merchant_defaults** — default_country, default_currency บน merchants (backfill TH/THB)

### Cloudflare

- สร้าง R2 buckets (slips, channel-media), Worker, ผูก SLIP_BUCKET, CHANNEL_MEDIA_BUCKET
- ตั้ง secrets ของ Worker (Supabase, Gemini, Facebook)
- สร้าง Pages, ตั้ง env (VITE\_\*)

### Supabase

- สร้าง user ใน Authentication → Users
- ใน SQL Editor ตั้ง role super_admin (แทนที่ YOUR_USER_UUID):

```sql
insert into public.profiles (id, email, full_name, role)
values ('YOUR_USER_UUID', 'admin@armai.com', 'Super Admin', 'super_admin')
on conflict (id) do update set role = 'super_admin', email = excluded.email, full_name = excluded.full_name, updated_at = now();
```

### Webhooks

- **Facebook:** Webhook URL = `https://<worker>/api/webhooks/facebook`; Verify Token = FACEBOOK_VERIFY_TOKEN
- **Bank:** `https://<worker>/api/webhooks/bank/:merchantId`
- **Telegram:** `https://<worker>/api/webhooks/telegram/:merchantId` (setWebhook กับ Telegram)
- **WhatsApp:** ตาม Meta Developer Console (verify + subscribe)

### สร้าง Super Admin คนแรก

| ขั้น | ที่                               | การกระทำ                                                  |
| ---- | --------------------------------- | --------------------------------------------------------- |
| 1    | Supabase → Authentication → Users | สร้าง user (email + password), จด UID                     |
| 2    | Supabase → SQL Editor             | รัน SQL ด้านบน ใส่/อัปเดต profiles ให้ role = super_admin |
| 3    | หน้า Login                        | ล็อกอิน → เข้า Super Dashboard                            |

### ตรวจหลังติดตั้ง

- ล็อกอินด้วย super_admin → เปิด Super Dashboard, Merchants
- สร้าง merchant ทดสอบ (เลือก default country TH หรือ LA ได้)
- ล็อกอินเป็น merchant → เปิด Merchant Dashboard, Orders, Products, Payment accounts, Settings, Telegram, Customers
- เรียก `GET /api/health` → ได้ ok

---

## 12. การทดสอบ

### แนวทาง

- ทดสอบ logic แยกจาก Cloudflare runtime; ใช้ Vitest ใน Node

### สิ่งที่ทดสอบ

- **packages/shared:** matching score, bank parser, tenant auth, order state, **currency** (getDefaultCurrencyForCountry, getMerchantDefaultCurrency, formatMoney, parseMoneyInput), **phone** (normalizePhone, normalizePhoneByCountry สำหรับ LA/TH/generic)
- **apps/api:** services ที่เขียนแบบ pure/testable

### คำสั่ง

- ราก: `npm run test`
- Shared: `npm run test -w packages/shared`
- API: `npm run test -w apps/api`

---

## 13. Checklist ความสอดคล้อง

ใช้ตรวจว่า schema, code, types, UI และเอกสารตรงกัน

### ตารางและ code

- [ ] profiles — ใช้ใน auth middleware และ RLS; role ตรงกับ shared
- [ ] merchants (รวม default_country, default_currency), merchant_members, merchant_settings
- [ ] facebook_pages, webhook_events, conversations, message_buffers, messages
- [ ] orders (payment_method, payment_status, fulfillment_status), order_slips, order_items, order_payment_targets, order_shipping_details, order_cod_details, order_payment_method_events, order_shipments, order_fulfillment_events
- [ ] bank_configs, bank_parser_profiles, bank_raw_notification_events, bank_transactions, bank_transaction_processing_logs, matching_results (scope_status)
- [ ] product_categories, products, product_variants, product_keywords
- [ ] merchant_faqs, merchant_promotions, merchant_knowledge_entries, merchant_payment_accounts, merchant_cod_settings
- [ ] channels, channel_connections, channel_messages; merchant_customers, customer_channel_identities, customer_identity_events
- [ ] telegram_connections, telegram_admins, telegram_messages, telegram_operation_events, shipment_images
- [ ] conversation_summaries, ai_usage_events
- [ ] merchant_dashboard_summaries, super_dashboard_summaries
- [ ] merchant_plans, merchant_billing_events, merchant_internal_notes, audit_logs, support_access_logs

### Enums และ constants

- [ ] order_status, payment_method, payment_status, fulfillment_status (SQL) ตรง shared
- [ ] matching_result_status, app_role ตรง shared
- [ ] Currency: ใช้ getMerchantDefaultCurrency / FALLBACK_CURRENCY; ไม่ hardcode THB ใน path ที่ต้องตาม merchant

### Routes และ Frontend

- [ ] GET /api/auth/me — AuthContext, api client
- [ ] /api/super/dashboard, /api/super/merchants, POST /api/super/merchants (รวม default_country, default_currency)
- [ ] /api/merchant/dashboard (คืน merchant สำหรับ default currency)
- [ ] /api/merchant/orders, payment-method/switch, cod/\*, shipments, bank-sync, telegram, customers, customer-identities, payment-method-settings, ai/context, ai/metrics
- [ ] /api/webhooks/facebook, bank/:merchantId, telegram/:merchantId, whatsapp
- [ ] GET/PATCH /api/settings, POST /api/orders/confirm-match, POST /api/orders/draft

### RLS และ tenant

- [ ] merchant_admin อ่าน/เขียนเฉพาะเมื่อ user_can_access_merchant(merchant_id)
- [ ] super_admin ใช้ได้ตาม policy
- [ ] Support เป็น read-only

### ความปลอดภัย

- [ ] ไม่มี service role key ใน frontend
- [ ] Flow สำคัญไม่พึ่งแค่ cache; DB เป็น source of truth
- [ ] AI extraction ไม่ set order เป็น paid เอง; เฉพาะ confirm-match + business rule
- [ ] ไม่ hardcode products, ราคา หรือบัญชี; AI ใช้เฉพาะ context จาก DB

---

## 14. หัวข้อเพิ่มเติม

### Conversation Router & AI Context Cache

- **Router:** input = normalized event (ข้อความ + สถานะ order/shipment/COD จาก DB); output = routeCategory + responseMode (template | retrieval | ai | escalation)
- **Cache (best-effort):** products, categories, faqs, promotions, knowledge_entries, cod_settings (TTL); order/payment/shipment **ไม่ cache** — อ่านจาก DB เสมอ
- **Invalidation:** เมื่อ merchant อัปเดต settings หรือ catalog/knowledge/COD
- **POST /api/merchant/ai/context** พร้อม lastMessageText → ผ่าน router; ถ้าได้ template/retrieval จะคืน responseMode + text

### COD (Cash on Delivery) Workflow

- Merchant เปิด COD ใน Settings (min/max amount, fee, manual confirmation)
- Product กำหนด is_cod_allowed, requires_manual_cod_confirmation
- Order มี payment_method เดียว (prepaid_bank_transfer | prepaid_qr | cod); payment_status แยก lifecycle COD (cod_pending_confirmation → cod_ready_to_ship → cod_shipped → cod_collected / cod_failed)
- UI: Order detail → Confirm COD, Mark shipped, Mark collected, Mark failed

### Payment Method Switching

- หนึ่งวิธีต่อ order; สลับได้ผ่าน `POST /api/merchant/orders/:orderId/payment-method/switch`
- order_payment_targets: สลับออกจาก prepaid → is_active = false, invalidation_reason
- order_cod_details: สลับออกจาก COD → is_active = false, superseded_at
- order_payment_method_events บันทึกทุกครั้ง; canSwitchPaymentMethod() ตรวจ lock, paid, COD eligibility, switch count (อาจต้อง merchant confirm)

### Bank Account Scoping

- เฉพาะธุรกรรมที่ **scoped** เข้า matching; ambiguous / out_of_scope เก็บแต่ไม่ match
- Strict mode: ต้องมีหลักฐานบัญชี/ซัฟฟิกซ์ชัด; Relaxed: ใช้ heuristics ได้
- bank_transactions.scope_status, bank_transaction_processing_logs สำหรับ trace
- BCEL One / แอปหลายบัญชี: ผูกหนึ่ง payment account ต่อ connection; ใช้ Strict แนะนำ

### Bank Parser Versioning

- bank_parser_profiles: bank_code, parser_family, parser_version, detection_pattern, extraction_rules_json
- Resolution: ดู profile ตาม merchant bank_code → locale/source → เลือก parser; fallback generic
- ทุก event บันทึก parser_profile_id

### Dashboard Summary Strategy

- **merchant_dashboard_summaries:** หนึ่งแถวต่อ merchant; อัปเดตเมื่อ order paid, matching รัน, shipment สร้าง
- **super_dashboard_summaries:** แถวเดียว; อัปเดต lazy ตอนโหลด dashboard ครั้งแรกหรือจาก cron/event
- Billing health / setup health ยังดึงจาก merchant/plan โดยตรง

### Performance & Scaling (~100 merchants)

- Summary-first dashboards; pagination (orders, super merchants, audit, operations feed)
- Matching เฉพาะ scoped; candidate orders 90 วัน, limit 500 ต่อ merchant
- Indexes: orders (merchant_id, status, created_at, fulfillment_status), order_slips, matching_results, bank_transactions (scope_status, payment_account_id), telegram_operation_events, audit/support logs
- Raw tables: retention_class, retained_until; cleanup ผ่าน retention-cleanup service (ไม่รันใน request path — ใช้ cron หรือ admin endpoint)

### Raw Event Retention

- webhook_events, bank_raw_notification_events, telegram_messages: retention_class short (เช่น 30 วัน); bank_transaction_processing_logs: medium
- retention-cleanup.ts: purgeWebhookEvents, purgeTelegramMessages, purgeBankRawEvents (batch); เรียกจาก cron หรือ POST /super/retention/run

### Telegram Operations

- หนึ่งกลุ่ม Telegram ต่อ merchant; bot token + group ID ใน dashboard
- Order paid → แจ้งกลุ่ม (ถ้าเปิด); รูป slip/waybill จากกลุ่ม → link กับ order → สร้าง shipment; AI escalation → ส่งเข้ากลุ่ม
- telegram_connections, telegram_admins, telegram_operation_events, shipment_images
- API: GET/PATCH /api/merchant/telegram, admins, test; GET /api/merchant/operations/feed; POST /api/webhooks/telegram/:merchantId

### Enterprise Laos (Currency, Phone, Language)

- **Merchant defaults:** merchants.default_country (LA/TH), default_currency (LAK/THB); สร้าง merchant ใหม่ระบุได้; backfill เดิมเป็น TH/THB (078_merchant_defaults.sql)
- **Currency:** shared/currency — getDefaultCurrencyForCountry, getMerchantDefaultCurrency, formatMoney, parseMoneyInput; products, payment accounts, billing events ใช้ default จาก merchant
- **Phone:** shared/phone — normalizePhoneByCountry (Laos 020/+856 → 856…, Thailand 0/66 → 66…); customer-identity ใช้ normalizePhoneForMerchant(merchantId) เพื่อลด duplicate จากรูปแบบเลขต่างกัน
- **Language:** Conversation router รองรับ Lao greetings (sabaidee, ສະບາຍດີ, ສະບາຍ)
- **UI:** หน้า Products / Payment accounts ใช้ defaultCurrency จาก dashboard merchant; Super สร้าง merchant มีฟิลด์ Default country และ Default currency

---

_เอกสารนี้รวมและอัปเดตจาก architecture, auth, data model, API routes, merchant/super workspace, billing, commerce extension, design system, deployment, setup, testing, consistency checklist และจาก conversation-router, cod-workflow, payment-method-switching, bank-account-scoping, bank-parser-versioning, dashboard-summary-strategy, performance, raw-event-retention, telegram-operations, bcel-one, scaling-to-100-merchants, enterprise-laos-upgrade-report, enterprise-laos-upgrade-audit-summary ให้ตรงกับระบบปัจจุบัน_
