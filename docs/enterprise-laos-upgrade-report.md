# Enterprise Laos Upgrade — Implementation Report

This document summarizes the in-place refactor applied to make the ArmAI platform enterprise-ready for Laos merchants while preserving the existing architecture (Cloudflare Workers + Hono + Supabase + shared package) and multi-tenant safety.

---

## 1. What Was Changed

### Currency and money model
- **Merchant-level defaults:** Added `default_country` (ISO 3166-1 alpha-2) and `default_currency` (ISO 4217) on `merchants`. New merchants can be created with `LA`/`LAK` for Laos; existing rows backfilled to `TH`/`THB`.
- **Shared currency module:** New `packages/shared/src/currency.ts` with `getDefaultCurrencyForCountry`, `getMerchantDefaultCurrency`, `formatMoney`, `parseMoneyInput`, `FALLBACK_CURRENCY`, `SUPPORTED_CURRENCIES` (LAK, THB, USD).
- **API:** Product creation, payment account creation, billing event creation, and super-admin merchant/plan creation now resolve currency from merchant defaults (or payment account for order payment targets) instead of hardcoded `THB`. Order-detail switch-to-prepaid uses the selected payment account’s currency for `expected_currency`.
- **Web:** Merchant dashboard response now includes `merchant` (with `default_currency` / `default_country`). Products and Payment Accounts pages use dashboard merchant to set form default currency (LAK for Laos merchants, THB otherwise).

### Laos phone normalization
- **Shared phone module:** New `packages/shared/src/phone.ts` with `normalizePhoneByCountry(phone, countryCode)` supporting Laos (+856, local 020 → canonical 856…), Thailand (66/0), and generic fallback. `normalizePhone` retained for backward compatibility.
- **API customer-identity:** New `normalizePhoneForMerchant(supabase, merchantId, phone)` uses merchant’s `default_country` for country-aware normalization. `getOrCreateChannelIdentity` and `createMerchantCustomer` use it; PATCH customer and WhatsApp webhook auto-link use it so duplicate identities from format variations (e.g. 020 vs +856) are avoided.

### Laos language / routing
- **Conversation router:** Greeting patterns extended with Lao: `sabaidee`, `ສະບາຍດີ`, `ສະບາຍ` so Lao-language greetings are routed to template response.

### Enterprise UI foundation
- **Theme:** Added `spacing` and `typography` design tokens in `apps/web/src/theme.ts` for consistent layout and hierarchy.
- **New components:** `FormSection`, `FieldHint`, `DataTableShell` in `apps/web/src/components/ui` for form grouping, field help text, and table toolbar/loading/empty states. Exported from `components/ui/index.ts`.

### Developer / shared
- **Merchant type and schema:** `Merchant` in `types.ts` now includes `default_country` and `default_currency`. `createMerchantBodySchema` extended with optional `default_country`, `default_currency`; password error message made language-neutral.
- **Shared exports:** `currency` and `phone` modules exported from `packages/shared`; `phone` uses `COUNTRY_LA`/`COUNTRY_TH` from `currency` to avoid duplicate exports.
- **Unused import removed:** `channelTypeSchema` import removed from `schemas/customer-identity.ts` (fixes build).

### Tests
- **packages/shared:** `currency.test.ts` (getDefaultCurrencyForCountry, getMerchantDefaultCurrency, formatMoney, parseMoneyInput) and `phone.test.ts` (normalizePhone, normalizePhoneByCountry for LA/TH/generic). All new tests pass.

---

## 2. Why It Was Changed

- **Laos readiness:** Merchants in Laos need LAK as first-class default and correct phone normalization (+856, 020) to avoid duplicate customers and failed matches.
- **Enterprise correctness:** Currency and phone must not be hardcoded to Thailand; they must derive from merchant (or payment account) and country.
- **Scalability:** Single source of truth for currency (shared + merchant defaults) and phone (country-aware normalization) makes future countries and features easier.
- **Consistency:** Design tokens and reusable UI primitives reduce inline-style sprawl and improve maintainability for Cursor and future engineers.

---

## 3. Files Touched

