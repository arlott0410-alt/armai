# Telegram Operations Bot

ArmAI can use a Telegram group as an **operations control center** for merchants: order-paid notifications, shipment slip intake, and AI escalations.

## Architecture

- **Customer channel**: Facebook Messenger (unchanged).
- **Merchant dashboard**: Web UI (unchanged).
- **Telegram**: Additional merchant operations layer. One Telegram group per merchant; bot token and group ID are configured per merchant in the dashboard.

## Setup

1. **Create a bot** with [@BotFather](https://t.me/BotFather). Copy the bot token.
2. **Create or use a Telegram group** and add the bot. Obtain the group ID (e.g. via @userinfobot or invite link).
3. **Dashboard → Telegram**: Enter group ID and bot token; save. Use "Send test message" to verify.
4. **Set webhook**: Use the shown webhook URL with Telegram’s `setWebhook` so updates are sent to `POST /api/webhooks/telegram/:merchantId`.
5. **Authorized admins**: Add Telegram user IDs (from @userinfobot) so only those users can trigger actions (e.g. linking shipment images).
6. **Settings → Telegram operations**: Enable "Notify when order is paid", "Allow shipment confirmation from Telegram", "Send AI escalations", etc.

## Flows

### Order paid notification

When an order becomes **paid** (prepaid confirm-match or COD mark-collected), the system can send a short message to the merchant’s Telegram group (if enabled). The message includes order reference, customer, amount, payment method, and items summary. Duplicate notifications for the same order are avoided.

### Shipment image from Telegram

1. An authorized admin sends a **photo** (shipment slip / waybill) in the linked group.
2. The bot stores the image and attempts to link it to an order (caption, or most recent paid order awaiting fulfillment).
3. If the order is unclear, the bot asks in the group: *"Reply with order number."*
4. An admin replies with the order number (or reference code); the system links the image to that order.
5. A shipment record is created (image-first); fulfillment status is set to shipped. If "Auto-send shipment confirmation" is on, the customer receives the shipment image (or a text confirmation) on the customer channel (e.g. Facebook).

### AI escalation

When the AI cannot safely decide (e.g. ambiguous intent, COD approval, refund), the system can send an **escalation message** to the Telegram group (if enabled). The message includes issue type, related order, context, and requested action. Responses are not auto-parsed; the merchant acts in the dashboard or in chat as needed.

## Security

- Only the **linked Telegram group** for that merchant is accepted; other chats are ignored.
- **Authorized admins** (by Telegram user ID) are required for operational actions if "Require authorized admins" is on.
- Bot token is stored per merchant; it is not exposed in the UI after save.
- All actions are logged in `telegram_operation_events` and `order_fulfillment_events` for audit.

## Database

- **telegram_connections**: Per-merchant bot/group (token reference, group ID, active).
- **telegram_admins**: Allowed Telegram user IDs and roles (owner / admin / operator).
- **telegram_messages**: Raw incoming updates for audit.
- **shipment_images**: Images from dashboard or Telegram; link to order when confident.
- **telegram_operation_events**: Event log (order_paid_notified, shipment_image_received, shipment_image_linked, shipment_confirmation_sent, ai_escalation_sent, etc.).

## API

- **Merchant**: `GET/PATCH /api/merchant/telegram`, `GET/POST/PATCH /api/merchant/telegram/admins`, `POST /api/merchant/telegram/test`, `GET /api/merchant/operations/feed`.
- **Webhook**: `POST /api/webhooks/telegram/:merchantId` — receives Telegram update JSON; no auth; merchant resolved by path.

## UI

- **Settings**: Telegram toggles (notify order paid, allow shipment from Telegram, AI escalation, require admins, auto-send confirmation).
- **Telegram** (Operations): Connection (group ID, token), webhook URL, test, admins list.
- **Operations**: Feed of recent events and shipment images awaiting/ambiguous.
- **Order detail**: Shipment images (with source), proof mode, customer notified; combined fulfillment + Telegram event timeline.
