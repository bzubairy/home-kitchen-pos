import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { CART_KEY, load, save } from './storage'

type Cart = Record<string, number> // menu item id → quantity

type CartState = {
  cart: Cart
  change: (id: string, delta: number) => void
  clear: () => void
}

const CartContext = createContext<CartState | null>(null)

const MAX_PER_ITEM = 20

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(() => load<Cart>(CART_KEY, {}))

  useEffect(() => save(CART_KEY, cart), [cart])

  function change(id: string, delta: number) {
    setCart((c) => {
      const next = Math.min(Math.max((c[id] ?? 0) + delta, 0), MAX_PER_ITEM)
      const copy = { ...c }
      if (next === 0) delete copy[id]
      else copy[id] = next
      return copy
    })
  }

  return <CartContext.Provider value={{ cart, change, clear: () => setCart({}) }}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
