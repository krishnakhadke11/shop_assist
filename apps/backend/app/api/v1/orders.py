import uuid
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.customer import Customer
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.schemas.order import (
    MerchantInfo,
    OrderCreate,
    OrderItemResponse,
    OrderResponse,
    OrderStatusUpdate,
)

router = APIRouter()

TERMINAL_STATES = {"confirmed", "modified", "rejected", "unreachable"}
ACTIVE_STATES = {"placing", "captured", "pending"}


def clean_phone(phone: str) -> str:
    cleaned = phone.strip().replace(" ", "").replace("-", "")
    if cleaned.startswith("+91"):
        cleaned = cleaned[3:]
    return cleaned


def format_order_response(order: Order) -> OrderResponse:
    merchant_data = MerchantInfo(
        id=order.merchant_id or "m1",
        name=order.merchant_name or "Sharma Kirana Store",
        phone=order.merchant_phone or "9876543210",
    )

    items_list: list[OrderItemResponse] = []
    for item in order.items:
        item_name = item.item_name
        if not item_name and item.product:
            item_name = item.product.name
        if not item_name:
            item_name = f"Item #{item.id}"

        unit_str = item.unit or (item.product.unit if item.product else "item")
        u_price = float(
            item.unit_price
            if (item.unit_price is not None and item.unit_price > 0)
            else (item.product.price if item.product and item.product.price else 0.0)
        )
        qty = item.quantity or 1
        subtotal = round(qty * u_price, 2)

        items_list.append(
            OrderItemResponse(
                product_id=item.product_id,
                name=str(item_name),
                qty=qty,
                unit=str(unit_str) if unit_str else "item",
                unit_price=u_price,
                subtotal=subtotal,
                confidence=1.0,
                changed=False,
            )
        )

    norm_status = (order.status or "pending").lower()
    total_val = float(order.total_amount) if order.total_amount is not None else None

    # In UI plan B-01: no price shown before confirmed/modified
    price_val = total_val if norm_status in {"confirmed", "modified"} else None

    cust_phone = str(order.customer.phone) if (order.customer and order.customer.phone) else None
    cust_name = str(order.customer.name) if (order.customer and order.customer.name) else None

    return OrderResponse(
        order_id=order.id,
        id=order.id,
        merchant=merchant_data,
        state=norm_status,
        status=norm_status,
        items=items_list,
        price=price_val,
        total_amount=total_val,
        eta=order.eta,
        changes=order.changes or [],
        rejection_reason=order.rejection_reason,
        created_at=order.created_at,
        updated_at=order.updated_at,
        customer_phone=cust_phone,
        customer_name=cust_name,
    )


