import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import ErrorMessage from '../components/ErrorMessage'
import { supabase } from '../lib/supabase'
import type { Customer } from '../lib/types'

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('customers')
      .select('*')
      .order('name')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setCustomers(data)
        setLoading(false)
      })
  }, [])

  const term = search.trim().toLowerCase()
  const shown = customers.filter(
    (c) => !term || c.name.toLowerCase().includes(term) || c.phone?.includes(term),
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Customers</h2>
        <Link to="/customers/new" className="btn-primary py-2">+ Add</Link>
      </div>
      <input type="search" placeholder="Search name or phone" value={search} onChange={(e) => setSearch(e.target.value)} className="input" />
      <ErrorMessage message={error} />
      {loading && <p className="text-stone-500">Loading…</p>}
      {!loading && !error && shown.length === 0 && <p className="card text-stone-500">No customers found.</p>}
      {shown.length > 0 && (
        <ul className="card divide-y divide-stone-100 p-0 dark:divide-stone-800">
          {shown.map((c) => (
            <li key={c.id}>
              <Link to={`/customers/${c.id}`} className="flex justify-between px-4 py-3">
                <span className="font-medium">{c.name}</span>
                <span className="text-stone-500">{c.phone}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
