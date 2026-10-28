import { useEffect, useState } from 'react'
import { isAcknowledged, onAcknowledged } from './acknowledged'
import { playAlarm, setupAlarmAudio } from './alarm'
import { supabase } from './supabase'

const POLL_MS = 20_000
const RING_EVERY_MS = 6_000

export type NewOrderSummary = {
  id: string
  number: number
  code: string | null
  delivery_at: string
  discount: number
  customers: { name: string } | null
  order_items: { quantity: number; unit_price: number }[]
}

/**
 * While the app is open, watches for website orders waiting for confirmation.
 * Returns all of them, plus the ones this phone hasn't looked at yet. The alarm
 * rings every few seconds while there are unseen ones.
 */
export function useNewOrderAlerts() {
  const [orders, setOrders] = useState<NewOrderSummary[]>([])
  const [, setAckVersion] = useState(0)

  // Poll for new orders while the app is visible.
  useEffect(() => {
    let timer: number | undefined

    async function check() {
      window.clearTimeout(timer)
      if (document.visibilityState === 'visible') {
        const { data, error } = await supabase
          .from('orders')
          .select('id, number, code, delivery_at, discount, customers(name), order_items(quantity, unit_price)')
          .eq('status', 'new')
          .order('created_at')
        if (!error) setOrders(data as unknown as NewOrderSummary[])
      }
      timer = window.setTimeout(check, POLL_MS)
    }

    check()
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])

  // Re-render when an order is acknowledged (opened or silenced).
  useEffect(() => onAcknowledged(() => setAckVersion((v) => v + 1)), [])
  useEffect(() => setupAlarmAudio(), [])

  const unseen = orders.filter((o) => !isAcknowledged(o.id))

  // Ring now and every few seconds until every new order has been seen.
  useEffect(() => {
    if (unseen.length === 0) return
    const ring = () => document.visibilityState === 'visible' && playAlarm()
    ring()
    const timer = window.setInterval(ring, RING_EVERY_MS)
    return () => window.clearInterval(timer)
  }, [unseen.length])

  return { count: orders.length, unseen }
}
