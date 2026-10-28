import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import Footer from '../components/Footer'
import { getOrderStatus, type OrderStatus } from '../lib/api'
import { formatMoney, formatTime, prettyPhone, whatsappLink } from '../lib/format'
import brand from '../brand'

const STEPS = [
  { status: 'new', label: 'Order received', hint: "We'll call or WhatsApp you shortly to confirm." },
  { status: 'pending', label: 'Confirmed', hint: 'Your order is in the queue.' },
  { status: 'preparing', label: 'Being prepared', hint: 'Cooking up your order…' },
  { status: 'delivered', label: 'Delivered', hint: 'Enjoy! Thanks for ordering.' },
] as const

const REFRESH_MS = 30_000

export default function OrderPage() {
  const { token } = useParams()
  const [order, setOrder] = useState<OrderStatus | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'not_found' | 'error'>('loading')

  useEffect(() => {
    let timer: number | undefined
    let stopped = false

    async function refresh() {
      try {
        const data = await getOrderStatus(token!)
        if (stopped) return
        if (!data) return setState('not_found')
        setOrder(data)
        setState('ok')
        // Keep checking until the order is finished.
        if (data.status !== 'delivered' && data.status !== 'cancelled') {
          timer = window.setTimeout(refresh, REFRESH_MS)
        }
      } catch {
        if (stopped) return
        setState((s) => (s === 'ok' ? s : 'error'))
        timer = window.setTimeout(refresh, REFRESH_MS)
      }
    }
    refresh()
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [token])

  return (
    <div className="mx-auto max-w-xl px-4">
      <header className="flex items-center gap-3 py-4">
        <Link to="/" className="flex items-center gap-3">
          <img src="/logo-256.png" alt="" width={44} height={44} className="h-11 w-11" />
          <span className="heading text-2xl">{brand.name}</span>
        </Link>
      </header>

      {state === 'loading' && <p className="text-center text-ink-soft">Loading your order…</p>}
      {state === 'error' && <p className="card text-center">Couldn't load your order. Check your internet — we'll keep trying.</p>}
      {state === 'not_found' && (
        <div className="card text-center">
          <p className="mb-4">We couldn't find this order.</p>
          <Link to="/" className="btn-primary inline-block">Back to the menu</Link>
        </div>
      )}
      {order && <OrderDetails order={order} />}

      <Footer whatsapp={order?.contact_whatsapp} />
    </div>
  )
}

function OrderDetails({ order }: { order: OrderStatus }) {
  const cancelled = order.status === 'cancelled'
  const current = STEPS.findIndex((s) => s.status === order.status)
  const code = order.code ?? `#${order.number}`
  const message = `Hi! About my ${brand.name} order ${code}`

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-ink-soft">Order</p>
        <h1 className="heading text-5xl">{code}</h1>
        {!cancelled && <p className="mt-1 text-ink-soft">Delivery around {formatTime(order.delivery_at)}</p>}
      </div>

      {cancelled ? (
        <div className="card border-ketchup/30 text-center">
          <p className="heading text-xl text-ketchup">Order cancelled</p>
          {order.cancel_reason && <p className="mt-1">{order.cancel_reason}</p>}
          <p className="mt-2 text-sm text-ink-soft">Questions? Message us on WhatsApp.</p>
        </div>
      ) : (
        <ol className="card space-y-4">
          {STEPS.map((step, i) => {
            const done = i <= current
            return (
              <li key={step.status} className="flex gap-3">
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display font-bold ${done ? 'bg-mustard text-ink' : 'bg-cream-deep text-ink-soft'}`}>
                  {i < current ? '✓' : i + 1}
                </span>
                <div>
                  <p className={`font-display text-lg font-semibold ${done ? '' : 'text-ink-soft'}`}>{step.label}</p>
                  {i === current && <p className="text-sm text-ink-soft">{step.hint}</p>}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {order.requested_payment === 'wallet' && !cancelled && order.status !== 'delivered' && (
        <div className="card space-y-2 bg-mustard/10">
          <p className="font-semibold">Paying with {brand.walletName}</p>
          <p className="text-sm">
            After we confirm, send <strong>{formatMoney(order.total)}</strong> to <strong>{prettyPhone(order.wallet_number)}</strong> and share the screenshot with us on WhatsApp.
          </p>
        </div>
      )}

      <div className="card space-y-2">
        {order.items.map((item) => (
          <div key={item.name} className="flex justify-between">
            <span>{item.quantity}× {item.name}</span>
            <span>{formatMoney(item.quantity * item.price)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-cream-deep pt-2 font-display text-lg font-semibold">
          <span>Total {order.requested_payment === 'cash' ? '(cash on delivery)' : ''}</span>
          <span>{formatMoney(order.total)}</span>
        </div>
      </div>

      <a href={whatsappLink(order.contact_whatsapp, message)} target="_blank" rel="noreferrer" className="btn-primary block text-center">
        WhatsApp us about this order
      </a>
      <Link to="/" className="block text-center font-display font-semibold text-orange">Order something else →</Link>
    </div>
  )
}
