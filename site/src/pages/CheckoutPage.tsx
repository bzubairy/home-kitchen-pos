import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import QtyControl from '../components/QtyControl'
import ShopBanner from '../components/ShopBanner'
import { getOrderStatus, placeOrder } from '../lib/api'
import { useCart } from '../lib/cart'
import { formatMoney, prettyPhone } from '../lib/format'
import { deliverySlots } from '../lib/slots'
import { DETAILS_KEY, load, rememberOrder, save, type SavedDetails } from '../lib/storage'
import { useMenu } from '../lib/useMenu'
import brand from '../brand'

const PHONE_PATTERN = /^(\+?92|0)?3\d{2}[\s-]?\d{7}$/

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { menu, error: menuError, reload } = useMenu()
  const { cart, change, clear } = useCart()
  const [saved] = useState(() => load<SavedDetails>(DETAILS_KEY, { name: '', phone: '', address: '' }))

  const [name, setName] = useState(saved.name)
  const [phone, setPhone] = useState(saved.phone)
  const [address, setAddress] = useState(saved.address)
  const [notes, setNotes] = useState('')
  const [deliveryTime, setDeliveryTime] = useState('') // '' = ASAP
  const [payment, setPayment] = useState<'cash' | 'wallet'>('cash')
  const [company, setCompany] = useState('') // honeypot
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!menu) {
    return (
      <Page>
        {menuError ? (
          <div className="card text-center">
            <p className="mb-3">{menuError}</p>
            <button onClick={reload} className="btn-secondary">Try again</button>
          </div>
        ) : (
          <p className="text-center text-ink-soft">Loading…</p>
        )}
      </Page>
    )
  }

  const { shop } = menu
  const lines = menu.items.filter((i) => cart[i.id])
  const total = lines.reduce((sum, i) => sum + cart[i.id] * i.price, 0)
  const soldOut = lines.filter((i) => i.sold_out)
  const slots = deliverySlots(shop)

  if (lines.length === 0) {
    return (
      <Page>
        <div className="card text-center">
          <p className="mb-4 text-lg">Your cart is empty.</p>
          <Link to="/" className="btn-primary inline-block">See the menu</Link>
        </div>
      </Page>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!PHONE_PATTERN.test(phone.trim())) {
      return setError('Please enter a valid mobile number, like 0300 1234567.')
    }
    setBusy(true)
    try {
      const result = await placeOrder({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        notes: notes.trim(),
        delivery_time: deliveryTime || null,
        payment,
        items: lines.map((i) => ({ menu_item_id: i.id, quantity: cart[i.id] })),
        company,
      })
      save(DETAILS_KEY, { name: name.trim(), phone: phone.trim(), address: address.trim() })
      // The order's code (e.g. BURGER-7KQ) is shown in the 'Your order' shortcut on the menu.
      const code = await getOrderStatus(result.token).then((s) => s?.code ?? null).catch(() => null)
      rememberOrder({ token: result.token, code, placedAt: new Date().toISOString() })
      clear()
      navigate(`/order/${result.token}`, { replace: true })
    } catch (err) {
      setError((err as Error).message)
      reload()
      setBusy(false)
    }
  }

  return (
    <Page>
      <form onSubmit={handleSubmit} className="space-y-5">
        <ShopBanner shop={shop} />

        <section className="card space-y-3">
          <h2 className="heading text-xl">Your order</h2>
          <ul className="space-y-3">
            {lines.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold leading-tight">{item.name}</p>
                  <p className="text-sm text-ink-soft">
                    {item.sold_out ? <span className="font-semibold text-ketchup">Sold out — please remove</span> : formatMoney(item.price * cart[item.id])}
                  </p>
                </div>
                <QtyControl name={item.name} qty={cart[item.id]} onChange={(d) => change(item.id, d)} disabled={item.sold_out} />
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-cream-deep pt-3 font-display text-lg font-semibold">
            <span>Total</span>
            <span>{formatMoney(total)}</span>
          </div>
          <p className="text-sm text-leaf">🛵 Free delivery in {shop.delivery_area}</p>
        </section>

        <section className="card space-y-3">
          <h2 className="heading text-xl">Delivery details</h2>
          <Field label="Your name">
            <input required autoComplete="name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </Field>
          <Field label="Mobile number">
            <input required type="tel" inputMode="tel" autoComplete="tel" placeholder="0300 1234567" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
          </Field>
          <Field label="Address">
            <textarea required rows={2} autoComplete="street-address" maxLength={300} placeholder={`House #, street, ${shop.delivery_area}`} value={address} onChange={(e) => setAddress(e.target.value)} className="input" />
          </Field>
          <Field label="When?">
            <select value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} className="input">
              <option value="">As soon as possible (~{shop.min_lead_minutes} min)</option>
              {slots.map((s) => (
                <option key={s.value} value={s.value}>Today at {s.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Notes (optional)">
            <input maxLength={500} placeholder="e.g. extra spicy, ring the bell" value={notes} onChange={(e) => setNotes(e.target.value)} className="input" />
          </Field>
          {/* Honeypot: hidden from people, bots tend to fill it in. */}
          <div className="absolute -left-[9999px]" aria-hidden>
            <label>Company<input tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} /></label>
          </div>
        </section>

        <section className="card space-y-3">
          <h2 className="heading text-xl">Payment</h2>
          <PaymentOption checked={payment === 'cash'} onSelect={() => setPayment('cash')} title="Cash on delivery" />
          <PaymentOption
            checked={payment === 'wallet'}
            onSelect={() => setPayment('wallet')}
            title={brand.walletName}
            detail={`Send ${formatMoney(total)} to ${prettyPhone(shop.wallet_number)} after we confirm your order.`}
          />
        </section>

        {error && <p className="rounded-xl bg-ketchup/10 px-4 py-3 font-medium text-ketchup" role="alert">{error}</p>}

        <button type="submit" disabled={busy || !shop.open || soldOut.length > 0} className="btn-primary w-full py-4">
          {busy ? 'Placing order…' : shop.open ? `Place order · ${formatMoney(total)}` : 'Closed right now'}
        </button>
        <p className="text-center text-sm text-ink-soft">We'll call or WhatsApp you to confirm your order.</p>
      </form>
    </Page>
  )
}

function Page({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-4 pb-10">
      <header className="flex items-center gap-3 py-4">
        <Link to="/" className="flex items-center gap-3">
          <img src="/logo-256.png" alt="" width={44} height={44} className="h-11 w-11" />
          <span className="heading text-2xl">Checkout</span>
        </Link>
        <Link to="/" className="ml-auto font-display font-semibold text-orange">← Menu</Link>
      </header>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink-soft">{label}</span>
      {children}
    </label>
  )
}

function PaymentOption({ checked, onSelect, title, detail }: { checked: boolean; onSelect: () => void; title: string; detail?: string }) {
  return (
    <label className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3 ${checked ? 'border-mustard bg-mustard/10' : 'border-cream-deep'}`}>
      <input type="radio" name="payment" checked={checked} onChange={onSelect} className="mt-1 h-5 w-5 accent-ink" />
      <span>
        <span className="font-semibold">{title}</span>
        {detail && <span className="block text-sm text-ink-soft">{detail}</span>}
      </span>
    </label>
  )
}
