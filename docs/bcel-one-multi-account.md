# BCEL One Multi-Account Handling

BCEL One (and similar apps) can have **multiple accounts** in one app. One device may receive notifications for all of them. ArmAI must only match orders to notifications that belong to the **specific payment account** the merchant has configured for receiving orders.

## Problem

- A single Android phone may receive “money received” notifications for:
  - Account A (store payments)
  - Account B (personal)
  - Account C (another business)
- If every notification is treated as eligible for matching, payments to B or C could be wrongly matched to store orders.

## Solution: Account scoping

1. **Link one payment account** — In Bank Sync, the merchant links **one** payment account (the one used for store orders) to the connection.
2. **Strict mode (recommended)** — With **Strict** match mode, only notifications that clearly refer to that account (by account number or suffix) are marked **scoped** and sent to the matching engine.
3. **Out-of-scope and ambiguous** — Notifications for other accounts are stored with `scope_status = out_of_scope` or `ambiguous` and are **not** used for auto-matching.
4. **Visibility** — The merchant (and super admin) can see scoping health: counts of scoped vs ambiguous vs out-of-scope, and use the “Test parser & scoping” tool to paste sample notifications and see the decision.

## Configuration

- **Bank Sync → Select bank and payment account** — Choose “BCEL One” (or Generic if no bank-specific parser yet) and select the **store** payment account.
- **Match mode** — Prefer **Strict** so only notifications with clear receiver account/suffix evidence are matched.
- **Test** — Use “Test parser & scoping” with a pasted sample notification (title/body or JSON) to verify extracted fields and scope result (scoped / out_of_scope / ambiguous) and decision reason.

## Why out-of-scope events are ignored

Notifications that are **out_of_scope** are intentionally excluded from the matching pipeline. Letting them through would:

- Risk matching a payment to the wrong order (e.g. a personal transfer matched to a store order).
- Break trust in “probable match” and “paid” status.

So the system:

- Stores every notification (and raw event) for audit and debugging.
- Sets `scope_status` and `ignored_reason` on each bank transaction.
- Runs the matching engine **only** for transactions with `scope_status = scoped`.

This keeps BCEL One (and other multi-account apps) safe and predictable for merchants.
