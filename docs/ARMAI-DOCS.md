# เอกสารรวมระบบ ArmAI

เอกสารฉบับนี้รวบรวมสถาปัตยกรรม โมเดลข้อมูล API การติดตั้ง และการใช้งานของระบบ ArmAI ให้อยู่ในที่เดียว และอัปเดตให้ตรงกับระบบปัจจุบัน

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

---

## 1. ภาพรวมและสถาปัตยกรรม

### ภาพรวม

ArmAI เป็น multi-tenant SaaS บนโดเมนเดียว หนึ่ง codebase รองรับหลาย merchant แยกข้อมูลตาม tenant (merchant) ทั้งที่ชั้น database (RLS) และ application

### Stack

| ส่วน | เทคโนโลยี |
|------|------------|
| Backend/API | Cloudflare Workers, Hono, TypeScript |
| Database / Auth / Realtime | Supabase (Postgres, Auth, Realtime, RLS) |
| File storage | Cloudflare R2 (slip images) |
| AI | Gemini 1.5 Flash (slip extraction) |
| Frontend | Vite + React + TypeScript (deploy บน Cloudflare Pages) |

### Control Plane

- Super admin: KPIs, รายการ merchant, สร้าง merchant
- Merchant provisioning: สร้าง auth user (Supabase Admin API), แถว merchant, membership, settings
- Billing: merchant_plans, merchants.billing_status
- Audit logs, support access logs
- Support (God mode): อ่านข้อมูล merchant แบบ read-only มี audit ไม่มีการ impersonate session

### Data Plane

- Facebook webhook (page_id → merchant, raw events, message buffer)
- Message debounce/aggregation (message_buffers)
- AI / slip extraction (Gemini)
- Slip image (R2 upload → Gemini)
- Bank webhook (parser ต่อ merchant, bank_transactions)
- Auto-matching (score-based ไม่ set order เป็น paid เอง)
- Orders, message timeline (แยกตาม tenant)

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
- Webhook (Facebook) ตรวจ signature เมื่อตั้งค่า secret

---

## 2. โมเดลข้อมูล (Data Model)

### Core (รากของ tenant)

| ตาราง | คำอธิบาย |
|-------|-----------|
| profiles | ขยาย auth.users; id = auth.users.id; role = super_admin \| merchant_admin |
| merchants | ต้นทาง tenant; slug ไม่ซ้ำ; billing_status |
| merchant_members | (merchant_id, user_id) + role; many-to-many |
| merchant_settings | ต่อ merchant: ai_system_prompt, bank_parser_id, webhook_verify_token |

### Business (มี merchant_id ทั้งหมด)

| ตาราง | คำอธิบาย |
|-------|-----------|
| facebook_pages | (merchant_id, page_id) สำหรับ webhook routing |
| webhook_events | raw events; merchant_id เป็น null ได้สำหรับ verification |
| conversations | หนึ่งต่อ (merchant, page_id, customer_psid) |
| message_buffers | ข้อความรอ flush / aggregate |
| messages | ไทม์ไลน์ข้อความ (inbound/outbound) |
| orders | สถานะ: pending → slip_uploaded → slip_extracted → bank_pending_match → probable_match \| manual_review → paid \| cancelled |
| order_slips | รูป slip ใน R2 + ผล AI; detected_receiver_* (ไม่ set paid เอง) |
| bank_configs | mapping bank/parser ต่อ merchant |
| bank_transactions | รายการจาก bank webhook |
| matching_results | เชื่อม order + bank_transaction; score, status; confirmed + business rule → paid |

### Commerce / Knowledge (มี merchant_id)

