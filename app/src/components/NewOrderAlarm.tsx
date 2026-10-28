import { useNavigate } from 'react-router'
import { acknowledgeOrders } from '../lib/acknowledged'
import { formatMoney } from '../lib/format'
import { customerCode, formatTime } from '../lib/orders'
import type { NewOrderSummary } from '../lib/useNewOrderAlerts'

/** Full-screen alert for website orders this phone hasn't seen yet. */
export default function NewOrderAlarm({ orders }: { orders: NewOrderSummary[] }) {
  const navigate = useNavigate()
  if (orders.length === 0) return null
  const first = orders[0]
  const total = Math.max(first.order_items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0) - first.discount, 0)

  function open() {
    acknowledgeOrders([first.id])
    navigate(`/orders/${first.id}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-red-600 px-6 text-center text-white" role="alertdialog" aria-live="assertive">
      <p className="animate-bounce text-7xl" aria-hidden>🔔</p>
      <div>
        <p className="text-3xl font-bold">New website order {customerCode(first)}</p>
        <p className="text-white/80">#{first.number}</p>
        <p className="mt-2 text-lg">
          {first.customers?.name ?? 'Customer'} · {formatMoney(total)} · for {formatTime(first.delivery_at)}
        </p>
        {orders.length > 1 && <p className="mt-1 text-white/80">+ {orders.length - 1} more waiting</p>}
      </div>
      <button onClick={open} className="w-full max-w-xs rounded-2xl bg-white py-4 text-xl font-bold text-red-700 active:scale-95">
        Open order
      </button>
      <button onClick={() => acknowledgeOrders(orders.map((o) => o.id))} className="py-2 text-white/90 underline">
        Silence
      </button>
    </div>
  )
}
