import type { Shop } from '../lib/api'
import { formatClock } from '../lib/format'

/** Open/closed message with today's hours. */
export default function ShopBanner({ shop }: { shop: Shop }) {
  const nowTime = shop.now.slice(11, 16)
  let message: string
  if (shop.open) message = `Open now · last orders ${formatClock(shop.last_order_time)}`
  else if (!shop.taking_orders) message = 'Not taking orders right now — check back soon'
  else if (nowTime < shop.opening_time) message = `Closed · opens at ${formatClock(shop.opening_time)}`
  else message = `Closed for today · opens tomorrow at ${formatClock(shop.opening_time)}`

  return (
    <p className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${shop.open ? 'bg-leaf/15 text-leaf' : 'bg-ketchup/10 text-ketchup'}`}>
      <span className={`h-2 w-2 rounded-full ${shop.open ? 'bg-leaf' : 'bg-ketchup'}`} aria-hidden />
      {message}
    </p>
  )
}