| ตาราง | คำอธิบาย |
|-------|-----------|
| product_categories | หมวดสินค้า; sort_order, is_active |
| products | name, slug, base_price, sale_price, currency, status, requires_manual_confirmation, ai_visible |
| product_variants | option values, price_override, stock_qty |
| product_keywords | คำค้นสำหรับ AI |
| product_images | (optional) R2 key ต่อ product |
| merchant_faqs | Q&A สำหรับ AI |
| merchant_promotions | โปรโมชัน; valid_from/until, keywords, is_active |
| merchant_knowledge_entries | type, title, content, keywords, priority |
| merchant_payment_accounts | bank_code, account_number, holder, qr_image_path, qr_image_object_key, is_primary, is_active, sort_order, notes |
| merchant_payment_account_rules | (optional) routing rules |
| order_items | line items ของ order; product_id, variant_id, snapshot ชื่อ/ราคา |
| order_payment_targets | บัญชีที่ assign ให้ order (expected_amount, assignment_reason) |

### Observability & Billing

| ตาราง | คำอธิบาย |
|-------|-----------|
| ai_logs | job type, entity, success, metadata |
| audit_logs | การกระทำ super/support |
| support_access_logs | แต่ละครั้งที่เข้า support (God mode) |
| merchant_plans | แผน/สถานะ billing |
| merchant_billing_events | เหตุการณ์ billing ต่อ merchant |
| merchant_internal_notes | หมายเหตุภายใน (super เท่านั้น) |

### Enums

- **Order status:** `pending` \| `slip_uploaded` \| `slip_extracted` \| `bank_pending_match` \| `probable_match` \| `paid` \| `manual_review` \| `cancelled`
- **Matching result status:** `unmatched` \| `auto_matched` \| `probable_match` \| `manual_review` \| `confirmed` \| `rejected`

---

## 3. การยืนยันตัวตนและบทบาท (Auth & Roles)

### Login

- หน้า login เดียว: `/login`
- Supabase Auth: `signInWithPassword(email, password)` จาก frontend
- Session เก็บโดย Supabase client; ใช้ access token กับ API

### Session

- Frontend ส่ง `Authorization: Bearer <access_token>` ทุก request
- Worker: อ่าน Bearer → ตรวจด้วย Supabase `getUser(token)` → โหลด `profiles.role` และ `merchant_members.merchant_id` ผ่าน service-role
- ไม่ sign out อัตโนมัติเมื่อ 401 เว้นแต่ response บอกชัดว่า session ไม่ถูกต้อง

### บทบาท

- **super_admin:** เจ้าของระบบ; เข้า Control Plane และ Support; สร้าง merchant; ดู tenant ใดก็ได้ (support = read-only)
- **merchant_admin:** ลูกค้า merchant; เข้าได้เฉพาะ merchant ที่ตัวเองเป็น member (บังคับด้วย RLS และ API middleware)

Role อยู่ที่ `profiles.role`; membership อยู่ที่ `merchant_members` เมนูเป็นแค่ UI; การเข้าถึงจริงบังคับที่ backend และ RLS

### Route guards

- **Super admin เท่านั้น:** `/api/super/*`, `/api/support/*` — ใช้ `requireSuperAdmin` หลัง authMiddleware
- **Merchant:** `/api/merchant/*`, `/api/settings`, `/api/orders` — authMiddleware → resolveMerchant → requireMerchantAdmin; ทุก operation ใช้ merchantId จาก path หรือ merchant แรกของ user

### Support (God) mode

- Super admin เริ่ม support session ตาม merchant_id; บันทึกใน `support_access_logs`
- Support เป็น read-only; ไม่ impersonate session ของ merchant หน้าเว็บแสดงแบนเนอร์ "Read-only support mode"

---

## 4. API และเส้นทาง (Routes)

Base URL ของ API ลงท้ายด้วย `/api` (เช่น `https://api.armai.com/api`)

### Health

- `GET /api/health` — สถานะ API (ไม่ต้อง auth)

### Auth

- `GET /api/auth/me` — ข้อมูล user ปัจจุบัน (userId, email, role, merchantIds)

### Super Admin

