import brand from '../brand'
import { customerCode } from './orders'
import type { Order } from './types'

const SITE_URL = import.meta.env.VITE_CUSTOMER_SITE_URL as string | undefined

export type CustomerUpdate = 'preparing' | 'delivered'

/** Local number → international digits, e.g. 0300 1234567 → 923001234567. */
function internationalDigits(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('0') ? `${brand.phoneCountryCode}${digits.slice(1)}` : digits
}

/** Customers we message: anyone with a phone number, except Foodpanda (they handle their customers). */
export function canMessageCustomer(order: Order) {
  return order.channel !== 'foodpanda' && Boolean(order.customers?.phone)
}

/** Fills a message template from brand.json ({firstName}, {business}, {code}). */
function fill(template: string, order: Order) {
  const firstName = order.customers?.name.trim().split(/\s+/)[0] ?? 'there'
  return template
    .replaceAll('{firstName}', firstName)
    .replaceAll('{business}', brand.name)
    .replaceAll('{code}', customerCode(order))
}

export function customerMessage(kind: CustomerUpdate, order: Order) {
  if (kind === 'preparing') {
    const track = order.channel === 'website' && SITE_URL ? `\n\nTrack your order: ${SITE_URL}/order/${order.public_token}` : ''
    return fill(brand.messages.preparing, order) + track
  }
  const instagram = brand.instagramHandle ? ` Follow us on Instagram: instagram.com/${brand.instagramHandle}` : ''
  return fill(brand.messages.delivered, order) + instagram
}

/**
 * Opens WhatsApp with the message ready to send. On phones the whatsapp:// link
 * opens the app directly (no browser page in between); elsewhere wa.me is used.
 */
export function openWhatsApp(phone: string, text: string) {
  const digits = internationalDigits(phone)
  const onPhone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  window.location.href = onPhone
    ? `whatsapp://send?phone=${digits}&text=${encodeURIComponent(text)}`
    : `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
