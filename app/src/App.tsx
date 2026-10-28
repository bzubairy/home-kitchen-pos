import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import Layout from './components/Layout'
import { isSupabaseConfigured } from './lib/supabase'
import CustomerForm from './pages/CustomerForm'
import Customers from './pages/Customers'
import ExpenseForm from './pages/ExpenseForm'
import Expenses from './pages/Expenses'
import Home from './pages/Home'
import IngredientDetail from './pages/IngredientDetail'
import IngredientForm from './pages/IngredientForm'
import Ingredients from './pages/Ingredients'
import Login from './pages/Login'
import Menu from './pages/Menu'
import MenuItemForm from './pages/MenuItemForm'
import More from './pages/More'
import OrderDetail from './pages/OrderDetail'
import OrderForm from './pages/OrderForm'
import Orders from './pages/Orders'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

function AppRoutes() {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center text-stone-500">Loading…</div>
  }
  if (!session) return <Login />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/new" element={<OrderForm key="new" />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="orders/:id/edit" element={<OrderForm />} />
        <Route path="inventory" element={<Ingredients />} />
        <Route path="inventory/new" element={<IngredientForm />} />
        <Route path="inventory/:id" element={<IngredientDetail />} />
        <Route path="inventory/:id/edit" element={<IngredientForm />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="expenses/new" element={<ExpenseForm key="new" />} />
        <Route path="expenses/:id" element={<ExpenseForm />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/new" element={<CustomerForm key="new" />} />
        <Route path="customers/:id" element={<CustomerForm />} />
        <Route path="menu" element={<Menu />} />
        <Route path="menu/new" element={<MenuItemForm />} />
        <Route path="menu/:id" element={<MenuItemForm />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="more" element={<More />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function SetupNeeded() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="card max-w-sm">
        <h1 className="mb-2 text-lg font-semibold">Supabase not configured</h1>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Copy <code>.env.example</code> to <code>.env.local</code>, add your Supabase URL and key,
          then restart the dev server.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  if (!isSupabaseConfigured) return <SetupNeeded />

  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