- `GET /api/super/dashboard` — KPIs, revenue, billingHealth, setupHealth, recentActivity
- `GET /api/super/merchants` — รายการ merchant (ขยายฟิลด์)
- `GET /api/super/merchants/:id` — รายละเอียด merchant
- `PATCH /api/super/merchants/:id` — อัปเดต billing_status / plan
- `POST /api/super/merchants` — สร้าง merchant (รวม user, membership, settings, plans)
- `GET /api/super/merchants/:id/billing` — รายการ billing events
- `POST /api/super/merchants/:id/billing` — สร้าง billing event
- `GET /api/super/merchants/:id/notes` — รายการ internal notes
- `POST /api/super/merchants/:id/notes` — เพิ่ม note
- `GET /api/super/billing/events?merchantId=` — billing events (ทั้งหมดหรือตาม merchant)
- `GET /api/super/audit?limit=` — audit logs
- `POST /api/support/start` — เริ่ม support session (body: merchantId)

### Support

- `GET /api/support/merchants/:merchantId/orders` — orders ของ merchant (read-only)
- `GET /api/support/merchants/:merchantId/settings` — settings ของ merchant (read-only)

### Merchant (ต้อง auth + merchant_admin)

- `GET /api/merchant/dashboard` — merchantId, settings, summary, readiness
- `GET /api/merchant/readiness` — readiness checklist
- `GET /api/merchant/orders?status=&limit=` — รายการ orders
- `GET /api/merchant/orders/:orderId` — รายละเอียด order
- `GET /api/merchant/bank-sync?limit=` — bank_transactions + matching_results
- `POST /api/merchant/ai/context` — build AI context (body: conversationId?, orderId?)

#### Products

- `GET /api/merchant/products?categoryId=&status=` — รายการ products
- `GET /api/merchant/products/search?q=` — ค้นจาก keyword
- `GET /api/merchant/products/:productId` — รายละเอียด product
- `POST /api/merchant/products` — สร้าง product
- `PATCH /api/merchant/products/:productId` — แก้ไข product
- `GET/POST /api/merchant/products/:productId/variants` — variants
- `GET/POST /api/merchant/products/:productId/keywords` — keywords
- `DELETE /api/merchant/products/:productId/keywords/:keywordId` — ลบ keyword

#### Categories

- `GET /api/merchant/categories?activeOnly=` — รายการ categories (activeOnly=false ได้ทั้งหมด)
- `POST /api/merchant/categories` — สร้าง category
- `PATCH /api/merchant/categories/:categoryId` — แก้ไข category

#### Knowledge

- `GET /api/merchant/knowledge/faqs?activeOnly=` — รายการ FAQs
- `POST /api/merchant/knowledge/faqs` — สร้าง FAQ
- `PATCH /api/merchant/knowledge/faqs/:faqId` — แก้ไข FAQ
- `GET /api/merchant/knowledge/entries?type=&activeOnly=` — รายการ knowledge entries
- `POST /api/merchant/knowledge/entries` — สร้าง entry
- `PATCH /api/merchant/knowledge/entries/:entryId` — แก้ไข entry

#### Promotions

- `GET /api/merchant/promotions?activeOnly=` — รายการ promotions
- `POST /api/merchant/promotions` — สร้าง promotion
- `PATCH /api/merchant/promotions/:promotionId` — แก้ไข promotion

#### Payment accounts

- `GET /api/merchant/payment-accounts?activeOnly=` — รายการบัญชี
- `GET /api/merchant/payment-accounts/:accountId` — รายละเอียดบัญชี
- `POST /api/merchant/payment-accounts` — สร้างบัญชี
- `PATCH /api/merchant/payment-accounts/:accountId` — แก้ไขบัญชี

### Settings (merchant_admin)

- `GET /api/settings` — ดึง merchant settings (ai_system_prompt, bank_parser_id, webhook_verify_token)
- `PATCH /api/settings` — อัปเดต settings (ส่งเฉพาะฟิลด์ที่ต้องการเปลี่ยน)

