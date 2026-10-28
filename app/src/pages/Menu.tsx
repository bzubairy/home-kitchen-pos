import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import ErrorMessage from '../components/ErrorMessage'
import { formatMoney } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { MenuItem, MenuItemCost } from '../lib/types'

export default function Menu() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [costs, setCosts] = useState<Record<string, MenuItemCost>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('menu_items').select('*').order('category').order('sort_order').order('name'),
      supabase.from('menu_item_costs').select('*'),
    ]).then(([itemsRes, costsRes]) => {
      if (itemsRes.error || costsRes.error) {
        setError((itemsRes.error ?? costsRes.error)!.message)
      } else {
        setItems(itemsRes.data)
        setCosts(Object.fromEntries(costsRes.data.map((c) => [c.menu_item_id, c])))
      }
      setLoading(false)
    })
  }, [])

  const categories = [...new Set(items.map((i) => i.category))]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Menu & recipes</h2>
        <Link to="/menu/new" className="btn-primary py-2">+ Add item</Link>
      </div>
      <ErrorMessage message={error} />
      {loading && <p className="text-stone-500">Loading…</p>}
      {!loading && !error && items.length === 0 && (
        <p className="card text-stone-500">No menu items yet.</p>
      )}

      {categories.map((category) => (
        <section key={category}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">{category}</h3>
          <ul className="card divide-y divide-stone-100 p-0 dark:divide-stone-800">
            {items
              .filter((i) => i.category === category)
              .map((item) => {
                const cost = costs[item.id]
                const hasRecipe = cost && cost.recipe_cost > 0
                return (
                  <li key={item.id}>
                    <Link to={`/menu/${item.id}`} className="flex items-center justify-between px-4 py-3">
                      <div className={item.is_active ? '' : 'opacity-50'}>
                        <p className="font-medium">
                          {item.name}
                          {!item.is_active && <span className="ml-2 text-xs">(hidden)</span>}
                        </p>
                        <p className="text-sm text-stone-500">
                          {hasRecipe
                            ? `Cost ${formatMoney(cost.recipe_cost)} · Profit ${formatMoney(cost.margin)}`
                            : 'Cost unknown — set ingredient costs'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatMoney(item.price)}</p>
                        {item.foodpanda_price != null && (
                          <p className="text-xs text-pink-600">FP {formatMoney(item.foodpanda_price)}</p>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
          </ul>
        </section>
      ))}
    </div>
  )
}
