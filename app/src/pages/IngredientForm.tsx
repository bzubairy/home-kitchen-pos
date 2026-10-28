import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import ErrorMessage from '../components/ErrorMessage'
import { supabase } from '../lib/supabase'
import type { Unit } from '../lib/types'
import { fromBulk, toBulk, UNITS } from '../lib/units'
import brand from '../brand'

export default function IngredientForm() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [unit, setUnit] = useState<Unit>('g')
  const [isPackaging, setIsPackaging] = useState(false)
  const [roundUp, setRoundUp] = useState(false)
  const [isActive, setIsActive] = useState(true)
  // Stock, threshold and cost are edited in bulk units (kg, litre, pcs).
  const [stock, setStock] = useState('0')
  const [threshold, setThreshold] = useState('0')
  const [cost, setCost] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isNew) return
    supabase
      .from('ingredients')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) return setError(error.message)
        setName(data.name)
        setUnit(data.unit)
        setIsPackaging(data.is_packaging)
        setRoundUp(data.round_up_per_order)
        setIsActive(data.is_active)
        setThreshold(String(toBulk(data.low_stock_threshold, data.unit)))
        setCost(String(data.cost_per_unit * UNITS[data.unit as Unit].factor))
      })
  }, [id, isNew])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const row = {
      name: name.trim(),
      unit,
      is_packaging: isPackaging,
      round_up_per_order: roundUp,
      is_active: isActive,
      low_stock_threshold: fromBulk(Number(threshold), unit),
      cost_per_unit: Number(cost) / UNITS[unit].factor,
    }
    // After creation, stock only changes through Restock/Adjust so it stays in the history.
    const { data, error } = isNew
      ? await supabase.from('ingredients').insert({ ...row, current_stock: fromBulk(Number(stock), unit) }).select('id').single()
      : await supabase.from('ingredients').update(row).eq('id', id).select('id').single()
    setBusy(false)
    if (error) return setError(error.message)
    navigate(`/inventory/${data.id}`, { replace: true })
  }

  const bulk = UNITS[unit].bulk

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold">{isNew ? 'New ingredient' : 'Edit ingredient'}</h2>

      <div className="card space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm text-stone-500">Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-stone-500">Recipe unit</span>
          {/* Changing the unit later would misread existing stock and recipes. */}
          <select disabled={!isNew} value={unit} onChange={(e) => setUnit(e.target.value as Unit)} className="input disabled:opacity-60">
            {Object.entries(UNITS).map(([key, u]) => (
              <option key={key} value={key}>{u.label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={isPackaging} onChange={(e) => setIsPackaging(e.target.checked)} className="h-5 w-5 accent-brand-600" />
          <span>This is packaging (box, cup, straw…)</span>
        </label>
        {isPackaging && (
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={roundUp} onChange={(e) => setRoundUp(e.target.checked)} className="mt-0.5 h-5 w-5 accent-brand-600" />
            <span>
              Shared within an order, rounded up
              <span className="block text-sm text-stone-500">For bags: use ½ in recipes if a bag holds 2 items.</span>
            </span>
          </label>
        )}
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-5 w-5 accent-brand-600" />
          <span>In use</span>
        </label>
      </div>

      <div className="card space-y-3">
        {isNew && (
          <label className="block">
            <span className="mb-1 block text-sm text-stone-500">Starting stock ({bulk})</span>
            <input type="number" inputMode="decimal" step="any" value={stock} onChange={(e) => setStock(e.target.value)} className="input" />
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-sm text-stone-500">Warn me when stock falls to ({bulk})</span>
          <input type="number" inputMode="decimal" min="0" step="any" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-stone-500">Cost ({brand.currencySymbol} per {bulk})</span>
          <input type="number" inputMode="decimal" min="0" step="any" value={cost} onChange={(e) => setCost(e.target.value)} className="input" />
        </label>
      </div>

      <ErrorMessage message={error} />
      <div className="flex gap-3">
        <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={busy} className="btn-primary flex-1">{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  )
}
