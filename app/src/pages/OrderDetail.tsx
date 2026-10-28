import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import ErrorMessage from '../components/ErrorMessage'
import ReceiptPreview from '../components/ReceiptPreview'
import { acknowledgeOrders } from '../lib/acknowledged'
import { takenBy, useStaffNames } from '../lib/staff'
import { canMessageCustomer, customerMessage, openWhatsApp, type CustomerUpdate } from '../lib/whatsapp'
import Row from '../components/SummaryRow'
import { formatMoney } from '../lib/format'
import { CHANNELS, customerCode, formatDate, formatTime, ORDER_SELECT, orderTotals, PAYMENT_METHODS, REQUESTED_PAYMENTS, STATUSES, whatsappLink } from '../lib/orders'
import { supabase } from '../lib/supabase'
import type { Order, OrderStatus, PaymentMethod } from '../lib/types'

export default function OrderDetail() {
  const { id } = useParams()
  const [order, setOrder] = useState<Order | null>(null)
  const [choosingPayment, setChoosingPayment] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const staffNames = useStaffNames()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Bumped after a status change to reload the order.
  const [version, setVersion] = useState(0)

  useEffect(() => {
    supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('id', id)
      .single<Order>()
      .then(({ data, error }) => {
        if (error) return setError(error.message)
        setOrder(data)
        if (data.status === 'new') acknowledgeOrders([data.id])
      })
  }, [id, version])

  /** Changes the status; with `update`, then opens WhatsApp with a message for the customer. */
  async function setStatus(status: OrderStatus, paymentMethod?: PaymentMethod, update?: CustomerUpdate) {
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('set_order_status', {
      p_order_id: id,
      p_status: status,
      p_payment_method: paymentMethod ?? null,
    })
    setBusy(false)
    setChoosingPayment(false)
    if (error) return setError(error.message)
    setVersion((v) => v + 1)
    if (update && order && canMessageCustomer(order)) {
      openWhatsApp(order.customers!.phone!, customerMessage(update, order))
    }
  }

  async function cancelOrder(question: string) {
    const reason = prompt(`${question}\n\nReason (optional), e.g. out of delivery area:`)
    if (reason === null) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('reject_order', { p_order_id: id, p_reason: reason })
    setBusy(false)
    if (error) return setError(error.message)
    setVersion((v) => v + 1)
  }

  function markDelivered() {
    // Foodpanda orders are always paid through Foodpanda.
    if (order?.channel === 'foodpanda') setStatus('delivered')
    else setChoosingPayment(true)
  }

  if (!order) return error ? <ErrorMessage message={error} /> : <p className="text-stone-500">Loading…</p>

  const totals = orderTotals(order)
  const status = STATUSES[order.status]
  const phone = order.customers?.phone

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {customerCode(order)} <span className="text-base font-normal text-stone-400">#{order.number}</span>
        </h2>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${status.className}`}>{status.label}</span>
      </div>

      <div className="card space-y-1">
        <Row label="Channel" value={CHANNELS[order.channel]} />
        {takenBy(order, staffNames) && <Row label="Taken by" value={takenBy(order, staffNames)!} />}
        <Row label="Delivery" value={`${formatDate(order.delivery_at)}, ${formatTime(order.delivery_at)}`} />
        {order.customers && <Row label="Customer" value={order.customers.name} />}
        {order.requested_payment && !order.payment_method && (
          <Row label="Will pay by" value={REQUESTED_PAYMENTS[order.requested_payment]} />
        )}
        {order.payment_method && <Row label="Paid by" value={PAYMENT_METHODS[order.payment_method]} />}
        {order.delivery_address && <p className="pt-1 text-sm">📍 {order.delivery_address}</p>}
        {phone && (
          <div className="flex gap-2 pt-2">
            <a href={`tel:${phone}`} className="btn-secondary flex-1 py-2 text-center">📞 Call</a>
            <a href={whatsappLink(phone)} target="_blank" rel="noreferrer" className="btn-secondary flex-1 py-2 text-center">💬 WhatsApp</a>
          </div>
        )}
      </div>

      <div className="card space-y-1">
        {order.order_items.map((item) => (
          <Row key={item.menu_item_id} label={`${item.quantity}× ${item.menu_items?.name}`} value={formatMoney(item.quantity * item.unit_price)} />
        ))}
        <hr className="my-2 border-stone-200 dark:border-stone-800" />
        {order.discount > 0 && <Row label="Discount" value={`− ${formatMoney(order.discount)}`} />}
        <Row label="Customer pays" value={formatMoney(totals.total)} bold />
        {order.commission_rate > 0 && (
          <>
            <Row label={`Foodpanda commission (${Math.round(order.commission_rate * 100)}%)`} value={`− ${formatMoney(totals.commission)}`} />
            <Row label="You receive" value={formatMoney(totals.net)} bold />
          </>
        )}
      </div>

      {order.status === 'new' && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Website order — call or WhatsApp the customer to confirm, then accept or reject it.
        </p>
      )}
      {order.cancel_reason && <p className="card text-sm">Cancelled: {order.cancel_reason}</p>}
      {order.notes && <p className="card whitespace-pre-wrap text-sm">{order.notes}</p>}

      <ErrorMessage message={error} />

      {order.status !== 'cancelled' && (
        <button onClick={() => setShowReceipt(true)} className="btn-secondary w-full">🧾 Print receipt</button>
      )}
      {showReceipt && <ReceiptPreview order={order} onClose={() => setShowReceipt(false)} />}

      {choosingPayment ? (
        <div className="card space-y-2">
          <p className="font-semibold">How did they pay?</p>
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => setStatus('delivered', 'cash', 'delivered')} className="btn-primary flex-1">Cash</button>
            <button disabled={busy} onClick={() => setStatus('delivered', 'bank_transfer', 'delivered')} className="btn-primary flex-1">{PAYMENT_METHODS.bank_transfer}</button>
          </div>
          <button onClick={() => setChoosingPayment(false)} className="w-full py-2 text-sm text-stone-500">Back</button>
        </div>
      ) : (
        <div className="space-y-2">
          {order.status === 'new' && (
            <>
              <button disabled={busy} onClick={() => setStatus('pending')} className="btn-primary w-full">Accept order</button>
              <button disabled={busy} onClick={() => cancelOrder('Reject this order?')} className="btn-secondary w-full text-red-600">
                Reject order
              </button>
            </>
          )}
          {order.status === 'pending' && (
            <button disabled={busy} onClick={() => setStatus('preparing', undefined, 'preparing')} className="btn-primary w-full">Start preparing</button>
          )}
          {(order.status === 'pending' || order.status === 'preparing') && (
            <button disabled={busy} onClick={markDelivered} className={`${order.status === 'preparing' ? 'btn-primary' : 'btn-secondary'} w-full`}>
              Mark delivered
            </button>
          )}
          {(order.status === 'new' || order.status === 'pending') && (
            <Link to={`/orders/${order.id}/edit`} className="btn-secondary block w-full text-center">Edit order</Link>
          )}
          {(order.status === 'pending' || order.status === 'preparing') && (
            <button
              disabled={busy}
              onClick={() => cancelOrder('Cancel this order?')}
              className="w-full py-2 text-sm text-red-600"
            >
              Cancel order
            </button>
          )}
          {order.status === 'delivered' && (
            <button
              disabled={busy}
              onClick={() => confirm('Move this order back to "Preparing"?') && setStatus('preparing')}
              className="btn-secondary w-full"
            >
              Undo delivery
            </button>
          )}
          {order.status === 'cancelled' && (
            <button disabled={busy} onClick={() => setStatus('pending')} className="btn-secondary w-full">Reopen order</button>
          )}
        </div>
      )}
    </div>
  )
}
