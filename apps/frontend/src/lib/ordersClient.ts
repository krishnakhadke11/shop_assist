import { api } from '@/lib/api';
import { CreateOrderPayload, Order } from '@/types';

export async function fetchOrders(phone?: string, status?: string): Promise<Order[]> {
  const params: Record<string, string> = {};
  if (phone) params.phone = phone;
  if (status) params.status = status;

  const data = await api.get<Order[]>('/api/v1/orders', { params });
  return (data as unknown) as Order[];
}

export async function fetchActiveOrders(phone?: string): Promise<Order[]> {
  const params: Record<string, string> = {};
  if (phone) params.phone = phone;

  const data = await api.get<Order[]>('/api/v1/orders/active', { params });
  return (data as unknown) as Order[];
}

export async function fetchOrderDetail(orderId: string): Promise<Order> {
  const data = await api.get<Order>(`/api/v1/orders/${orderId}`);
  return (data as unknown) as Order;
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const data = await api.post<Order>('/api/v1/orders', payload);
  return (data as unknown) as Order;
}

export async function updateOrderStatus(
  orderId: string,
  payload: {
    status: string;
    price?: number;
    eta?: string;
    changes?: Array<{ field: string; item?: string; from: string; to: string }>;
    rejection_reason?: string;
  }
): Promise<Order> {
  const data = await api.patch<Order>(`/api/v1/orders/${orderId}/status`, payload);
  return (data as unknown) as Order;
}
