import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import ErrorMessage from '../components/ErrorMessage'
import OrderCard from '../components/OrderCard'
import { formatMoney } from '../lib/format'
import { ORDER_SELECT, orderTotals } from '../lib/orders'
import { supabase } from '../lib/supabase'
import type { Order } from '../lib/types'

export default function CustomerForm() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isNew) return
    Promise.all([
      supabase.from('customers').select('*').eq('id', id).single(),
      supabase.from('orders').select(ORDER_SELECT).eq('customer_id', id).order('delivery_at', { ascending: false }),
    ]).then(([custRes, ordersRes]) => {
      const failed = custRes.error ?? ordersRes.error
      if (failed) return setError(failed.message)
      setName(custRes.data.name)
      setPhone(custRes.data.phone ?? '')
      setAddress(custRes.data.address ?? '')
      setNotes(custRes.data.notes ?? '')
      setOrders(ordersRes.data as Order[])
    })
  }, [id, isNew])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const row = { name: name.trim(), phone: phone.trim() || null, address: address.trim() || null, notes: notes.trim() || null }
    const { error } = isNew
      ? await supabase.from('customers').insert(row)
      : await supabase.from('customers').update(row).eq('id', id)
    setBusy(false)
    if (error) {
      return setError(error.message.includes('customers_phone_key') ? 'Another customer already has this phone number.' : error.message)
    }
    navigate('/customers')
  }

  const delivered = orders.filter((o) => o.status === 'delivered')
  const spent = delivered.reduce((sum, o) => sum + orderTotals(o).total, 0)

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-xl font-semibold">{isNew ? 'New customer' : 'Customer'}</h2>
        <div className="card space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm text-stone-500">Name</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-stone-500">Phone</span>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-stone-500">Address</span>
            <textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-stone-500">Notes / preferences</span>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder="e.g. likes extra sauce, address…" />
          </label>
        </div>
        <ErrorMessage message={error} />
        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/customers')} className="btn-secondary flex-1">Back</button>
          <button type="submit" disabled={busy} className="btn-primary flex-1">{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>

      {!isNew && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Orders · {delivered.length} delivered · {formatMoney(spent)} total
          </h3>
          {orders.length === 0 && <p className="card text-stone-500">No orders yet.</p>}
          {orders.map((order) => <OrderCard key={order.id} order={order} />)}
        </section>
      )}
    </div>
  )
}
