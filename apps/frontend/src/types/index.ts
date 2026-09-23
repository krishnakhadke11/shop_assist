export interface Product {
  id: string | number;
  name: string;
  price: number;
  description?: string;
  category?: string;
  brand?: string;
  unit?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductCreate {
  name: string;
  price: number;
  description?: string;
}

export interface ProductUpdate {
  name?: string;
  price?: number;
  description?: string;
}

export type OrderState =
  | 'placing'
  | 'captured'
  | 'pending'
  | 'confirmed'
  | 'modified'
  | 'rejected'
  | 'unreachable';

export interface OrderItem {
  product_id?: number;
  name: string;
  qty: number;
  unit?: string;
  unit_price: number;
  subtotal: number;
  confidence?: number;
  changed?: boolean;
}

export interface OrderMerchant {
  id: string;
  name: string;
  phone: string;
}

export interface OrderDiffChange {
  field: string;
  item?: string;
  from: string;
  to: string;
}

export interface Order {
  order_id: string;
  id: string;
  merchant: OrderMerchant;
  state: OrderState;
  status: string;
  items: OrderItem[];
  price?: number | null;
  total_amount?: number | null;
  eta?: string | null;
  changes?: OrderDiffChange[];
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  customer_phone?: string | null;
  customer_name?: string | null;
  delivery_address?: string | null;
}

export interface CreateOrderItemInput {
  product_id?: number;
  name: string;
  quantity: number;
  unit?: string;
  unit_price?: number;
}

export interface CreateOrderPayload {
  customer_phone: string;
  customer_name?: string;
  merchant_id?: string;
  merchant_name?: string;
  merchant_phone?: string;
  items: CreateOrderItemInput[];
  delivery_address?: string;
  status?: string;
  notes?: string;
}