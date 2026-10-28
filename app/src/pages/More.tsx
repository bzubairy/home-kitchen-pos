import { Link } from 'react-router'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'

const links = [
  { to: '/expenses', label: 'Expenses' },
  { to: '/customers', label: 'Customers' },
  { to: '/menu', label: 'Menu & recipes' },
  { to: '/reports', label: 'Reports' },
  { to: '/settings', label: 'Settings' },
]

export default function More() {
  const { session } = useAuth()

  return (
    <div className="space-y-4">
      <ul className="card divide-y divide-stone-100 p-0 dark:divide-stone-800">
        {links.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className="flex justify-between px-4 py-3">
              {link.label}
              <span className="text-stone-400">›</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="card">
        <p className="mb-3 text-sm text-stone-500">Signed in as {session?.user.email}</p>
        <button onClick={() => supabase.auth.signOut()} className="btn-secondary w-full">
          Sign out
        </button>
      </div>
    </div>
  )
}