### Orders (merchant_admin)

- `POST /api/orders/confirm-match` — ยืนยัน/ปฏิเสธ matching (body: matching_result_id, confirm)
- `POST /api/orders/draft` — สร้าง draft order + items + payment target (body: conversationId?, items[], customerPsid?, customerName?)

### Webhooks (ไม่ใช้ Bearer แบบ user)

- `GET/POST /api/webhooks/facebook` — Facebook webhook (verify + events)
- `POST /api/webhooks/bank/:merchantId` — Bank webhook ต่อ merchant

---

## 5. Workspace ของ Merchant

Merchant จัดการข้อมูลของตัวเองผ่านหน้าเว็บได้ครบ (CRUD) โดยไม่กระทบ auth, tenant isolation, webhook, slip หรือ matching

### หน้าที่มี

- **Overview** — Dashboard สรุป orders, payment, readiness
- **Orders** — รายการ orders
- **Bank Sync** — bank transactions + matching results
- **Products** — สร้าง/แก้ไข/ลิสต์ products (ค้นหา/กรอง, เลือก category)
- **Categories** — สร้าง/แก้ไข/ลิสต์ categories
- **Knowledge** — แท็บ FAQs และ Entries; สร้าง/แก้ไข FAQs และ knowledge entries
- **Promotions** — สร้าง/แก้ไข/ลิสต์ promotions (รวม valid_from, valid_until, keywords, is_active)
- **Payment accounts** — สร้าง/แก้ไข/ลิสต์บัญชี (รวม primary/active badge, ฟิลด์ครบตาม schema)
- **Settings** — แก้ไข AI prompt, bank_parser_id, webhook_verify_token (แบ่งเป็น 3 section)

### ฟิลด์หลักที่รองรับ

- **Product:** category_id, name, slug, description, base_price, sale_price, currency, sku, status, requires_manual_confirmation, ai_visible
- **Category:** name, description, sort_order, is_active
- **FAQ:** question, answer, keywords, sort_order, is_active
- **Knowledge entry:** type, title, content, keywords, priority, is_active
- **Promotion:** title, content, valid_from, valid_until, keywords, is_active
- **Payment account:** bank_code, account_name, account_number, account_holder_name, currency, qr_image_path, qr_image_object_key, is_primary, is_active, sort_order, notes
- **Settings:** ai_system_prompt, bank_parser_id, webhook_verify_token

### Components ร่วม (Merchant)

- `FormModal` — modal สำหรับฟอร์ม (title, body, footer, ปิดด้วย Escape)
- `SaveCancelFooter` — ปุ่ม Cancel + Save (รองรับสถานะ saving)
- `FieldGroup` — label + hint + children สำหรับฟิลด์ฟอร์ม

---

## 6. ระบบ Super Admin

### Navigation

- Overview (dashboard)
- Merchants (ตาราง + สร้าง merchant)
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

ฟิลด์เพิ่ม: monthly_price_usd, currency, billing_cycle, started_at, trial_ends_at, current_period_start, next_billing_at, last_paid_at, grace_until, cancel_at_period_end, is_auto_renew, notes

### merchant_billing_events

- id, merchant_id, event_type, amount, currency, invoice_period_*, due_at, paid_at, status, reference_note, created_at, updated_at
- RLS: super อ่าน/เขียน; member อ่านได้ตาม policy

### merchant_internal_notes

- id, merchant_id, actor_id, note, created_at
- RLS: super เท่านั้น (merchant ไม่เห็น)

### SQL migrations (Billing)

- 019_billing_expansion.sql — ขยาย merchant_plans; สร้าง merchant_billing_events, merchant_internal_notes
- 020_billing_indexes.sql
- 021_billing_rls.sql
- 022_billing_policies.sql

