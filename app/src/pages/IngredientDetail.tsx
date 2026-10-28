import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import ErrorMessage from '../components/ErrorMessage'
import Row from '../components/SummaryRow'
import { formatMoney } from '../lib/format'
import { formatDate, formatTime } from '../lib/orders'
import { loadIngredientsWithDemand, type IngredientWithDemand } from '../lib/stock'
import { supabase } from '../lib/supabase'
import type { StockMovement } from '../lib/types'
import { formatQty, fromBulk, UNITS } from '../lib/units'

const REASONS: Record<StockMovement['reason'], string> = {
  order: 'Order',
  order_undone: 'Order undone',
  restock: 'Restock',
  adjustment: 'Adjustment',
}

const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time

export default function IngredientDetail() {
  const { id } = useParams()
  const [ingredient, setIngredient] = useState<IngredientWithDemand | null>(null)
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [panel, setPanel] = useState<'restock' | 'adjust' | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Bumped after a change to reload.
  const [version, setVersion] = useState(0)

  useEffect(() => {
    Promise.all([
      loadIngredientsWithDemand({ id: id! }),
      supabase
        .from('stock_movements')
        .select('*, orders(number)')
        .eq('ingredient_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]).then(([ingRes, movRes]) => {
      if (ingRes.error) return setError(ingRes.error)
      if (movRes.error) return setError(movRes.error.message)
      setIngredient(ingRes.data![0] ?? null)
      setMovements(movRes.data as StockMovement[])
    })
  }, [id, version])

  if (!ingredient) return error ? <ErrorMessage message={error} /> : <p className="text-stone-500">Loading…</p>

  const unit = UNITS[ingredient.unit]
  const done = () => {
    setPanel(null)
    setVersion((v) => v + 1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{ingredient.name}</h2>
        <Link to={`/inventory/${ingredient.id}/edit`} className="text-brand-600">Edit</Link>
      </div>

      <div className="card space-y-1">
        <Row label="In stock" value={formatQty(ingredient.current_stock, ingredient.unit)} bold />
        {ingredient.needed > 0 && (
          <>
            <Row label="Needed for active orders" value={formatQty(ingredient.needed, ingredient.unit)} />
            <Row label="Left after those orders" value={formatQty(ingredient.projected, ingredient.unit)} />
          </>
        )}
        <Row label="Warn at" value={formatQty(ingredient.low_stock_threshold, ingredient.unit)} />
        <Row label="Cost" value={ingredient.cost_per_unit > 0 ? `${formatMoney(ingredient.cost_per_unit * unit.factor)} per ${unit.bulk}` : 'Not set'} />
        {ingredient.isLow && <p className="pt-2 font-medium text-red-600">⚠️ Running low — time to restock.</p>}
      </div>

      <ErrorMessage message={error} />

      {panel === null && (
        <div className="flex gap-3">
          <button onClick={() => setPanel('restock')} className="btn-primary flex-1">Restock</button>
          <button onClick={() => setPanel('adjust')} className="btn-secondary flex-1">Adjust</button>
        </div>
      )}
      {panel === 'restock' && <RestockPanel ingredient={ingredient} onDone={done} onCancel={() => setPanel(null)} />}
      {panel === 'adjust' && <AdjustPanel ingredient={ingredient} onDone={done} onCancel={() => setPanel(null)} />}

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">History</h3>
        {movements.length === 0 ? (
          <p className="card text-stone-500">No changes yet.</p>
        ) : (
          <ul className="card divide-y divide-stone-100 p-0 dark:divide-stone-800">
            {movements.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-4 py-2">
                <div>
                  <p className="font-medium">
                    {REASONS[m.reason]}
                    {m.orders && (
                      <Link to={`/orders/${m.order_id}`} className="text-brand-600"> #{m.orders.number}</Link>
                    )}
                  </p>
                  <p className="text-xs text-stone-500">
                    {formatDate(m.created_at)}, {formatTime(m.created_at)}
                    {m.note ? ` · ${m.note}` : ''}
                  </p>
                </div>
                <span className={`font-semibold ${m.change < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {m.change > 0 ? '+' : '−'}{formatQty(Math.abs(m.change), ingredient.unit)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

type PanelProps = { ingredient: IngredientWithDemand; onDone: () => void; onCancel: () => void }

function RestockPanel({ ingredient, onDone, onCancel }: PanelProps) {
  const unit = UNITS[ingredient.unit]
  const [quantity, setQuantity] = useState('')
  const [cost, setCost] = useState('')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const perUnit = Number(quantity) > 0 && Number(cost) > 0 ? Number(cost) / Number(quantity) : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('restock_ingredient', {
      p_ingredient_id: ingredient.id,
      p_quantity: fromBulk(Number(quantity), ingredient.unit),
      p_total_cost: Number(cost),
      p_date: date,
      p_note: note.trim() || null,
    })
    setBusy(false)
    if (error) return setError(error.message)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <h3 className="font-semibold">Restock</h3>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-sm text-stone-500">Bought ({unit.bulk})</span>
          <input required autoFocus type="number" inputMode="decimal" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-stone-500">Total paid (Rs)</span>
          <input required type="number" inputMode="decimal" min="0" step="any" value={cost} onChange={(e) => setCost(e.target.value)} className="input" />
        </label>
      </div>
      {perUnit !== null && <p className="text-sm text-stone-500">= {formatMoney(perUnit)} per {unit.bulk}. This becomes the new cost.</p>}
      <label className="block">
        <span className="mb-1 block text-sm text-stone-500">Date</span>
        <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
      </label>
      <input placeholder="Note (optional), e.g. shop name" value={note} onChange={(e) => setNote(e.target.value)} className="input" />
      <ErrorMessage message={error} />
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={busy} className="btn-primary flex-1">{busy ? 'Saving…' : 'Add stock'}</button>
      </div>
      <p className="text-xs text-stone-500">This is also recorded as an expense.</p>
    </form>
  )
}

function AdjustPanel({ ingredient, onDone, onCancel }: PanelProps) {
  const unit = UNITS[ingredient.unit]
  const [mode, setMode] = useState<'remove' | 'count'>('remove')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const value = fromBulk(Number(amount), ingredient.unit)
    const { error } = await supabase.rpc('adjust_stock', {
      p_ingredient_id: ingredient.id,
      p_change: mode === 'remove' ? -value : null,
      p_new_stock: mode === 'count' ? value : null,
      p_note: note.trim() || (mode === 'remove' ? 'Wasted' : 'Recount'),
    })
    setBusy(false)
    if (error) return setError(error.message)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <h3 className="font-semibold">Adjust stock</h3>
      <div className="grid grid-cols-2 rounded-xl bg-stone-200 p-1 dark:bg-stone-800">
        {(['remove', 'count'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg py-1.5 text-sm font-medium ${mode === m ? 'bg-white shadow-sm dark:bg-stone-900' : 'text-stone-500'}`}
          >
            {m === 'remove' ? 'Wasted / used' : 'Actual count'}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="mb-1 block text-sm text-stone-500">
          {mode === 'remove' ? `Amount to remove (${unit.bulk})` : `How much is there now? (${unit.bulk})`}
        </span>
        <input required autoFocus type="number" inputMode="decimal" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" />
      </label>
      <input placeholder={mode === 'remove' ? 'Reason, e.g. spoiled, staff meal' : 'Note (optional)'} value={note} onChange={(e) => setNote(e.target.value)} className="input" />
      <ErrorMessage message={error} />
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={busy} className="btn-primary flex-1">{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  )
}
