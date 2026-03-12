# Bank Parser Versioning

ArmAI supports multiple bank notification formats through a **parser profile** system. Parsers are versioned and selectable by bank, app, and locale so the system can evolve without a single fragile regex.

## Concepts

- **Parser profile** — A row in `bank_parser_profiles` with:
  - `bank_code` (e.g. GENERIC, BCEL_ONE, LDB)
  - `parser_family` (e.g. bcel_one_en, generic_fallback)
  - `parser_version`
  - Optional: `locale`, `source_app_package`, `detection_pattern`, `extraction_rules_json`
  - `priority` (lower = higher priority when multiple profiles match)

- **Parser resolution** — When a webhook is received, the backend:
  1. Looks up active profiles for the merchant’s `bank_code`
  2. Optionally narrows by locale / source app / pattern
  3. Uses the highest-priority matching profile
  4. Falls back to `merchant_settings.bank_parser_id` or the generic parser if no profile matches

- **Traceability** — Every processed event records which `parser_profile_id` was used (on `bank_transactions` and in `bank_transaction_processing_logs`).

## Adding a new parser profile

1. Implement the parser in code (e.g. in `@armai/shared` or API) and register it in the parser registry (e.g. `bank-webhook.ts`).
2. Insert a row into `bank_parser_profiles` with the correct `bank_code`, `parser_family`, `parser_version`, and optional `detection_pattern` / `extraction_rules_json`.
3. Ensure the profile’s `id` matches the parser’s ID in the registry, or that resolution maps the profile to the correct parser.

## Generic fallback

The built-in generic parser is registered with ID `00000000-0000-4000-8000-000000000001` and a matching row in `bank_parser_profiles` for `bank_code = 'GENERIC'`. It expects a JSON payload with `amount`, `datetime`, and optional `sender_name`, `reference_code`, `transaction_id`.

## Why versioning matters

- Different banks and app versions send different text formats.
- Locale (e.g. en vs lo) can change field labels.
- Storing which parser was used per event makes debugging and support straightforward and allows safe rollout of new parser versions.
