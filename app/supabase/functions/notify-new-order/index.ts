// Sends a push notification to every staff phone when a website order arrives, and reminders
// while nobody has accepted it. Called by the orders_notify_new_website_order trigger and the
// website-order-reminders cron job (via pg_net). Safe to call by anyone: the database only hands
// out an alert when one is actually due.
import { createClient } from 'npm:@supabase/supabase-js@2.109.0'
import webpush from 'npm:web-push@3.6.7'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

// Regional formatting; set these as function secrets to match brand.json (defaults: Pakistan).
const LOCALE = Deno.env.get('LOCALE') ?? 'en-PK'
const CURRENCY = Deno.env.get('CURRENCY_SYMBOL') ?? 'Rs'
const money = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })
const time = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit', timeZone: Deno.env.get('TIME_ZONE') ?? 'Asia/Karachi' })

type Claimed = {
  id: string
  number: number
  code: string | null
  customer: string | null
  delivery_at: string
  items: number
  total: number
  reminder: number // 0 = first alert, 1–5 = reminders
  waiting_minutes: number
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const { order_id } = await req.json().catch(() => ({}))
  if (typeof order_id !== 'string') return new Response('order_id required', { status: 400 })

  const { data: order, error } = await supabase.rpc('claim_order_notification', { p_order_id: order_id })
  if (error) {
    console.error('claim failed', error)
    return new Response('error', { status: 500 })
  }
  if (!order) return new Response('nothing to send')

  const o = order as Claimed
  const payload = JSON.stringify({
    title:
      !o.reminder
        ? `🔔 New website order ${o.code ?? ''} #${o.number}`
        : `⏰ Still waiting: ${o.code ?? 'order'} #${o.number} (${o.waiting_minutes} min)`,
    body: `${o.customer ?? 'Customer'} · ${CURRENCY} ${money.format(o.total)} · ${o.items} item${o.items === 1 ? '' : 's'} · for ${time.format(new Date(o.delivery_at))}`,
    url: `/orders/${o.id}`,
    tag: `order-${o.id}`,
  })

  const { data: subs, error: subsError } = await supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth')
  if (subsError) {
    console.error('loading subscriptions failed', subsError)
    return new Response('error', { status: 500 })
  }

  let sent = 0
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60, urgency: 'high' },
        )
        sent++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        // 404/410: the phone turned notifications off or the app was removed.
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', s.id)
        } else {
          console.error('push failed', status, err)
        }
      }
    }),
  )

  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } })
})
