import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import ErrorMessage from '../components/ErrorMessage'
import Row from '../components/SummaryRow'
import { formatMoney } from '../lib/format'
import { CHANNELS, nextQuarterHour, ORDER_SELECT, orderTotals, STAFF_CHANNELS } from '../lib/orders'
import { supabase } from '../lib/supabase'
import type { Channel, Customer, MenuItem, Order } from '../lib/types'

const NEW_CUSTOMER = 'new'

export default function OrderForm() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()

  const [menu, setMenu] = useState<MenuItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [commissionRate, setCommissionRate] = useState(0)

  const [channel, setChannel] = useState<Channel>('whatsapp')
  const [customerId, setCustomerId] = useState('')
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [time, setTime] = useState(nextQuarterHour)
  // Orders are same-day, so only the time is editable; this keeps an edited order's date.
  const [baseDate, setBaseDate] = useState(() => new Date())
  const [discount, setDiscount] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    async function load() {
      const [menuRes, custRes, settingsRes] = await Promise.all([
        supabase.from('menu_items').select('*').order('category').order('sort_order').order('name'),
        supabase.from('customers').select('*').order('name'),
        supabase.from('settings').select('foodpanda_commission_rate').single(),
      ])
      if (menuRes.error || custRes.error || settingsRes.error) {
        return setError((menuRes.error ?? custRes.error ?? settingsRes.error)!.message)
      }
      setMenu(menuRes.data)
      setCustomers(custRes.data)
      setCommissionRate(settingsRes.data.foodpanda_commission_rate)

      if (isNew) return
      const { data, error } = await supabase.from('orders').select(ORDER_SELECT).eq('id', id).single<Order>()
      if (error) return setError(error.message)
      setChannel(data.channel)
      setCustomerId(data.customer_id ?? '')
      setQuantities(Object.fromEntries(data.order_items.map((i) => [i.menu_item_id, i.quantity])))
      const delivery = new Date(data.delivery_at)
      setBaseDate(delivery)
      setTime(`${String(delivery.getHours()).padStart(2, '0')}:${String(delivery.getMinutes()).padStart(2, '0')}`)
      setDiscount(data.discount ? String(data.discount) : '')
      setNotes(data.notes ?? '')
    }
    load()
  }, [id, isNew])

  const isFoodpanda = channel === 'foodpanda'
  const priceOf = (item: MenuItem) => (isFoodpanda ? (item.foodpanda_price ?? item.price) : item.price)

  // Show available items, plus hidden ones already on an order being edited.
  const visibleMenu = menu.filter((m) => m.is_active || quantities[m.id])
  const categories = [...new Set(visibleMenu.map((m) => m.category))]

  const totals = orderTotals({
    order_items: menu
      .filter((m) => quantities[m.id])
      .map((m) => ({ menu_item_id: m.id, quantity: quantities[m.id], unit_price: priceOf(m) })),
    discount: Number(discount) || 0,
    commission_rate: isFoodpanda ? commissionRate : 0,
  })

  function changeQty(itemId: string, delta: number) {
    setQuantities((q) => {
      const next = Math.max((q[itemId] ?? 0) + delta, 0)
      const copy = { ...q }
      if (next === 0) delete copy[itemId]
      else copy[itemId] = next
      return copy
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const items = Object.entries(quantities).map(([menu_item_id, quantity]) => ({ menu_item_id, quantity }))
    if (items.length === 0) return setError('Add at least one item.')

    const [hours, minutes] = time.split(':').map(Number)
    const deliveryAt = new Date(baseDate)
    deliveryAt.setHours(hours, minutes, 0, 0)

    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('save_order', {
      payload: {
        id: id ?? null,
        channel,
        customer_id: customerId && customerId !== NEW_CUSTOMER ? customerId : null,
        new_customer: customerId === NEW_CUSTOMER && newName.trim() ? { name: newName, phone: newPhone } : null,
        delivery_at: deliveryAt.toISOString(),
        discount: Number(discount) || 0,
        notes: notes.trim() || null,
      },
      items,
    })
    setBusy(false)
    if (error) {
      return setError(error.message.includes('customers_phone_key')
        ? 'A customer with this phone number already exists — pick them from the list.'
        : error.message)
    }
    navigate(`/orders/${data}`, { replace: true })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold">{isNew ? 'New order' : 'Edit order'}</h2>

      <div className="card space-y-3">
        {channel === 'website' ? (
          <p className="font-medium">🌐 Website order</p>
        ) : (
        <div className="grid grid-cols-2 gap-2">
          {STAFF_CHANNELS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              className={`rounded-xl border px-3 py-2 font-medium ${
                channel === c
                  ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100'
                  : 'border-stone-300 dark:border-stone-700'
              }`}
            >
              {CHANNELS[c]}
            </button>
          ))}
        </div>
        )}

        <label className="block">
          <span className="mb-1 block text-sm text-stone-500">Customer (optional)</span>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input">
            <option value="">— No customer —</option>
            <option value={NEW_CUSTOMER}>+ New customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.phone ? ` · ${c.phone}` : ''}
              </option>
            ))}
          </select>
        </label>
        {customerId === NEW_CUSTOMER && (
          <div className="grid grid-cols-2 gap-2">
            <input required placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} className="input" />
            <input type="tel" placeholder="Phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="input" />
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-sm text-stone-500">Delivery time{isNew ? ' (today)' : ''}</span>
          <input required type="time" value={time} onChange={(e) => setTime(e.target.value)} className="input" />
        </label>
      </div>

      {categories.map((category) => (
        <section key={category}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">{category}</h3>
          <ul className="card divide-y divide-stone-100 p-0 dark:divide-stone-800">
            {visibleMenu
              .filter((m) => m.category === category)
              .map((item) => {
                const qty = quantities[item.id] ?? 0
                return (
                  <li key={item.id} className="flex items-center justify-between px-4 py-2">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-stone-500">{formatMoney(priceOf(item))}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {qty > 0 && (
                        <>
                          <button type="button" onClick={() => changeQty(item.id, -1)} className="h-9 w-9 rounded-full border border-stone-300 text-lg dark:border-stone-700" aria-label={`Remove one ${item.name}`}>−</button>
                          <span className="w-5 text-center font-semibold">{qty}</span>
                        </>
                      )}
                      <button type="button" onClick={() => changeQty(item.id, 1)} className="h-9 w-9 rounded-full bg-brand-600 text-lg text-white" aria-label={`Add one ${item.name}`}>+</button>
                    </div>
                  </li>
                )
              })}
          </ul>
        </section>
      ))}

      <div className="card space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm text-stone-500">Discount (Rs)</span>
          <input type="number" inputMode="numeric" min="0" placeholder="0" value={discount} onChange={(e) => setDiscount(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-stone-500">Notes</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder="e.g. extra spicy, address…" />
        </label>
      </div>

      <div className="card space-y-1">
        <Row label="Items" value={formatMoney(totals.subtotal)} />
        {totals.subtotal !== totals.total && <Row label="Discount" value={`− ${formatMoney(totals.subtotal - totals.total)}`} />}
        <Row label="Customer pays" value={formatMoney(totals.total)} bold />
        {isFoodpanda && (
          <>
            <Row label={`Foodpanda commission (${Math.round(commissionRate * 100)}%)`} value={`− ${formatMoney(totals.commission)}`} />
            <Row label="You receive" value={formatMoney(totals.net)} bold />
          </>
        )}
      </div>

      <ErrorMessage message={error} />
      <div className="flex gap-3">
        <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={busy} className="btn-primary flex-1">{busy ? 'Saving…' : 'Save order'}</button>
      </div>
    </form>
  )
}
