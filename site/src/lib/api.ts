const URL = import.meta.env.VITE_SUPABASE_URL as string
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export type Shop = {
  open: boolean
  taking_orders: boolean
  opening_time: string // "HH:MM", Pakistan time
  last_order_time: string
  closing_time: string
  min_lead_minutes: number
  now: string // "YYYY-MM-DDTHH:MM", Pakistan time (server clock)
  wallet_number: string
  contact_whatsapp: string
  delivery_area: string
}

export type MenuItem = { id: string; name: string; category: string; price: number; sold_out: boolean }

export type PublicMenu = { shop: Shop; items: MenuItem[] }

export type OrderStatus = {
  number: number
  code: string | null
  status: 'new' | 'pending' | 'preparing' | 'delivered' | 'cancelled'
  delivery_at: string
  requested_payment: 'cash' | 'wallet'
  cancel_reason: string | null
  total: number
  items: { name: string; quantity: number; price: number }[]
  wallet_number: string
  contact_whatsapp: string
}

export type OrderPayload = {
  name: string
  phone: string
  address: string
  notes: string
  delivery_time: string | null // "HH:MM" today, or null for ASAP
  payment: 'cash' | 'wallet'
  items: { menu_item_id: string; quantity: number }[]
  company: string // honeypot, must stay empty
}

/** Calls one of the public database functions. Throws with the server's message on failure. */
async function rpc<T>(fn: string, body: object = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Could not connect. Please check your internet and try again.')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.message ?? 'Something went wrong. Please try again.')
  return data as T
}

export const getMenu = () => rpc<PublicMenu>('get_public_menu')
export const placeOrder = (payload: OrderPayload) => rpc<{ token: string; number: number }>('place_website_order', { payload })
export const getOrderStatus = (token: string) => rpc<OrderStatus | null>('get_order_status', { p_token: token })
