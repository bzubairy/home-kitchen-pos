import { Link } from 'react-router'
import Footer from '../components/Footer'
import QtyControl from '../components/QtyControl'
import ShopBanner from '../components/ShopBanner'
import { useCart } from '../lib/cart'
import { formatMoney } from '../lib/format'
import { load, RECENT_KEY, type RecentOrder } from '../lib/storage'
import { useMenu } from '../lib/useMenu'
import brand from '../brand'


// Menu order on the site (brand.json); any other category goes at the end.
const CATEGORY_ORDER = brand.categoryOrder
const emojiFor = (category: string) => brand.categoryEmoji[category] ?? brand.defaultEmoji

const categoryRank = (c: string) => {
  const i = CATEGORY_ORDER.indexOf(c)
  return i === -1 ? CATEGORY_ORDER.length : i
}

export default function MenuPage() {
  const { menu, error, reload } = useMenu()
  const { cart, change } = useCart()
  const recent = load<RecentOrder[]>(RECENT_KEY, [])

  const categories = menu
    ? [...new Set(menu.items.map((i) => i.category))].sort((a, b) => categoryRank(a) - categoryRank(b))
    : []
  const cartItems = menu ? menu.items.filter((i) => cart[i.id]) : []
  const count = cartItems.reduce((sum, i) => sum + cart[i.id], 0)
  const total = cartItems.reduce((sum, i) => sum + cart[i.id] * i.price, 0)

  return (
    <div className="mx-auto max-w-xl px-4 pb-28">
      <header className="flex flex-col items-center pt-6 text-center">
        <img src="/logo-256.png" alt={brand.name} width={128} height={128} className="h-32 w-32 drop-shadow-md" />
        <h1 className="heading mt-3 text-4xl">{brand.name}</h1>
        {brand.tagline && <p className="font-display text-lg text-orange">{brand.tagline}</p>}
        {menu && (
          <div className="mt-3 space-y-2">
            <ShopBanner shop={menu.shop} />
            <p className="text-sm text-ink-soft">🛵 Free delivery in {menu.shop.delivery_area}</p>
          </div>
        )}
      </header>

      {recent.length > 0 && (
        <div className="mt-5 space-y-2">
          {recent.slice(0, 2).map((o) => (
            <Link key={o.token} to={`/order/${o.token}`} className="card flex items-center justify-between py-3">
              <span>Your order {o.code && <strong>{o.code}</strong>}</span>
              <span className="font-display font-semibold text-orange">Track →</span>
            </Link>
          ))}
        </div>
      )}

      {error && (
        <div className="card mt-6 text-center">
          <p className="mb-3">{error}</p>
          <button onClick={reload} className="btn-secondary">Try again</button>
        </div>
      )}
      {!menu && !error && <p className="mt-10 text-center text-ink-soft">Loading the menu…</p>}

      {categories.length > 1 && (
        <nav className="sticky top-0 z-10 -mx-4 mt-6 flex gap-2 overflow-x-auto bg-cream/95 px-4 py-3 backdrop-blur" aria-label="Menu categories">
          {categories.map((c) => (
            <a key={c} href={`#${c}`} className="shrink-0 rounded-full border border-cream-deep bg-white px-4 py-1.5 font-display font-semibold">
              {emojiFor(c)} {c}
            </a>
          ))}
        </nav>
      )}

      {categories.map((category) => (
        <section key={category} id={category} className="scroll-mt-16 pt-4">
          <h2 className="heading mb-3 text-2xl">{emojiFor(category)} {category}</h2>
          <ul className="space-y-3">
            {menu!.items
              .filter((i) => i.category === category)
              .map((item) => (
                <li key={item.id} className={`card flex items-center gap-3 ${item.sold_out ? 'opacity-60' : ''}`}>
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-mustard/20 text-3xl" aria-hidden>
                    {emojiFor(category)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg font-semibold leading-tight">{item.name}</p>
                    <p className="text-ink-soft">{formatMoney(item.price)}</p>
                  </div>
                  {item.sold_out ? (
                    <span className="rounded-full bg-ketchup/10 px-3 py-1 text-sm font-semibold text-ketchup">Sold out</span>
                  ) : (
                    <QtyControl name={item.name} qty={cart[item.id] ?? 0} onChange={(d) => change(item.id, d)} />
                  )}
                </li>
              ))}
          </ul>
        </section>
      ))}

      <Footer whatsapp={menu?.shop.contact_whatsapp} />

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <Link to="/checkout" className="mx-auto flex max-w-xl items-center justify-between rounded-full bg-ink px-6 py-4 font-display text-lg font-semibold text-mustard shadow-xl">
            <span>{count} item{count === 1 ? '' : 's'} · {formatMoney(total)}</span>
            <span>Checkout →</span>
          </Link>
        </div>
      )}
    </div>
  )
}
