import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import ErrorMessage from '../components/ErrorMessage'
import NotificationSettings from '../components/NotificationSettings'
import PrinterSettings from '../components/PrinterSettings'
import StaffNameSettings from '../components/StaffNameSettings'
import { supabase } from '../lib/supabase'
import brand from '../brand'

type Form = {
  commissionPercent: string
  takingOrders: boolean
  openingTime: string
  lastOrderTime: string
  closingTime: string
  minLeadMinutes: string
  walletNumber: string
  contactWhatsapp: string
  deliveryArea: string
}

export default function Settings() {
  const navigate = useNavigate()
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase
      .from('settings')
      .select('*')
      .single()
      .then(({ data, error }) => {
        if (error) return setError(error.message)
        setForm({
          commissionPercent: String(Math.round(data.foodpanda_commission_rate * 10000) / 100),
          takingOrders: data.taking_orders,
          // Postgres returns "HH:MM:SS"; time inputs want "HH:MM".
          openingTime: data.opening_time.slice(0, 5),
          lastOrderTime: data.last_order_time.slice(0, 5),
          closingTime: data.closing_time.slice(0, 5),
          minLeadMinutes: String(data.min_lead_minutes),
          walletNumber: data.wallet_number,
          contactWhatsapp: data.contact_whatsapp,
          deliveryArea: data.delivery_area,
        })
      })
  }, [])

  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('settings')
      .update({
        foodpanda_commission_rate: Number(form.commissionPercent) / 100,
        taking_orders: form.takingOrders,
        opening_time: form.openingTime,
        last_order_time: form.lastOrderTime,
        closing_time: form.closingTime,
        min_lead_minutes: Number(form.minLeadMinutes),
        wallet_number: form.walletNumber.trim(),
        contact_whatsapp: form.contactWhatsapp.trim(),
        delivery_area: form.deliveryArea.trim(),
      })
      .eq('id', true)
    setBusy(false)
    if (error) return setError(error.message)
    navigate('/more')
  }

  if (!form) return error ? <ErrorMessage message={error} /> : <p className="text-stone-500">Loading…</p>

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold">Settings</h2>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">You</h3>
        <StaffNameSettings />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Notifications</h3>
        <NotificationSettings />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Receipt printer</h3>
        <PrinterSettings />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Website orders</h3>
        <div className="card space-y-3">
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={form.takingOrders} onChange={(e) => set({ takingOrders: e.target.checked })} className="mt-0.5 h-5 w-5 accent-brand-600" />
            <span>
              Taking website orders
              <span className="block text-sm text-stone-500">Turn off to pause orders, e.g. on a day off.</span>
            </span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <TimeField label="Opens" value={form.openingTime} onChange={(v) => set({ openingTime: v })} />
            <TimeField label="Last order" value={form.lastOrderTime} onChange={(v) => set({ lastOrderTime: v })} />
            <TimeField label="Last delivery" value={form.closingTime} onChange={(v) => set({ closingTime: v })} />
          </div>
          <Field label="Shortest wait (minutes)">
            <input required type="number" inputMode="numeric" min="0" max="240" value={form.minLeadMinutes} onChange={(e) => set({ minLeadMinutes: e.target.value })} className="input" />
          </Field>
          <Field label="Delivery area (shown on the website)">
            <input required value={form.deliveryArea} onChange={(e) => set({ deliveryArea: e.target.value })} className="input" />
          </Field>
          <Field label={`${brand.walletName} number`}>
            <input required type="tel" value={form.walletNumber} onChange={(e) => set({ walletNumber: e.target.value })} className="input" />
          </Field>
          <Field label="WhatsApp contact number">
            <input required type="tel" value={form.contactWhatsapp} onChange={(e) => set({ contactWhatsapp: e.target.value })} className="input" />
          </Field>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Foodpanda</h3>
        <div className="card space-y-2">
          <Field label="Commission (%)">
            <input required type="number" inputMode="decimal" min="0" max="99" step="any" value={form.commissionPercent} onChange={(e) => set({ commissionPercent: e.target.value })} className="input" />
          </Field>
          <p className="text-sm text-stone-500">Applies to new Foodpanda orders. Past orders keep the rate they were created with.</p>
        </div>
      </section>

      <ErrorMessage message={error} />
      <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? 'Saving…' : 'Save'}</button>
    </form>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-stone-500">{label}</span>
      {children}
    </label>
  )
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <input required type="time" value={value} onChange={(e) => onChange(e.target.value)} className="input px-2" />
    </Field>
  )
}
