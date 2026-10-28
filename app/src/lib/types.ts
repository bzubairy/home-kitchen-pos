export type Unit = 'g' | 'ml' | 'pcs'

export type Ingredient = {
  id: string
  name: string
  unit: Unit
  current_stock: number
  low_stock_threshold: number
  cost_per_unit: number
  is_packaging: boolean
  round_up_per_order: boolean
  is_active: boolean
}

export type MenuItem = {
  id: string
  name: string
  category: string
  price: number
  foodpanda_price: number | null
  is_active: boolean
  sort_order: number
}

export type RecipeLine = {
  menu_item_id: string
  ingredient_id: string
  quantity: number
}

export type MenuItemCost = {
  menu_item_id: string
  recipe_cost: number
  margin: number
}

export type Channel = 'whatsapp' | 'phone' | 'instagram' | 'foodpanda' | 'website'
export type OrderStatus = 'new' | 'pending' | 'preparing' | 'delivered' | 'cancelled'
export type RequestedPayment = 'cash' | 'wallet'
export type PaymentMethod = 'cash' | 'bank_transfer' | 'foodpanda'

export type Customer = {
  id: string
  name: string
  phone: string | null
  address: string | null
  notes: string | null
}

export type OrderItem = {
  menu_item_id: string
  quantity: number
  unit_price: number
  menu_items?: { name: string }
}

export type Order = {
  id: string
  number: number
  /** Customer-facing code, e.g. BURGER-7KQ. */
  code: string | null
  customer_id: string | null
  channel: Channel
  status: OrderStatus
  delivery_at: string
  discount: number
  commission_rate: number
  payment_method: PaymentMethod | null
  delivered_at: string | null
  notes: string | null
  delivery_address: string | null
  requested_payment: RequestedPayment | null
  cancel_reason: string | null
  public_token: string
  created_by: string | null
  created_at: string
  customers?: Pick<Customer, 'name' | 'phone'> | null
  order_items: OrderItem[]
}

export type ExpenseCategory = 'ingredients' | 'packaging' | 'other'

export type Expense = {
  id: string
  date: string
  category: ExpenseCategory
  amount: number
  ingredient_id: string | null
  quantity: number | null
  notes: string | null
  ingredients?: Pick<Ingredient, 'name' | 'unit'> | null
}

export type StockMovement = {
  id: string
  change: number
  reason: 'order' | 'order_undone' | 'restock' | 'adjustment'
  note: string | null
  order_id: string | null
  created_at: string
  orders?: { number: number } | null
}
