import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { merchantApi, type OrderDetailResponse, type ShipmentRow, type CreateShipmentBody } from '../../lib/api';
import { PageShell, PanelCard, StatusBadge, Badge, FulfillmentStatusBadge } from '../../components/ui';
import { theme } from '../../theme';

const paymentMethodLabel: Record<string, string> = {
  prepaid_bank_transfer: 'Bank transfer',
  prepaid_qr: 'QR',
  cod: 'COD',
};

export default function MerchantOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const token = user?.accessToken ?? null;
  const [order, setOrder] = useState<OrderDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showShipmentForm, setShowShipmentForm] = useState(false);
  const [shipmentForm, setShipmentForm] = useState<CreateShipmentBody>({});
  const [creatingShipment, setCreatingShipment] = useState(false);

  const load = () => {
    if (!token || !orderId) return;
    setError(null);
    merchantApi
      .orderDetail(token, orderId)
      .then(setOrder)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token, orderId]);

  const runAction = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action failed');
    }
  };

  const switchPaymentMethod = async (desiredMethod: string) => {
    if (!token || !orderId) return;
    setActionError(null);
    try {
      const res = await merchantApi.orderSwitchPaymentMethod(token, orderId, { desired_method: desiredMethod, requested_by: 'merchant_admin' });
      if (res.order) setOrder(res.order);
      else load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Switch failed');
    }
  };

  if (error) return <p style={{ color: theme.danger }}>{error}</p>;
  if (loading || !order) return <p style={{ color: theme.textSecondary }}>Loading…</p>;

  const isCod = order.payment_method === 'cod';
  const codDetails = order.cod_details as { cod_status?: string; cod_amount?: number; cod_fee?: number } | null;
  const events = order.payment_method_events ?? [];
  const canSwitch = !order.payment_method_locked_at && order.status !== 'paid' && order.payment_status !== 'paid' && order.payment_status !== 'cod_collected';

  return (
    <PageShell
      title={`Order ${orderId?.slice(0, 8)}…`}
      description="Order detail, payment method, and actions"
      breadcrumb={
        <button
          type="button"
          onClick={() => navigate('/merchant/orders')}
          style={{ background: 'none', border: 0, color: theme.primary, cursor: 'pointer', fontSize: 13 }}
        >
          ← Orders
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <PanelCard title="Order" subtitle="Status and payment">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            <div><span style={{ fontSize: 12, color: theme.textMuted, marginRight: 8 }}>Status</span><StatusBadge status={order.status} /></div>
            <div><span style={{ fontSize: 12, color: theme.textMuted, marginRight: 8 }}>Payment method</span><Badge variant={isCod ? 'gold' : 'default'}>{paymentMethodLabel[order.payment_method ?? ''] ?? order.payment_method}</Badge></div>
            <div><span style={{ fontSize: 12, color: theme.textMuted, marginRight: 8 }}>Payment status</span><span style={{ fontSize: 13 }}>{order.payment_status ?? '—'}</span></div>
            <div><span style={{ fontSize: 12, color: theme.textMuted, marginRight: 8 }}>Fulfillment</span><FulfillmentStatusBadge status={order.fulfillment_status} /></div>
            <div><span style={{ fontSize: 12, color: theme.textMuted, marginRight: 8 }}>Switch count</span><span style={{ fontSize: 13 }}>{order.payment_switch_count ?? 0}</span></div>
            <div><span style={{ fontSize: 12, color: theme.textMuted, marginRight: 8 }}>Amount</span><span style={{ fontSize: 13 }}>{order.amount ?? '—'}</span></div>
            <div><span style={{ fontSize: 12, color: theme.textMuted, marginRight: 8 }}>Customer</span><span style={{ fontSize: 13 }}>{order.customer_name ?? '—'}</span></div>
          </div>
          {canSwitch && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${theme.borderMuted}` }}>
              <span style={{ fontSize: 12, color: theme.textMuted, marginRight: 8 }}>Switch payment method</span>
              {!isCod && (
                <button type="button" onClick={() => switchPaymentMethod('cod')} style={{ marginRight: 8, padding: '6px 12px', background: theme.surfaceElevated, border: `1px solid ${theme.borderMuted}`, borderRadius: 6, color: theme.text, fontSize: 12, cursor: 'pointer' }}>
                  Switch to COD
                </button>
              )}
              {isCod && (
                <button type="button" onClick={() => switchPaymentMethod('prepaid_bank_transfer')} style={{ marginRight: 8, padding: '6px 12px', background: theme.surfaceElevated, border: `1px solid ${theme.borderMuted}`, borderRadius: 6, color: theme.text, fontSize: 12, cursor: 'pointer' }}>
                  Switch to bank transfer
                </button>
              )}
            </div>
          )}
          {actionError && <p style={{ color: theme.danger, fontSize: 13, marginTop: 8 }}>{actionError}</p>}
        </PanelCard>

        {events.length > 0 && (
          <PanelCard title="Payment method history" subtitle="Timeline of payment method changes">
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: theme.textSecondary }}>
              {events.map((ev) => (
                <li key={ev.id} style={{ marginBottom: 6 }}>
                  {ev.from_method} → {ev.to_method} ({ev.switch_result}) {ev.reason ? `— ${ev.reason}` : ''} — {new Date(ev.created_at).toLocaleString()}
                </li>
              ))}
            </ul>
          </PanelCard>
        )}

        {isCod && codDetails && (
          <PanelCard title="COD details" subtitle="Cash on Delivery status">
            <div style={{ marginBottom: 12 }}>Status: <StatusBadge status={codDetails.cod_status ?? ''} /> Amount: {codDetails.cod_amount} Fee: {codDetails.cod_fee ?? 0}</div>
            {actionError && <p style={{ color: theme.danger, fontSize: 13 }}>{actionError}</p>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {codDetails.cod_status === 'pending_merchant_confirmation' && (
                <button
                  type="button"
                  onClick={() => token && orderId && runAction(() => merchantApi.orderCodConfirm(token, orderId))}
                  style={{ padding: '8px 16px', background: theme.primary, color: theme.background, border: 0, borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  Confirm COD
                </button>
              )}
              {(codDetails.cod_status === 'ready_to_ship' || codDetails.cod_status === 'pending_merchant_confirmation') && (
                <button
                  type="button"
                  onClick={() => token && orderId && runAction(() => merchantApi.orderCodMarkShipped(token, orderId))}
                  style={{ padding: '8px 16px', background: theme.surfaceElevated, border: `1px solid ${theme.borderMuted}`, color: theme.text, borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
                >
                  Mark shipped
                </button>
              )}
              {codDetails.cod_status === 'shipped' && (
                <button
                  type="button"
                  onClick={() => token && orderId && runAction(() => merchantApi.orderCodMarkCollected(token, orderId))}
                  style={{ padding: '8px 16px', background: theme.success, color: theme.background, border: 0, borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  Mark collected
                </button>
              )}
              {(codDetails.cod_status === 'ready_to_ship' || codDetails.cod_status === 'shipped') && (
                <button
                  type="button"
                  onClick={() => token && orderId && runAction(() => merchantApi.orderCodMarkFailed(token, orderId))}
                  style={{ padding: '8px 16px', background: theme.dangerMuted, color: theme.danger, border: `1px solid ${theme.danger}`, borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
                >
                  Mark failed
                </button>
              )}
            </div>
          </PanelCard>
        )}

        {/* Fulfillment: shipments and create form */}
        {(order.payment_status === 'paid' || order.payment_status === 'cod_collected' || (order.shipments?.length ?? 0) > 0) && (
          <PanelCard title="Fulfillment" subtitle="Shipment and delivery">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: theme.textMuted }}>Payment status</span>
              <span style={{ fontSize: 13 }}>{order.payment_status ?? '—'}</span>
              <span style={{ fontSize: 12, color: theme.textMuted, marginLeft: 12 }}>Fulfillment status</span>
              <FulfillmentStatusBadge status={order.fulfillment_status} />
            </div>
            {(order.shipment_images?.length ?? 0) > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 8 }}>Shipment images</div>
                {(order.shipment_images ?? []).map((img: { id: string; image_url: string | null; source: string; processing_status: string; created_at: string }) => (
                  <div key={img.id} style={{ display: 'inline-block', marginRight: 12, marginBottom: 8 }}>
                    {img.image_url ? (
                      <a href={img.image_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', border: `1px solid ${theme.borderMuted}`, borderRadius: 8, overflow: 'hidden', maxWidth: 160 }}>
                        <img src={img.image_url} alt="Shipment" style={{ width: 160, height: 120, objectFit: 'cover' }} />
                      </a>
                    ) : (
                      <div style={{ width: 160, height: 120, background: theme.surfaceElevated, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: theme.textMuted }}>No preview</div>
                    )}
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>Source: {img.source} · {img.processing_status}</div>
                  </div>
                ))}
              </div>
            )}
            {(order.shipments?.length ?? 0) > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 8 }}>Shipments</div>
                {(order.shipments ?? []).map((s: ShipmentRow & { shipment_proof_mode?: string; customer_notified_at?: string | null }) => (
                  <div
                    key={s.id}
                    style={{
                      padding: 12,
                      background: theme.surfaceElevated,
                      border: `1px solid ${theme.borderMuted}`,
                      borderRadius: 8,
                      marginBottom: 8,
                      fontSize: 13,
                    }}
                  >
                    {(s as { shipment_proof_mode?: string }).shipment_proof_mode === 'image' && (
                      <div style={{ fontSize: 11, color: theme.primary, marginBottom: 6 }}>Proof: image (from Telegram or dashboard)</div>
                    )}
                    {(s as { customer_notified_at?: string | null }).customer_notified_at && (
                      <div style={{ fontSize: 11, color: theme.success, marginBottom: 6 }}>Customer notified</div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
                      <span><strong style={{ color: theme.textMuted }}>Courier</strong> {s.courier_name ?? '—'}</span>
                      <span><strong style={{ color: theme.textMuted }}>Tracking</strong> {s.tracking_number ?? '—'}</span>
                      {s.tracking_url && <a href={s.tracking_url} target="_blank" rel="noopener noreferrer" style={{ color: theme.primary }}>Track</a>}
                      <span><strong style={{ color: theme.textMuted }}>Shipped</strong> {s.shipped_at ? new Date(s.shipped_at).toLocaleString() : '—'}</span>
                      <span><strong style={{ color: theme.textMuted }}>Status</strong> {s.shipment_status}</span>
                    </div>
                    {s.shipping_note && <div style={{ color: theme.textSecondary, marginBottom: 8 }}>{s.shipping_note}</div>}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {s.shipment_status !== 'shipped' && s.shipment_status !== 'in_transit' && (
                        <button
                          type="button"
                          onClick={() => token && runAction(() => merchantApi.updateShipment(token, s.id, { shipment_status: 'shipped', shipped_at: new Date().toISOString() }))}
                          style={{ padding: '6px 12px', background: theme.surfaceElevated, border: `1px solid ${theme.borderMuted}`, borderRadius: 6, color: theme.text, fontSize: 12, cursor: 'pointer' }}
                        >
                          Mark shipped
                        </button>
                      )}
                      {s.shipment_status !== 'delivered' && (
                        <button
                          type="button"
                          onClick={() => token && runAction(() => merchantApi.updateShipment(token, s.id, { shipment_status: 'delivered', delivered_at: new Date().toISOString() }))}
                          style={{ padding: '6px 12px', background: theme.success, color: theme.background, border: 0, borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                        >
                          Mark delivered
                        </button>
                      )}
                      {s.shipment_status !== 'failed' && (
                        <button
                          type="button"
                          onClick={() => token && runAction(() => merchantApi.updateShipment(token, s.id, { shipment_status: 'failed' }))}
                          style={{ padding: '6px 12px', background: theme.dangerMuted, color: theme.danger, border: `1px solid ${theme.danger}`, borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                        >
                          Mark failed
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => token && runAction(() => merchantApi.sendShipmentConfirmation(token, s.id))}
                        style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${theme.primary}`, borderRadius: 6, color: theme.primary, fontSize: 12, cursor: 'pointer' }}
                      >
                        Send confirmation to customer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!showShipmentForm && (
              <button
                type="button"
                onClick={() => setShowShipmentForm(true)}
                style={{ padding: '8px 16px', background: theme.primary, color: theme.background, border: 0, borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                {(order.shipments?.length ?? 0) === 0 ? 'Create shipment' : 'Add another shipment'}
              </button>
            )}
            {showShipmentForm && (
              <div style={{ padding: 12, background: theme.surfaceElevated, borderRadius: 8, border: `1px solid ${theme.borderMuted}` }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 12 }}>New shipment</div>
                <div style={{ display: 'grid', gap: 10, maxWidth: 400 }}>
                  <input placeholder="Courier name" value={shipmentForm.courier_name ?? ''} onChange={(e) => setShipmentForm((f) => ({ ...f, courier_name: e.target.value || undefined }))} style={{ padding: 8, background: theme.surface, border: `1px solid ${theme.borderMuted}`, borderRadius: 6, color: theme.text }} />
                  <input placeholder="Tracking number" value={shipmentForm.tracking_number ?? ''} onChange={(e) => setShipmentForm((f) => ({ ...f, tracking_number: e.target.value || undefined }))} style={{ padding: 8, background: theme.surface, border: `1px solid ${theme.borderMuted}`, borderRadius: 6, color: theme.text }} />
                  <input placeholder="Tracking URL" value={shipmentForm.tracking_url ?? ''} onChange={(e) => setShipmentForm((f) => ({ ...f, tracking_url: e.target.value || undefined }))} style={{ padding: 8, background: theme.surface, border: `1px solid ${theme.borderMuted}`, borderRadius: 6, color: theme.text }} />
                  <input placeholder="Shipping note" value={shipmentForm.shipping_note ?? ''} onChange={(e) => setShipmentForm((f) => ({ ...f, shipping_note: e.target.value || undefined }))} style={{ padding: 8, background: theme.surface, border: `1px solid ${theme.borderMuted}`, borderRadius: 6, color: theme.text }} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    type="button"
                    disabled={creatingShipment}
                    onClick={async () => {
                      if (!token || !orderId) return;
                      setCreatingShipment(true);
                      setActionError(null);
                      try {
                        const res = await merchantApi.createShipment(token, orderId, shipmentForm);
                        if (res.order) setOrder(res.order);
                        else load();
                        setShowShipmentForm(false);
                        setShipmentForm({});
                      } catch (e) {
                        setActionError(e instanceof Error ? e.message : 'Create failed');
                      } finally {
                        setCreatingShipment(false);
                      }
                    }}
                    style={{ padding: '8px 16px', background: theme.primary, color: theme.background, border: 0, borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: creatingShipment ? 'not-allowed' : 'pointer' }}
                  >
                    {creatingShipment ? 'Saving…' : 'Save shipment'}
                  </button>
                  <button type="button" onClick={() => { setShowShipmentForm(false); setShipmentForm({}); }} style={{ padding: '8px 16px', background: 'transparent', border: `1px solid ${theme.borderMuted}`, borderRadius: 6, color: theme.textSecondary, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
            {(order.fulfillment_events?.length || order.telegram_operation_events?.length) ? (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${theme.borderMuted}` }}>
                <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 6 }}>Event timeline</div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: theme.textSecondary }}>
                  {[
                    ...(order.fulfillment_events ?? []).map((ev) => ({ id: ev.id, type: ev.event_type, at: ev.created_at, source: 'fulfillment' })),
                    ...(order.telegram_operation_events ?? []).map((ev) => ({ id: ev.id, type: ev.event_type, at: ev.created_at, source: 'telegram' })),
                  ]
                    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
                    .slice(0, 15)
                    .map((ev) => (
                      <li key={ev.id}>
                        <span style={{ color: theme.primary }}>{ev.type}</span>
                        {ev.source === 'telegram' && <span style={{ color: theme.textMuted, marginLeft: 6 }}>(Telegram)</span>}
                        {' — '}
                        {new Date(ev.at).toLocaleString()}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </PanelCard>
        )}

        {order.order_items?.length > 0 && (
          <PanelCard title="Items" subtitle="">
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
              {order.order_items.map((item) => (
                <li key={item.id}>{item.product_name_snapshot} x{item.quantity} = {item.total_price}</li>
              ))}
            </ul>
          </PanelCard>
        )}

        {order.shipping_details && (
          <PanelCard title="Shipping details" subtitle="">
            <pre style={{ margin: 0, fontSize: 12, color: theme.textSecondary, whiteSpace: 'pre-wrap' }}>{JSON.stringify(order.shipping_details, null, 2)}</pre>
          </PanelCard>
        )}
      </div>
    </PageShell>
  );
}
