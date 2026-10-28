import brand, { instagramUrl } from '../brand'

const money = new Intl.NumberFormat(brand.locale, { maximumFractionDigits: 0 })

export const formatMoney = (amount: number) => `${brand.currencySymbol} ${money.format(Math.round(amount))}`

/** "22:30" → "10:30 PM" */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return m === 0 ? `${hour} ${suffix}` : `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}

const timeFormat = new Intl.DateTimeFormat(brand.locale, { hour: 'numeric', minute: '2-digit', timeZone: brand.timeZone })
export const formatTime = (iso: string) => timeFormat.format(new Date(iso))

/** wa.me link for a local number, optionally with a pre-filled message. */
export function whatsappLink(phone: string, text?: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) digits = `${brand.phoneCountryCode}${digits.slice(1)}`
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

/** "03001234567" → "0300 1234567" */
export const prettyPhone = (phone: string) => phone.replace(/^(\d{4})(\d+)$/, '$1 $2')

export const INSTAGRAM_URL = instagramUrl(brand)
