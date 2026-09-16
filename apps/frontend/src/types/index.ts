export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface ProductCreate {
  name: string;
  price: number;
  description: string;
}

export interface ProductUpdate {
  name?: string;
  price?: number;
  description?: string;
}