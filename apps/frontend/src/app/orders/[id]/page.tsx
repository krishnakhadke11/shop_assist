'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchOrderDetail, updateOrderStatus } from '@/lib/ordersClient';
import { Order } from '@/types';
import { DiffBlock, ElapsedTimer, OrderStateChip } from '@/components/OrderComponents';
import { MERCHANTS } from '@/lib/dummyData';
import { CallButton } from '@/components/CallButton';

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingState, setUpdatingState] = useState(false);

  const loadOrder = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setError(null);
    try {
      const data = await fetchOrderDetail(params.id);
      setOrder(data);
    } catch (err) {
      console.error('Failed to load order detail:', err);
      setError('Could not load order details from backend.');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const normState = (order?.state || order?.status || 'pending').toLowerCase();
  const isTerminal = ['confirmed', 'modified', 'rejected', 'unreachable'].includes(normState);
  const merchantObj = MERCHANTS.find((m) => m.id === order?.merchant?.id) || MERCHANTS[0];

  // Helper to test state transitions directly in UI
  const handleSimulateStatus = async (
    targetState: 'confirmed' | 'modified' | 'rejected' | 'pending'
  ) => {
    if (!order) return;
    setUpdatingState(true);
    try {
      if (targetState === 'confirmed') {
        await updateOrderStatus(order.order_id || order.id, {
          status: 'confirmed',
          price: order.total_amount && order.total_amount > 0 ? order.total_amount : 144.0,
          eta: '25-35 mins',
        });
      } else if (targetState === 'modified') {
        await updateOrderStatus(order.order_id || order.id, {
          status: 'modified',
          price: 116.0,
          eta: '20 mins',
          changes: [
            { field: 'quantity', item: 'Aashirwaad Atta', from: '5 kg', to: '1 kg' },
            { field: 'price', item: 'Order Total', from: '₹348.00', to: '₹116.00' },
          ],
        });
      } else if (targetState === 'rejected') {
        await updateOrderStatus(order.order_id || order.id, {
          status: 'rejected',
          rejection_reason: 'Shopkeeper is currently out of stock for requested items.',
        });
      } else if (targetState === 'pending') {
        await updateOrderStatus(order.order_id || order.id, {
          status: 'pending',
          changes: [],
        });
      }
      await loadOrder();
    } catch (err) {
      console.error('Failed to simulate state:', err);
      alert('Failed to update state on backend.');
    } finally {
      setUpdatingState(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-sm flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => router.push('/orders')}
              aria-label="Back to orders list"
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 text-ink"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-base font-bold text-ink">Order Details</h1>
              <p className="text-[11px] text-ink/60 font-mono">#{params.id}</p>
            </div>
          </div>

          {/* Manual Refresh Button */}
          <button
            type="button"
            onClick={() => loadOrder(true)}
            disabled={refreshing || loading}
            aria-label="Refresh order"
            className="flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100 text-ink active:scale-95 transition-transform disabled:opacity-50"
            title="Refresh order status"
          >
            <svg
              className={`w-4 h-4 ${refreshing ? 'animate-spin text-brand' : 'text-ink'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </header>

        {/* Body */}
        {loading ? (
          <div className="p-6 space-y-4 flex-1">
            <div className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
            <div className="h-48 rounded-2xl bg-gray-100 animate-pulse" />
          </div>
        ) : error || !order ? (
          <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
            <p className="text-sm font-semibold text-error mb-4">{error || 'Order not found'}</p>
            <button
              type="button"
              onClick={() => router.push('/orders')}
              className="px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold"
            >
              Back to Orders
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-5 flex-1">
            {/* Merchant Card with Call Button */}
            <div className="rounded-2xl border border-gray-200 p-4 bg-white flex items-center justify-between shadow-sm">
              <div>
                <h2 className="text-base font-extrabold text-ink">{order.merchant?.name}</h2>
                <p className="text-xs text-ink/60 mt-0.5">Shop phone: +91 {order.merchant?.phone}</p>
              </div>
              <CallButton
                onClick={() => router.push(`/call/${merchantObj.id}`)}
                ariaLabel={`Call ${order.merchant?.name}`}
                title={`Call ${order.merchant?.name}`}
                size={42}
              />
            </div>

            {/* State Machine Surface */}

            {/* 1. Diff block first for 'modified' state (UI Plan §4 & §5.8) */}
            {normState === 'modified' && order.changes && order.changes.length > 0 && (
              <DiffBlock changes={order.changes} />
            )}

            {/* 2. State-specific Banner */}
            {normState === 'pending' || normState === 'captured' || normState === 'placing' ? (
              <div className="rounded-2xl border-2 border-amber/40 bg-amber-50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber">
                    Shop is reviewing your order
                  </span>
                  <ElapsedTimer createdAt={order.created_at} />
                </div>
                <p className="text-xs text-ink/80 leading-relaxed">
                  The merchant AI is checking inventory and pricing. Total amount and delivery ETA will
                  appear once confirmed by the shop.
                </p>
                {/* Rule B-01: Skeleton for price */}
                <div className="mt-3 pt-3 border-t border-amber/20 flex items-center justify-between text-xs">
                  <span className="text-ink/60">Estimated Total:</span>
                  <span className="inline-block w-20 h-5 bg-amber-200/50 rounded animate-pulse" />
                </div>
              </div>
            ) : normState === 'confirmed' ? (
              <div className="rounded-2xl border-2 border-brand/40 bg-brand/10 p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-strong flex items-center gap-1">
                    ✓ Order Confirmed
                  </span>
                  <OrderStateChip state="confirmed" />
                </div>
                <p className="text-xs text-ink/80">
                  Shop has confirmed your order. Expected delivery:{' '}
                  <strong className="text-brand-strong">{order.eta || '30 mins'}</strong>.
                </p>
              </div>
            ) : normState === 'modified' ? (
              <div className="rounded-2xl border-2 border-amber/40 bg-amber/10 p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber flex items-center gap-1">
                    Order Adjusted by Shop
                  </span>
                  <OrderStateChip state="modified" />
                </div>
                <p className="text-xs text-ink/80">
                  The shop made adjustments to quantities or items based on availability.
                </p>
              </div>
            ) : normState === 'rejected' ? (
              <div className="rounded-2xl border-2 border-error/40 bg-error-bg p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-error">
                    Order Rejected
                  </span>
                  <OrderStateChip state="rejected" />
                </div>
                <p className="text-xs text-error font-medium">
                  {order.rejection_reason || 'Shop was unable to accept this order at this time.'}
                </p>
                <div className="mt-3 pt-2.5 border-t border-error/20">
                  <p className="text-[11px] font-bold text-ink/70 mb-2">Nearby alternative shops:</p>
                  <button
                    type="button"
                    onClick={() => router.push('/')}
                    className="text-xs font-bold text-brand hover:underline"
                  >
                    View other nearby stores →
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">Shop Unreachable</span>
                  <OrderStateChip state="unreachable" />
                </div>
                <p className="text-xs text-ink/70 mt-1">
                  Could not connect to merchant AI. You can call the shopkeeper directly below.
                </p>
              </div>
            )}

            {/* Line Items Table */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60 mb-3">
                Items ({order.items.reduce((s, it) => s + it.qty, 0)})
              </h3>

              <div className="divide-y divide-gray-100">
                {order.items.map((it, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-ink text-sm">{it.name}</p>
                      <p className="text-ink/60 text-[11px]">
                        Qty: {it.qty} {it.unit || 'unit'}
                      </p>
                    </div>
                    <div className="text-right">
                      {it.subtotal > 0 ? (
                        <p className="font-bold text-ink">₹{it.subtotal.toFixed(2)}</p>
                      ) : (
                        <p className="text-ink/40">—</p>
                      )}
                      {it.unit_price > 0 && (
                        <p className="text-[10px] text-ink/50">₹{it.unit_price.toFixed(2)} / {it.unit}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-1.5 text-xs">
                <div className="flex justify-between text-ink/70">
                  <span>Delivery</span>
                  <span className="text-brand-strong font-bold">FREE</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-ink pt-1 border-t border-gray-100">
                  <span>Total Amount</span>
                  {normState === 'confirmed' || normState === 'modified' ? (
                    <span>₹{(order.price ?? order.total_amount ?? 0).toFixed(2)}</span>
                  ) : (
                    <span className="text-ink/40 font-normal">To be confirmed</span>
                  )}
                </div>
              </div>
            </div>

            {/* Terminal State Action: Re-order button pre-filling same shop */}
            {isTerminal && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => router.push(`/call/${merchantObj.id}`)}
                  className="w-full py-3.5 rounded-xl bg-brand text-white font-bold text-sm hover:bg-brand-strong transition-all shadow-sm active:scale-95"
                >
                  Call {order.merchant?.name} again
                </button>
              </div>
            )}

            {/* Dev Simulator Bar for Quick Testing */}
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-3.5 text-xs mt-6">
              <p className="font-bold text-ink/70 mb-2 flex items-center justify-between">
                <span>🛠️ Dev State Simulator (Test State Transitions)</span>
                {updatingState && <span className="text-brand animate-pulse">Updating…</span>}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleSimulateStatus('confirmed')}
                  disabled={updatingState}
                  className="py-1.5 rounded-lg bg-white border border-brand text-brand-strong font-bold hover:bg-brand/10 disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulateStatus('modified')}
                  disabled={updatingState}
                  className="py-1.5 rounded-lg bg-white border border-amber text-amber font-bold hover:bg-amber-bg disabled:opacity-50"
                >
                  Modify (Diff)
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulateStatus('rejected')}
                  disabled={updatingState}
                  className="py-1.5 rounded-lg bg-white border border-error text-error font-bold hover:bg-error-bg disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