การสร้าง merchant ใหม่ยังคงสร้าง auth user, merchant, merchant_members, merchant_settings และสร้าง **merchant_plans** (starter, trialing, trial_ends_at, next_billing_at = now + 14 วัน)

---

## 8. Commerce / Knowledge Extension

### วัตถุประสงค์

- AI รู้ products, ราคา, บัญชีรับโอน, FAQs, โปรโมชัน, knowledge entries **จาก database เท่านั้น**
- ไม่ hardcode products, ราคา หรือบัญชีใน code/prompt
- การ assign payment target เป็นไปตาม rule และ audit ได้ (order_payment_targets)
- Slip verification และ bank matching ใช้ expected payment account ได้

### AI context

- `buildAiContext(merchantId, …)` รวม: platform prompt, merchant prompt จาก settings, products, categories, faqs, promotions, knowledge entries, order summary, payment target
- AI ตอบจาก context นี้เท่านั้น; ถ้าข้อมูลไม่มี ให้บอกว่าไม่มี

### Slip และ matching

- Slip extraction (Gemini) ส่งคืน detected_receiver_* เก็บใน order_slips
- Matching score มี receiverAccountScore เมื่อมี expected account (order_payment_targets)
- Flow เดิมของ amount/time/sender/reference ยังใช้อยู่

### SQL (extension)

- 011–013: catalog, knowledge, payment account tables
- 014: order_items, order_payment_targets; orders.conversation_id
- 015: alter order_slips, bank_transactions, matching_results
- 016–018: indexes, RLS, policies

---

## 9. Design System และ UI

### Theme (apps/web)

- Black/Gold enterprise: background #0B0B0B, surface #121212, primary #D4AF37, highlight #F5D67A
- ใช้ในทุกหน้า merchant และ super

### Components (apps/web/src/components/ui)

- **Card**, **CardHeader**, **CardBody** — container และ section
- **StatCard** — KPI
- **Badge** — variants: default, success, warning, danger, info, gold
- **StatusBadge** — สถานะ order/matching
- **Section**, **SectionHeader** — section กับ title, description, action
- **EmptyState** — title, description, action (ปุ่ม CTA)
- **PageShell** — title, description, breadcrumb, actions, children
- **PanelCard** — title, subtitle, action, children

### Merchant components (apps/web/src/components/merchant)

- **FormModal** — modal ฟอร์ม
- **SaveCancelFooter** — Cancel + Save
- **FieldGroup** — label + hint + children

---

## 10. การ Deploy

### สิ่งที่ต้องมี

- บัญชี Cloudflare, โปรเจกต์ push ขึ้น GitHub
- Supabase project + รัน SQL ครบ (ดูหัวข้อ 11)
- Node.js 18+ (สำหรับ build)

### Build

- รากโปรเจกต์: `npm install`, `npm run build` (shared, api, web)
- API: `npm run build -w apps/api` (Wrangler dry-run)
- Web: `npm run build -w apps/web` → โฟลเดอร์ `apps/web/dist`

### Cloudflare Workers (API)

- สร้าง Worker (หรือเชื่อม GitHub)
- ผูก R2: variable `SLIP_BUCKET` ชี้ไปที่ bucket (เช่น armai-slips)
- ตั้งค่า Secrets/Env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `FACEBOOK_APP_SECRET`, `FACEBOOK_VERIFY_TOKEN` (optional)
- ตั้ง route/domain เช่น `api.armai.com`

### Cloudflare Pages (Web)

