# Enterprise Laos Upgrade — Audit Summary

Strict enterprise review of the implementation, with fixes applied and remaining items noted.

---

## Critical Fixes Completed

1. **Removed dangerous hardcoded THB in merchant-facing UI**
   - **MerchantProducts:** Table price column now uses `p.currency ?? defaultCurrency` (was `'THB'`). Currency input placeholder and validation hint use `defaultCurrency` and "e.g. LAK, THB".
   - **MerchantPaymentAccounts:** Currency field value and placeholder use `defaultCurrency`; onChange fallback when cleared uses `defaultCurrency` instead of `'THB'`.

2. **API fallback currency centralized**
   - **order-detail.ts:** `expectedCurrency` when payment account has no currency now uses `FALLBACK_CURRENCY` from `@armai/shared` instead of literal `'THB'` for consistency and single source of truth.

3. **Merchant default currency resolution hardened**
   - **getMerchantDefaultCurrency (shared):** Now trims and normalizes optional `default_currency`; only treats as explicit when trimmed length is 3, avoiding edge cases with whitespace.

4. **Schema normalization**
   - **createMerchantBodySchema:** `default_country` and `default_currency` now use `.transform(s => s.toUpperCase())` so client-sent "la"/"lak" are stored and used consistently.

---

## Verification Summary (10 Criteria)

| # | Criterion | Status |
|---|-----------|--------|
| 1 | No dangerous hardcoded THB where Laos-aware behavior required | **Met** — All merchant-facing defaults and API fallbacks use merchant default or shared `FALLBACK_CURRENCY`. Legacy SQL table defaults (011, 013, 014, 019) unchanged for backward compatibility. |
| 2 | LAK-first for Laos merchants | **Met** — `getDefaultCurrencyForCountry('LA')` → LAK; create merchant with `default_country: 'LA'` yields LAK; products/accounts/billing use merchant default. |
| 3 | Phone normalization consistent, not duplicate-prone | **Met** — All identity paths use `normalizePhoneForMerchant` (getOrCreateChannelIdentity, createMerchantCustomer, PATCH customer, WhatsApp auto-link). Lao 020 and +856 normalize to same canonical 856… form. |
| 4 | UI more reusable, less inline style | **Partial** — New primitives (FormSection, FieldHint, DataTableShell, spacing/typography tokens) exist and are exported. Merchant Products/Payment Accounts still use inline styles; migration to primitives is incremental. |
| 5 | Merchant pages clearer and workflow-oriented | **Partial** — Currency and defaults are workflow-correct. Full layout/workflow refactor (sections, toolbars, empty states) not done for all pages. |
| 6 | Super admin more enterprise and readable | **Partial** — Create-merchant form has country/currency; super list/detail/billing/audit not restyled in this pass. |
| 7 | Shared types/schemas/helpers aligned | **Met** — Merchant type and createMerchantBodySchema include default_country/currency; dashboard response includes merchant; currency/phone live in shared with tests. |
| 8 | No API contract drift | **Met** — Dashboard response is additive (`merchant` added); no breaking changes. |
| 9 | SQL migrations coherent and backward-aware | **Met** — 078 only; additive columns, backfill TH/THB, defaults for new rows. |
| 10 | Easier to extend | **Met** — Single source for currency/phone; country-aware helpers; new countries require only config and optional normalizer. |

---

## Important Files Changed (Audit Round)

| Area | File | Change |
|------|------|--------|
| Web | `apps/web/src/pages/merchant/MerchantProducts.tsx` | Table currency fallback and placeholder use `defaultCurrency`; validation message "e.g. LAK, THB". |
| Web | `apps/web/src/pages/merchant/MerchantPaymentAccounts.tsx` | Currency value, placeholder, and empty fallback use `defaultCurrency`. |
| API | `apps/api/src/services/order-detail.ts` | Import and use `FALLBACK_CURRENCY` for `expectedCurrency` fallback. |
| Shared | `packages/shared/src/currency.ts` | `getMerchantDefaultCurrency` trims and validates 3-char currency. |
| Shared | `packages/shared/src/schemas/merchant.ts` | `default_country` and `default_currency` normalized to uppercase via `.transform()`. |

---

## Migrations Added

- **078_merchant_defaults.sql** — Adds `merchants.default_country` and `merchants.default_currency`; backfills existing rows to TH/THB; sets default for new rows. No destructive changes.

---

## Remaining Medium-Risk / Follow-up Items

1. **Legacy SQL table defaults** — `products`, `merchant_payment_accounts`, `order_payment_targets`, `merchant_plans`, and `merchant_billing_events` still have `DEFAULT 'THB'` at the column level. Behavior is correct at runtime (API resolves from merchant or account), but schema and runtime could be documented or aligned in a future migration (e.g. leave default for backward compat or set to a sentinel that API never uses).

2. **UI migration to design primitives** — Merchant and super pages still rely on inline styles. Gradual adoption of FormSection, FieldHint, DataTableShell, and spacing/typography tokens would improve consistency and maintainability.

3. **Pre-existing test failures** — `matching/score.test.ts` and `parsers/generic.test.ts` still fail; unrelated to this upgrade. Should be fixed or relaxed in a separate pass.

4. **Super list columns** — SuperMerchants table does not yet show `default_country`/`default_currency`; could be added for operational visibility.

---

**Build:** Full monorepo build succeeds.  
**Tests:** All currency and phone tests (24) pass.
