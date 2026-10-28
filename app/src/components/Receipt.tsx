import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { formatMoney } from '../lib/format'
import { customerCode, orderTotals, PAYMENT_METHODS, REQUESTED_PAYMENTS } from '../lib/orders'
import { PRINT_AREA_MM, type PaperWidth } from '../lib/receipt'
import type { Order } from '../lib/types'
import brand from '../brand'

const SITE_URL = (import.meta.env.VITE_CUSTOMER_SITE_URL as string | undefined) ?? ''
const SITE_LABEL = SITE_URL.replace(/^https?:\/\//, '')

const dateTime = new Intl.DateTimeFormat(brand.locale, {
  day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
})

/** Payment line: what was paid, or what the rider must collect. */
function paymentLine(order: Order, total: number): { label: string; value: string } {
  if (order.channel === 'foodpanda') return { label: 'PAID', value: 'via Foodpanda' }
  if (order.payment_method) return { label: 'PAID', value: PAYMENT_METHODS[order.payment_method] }
  const method = order.requested_payment ? REQUESTED_PAYMENTS[order.requested_payment] : 'Cash'
  return { label: `To collect (${method})`, value: formatMoney(total) }
}

/** Customer receipt laid out for a thermal printer (58 or 80 mm paper). */
export default function Receipt({ order, paper, onReady }: { order: Order; paper: PaperWidth; onReady?: () => void }) {
  const [qr, setQr] = useState<string | null>(null)
  const width = PRINT_AREA_MM[paper]
  const totals = orderTotals(order)
  const payment = paymentLine(order, totals.total)
  // Foodpanda orders show the Foodpanda price the customer paid; commission is internal.

  useEffect(() => {
    if (!SITE_URL) return onReady?.()
    QRCode.toDataURL(SITE_URL, { margin: 0, width: 240, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setQr(null))
      .finally(() => onReady?.())
  }, [onReady])

  return (
    <div className="receipt" style={{ width: `${width}mm`, fontSize: paper === 58 ? '11px' : '13px' }}>
      <div className="receipt-center">
        <img src="/receipt-logo.png" alt="" style={{ width: paper === 58 ? '22mm' : '28mm' }} />
        <div className="receipt-title">{brand.name}</div>
        {brand.tagline && <div>{brand.tagline}</div>}
      </div>
      <hr />
      <div className="receipt-row receipt-bold receipt-big">
        <span>Order {customerCode(order)}</span>
      </div>
      <div>{dateTime.format(new Date(order.created_at))}</div>
      {order.customers && (
        <>
          <div>{order.customers.name}</div>
          {order.customers.phone && <div>{order.customers.phone}</div>}
        </>
      )}
      <hr />
      {order.order_items.map((item) => (
        <div key={item.menu_item_id} className="receipt-row">
          <span>{item.quantity} × {item.menu_items?.name}</span>
          <span>{formatMoney(item.quantity * item.unit_price)}</span>
        </div>
      ))}
      <hr />
      {order.discount > 0 && (
        <>
          <div className="receipt-row"><span>Subtotal</span><span>{formatMoney(totals.subtotal)}</span></div>
          <div className="receipt-row"><span>Discount</span><span>− {formatMoney(order.discount)}</span></div>
        </>
      )}
      <div className="receipt-row receipt-bold receipt-big"><span>TOTAL</span><span>{formatMoney(totals.total)}</span></div>
      <div className="receipt-row receipt-bold"><span>{payment.label}</span><span>{payment.value}</span></div>
      {order.notes && (
        <>
          <hr />
          <div className="receipt-notes">Notes: {order.notes}</div>
        </>
      )}
      <hr />
      <div className="receipt-center">
        <div className="receipt-bold">Thank you!</div>
        {SITE_LABEL && (
          <>
            <div>Order again:</div>
            <div className="receipt-bold" style={{ whiteSpace: 'nowrap' }}>{SITE_LABEL}</div>
          </>
        )}
        {brand.instagramHandle && <div>Instagram: @{brand.instagramHandle}</div>}
        {qr && <img src={qr} alt="" style={{ width: paper === 58 ? '24mm' : '30mm', marginTop: '2mm' }} />}
      </div>
    </div>
  )
}
