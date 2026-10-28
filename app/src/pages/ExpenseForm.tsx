import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import ErrorMessage from '../components/ErrorMessage'
import Row from '../components/SummaryRow'
import { EXPENSE_CATEGORIES, formatDay } from '../lib/expenses'
import { formatMoney } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Expense, ExpenseCategory } from '../lib/types'
import { formatQty } from '../lib/units'

export default function ExpenseForm() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()

  const [restock, setRestock] = useState<Expense | null>(null)
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [category, setCategory] = useState<ExpenseCategory>('other')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isNew) return
    supabase
      .from('expenses')
      .select('*, ingredients(name, unit)')
      .eq('id', id)
      .single<Expense>()
      .then(({ data, error }) => {
        if (error) return setError(error.message)
        if (data.ingredient_id) setRestock(data)
        setDate(data.date)
        setCategory(data.category)
        setAmount(String(data.amount))
        setNotes(data.notes ?? '')
      })
  }, [id, isNew])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const row = { date, category, amount: Number(amount), notes: notes.trim() || null }
    const { error } = isNew
      ? await supabase.from('expenses').insert(row)
      : await supabase.from('expenses').update(row).eq('id', id)
    setBusy(false)
    if (error) return setError(error.message)
    navigate('/expenses')
  }

  async function handleDelete() {
    const message = restock
      ? 'Delete this restock? The stock it added will be removed again.'
      : 'Delete this expense?'
    if (!confirm(message)) return
    setBusy(true)
    const { error } = await supabase.rpc('delete_expense', { p_expense_id: id })
    setBusy(false)
    if (error) return setError(error.message)
    navigate('/expenses')
  }

  // Restocks are made from the Stock screen; here they can only be viewed or deleted.
  if (restock) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Restock</h2>
        <div className="card space-y-1">
          <Row label="Item" value={restock.ingredients?.name ?? 'Deleted ingredient'} />
          {restock.quantity && restock.ingredients && (
            <Row label="Quantity" value={formatQty(restock.quantity, restock.ingredients.unit)} />
          )}
          <Row label="Date" value={formatDay(restock.date)} />
          <Row label="Paid" value={formatMoney(restock.amount)} bold />
          {restock.notes && <p className="pt-2 text-sm">{restock.notes}</p>}
        </div>
        <p className="text-sm text-stone-500">
          To change a restock, delete it and restock again from{' '}
          <Link to={`/inventory/${restock.ingredient_id}`} className="text-brand-600">the stock item</Link>.
        </p>
        <ErrorMessage message={error} />
        <div className="flex gap-3">
          <button onClick={() => navigate('/expenses')} className="btn-secondary flex-1">Back</button>
          <button onClick={handleDelete} disabled={busy} className="btn-secondary flex-1 text-red-600">Delete</button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold">{isNew ? 'New expense' : 'Edit expense'}</h2>
      {isNew && (
        <p className="text-sm text-stone-500">
          Bought an ingredient or packaging? Use <Link to="/inventory" className="text-brand-600">Stock → Restock</Link> instead, so the stock goes up too.
        </p>
      )}
      <div className="card space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm text-stone-500">Amount (Rs)</span>
          <input required autoFocus type="number" inputMode="decimal" min="1" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-stone-500">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className="input">
            {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-stone-500">Date</span>
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-stone-500">What was it for?</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder="e.g. cooking oil, spices" />
        </label>
      </div>
      <ErrorMessage message={error} />
      <div className="flex gap-3">
        <button type="button" onClick={() => navigate('/expenses')} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={busy} className="btn-primary flex-1">{busy ? 'Saving…' : 'Save'}</button>
      </div>
      {!isNew && (
        <button type="button" onClick={handleDelete} disabled={busy} className="w-full py-2 text-sm text-red-600">
          Delete expense
        </button>
      )}
    </form>
  )
}
