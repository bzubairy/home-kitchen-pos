// Per-device conveniences only (cart, saved details, recent orders).
// Storage can be unavailable (private mode, blocked), so every access is guarded.

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore: the site still works without storage.
  }
}

export type SavedDetails = { name: string; phone: string; address: string }
export type RecentOrder = { token: string; code?: string | null; placedAt: string }

export const DETAILS_KEY = 'hkpos.details'
export const RECENT_KEY = 'hkpos.recentOrders'
export const CART_KEY = 'hkpos.cart'

export function rememberOrder(order: RecentOrder) {
  const recent = load<RecentOrder[]>(RECENT_KEY, []).filter((o) => o.token !== order.token)
  save(RECENT_KEY, [order, ...recent].slice(0, 5))
}
