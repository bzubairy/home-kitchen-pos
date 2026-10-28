import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import ErrorMessage from '../components/ErrorMessage'
import { formatMoney } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Ingredient } from '../lib/types'

type LineDraft = { ingredient_id: string; quantity: string }

export default function MenuItemForm() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [foodpandaPrice, setFoodpandaPrice] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [lines, setLines] = useState<LineDraft[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    async function load() {
      const [ingRes, catRes] = await Promise.all([
        supabase.from('ingredients').select('*').order('name'),
        supabase.from('menu_items').select('category'),
      ])
      if (ingRes.error || catRes.error) return setError((ingRes.error ?? catRes.error)!.message)
      setIngredients(ingRes.data)
      setCategories([...new Set(catRes.data.map((c) => c.category as string))].sort())

      if (isNew) return
      const [itemRes, linesRes] = await Promise.all([
        supabase.from('menu_items').select('*').eq('id', id).single(),
        supabase.from('recipe_lines').select('*').eq('menu_item_id', id),
      ])
      if (itemRes.error || linesRes.error) return setError((itemRes.error ?? linesRes.error)!.message)
      setName(itemRes.data.name)
      setCategory(itemRes.data.category)
      setPrice(String(itemRes.data.price))
      setFoodpandaPrice(itemRes.data.foodpanda_price == null ? '' : String(itemRes.data.foodpanda_price))
      setIsActive(itemRes.data.is_active)
      setLines(linesRes.data.map((l) => ({ ingredient_id: l.ingredient_id, quantity: String(l.quantity) })))
    }
    load()
  }, [id, isNew])

  const byId = Object.fromEntries(ingredients.map((i) => [i.id, i]))
  const recipeCost = lines.reduce((sum, l) => {
    const ing = byId[l.ingredient_id]
    return ing ? sum + Number(l.quantity || 0) * ing.cost_per_unit : sum
  }, 0)

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const filled = lines.filter((l) => l.ingredient_id && Number(l.quantity) > 0)
    if (new Set(filled.map((l) => l.ingredient_id)).size !== filled.length) {
      return setError('Each ingredient can only appear once in a recipe.')
    }
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('save_menu_item', {
      item: { id: id ?? null, name: name.trim(), category: category.trim(), price: Number(price), foodpanda_price: foodpandaPrice === '' ? null : Number(foodpandaPrice), is_active: isActive },
      lines: filled.map((l) => ({ ingredient_id: l.ingredient_id, quantity: Number(l.quantity) })),
    })
    setBusy(false)
    if (error) return setError(error.message)
    navigate('/menu')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold">{isNew ? 'New menu item' : 'Edit menu item'}</h2>

      <div className="card space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm text-stone-500">Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-stone-500">Category</span>
          <input required list="categories" value={category} onChange={(e) => setCategory(e.target.value)} className="input" />
          <datalist id="categories">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-stone-500">Price (Rs)</span>
          <input required type="number" inputMode="numeric" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-stone-500">Foodpanda price (Rs) — leave empty if same</span>
          <input type="number" inputMode="numeric" min="0" value={foodpandaPrice} onChange={(e) => setFoodpandaPrice(e.target.value)} className="input" />
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-5 w-5 accent-brand-600" />
          <span>Available (show when taking orders)</span>
        </label>
      </div>

      <div className="card space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="font-semibold">Recipe (for one item)</h3>
          <span className="text-sm text-stone-500">Cost {formatMoney(recipeCost)}</span>
        </div>
        {lines.map((line, index) => (
          <div key={index} className="flex items-center gap-2">
            <select
              value={line.ingredient_id}
              onChange={(e) => updateLine(index, { ingredient_id: e.target.value })}
              className="input min-w-0 flex-1 px-2"
            >
              <option value="">Ingredient…</option>
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>{ing.name}</option>
              ))}
            </select>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder="Qty"
              value={line.quantity}
              onChange={(e) => updateLine(index, { quantity: e.target.value })}
              className="input w-20 px-2"
            />
            <span className="w-8 text-sm text-stone-500">{byId[line.ingredient_id]?.unit ?? ''}</span>
            <button type="button" onClick={() => setLines(lines.filter((_, i) => i !== index))} className="px-1 text-xl text-stone-400" aria-label="Remove">
              ×
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setLines([...lines, { ingredient_id: '', quantity: '' }])} className="btn-secondary w-full py-2">
          + Add ingredient
        </button>
      </div>

      <ErrorMessage message={error} />
      <div className="flex gap-3">
        <button type="button" onClick={() => navigate('/menu')} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={busy} className="btn-primary flex-1">{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  )
}
