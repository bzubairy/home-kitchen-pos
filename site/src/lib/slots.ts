import type { Shop } from './api'
import { formatClock } from './format'

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const toHHMM = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/**
 * Delivery times customers can pick today, every 15 minutes from the earliest
 * allowed time until closing. Uses the server's clock (Pakistan time), not the phone's.
 */
export function deliverySlots(shop: Shop): { value: string; label: string }[] {
  const now = toMinutes(shop.now.slice(11, 16))
  const start = Math.ceil((Math.max(now, toMinutes(shop.opening_time)) + shop.min_lead_minutes + 15) / 15) * 15
  const end = toMinutes(shop.closing_time)
  const slots = []
  for (let t = start; t <= end && t < 24 * 60; t += 15) {
    slots.push({ value: toHHMM(t), label: formatClock(toHHMM(t)) })
  }
  return slots
}