@router.get("/orders", response_model=list[OrderResponse])
async def list_orders(
    phone: str | None = Query(None, description="Customer phone to filter"),
    status: str | None = Query(None, description="Status filter: active, past, or specific state"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> list[OrderResponse]:
    query = (
        select(Order)
        .options(selectinload(Order.items).selectinload(OrderItem.product), selectinload(Order.customer))
        .order_by(desc(Order.created_at))
        .limit(limit)
    )

    if phone:
        cleaned = clean_phone(phone)
        query = query.join(Order.customer).where(
            or_(
                Customer.phone == cleaned,
                Customer.phone == f"+91{cleaned}",
                Customer.phone.endswith(cleaned),
            )
        )

    if status:
        stat = status.strip().lower()
        if stat == "active":
            query = query.where(func.lower(Order.status).in_(ACTIVE_STATES))
        elif stat == "past":
            query = query.where(func.lower(Order.status).in_(TERMINAL_STATES))
        else:
            query = query.where(Order.status.ilike(stat))

    result = await db.execute(query)
    orders = result.scalars().all()
    return [format_order_response(o) for o in orders]


@router.get("/orders/active", response_model=list[OrderResponse])
async def list_active_orders(
    phone: str | None = Query(None, description="Customer phone to filter"),
    db: AsyncSession = Depends(get_db),
) -> list[OrderResponse]:
    query = (
        select(Order)
        .options(selectinload(Order.items).selectinload(OrderItem.product), selectinload(Order.customer))
        .order_by(desc(Order.created_at))
    )

    if phone:
        cleaned = clean_phone(phone)
        query = query.join(Order.customer).where(
            or_(
                Customer.phone == cleaned,
                Customer.phone == f"+91{cleaned}",
                Customer.phone.endswith(cleaned),
            )
        )

    result = await db.execute(query)
    orders = result.scalars().all()
    # Filter active in Python to ensure case-insensitivity regardless of DB dialect
    active_orders = [o for o in orders if (o.status or "").lower() not in TERMINAL_STATES]
    return [format_order_response(o) for o in active_orders]


@router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:

    query = (
        select(Order)
        .options(selectinload(Order.items).selectinload(OrderItem.product), selectinload(Order.customer))
        .where(Order.id == order_id)
    )
    result = await db.execute(query)
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return format_order_response(order)


@router.post("/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    order_in: OrderCreate,
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:
    cleaned_phone = clean_phone(order_in.customer_phone)
    if not cleaned_phone:
        raise HTTPException(status_code=400, detail="Invalid customer phone number")

    # 1. Find or create customer
    cust_res = await db.execute(
        select(Customer).where(
            or_(
                Customer.phone == cleaned_phone,
                Customer.phone == f"+91{cleaned_phone}",
                Customer.phone.endswith(cleaned_phone),
            )
        )
    )
    customer = cust_res.scalars().first()
    if not customer:
        customer = Customer(
            name=order_in.customer_name or "Customer",
            phone=cleaned_phone,
        )
        db.add(customer)
        await db.flush()

    # 2. Generate unique order ID
    date_str = datetime.now().strftime("%Y%m%d")
    short_suffix = uuid.uuid4().hex[:6].upper()
    order_id = f"ORD-{date_str}-{short_suffix}"

    total_amount = Decimal("0.00")
    order_items_to_add: list[OrderItem] = []

    for item_data in order_in.items:
        u_price = item_data.unit_price
        item_name = item_data.name
        unit_str = item_data.unit

        if item_data.product_id and (u_price is None or u_price <= Decimal("0.00") or not item_name or not unit_str):
            prod_res = await db.execute(select(Product).where(Product.id == item_data.product_id))
            prod = prod_res.scalar_one_or_none()
            if prod:
                if u_price is None or u_price <= Decimal("0.00"):
                    u_price = prod.price
                if not item_name:
                    item_name = prod.name
                if not unit_str:
                    unit_str = prod.unit

        u_price = u_price or Decimal("0.00")
        unit_str = unit_str or "item"
        subtotal = item_data.quantity * u_price
        total_amount += subtotal

        order_items_to_add.append(
            OrderItem(
                order_id=order_id,
                product_id=item_data.product_id,
                item_name=item_name,
                unit=unit_str,
                quantity=item_data.quantity,
                unit_price=u_price,
            )
        )

    init_status = (order_in.status or "pending").upper()

    order = Order(
        id=order_id,
        customer_id=customer.id,
        status=init_status,
        total_amount=total_amount,
        merchant_id=order_in.merchant_id or "m1",
        merchant_name=order_in.merchant_name or "Sharma Kirana Store",
        merchant_phone=order_in.merchant_phone or "9876543210",
        notes=order_in.notes,
        changes=[],
    )

    db.add(order)
    await db.flush()

    for oi in order_items_to_add:
        db.add(oi)

    await db.commit()

    # Refetch with relations
    return await get_order(order_id, db)


@router.patch("/orders/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: str,
    update_in: OrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
) -> OrderResponse:
    query = (
        select(Order)
        .options(selectinload(Order.items).selectinload(OrderItem.product), selectinload(Order.customer))
        .where(Order.id == order_id)
    )
    result = await db.execute(query)
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = update_in.status.upper()
    if update_in.price is not None:
        order.total_amount = update_in.price
    if update_in.eta is not None:
        order.eta = update_in.eta
    if update_in.changes is not None:
        order.changes = update_in.changes
    if update_in.rejection_reason is not None:
        order.rejection_reason = update_in.rejection_reason

    await db.commit()
    await db.refresh(order)

    return format_order_response(order)
