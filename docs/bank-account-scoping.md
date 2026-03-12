# Bank Account Scoping

Bank notification ingestion in ArmAI uses **account scoping** to ensure only notifications that belong to the merchant’s configured payment account are used for order matching. This avoids false matches when one device or app receives notifications for multiple accounts (e.g. BCEL One with several accounts).

## Pipeline

1. **Raw intake** — Incoming webhook is stored in `bank_raw_notification_events` (and optionally linked to a `bank_connection`).
2. **Parser resolution** — A parser profile is chosen (see [bank-parser-versioning.md](bank-parser-versioning.md)).
3. **Parse** — Raw payload is parsed into a normalized transaction candidate.
4. **Account scoping** — The candidate is checked against the linked payment account (see below).
5. **Eligibility** — Only **scoped** transactions proceed to the normal matching engine. **Ambiguous** and **out_of_scope** are stored but not auto-matched.

## Scope statuses

| Status         | Meaning | Matching |
|----------------|--------|----------|
| **scoped**     | Notification is for the linked payment account. | Eligible for auto-matching. |
| **ambiguous**  | Not enough evidence to be sure. | Not auto-matched; can be reviewed. |
| **out_of_scope** | Clearly not for the linked account (e.g. different account number). | Excluded from matching. |
| **manual_review** | Flagged for human review. | Not auto-matched. |

Only `scoped` transactions are passed to the matching pipeline.

## Scoping logic (summary)

- **Exact account match** — If the notification includes a receiver account number and it matches the payment account’s normalized number → **scoped** (high confidence).
- **Suffix / masked match** — If only a suffix is present and it matches the payment account’s suffix (or alias) → **scoped**.
- **Mismatch** — If receiver account or suffix is present and does not match → **out_of_scope**.
- **Strict mode** — Requires strong account/suffix evidence; otherwise **out_of_scope** or **ambiguous**.
- **Relaxed mode** — May use device binding plus account holder name / bank hints to scope, with lower confidence; otherwise **ambiguous** if evidence is weak.
- **No linked account** — Treated as legacy: all notifications are considered **scoped** so existing behaviour (matching all) is preserved.

## Strict vs relaxed mode

- **Strict (default)** — Recommended when the same app has multiple accounts. Only notifications with clear receiver account or suffix match are scoped.
- **Relaxed** — Allows heuristics (e.g. device + account holder name similarity) when explicit receiver data is missing. Still does not auto-match when confidence is low.

Mode is configured per bank connection / bank config (`match_mode`).

## Where it’s stored

- **bank_transactions** — `scope_status`, `scope_confidence`, `ignored_reason`, `payment_account_id`.
- **bank_transaction_processing_logs** — `scope_status`, `matching_eligibility`, `decision_reason` for every decision.

This gives full traceability for support and debugging.
