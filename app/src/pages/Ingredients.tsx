import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import ErrorMessage from '../components/ErrorMessage'
import { loadIngredientsWithDemand, type IngredientWithDemand } from '../lib/stock'
import { formatQty } from '../lib/units'

export default function Ingredients() {
  const [ingredients, setIngredients] = useState<IngredientWithDemand[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadIngredientsWithDemand().then(({ data, error }) => {
      if (error) setError(error)
      else setIngredients(data!)
      setLoading(false)
    })
  }, [])

  const groups = [
    { title: '⚠️ Running low', items: ingredients.filter((i) => i.isLow) },
    { title: 'Ingredients', items: ingredients.filter((i) => !i.isLow && !i.is_packaging) },
    { title: 'Packaging', items: ingredients.filter((i) => !i.isLow && i.is_packaging) },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Stock</h2>
        <Link to="/inventory/new" className="btn-primary py-2">+ Add</Link>
      </div>
      <ErrorMessage message={error} />
      {loading && <p className="text-stone-500">Loading…</p>}

      {groups.map(
        (group) =>
          group.items.length > 0 && (
            <section key={group.title}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">{group.title}</h3>
              <ul className="card divide-y divide-stone-100 p-0 dark:divide-stone-800">
                {group.items.map((ing) => (
                  <li key={ing.id}>
                    <Link to={`/inventory/${ing.id}`} className="flex items-center justify-between px-4 py-3">
                      <div className={ing.is_active ? '' : 'opacity-50'}>
                        <p className="font-medium">{ing.name}</p>
                        {ing.needed > 0 && (
                          <p className="text-sm text-stone-500">
                            {formatQty(ing.needed, ing.unit)} needed for active orders
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${ing.isLow ? 'text-red-600' : ''}`}>{formatQty(ing.current_stock, ing.unit)}</p>
                        {ing.needed > 0 && (
                          <p className="text-xs text-stone-500">→ {formatQty(ing.projected, ing.unit)} after</p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ),
      )}
    </div>
  )
}
