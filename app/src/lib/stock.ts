import { supabase } from './supabase'
import type { Ingredient } from './types'

export type IngredientWithDemand = Ingredient & {
  /** Amount still needed by pending/preparing orders (base units). */
  needed: number
  /** Stock left once active orders are made. */
  projected: number
  isLow: boolean
}

/** Loads ingredients with what active orders still need and whether they're running low. */
export async function loadIngredientsWithDemand(filter?: { id: string }) {
  let query = supabase.from('ingredients').select('*').order('is_packaging').order('name')
  if (filter) query = query.eq('id', filter.id)
  const [ingRes, demandRes] = await Promise.all([query, supabase.from('ingredient_demand').select('*')])
  if (ingRes.error || demandRes.error) {
    return { data: null, error: (ingRes.error ?? demandRes.error)!.message }
  }

  const needed = Object.fromEntries(demandRes.data.map((d) => [d.ingredient_id, Number(d.needed)]))
  const data: IngredientWithDemand[] = (ingRes.data as Ingredient[]).map((ing) => {
    const need = needed[ing.id] ?? 0
    const projected = ing.current_stock - need
    return { ...ing, needed: need, projected, isLow: ing.is_active && projected <= ing.low_stock_threshold }
  })
  return { data, error: null }
}
