import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Order } from './types'

type Names = Record<string, string> // login id → staff name

let cache: Promise<Names> | null = null

/** Staff names, loaded once per app session (there are only a couple of staff). */
export function loadStaffNames(): Promise<Names> {
  cache ??= Promise.resolve(supabase.from('staff_profiles').select('user_id, name')).then(({ data }) =>
    Object.fromEntries((data ?? []).map((p) => [p.user_id as string, p.name as string])),
  )
  return cache
}

export function forgetStaffNames() {
  cache = null
}

export function useStaffNames(): Names {
  const [names, setNames] = useState<Names>({})
  useEffect(() => {
    loadStaffNames().then(setNames)
  }, [])
  return names
}

/** Who took the order: a staff name, or "Website" for orders customers placed themselves. */
export function takenBy(order: Pick<Order, 'channel' | 'created_by'>, names: Names): string | null {
  if (order.channel === 'website') return 'Website'
  if (!order.created_by) return null
  return names[order.created_by] ?? 'Staff'
}