- สร้างโปรเจกต์ Pages (เชื่อม Git หรืออัปโหลด build)
- Build: `npm install && npm run build -w packages/shared && npm run build -w apps/web`
- Output: `apps/web/dist`
- Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` (URL ของ Worker)

### Deploy จากเครื่อง (ไม่ใช้ Git)

**Worker:**

```bash
cd <repo>
npm install
# แก้ wrangler.toml ให้ bucket ชื่อจริง
cd apps/api
npx wrangler secret put SUPABASE_URL
# ... ใส่ secrets อื่น
npx wrangler deploy
```

**Pages:** build แล้วอัปโหลด `apps/web/dist` ผ่าน Dashboard → Upload assets หรือเชื่อม Git ตามหัวข้อด้านบน

### ตรวจสอบหลัง deploy

- เปิด `https://<worker-url>/api/health` → ได้ `{ ok: true, service: "armai-api", environment: "production" }`
- เปิดหน้าเว็บ → Login ด้วย super_admin

---

## 11. คู่มือติดตั้งและตั้งค่า

### ลำดับการรัน SQL ใน Supabase

รันตามลำดับ:

- 001_extensions → 002_enums → 003_tables_core → 004_tables_business → 005_indexes → 006_functions → 007_triggers → 008_rls_enable → 009_policies → 010_seed_minimal
- 011_catalog_tables → 012_knowledge_tables → 013_payment_accounts → 014_order_items_and_targets → 015_extension_alter → 016_extension_indexes → 017_extension_rls → 018_extension_policies
- 019_billing_expansion → 020_billing_indexes → 021_billing_rls → 022_billing_policies

### Cloudflare

- สร้าง R2 bucket, Worker, ผูก SLIP_BUCKET
- ตั้ง secrets ของ Worker (Supabase, Gemini, Facebook)
- สร้าง Pages, ตั้ง env (VITE_*)

### Supabase

- สร้าง user ใน Authentication → Users
- ใน SQL Editor ตั้ง role super_admin (แทนที่ YOUR_USER_UUID ด้วย UID ของ user):

```sql
insert into public.profiles (id, email, full_name, role)
values (
  'YOUR_USER_UUID',
  'admin@armai.com',
  'Super Admin',
  'super_admin'
)
on conflict (id) do update set
  role = 'super_admin',
  email = excluded.email,
  full_name = excluded.full_name,
  updated_at = now();
```

### Facebook Webhook

- ใน Meta Developer app ตั้ง Webhook URL = `https://<worker>/api/webhooks/facebook`
- Verify Token = ค่าเดียวกับ FACEBOOK_VERIFY_TOKEN ใน Worker (หรือเว้นว่างถ้ารับค่าใดก็ได้ตอน verify)
- Subscribe events ที่ใช้ (เช่น messages)

### สร้าง Super Admin คนแรก (สรุป)

| ขั้น | ที่ | การกระทำ |
|-----|-----|-----------|
| 1 | Supabase → Authentication → Users | สร้าง user (email + password), จด **UID** |
| 2 | Supabase → SQL Editor | รัน SQL ด้านบน ใส่/อัปเดต profiles ให้ role = super_admin |
| 3 | หน้า Login (armai.pages.dev/login หรือโดเมนที่ deploy) | ล็อกอิน → เข้า Super Dashboard |

### ตรวจหลังติดตั้ง

- ล็อกอินด้วย super_admin → เปิด Super Dashboard, Merchants
- สร้าง merchant ทดสอบ จาก Super → Merchants
- ล็อกอินเป็น merchant (หรือเพิ่ม user นั้นใน merchant_members) → เปิด Merchant Dashboard, Orders, Products, Categories, Knowledge, Promotions, Payment accounts, Settings
- เรียก `GET /api/health` → ได้ `{ ok: true }`

---

## 12. การทดสอบ

### แนวทาง

- ทดสอบ logic แยกจาก Cloudflare runtime; ใช้ Vitest ใน Node
- ไม่พึ่ง wrangler dev เป็นหลัก

### สิ่งที่ทดสอบ

- **packages/shared:** matching score/outcome, bank parser (generic), tenant auth helper, order state
- **apps/api:** matching กับ shared, services อื่นที่เขียนแบบ pure/testable

### คำสั่ง

- ราก: `npm run test`
- Shared: `npm run test -w packages/shared`
- API: `npm run test -w apps/api`