| Area | Files |
|------|--------|
| **SQL** | `sql/078_merchant_defaults.sql` (new) |
| **Shared** | `packages/shared/src/currency.ts` (new), `packages/shared/src/phone.ts` (new), `packages/shared/src/index.ts`, `packages/shared/src/types.ts`, `packages/shared/src/schemas/merchant.ts`, `packages/shared/src/schemas/customer-identity.ts`, `packages/shared/src/currency.test.ts` (new), `packages/shared/src/phone.test.ts` (new) |
| **API** | `apps/api/src/services/merchant.ts`, `apps/api/src/services/catalog.ts`, `apps/api/src/services/payment-accounts.ts`, `apps/api/src/services/billing.ts`, `apps/api/src/services/order-detail.ts`, `apps/api/src/services/customer-identity.ts`, `apps/api/src/services/conversation-router.ts`, `apps/api/src/services/whatsapp-webhook.ts`, `apps/api/src/routes/super/index.ts`, `apps/api/src/routes/merchant/index.ts`, `apps/api/src/routes/merchant/customers.ts` |
| **Web** | `apps/web/src/theme.ts`, `apps/web/src/lib/api.ts`, `apps/web/src/pages/merchant/MerchantProducts.tsx`, `apps/web/src/pages/merchant/MerchantPaymentAccounts.tsx`, `apps/web/src/pages/super/SuperMerchants.tsx`, `apps/web/src/components/ui/index.ts`, `apps/web/src/components/ui/FormSection.tsx` (new), `apps/web/src/components/ui/DataTableShell.tsx` (new) |

---

## 4. Migrations Added

- **078_merchant_defaults.sql:** Adds `merchants.default_country` and `merchants.default_currency` (nullable then backfilled to `TH`/`THB`), with defaults for new rows set to `TH`/`THB`. No destructive changes; existing data remains valid.

---

## 5. UI System Improvements Added

- **Design tokens:** `spacing` (xs–xxl) and `typography` (pageTitle, sectionTitle, body, bodySmall, caption) in `theme.ts`.
- **Components:** `FormSection` (title + hint + children), `FieldHint` (inline help), `DataTableShell` (toolbar + loading/empty + table content). These are ready for use on products, payment accounts, orders, and super-admin pages to replace repeated inline styles.

---

## 6. Laos Localization Improvements

- **Currency:** LAK as default for `default_country = LA`; merchant and plan creation accept `default_country`/`default_currency`; products, payment accounts, and billing events use merchant default when currency not explicitly provided.
- **Phone:** Laos numbers normalized to canonical 856… (e.g. 020… → 85620…); Thailand and generic fallback preserved; customer identity and auto-link use country-aware normalization when merchant is known.
- **Language:** Lao greetings (sabaidee, ສະບາຍດີ, ສະບາຍ) in conversation router for template greeting response.

---

## 7. Developer Architecture Improvements

- **Single source of truth:** Currency and phone logic live in `@armai/shared` and are used by both API and web.
- **Clear contracts:** Merchant type and create-merchant schema include locale defaults; dashboard response includes `merchant` for client-side default currency.
- **Testability:** Currency and phone behavior covered by unit tests in shared.

---

## 8. Remaining Recommended Future Work (Brief)

- **Super admin UI:** Implemented — “Add Merchant” in SuperMerchants includes Default country (TH/LA) and optional Default currency; values are sent to `createMerchant`.
- **More pages:** Apply `DataTableShell`, `FormSection`, and `FieldHint` to MerchantOrders, MerchantOrderDetail, SuperBilling, SuperAudit, and settings/onboarding flows.
- **Merchant settings:** Allow merchants to edit their own `default_country`/`default_currency` (and surface in API) if business requires.
- **Observability:** Add structured logging or request context (e.g. merchantId) in key routes for easier diagnostics.
- **Pre-existing tests:** Two existing shared tests currently fail (matching/score totalScore threshold, parsers/generic invalid payload). Fix or relax assertions as needed.

---

**Build status:** Full monorepo build (shared, api, web) succeeds. New currency and phone tests pass.
