from datetime import datetime
from decimal import Decimal
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field


class MerchantInfo(BaseModel):
    id: str
    name: str
    phone: str


class OrderItemCreate(BaseModel):
    product_id: Optional[int] = None
    name: str
    quantity: int = Field(default=1, ge=1)
    unit: Optional[str] = "item"
    unit_price: Optional[Decimal] = Decimal("0.00")


class OrderItemResponse(BaseModel):
    product_id: Optional[int] = None
    name: str
    qty: int
    unit: Optional[str] = "item"
    unit_price: float = 0.0
    subtotal: float = 0.0
    confidence: Optional[float] = 1.0
    changed: Optional[bool] = False


class OrderCreate(BaseModel):
    customer_phone: str
    customer_name: Optional[str] = "Customer"
    merchant_id: Optional[str] = "m1"
    merchant_name: Optional[str] = "Sharma Kirana Store"
    merchant_phone: Optional[str] = "9876543210"
    items: list[OrderItemCreate]
    delivery_address: Optional[str] = None
    status: Optional[str] = "pending"
    notes: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    status: str
    price: Optional[Decimal] = None
    eta: Optional[str] = None
    changes: Optional[list[dict[str, Any]]] = None
    rejection_reason: Optional[str] = None


class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    order_id: str
    id: str
    merchant: MerchantInfo
    state: str
    status: str
    items: list[OrderItemResponse]
    price: Optional[float] = None
    total_amount: Optional[float] = None
    eta: Optional[str] = None
    changes: list[dict[str, Any]] = []
    rejection_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    customer_phone: Optional[str] = None
    customer_name: Optional[str] = None
    delivery_address: Optional[str] = None
