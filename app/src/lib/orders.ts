import type { Channel, Order, OrderStatus, PaymentMethod, RequestedPayment } from './types'
import brand from '../brand'

export const CHANNELS: Record<Channel, string> = {
  whatsapp: 'WhatsApp',
  phone: 'Phone',
  instagram: 'Instagram',
  foodpanda: 'Foodpanda',
  website: 'Website',
}

/** Channels staff can choose when entering an order (website orders come from the site). */
export const STAFF_CHANNELS: Channel[] = ['whatsapp', 'phone', 'instagram', 'foodpanda']

export const STATUSES: Record<OrderStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  preparing: { label: 'Preparing', className: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' },
  delivered: { label: 'Delivered', className: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' },
  cancelled: { label: 'Cancelled', className: 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400' },
}

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: `Bank / ${brand.walletName}`,
  foodpanda: 'Foodpanda',
}

export const REQUESTED_PAYMENTS: Record<RequestedPayment, string> = {
  cash: 'Cash on delivery',
  wallet: brand.walletName,
}

/** What customers see as the order number, e.g. BURGER-7KQ (falls back to #12 until a code exists). */
export const customerCode = (order: { code?: string | null; number: number }) => order.code ?? `#${order.number}`

/** Website orders awaiting confirmation first, then by delivery time. */
export function sortActiveOrders(orders: Order[]): Order[] {
  return [...orders].sort(
    (a, b) => Number(b.status === 'new') - Number(a.status === 'new') || a.delivery_at.localeCompare(b.delivery_at),
  )
}

/** Joins order fields with their customer and items, for list and detail screens. */
export const ORDER_SELECT = '*, customers(name, phone), order_items(menu_item_id, quantity, unit_price, menu_items(name))'

export function orderTotals(order: Pick<Order, 'order_items' | 'discount' | 'commission_rate'>) {
  const subtotal = order.order_items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
  const total = Math.max(subtotal - order.discount, 0)
  const commission = total * order.commission_rate
  return { subtotal, total, commission, net: total - commission }
}

const timeFormat = new Intl.DateTimeFormat(brand.locale, { hour: 'numeric', minute: '2-digit' })
const dateFormat = new Intl.DateTimeFormat(brand.locale, { weekday: 'short', day: 'numeric', month: 'short' })

export const formatTime = (iso: string) => timeFormat.format(new Date(iso))
export const formatDate = (iso: string) => dateFormat.format(new Date(iso))

/** "HH:MM" for the next quarter hour, used as the default delivery time. */
export function nextQuarterHour(): string {
  const d = new Date()
  d.setMinutes(Math.ceil((d.getMinutes() + 1) / 15) * 15, 0, 0)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** WhatsApp link for a local number, e.g. 0300 1234567 → wa.me/923001234567. */
export function whatsappLink(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) digits = `${brand.phoneCountryCode}${digits.slice(1)}`
  return `https://wa.me/${digits}`
}
