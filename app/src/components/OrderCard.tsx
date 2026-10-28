import { Link } from 'react-router'
import { formatMoney } from '../lib/format'
import { CHANNELS, customerCode, formatTime, orderTotals, STATUSES } from '../lib/orders'
import { takenBy, useStaffNames } from '../lib/staff'
import type { Order } from '../lib/types'

export default function OrderCard({ order }: { order: Order }) {
  const status = STATUSES[order.status]
  const itemCount = order.order_items.reduce((sum, i) => sum + i.quantity, 0)
  const names = useStaffNames()
  const by = order.channel === 'website' ? null : takenBy(order, names)

  return (
    <Link to={`/orders/${order.id}`} className="card block space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-semibold">
          {customerCode(order)} <span className="text-sm font-normal text-stone-400">#{order.number}</span> · {order.customers?.name ?? CHANNELS[order.channel]}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
      </div>
      <p className="truncate text-sm text-stone-500">
        {order.order_items.map((i) => `${i.quantity}× ${i.menu_items?.name}`).join(', ')}
      </p>
      <div className="flex justify-between text-sm">
        <span className="text-stone-500">
          {formatTime(order.delivery_at)} · {CHANNELS[order.channel]} · {itemCount} item{itemCount === 1 ? '' : 's'}
          {by && ` · by ${by}`}
        </span>
        <span className="font-semibold">{formatMoney(orderTotals(order).total)}</span>
      </div>
    </Link>
  )
}
