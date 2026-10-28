import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { CartProvider } from './lib/cart'
import CheckoutPage from './pages/CheckoutPage'
import MenuPage from './pages/MenuPage'
import OrderPage from './pages/OrderPage'

export default function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route index element={<MenuPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="order/:token" element={<OrderPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </CartProvider>
  )
}
