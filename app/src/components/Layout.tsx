import { NavLink, Outlet } from 'react-router'
import { useNewOrderAlerts } from '../lib/useNewOrderAlerts'
import NewOrderAlarm from './NewOrderAlarm'

const tabs = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/orders', label: 'Orders', icon: '🧾', end: true },
  { to: '/orders/new', label: 'New', icon: '➕' },
  { to: '/inventory', label: 'Stock', icon: '📦' },
  { to: '/more', label: 'More', icon: '☰' },
]

export default function Layout() {
  const { count: newOrders, unseen } = useNewOrderAlerts()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 bg-brand-600 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white shadow">
        <h1 className="text-lg font-semibold">Kitchen Manager</h1>
      </header>

      <NewOrderAlarm orders={unseen} />

      <main className="flex-1 px-4 py-4 pb-24">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-stone-800 dark:bg-stone-900">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-xs ${
                isActive ? 'font-semibold text-brand-600' : 'text-stone-500'
              }`
            }
          >
            <span className="relative text-xl leading-none">
              {tab.icon}
              {tab.to === '/orders' && newOrders > 0 && (
                <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-4 text-white">
                  {newOrders}
                </span>
              )}
            </span>
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
