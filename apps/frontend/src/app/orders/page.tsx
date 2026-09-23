'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/authClient';
import { createOrder, fetchOrders } from '@/lib/ordersClient';
import { Order } from '@/types';
import { BottomNav } from '@/components/BottomNav';
import { ElapsedTimer, OrderStateChip } from '@/components/OrderComponents';
import { CATEGORIES, MERCHANTS } from '@/lib/dummyData';

const TERMINAL_STATES = new Set(['confirmed', 'modified', 'rejected', 'unreachable']);

function formatDateGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return 'Yesterday';

  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function OrdersPage() {
  const router = useRouter();
  const [sessionPhone, setSessionPhone] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = getSession();
    if (s?.phone) {
      setSessionPhone(s.phone);
    }
  }, []);

  const loadOrders = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    setError(null);
    try {
      const s = getSession();
      const data = await fetchOrders(s?.phone);
      setOrders(data);
    } catch (err) {
      console.error('Failed to load orders:', err);
      setError('Could not fetch orders from backend. Make sure the backend server is running.');
    } finally {
      setLoading(false);
      if (isManualRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionPhone]);

  const activeOrders = useMemo(() => {
    return orders.filter((o) => !TERMINAL_STATES.has((o.state || o.status || '').toLowerCase()));
  }, [orders]);

  const pastOrders = useMemo(() => {
    return orders.filter((o) => TERMINAL_STATES.has((o.state || o.status || '').toLowerCase()));
  }, [orders]);

  const pastOrdersGrouped = useMemo(() => {
    const groups: Record<string, Order[]> = {};
    for (const order of pastOrders) {
      const groupKey = formatDateGroup(order.created_at);
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(order);
    }
    return groups;
  }, [pastOrders]);

  const handlePlaceSampleOrder = async () => {
    const phone = sessionPhone || '98701111';
    setCreatingOrder(true);
    try {
      // Pick merchant 1 or random merchant
      const merchant = MERCHANTS[0];
      await createOrder({
        customer_phone: phone,
        customer_name: 'Customer',
        merchant_id: merchant.id,
        merchant_name: merchant.name,
        merchant_phone: merchant.phone,
        items: [
          { name: 'Tata Salt', quantity: 1, unit: 'packet', unit_price: 28.0 },
          { name: 'Aashirwaad Atta 5kg', quantity: 1, unit: 'bag', unit_price: 320.0 },
          { name: 'Amul Taaza Milk', quantity: 2, unit: 'litre', unit_price: 58.0 },
        ],
        status: 'pending',
      });
      await loadOrders();
    } catch (err) {
      console.error('Failed to create sample order:', err);
      alert('Failed to place sample order. Please verify backend is running.');
    } finally {
      setCreatingOrder(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 pb-28">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-sm">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-5 py-3.5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-ink tracking-tight">Your Orders</h1>
            <p className="text-xs text-ink/60 mt-0.5">
              {sessionPhone ? `Account: +91 ${sessionPhone}` : 'Viewing all active orders'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Manual Refresh Button */}
            <button
              type="button"
              onClick={() => loadOrders(true)}
              disabled={refreshing || loading}
              aria-label="Refresh orders"
              className="flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100 text-ink active:scale-95 transition-transform disabled:opacity-60"
              title="Refresh orders"
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

            {/* Quick Test Order Button */}
            <button
              type="button"
              onClick={handlePlaceSampleOrder}
              disabled={creatingOrder}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand text-white text-xs font-bold hover:bg-brand-strong active:scale-95 transition-all shadow-sm disabled:opacity-60"
              title="Place a sample order to test the pipeline"
            >
              <span>+</span>
              <span>{creatingOrder ? 'Placing…' : 'Sample Order'}</span>
            </button>
          </div>
        </header>

        {/* Error Banner */}
        {error && (
          <div className="m-4 p-3 rounded-xl bg-error-bg border border-error/20 text-xs text-error flex items-start gap-2">
            <span className="font-bold">⚠️</span>
            <div className="flex-1">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => loadOrders(true)}
                className="mt-1 font-bold underline"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Content Area */}
        {loading ? (
          <div className="p-6 space-y-4">
            <div className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
            <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
            <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
          </div>
        ) : orders.length === 0 ? (
          <div className="px-6 py-20 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center text-3xl mb-4">
              🛍️
            </div>
            <h2 className="text-lg font-bold text-ink mb-1">No orders yet</h2>
            <p className="text-sm text-ink/60 max-w-xs mb-6">
              When you call a shop or place an order, it will appear here with live updates from the shop.
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="w-full py-3 rounded-xl bg-brand text-white font-bold text-sm hover:bg-brand-strong transition-colors shadow-sm"
              >
                Browse nearby shops
              </button>
              <button
                type="button"
                onClick={handlePlaceSampleOrder}
                disabled={creatingOrder}
                className="w-full py-2.5 rounded-xl border border-gray-200 bg-white text-ink font-semibold text-xs hover:bg-gray-50 transition-colors"
              >
                {creatingOrder ? 'Placing demo order…' : 'Place a demo order to test'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-6">
            {/* Active Orders Section */}
            {activeOrders.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-amber flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber animate-ping" />
                    Active Orders ({activeOrders.length})
                  </h2>
                  <span className="text-[11px] text-ink/50">Tap card for details</span>
                </div>

                <div className="space-y-3">
                  {activeOrders.map((order) => {
                    const totalItems = order.items.reduce((sum, it) => sum + it.qty, 0);
                    const itemNames = order.items.map((it) => it.name).slice(0, 2).join(', ');

                    return (
                      <div
                        key={order.order_id || order.id}
                        onClick={() => router.push(`/orders/${order.order_id || order.id}`)}
                        className="rounded-2xl border-2 border-amber/30 bg-amber-50/20 p-4 shadow-sm hover:border-amber cursor-pointer transition-all active:scale-[0.99]"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2.5">
                          <div>
                            <h3 className="font-bold text-ink text-base">
                              {order.merchant?.name || 'Local Store'}
                            </h3>
                            <p className="text-xs text-ink/60 mt-0.5">Order #{order.order_id || order.id}</p>
                          </div>
                          <OrderStateChip state={order.state || order.status} />
                        </div>

                        {/* Items preview */}
                        <div className="bg-white rounded-xl p-2.5 border border-gray-100 mb-3 text-xs">
                          <p className="font-medium text-ink/80 truncate">
                            <span className="font-bold text-ink">{totalItems} {totalItems === 1 ? 'item' : 'items'}:</span>{' '}
                            {itemNames}
                            {order.items.length > 2 ? ` +${order.items.length - 2} more` : ''}
                          </p>
                        </div>

                        {/* Footer with elapsed timer and price skeleton */}
                        <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-ink/60">Waiting:</span>
                            <ElapsedTimer createdAt={order.created_at} />
                          </div>

                          {/* Rule B-01: No price before confirmed - show price skeleton */}
                          <div className="flex items-center gap-1.5 text-xs text-ink/60">
                            <span>Price:</span>
                            <span className="inline-block w-14 h-4 bg-gray-200 rounded animate-pulse" title="Price confirmed by merchant" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Past Orders Section */}
            {pastOrders.length > 0 && (
              <section>
                <h2 className="text-xs font-bold uppercase tracking-wider text-ink/60 mb-3">
                  Past Orders
                </h2>

                <div className="space-y-5">
                  {Object.entries(pastOrdersGrouped).map(([dateGroup, groupOrders]) => (
                    <div key={dateGroup} className="space-y-3">
                      <p className="text-xs font-bold text-ink/50 px-1">{dateGroup}</p>
                      <div className="space-y-2.5">
                        {groupOrders.map((order) => {
                          const totalItems = order.items.reduce((sum, it) => sum + it.qty, 0);
                          const isConfirmedOrMod =
                            (order.state || order.status).toLowerCase() === 'confirmed' ||
                            (order.state || order.status).toLowerCase() === 'modified';

                          return (
                            <div
                              key={order.order_id || order.id}
                              onClick={() => router.push(`/orders/${order.order_id || order.id}`)}
                              className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm hover:border-gray-300 cursor-pointer transition-all active:scale-[0.99]"
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                  <h3 className="font-bold text-ink text-sm">
                                    {order.merchant?.name || 'Local Store'}
                                  </h3>
                                  <p className="text-[11px] text-ink/50">
                                    {new Date(order.created_at).toLocaleTimeString('en-IN', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}{' '}
                                    · {totalItems} {totalItems === 1 ? 'item' : 'items'}
                                  </p>
                                </div>
                                <OrderStateChip state={order.state || order.status} />
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                                <span className="text-ink/60 truncate max-w-[200px]">
                                  {order.items.map((i) => i.name).slice(0, 2).join(', ')}
                                  {order.items.length > 2 ? '…' : ''}
                                </span>

                                {isConfirmedOrMod && (order.price !== null || order.total_amount !== null) ? (
                                  <span className="font-extrabold text-ink">
                                    ₹{(order.price ?? order.total_amount ?? 0).toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-ink/40">—</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Persistent Bottom Nav */}
        <BottomNav activeTab="orders" activeOrdersCount={activeOrders.length} />
      </div>
    </main>
  );
}
