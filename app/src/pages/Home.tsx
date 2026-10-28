import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import ErrorMessage from '../components/ErrorMessage'
import OrderCard from '../components/OrderCard'
import { formatMoney } from '../lib/format'
import { ORDER_SELECT, sortActiveOrders } from '../lib/orders'
import { loadReport, profitOf, type ReportSummary } from '../lib/reports'
import { loadIngredientsWithDemand, type IngredientWithDemand } from '../lib/stock'
import { supabase } from '../lib/supabase'
import type { Order } from '../lib/types'
import { formatQty } from '../lib/units'
import brand from '../brand'

const todayFormat = new Intl.DateTimeFormat(brand.locale, { weekday: 'long', day: 'numeric', month: 'long' })

export default function Home() {
  const [today, setToday] = useState<ReportSummary | null>(null)
  const [month, setMonth] = useState<ReportSummary | null>(null)
  const [active, setActive] = useState<Order[]>([])
  const [lowStock, setLowStock] = useState<IngredientWithDemand[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateLabel] = useState(() => todayFormat.format(new Date()))

  useEffect(() => {
    Promise.all([
      loadReport('today'),
      loadReport('month'),
      supabase.from('orders').select(ORDER_SELECT).in('status', ['new', 'pending', 'preparing']).order('delivery_at'),
      loadIngredientsWithDemand(),
    ]).then(([todayRes, monthRes, ordersRes, stockRes]) => {
      const failed = todayRes.error ?? monthRes.error ?? ordersRes.error?.message ?? stockRes.error
      if (failed) setError(failed)
      setToday(todayRes.data)
      setMonth(monthRes.data)
      setActive(sortActiveOrders((ordersRes.data ?? []) as Order[]))
      setLowStock((stockRes.data ?? []).filter((i) => i.isLow))
      setLoading(false)
    })
  }, [])

  const newCount = active.filter((o) => o.status === 'new').length

  return (
    <div className="space-y-5">
      <p className="text-stone-500">{dateLabel}</p>
      <ErrorMessage message={error} />

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Sales today" value={today && formatMoney(today.sales)} sub={today && `${today.orders} delivered`} />
        <Stat label="You keep today" value={today && formatMoney(today.sales - today.commission)} sub="after Foodpanda" />
        <Stat label="Sales this month" value={month && formatMoney(month.sales)} sub={month && `${month.orders} orders`} />
        <Stat
          label="Profit this month"
          value={month && formatMoney(profitOf(month))}
          sub={month && `${formatMoney(month.expenses)} spent`}
          negative={month ? profitOf(month) < 0 : false}
        />
      </div>

      {lowStock.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-red-600">⚠️ Running low</h3>
          <ul className="card divide-y divide-stone-100 p-0 dark:divide-stone-800">
            {lowStock.map((ing) => (
              <li key={ing.id}>
                <Link to={`/inventory/${ing.id}`} className="flex justify-between px-4 py-3">
                  <span className="font-medium">{ing.name}</span>
                  <span className="text-red-600">
                    {formatQty(ing.needed > 0 ? ing.projected : ing.current_stock, ing.unit)}
                    {ing.needed > 0 ? ' after orders' : ' left'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {newCount > 0 && (
        <p className="rounded-xl bg-red-600 px-4 py-3 font-semibold text-white">
          🔔 {newCount} new website order{newCount === 1 ? '' : 's'} to confirm
        </p>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Active orders</h3>
          <Link to="/orders/new" className="text-sm font-medium text-brand-600">+ New order</Link>
        </div>
        {loading && <p className="text-stone-500">Loading…</p>}
        {!loading && active.length === 0 && <p className="card text-stone-500">No active orders.</p>}
        {active.map((order) => <OrderCard key={order.id} order={order} />)}
      </section>

      <Link to="/reports" className="btn-secondary block text-center">See full reports</Link>
    </div>
  )
}

function Stat({ label, value, sub, negative }: { label: string; value: string | null; sub?: string | null; negative?: boolean }) {
  return (
    <div className="card">
      <p className="text-sm text-stone-500">{label}</p>
      <p className={`text-xl font-bold ${negative ? 'text-red-600' : ''}`}>{value ?? '…'}</p>
      {sub && <p className="text-xs text-stone-500">{sub}</p>}
    </div>
  )
}
