# Conversation Router & AI Context Cache

## Overview

The **Conversation Router** and **AI Context Cache** layer reduces Gemini/API cost by:

- Routing incoming messages before calling AI (rule-first, AI-second).
- Caching catalog/knowledge/COD context with TTL; order/payment/shipment stay live from DB.
- Supporting low-cost response paths (templates, retrieval) and logging why AI was used.

## Router

- **Input**: Normalized event (`merchantId`, `channelType`, `conversationId`, `messageType`, `text`, and **fresh-from-DB** order/shipment/COD state).
- **Output**: `routeCategory` (e.g. greeting, product_inquiry, payment_slip_related, request_human_escalation) and `responseMode` (`template` | `retrieval` | `ai` | `escalation`).
- **Channel-agnostic**: Same logic for Facebook and WhatsApp; channel-specific handling stays at ingestion/output edges.

## Response Modes

- **template**: Fixed or parameterized reply (e.g. greeting, ack).
- **retrieval**: Answer from FAQ, tracking number, “please send slip”, COD available/not available.
- **ai**: Full AI context is built and generation is required.
- **escalation**: Human handoff; reply is an acknowledgement.

## Cache (Best-Effort Only)

- **Cached**: `products`, `categories`, `faqs`, `promotions`, `knowledge_entries`, `cod_settings` (TTL 3–5 min). Keys are tenant-scoped (`m:{merchantId}:{scope}`).
- **Never cached**: Order summary, payment target, shipment, payment status, fulfillment, COD status. These are always read from DB in the context builder and in low-cost resolution.
- **Invalidation**: On merchant settings update, catalog/knowledge/COD create or update, cache for that merchant/scope is invalidated. DB remains source of truth.

## Conversation Summary

- Table: `conversation_summaries` (per conversation: recent intent, active order, payment method, fulfillment/payment state).
- Used to reduce repeated token usage in AI context. Raw message history remains source of truth; summary is safe to rebuild.

## API

- **POST /api/merchant/ai/context**
  - Without `lastMessageText`: Returns full built context (unchanged behavior).
  - With `lastMessageText` (and optional `conversationId`, `orderId`, `channelType`, `messageType`): Runs router and low-cost resolver. If a template or retrieval reply is chosen, returns `{ responseMode, text }`. Otherwise builds and returns full context. All paths log to `ai_usage_events`.
- **GET /api/merchant/ai/metrics**: Returns router metrics for the last 24h (total inbound, rule-handled, retrieval-handled, AI-handled, escalated).

## Safety

- Critical business decisions (payment completion, active payment method, order–shipment link, COD status) **never** use cached state; they always use fresh DB reads.
- Cache is best-effort and safe to invalidate; correctness does not depend on cache.
