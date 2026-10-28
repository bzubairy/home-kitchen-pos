import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import ErrorMessage from '../components/ErrorMessage'
import OrderCard from '../components/OrderCard'
import { formatDate, ORDER_SELECT, sortActiveOrders } from '../lib/orders'
import { supabase } from '../lib/supabase'
import type { Order } from '../lib/types'

const TABS = [
  { key: 'active', label: 'Active', statuses: ['new', 'pending', 'preparing'], ascending: true },
  { key: 'delivered', label: 'Delivered', statuses: ['delivered'], ascending: false },
  { key: 'cancelled', label: 'Cancelled', statuses: ['cancelled'], ascending: false },
] as const

export default function Orders() {
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS[0])
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('orders')
      .select(ORDER_SELECT)
      .in('status', [...tab.statuses])
      .order('delivery_at', { ascending: tab.ascending })
      .limit(100)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setOrders(tab.key === 'active' ? sortActiveOrders(data as Order[]) : (data as Order[]))
        setLoading(false)
      })
  }, [tab])

  // Group by day so past orders are easy to scan.
  const days = [...new Set(orders.map((o) => formatDate(o.delivery_at)))]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Orders</h2>
        <Link to="/orders/new" className="btn-primary py-2">+ New order</Link>
      </div>

      <div className="grid grid-cols-3 rounded-xl bg-stone-200 p-1 dark:bg-stone-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setLoading(true)
              setTab(t)
            }}
            className={`rounded-lg py-1.5 text-sm font-medium ${tab.key === t.key ? 'bg-white shadow-sm dark:bg-stone-900' : 'text-stone-500'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ErrorMessage message={error} />
      {loading && <p className="text-stone-500">Loading…</p>}
      {!loading && !error && orders.length === 0 && <p className="card text-stone-500">No orders here.</p>}

      {!loading &&
        days.map((day) => (
          <section key={day} className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">{day}</h3>
            {orders
              .filter((o) => formatDate(o.delivery_at) === day)
              .map((order) => <OrderCard key={order.id} order={order} />)}
          </section>
        ))}
    </div>
  )
}