### สิ่งที่ไม่ทดสอบในเครื่อง

- Request/response จริงผ่าน Worker กับ Supabase/R2 จริง (ใช้ env deploy หรือ integration กับ test project)
- E2E ทั้งระบบ (ทำหลัง deploy หรือใช้ E2E tool)

---

## 13. Checklist ความสอดคล้อง

ใช้ตรวจว่า schema, code, types, UI และเอกสารตรงกัน

### ตารางและ code

- [ ] profiles — ใช้ใน auth middleware และ RLS; role ตรงกับ shared
- [ ] merchants, merchant_members, merchant_settings — ตรง types และ API
- [ ] facebook_pages, webhook_events, conversations, message_buffers, messages — ตรง webhook และ SQL
- [ ] orders, order_slips — สถานะตรง ORDER_STATUS; slip ไม่ set paid เอง
- [ ] bank_configs, bank_transactions, matching_results — ตรง bank webhook และ matching; สถานะตรง MATCHING_RESULT_STATUS
- [ ] ai_logs, audit_logs, support_access_logs, merchant_plans — ตรง support/audit
- [ ] product_categories, products, product_variants, product_keywords — ตรง catalog และ RLS
- [ ] merchant_faqs, merchant_promotions, merchant_knowledge_entries — ตรง knowledge และ RLS
- [ ] merchant_payment_accounts, merchant_payment_account_rules — ตรง payment-accounts และ RLS
- [ ] order_items, order_payment_targets — ตรง order-draft และ matching; orders.conversation_id

### Enums

- [ ] order_status (SQL) = ORDER_STATUS (shared)
- [ ] matching_result_status (SQL) = MATCHING_RESULT_STATUS (shared)
- [ ] app_role (SQL) = ROLE (shared)

### Routes และ Frontend

- [ ] GET /api/auth/me — AuthContext, api client
- [ ] /api/super/dashboard, /api/super/merchants, POST /api/super/merchants — Super UI
- [ ] POST /api/support/start, GET /api/support/merchants/:id/orders — Support
- [ ] /api/merchant/dashboard, orders, bank-sync — Merchant dashboard
- [ ] /api/merchant/products (GET, POST, PATCH), categories, knowledge/*, promotions (GET, POST, PATCH), payment-accounts — หน้า Products, Categories, Knowledge, Promotions, Payment accounts (CRUD)
- [ ] POST /api/merchant/ai/context — AI context
- [ ] POST /api/orders/draft — draft order
- [ ] GET/PATCH /api/settings — MerchantSettings
- [ ] POST /api/orders/confirm-match — ยืนยัน matching
- [ ] /api/webhooks/facebook, /api/webhooks/bank/:merchantId

### RLS และ tenant

- [ ] merchant_admin อ่าน/เขียนเฉพาะเมื่อ user_can_access_merchant(merchant_id)
- [ ] super_admin ใช้ได้ตาม policy (merchants, audit, support)
- [ ] Support เป็น read-only; ไม่มี policy ให้ support แก้ข้อมูล merchant

### ความปลอดภัย

- [ ] ไม่มี service role key ใน frontend
- [ ] Flow สำคัญไม่พึ่งแค่ cache; DB เป็น source of truth
- [ ] AI extraction ไม่ set order เป็น paid เอง; เฉพาะ confirm-match + business rule
- [ ] ไม่ hardcode products, ราคา หรือบัญชี; AI ใช้เฉพาะ context จาก DB

---

*เอกสารนี้รวมและอัปเดตจาก architecture, auth-flow, data-model, enterprise-ux-schema, deployment, deployment-cloudflare-th, extension-commerce, consistency-checklist, manual-setup-checklist, testing, create-superadmin-th และสอดคล้องกับระบบปัจจุบัน (รวม Merchant CRUD ครบทุกหน้า และ Promotions PATCH).*
