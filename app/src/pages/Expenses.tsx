import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import ErrorMessage from '../components/ErrorMessage'
import { EXPENSE_CATEGORIES, formatDay } from '../lib/expenses'
import { formatMoney } from '../lib/format'
import { supabase } from '../lib/supabase'
import type { Expense, ExpenseCategory } from '../lib/types'
import { formatQty } from '../lib/units'
import brand from '../brand'

const monthFormat = new Intl.DateTimeFormat(brand.locale, { month: 'long', year: 'numeric' })
const ymd = (d: Date) => d.toLocaleDateString('en-CA')
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)

export default function Expenses() {
  const [thisMonth] = useState(() => startOfMonth(new Date()))
  // First day of the month being viewed.
  const [month, setMonth] = useState(thisMonth)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const next = new Date(month.getFullYear(), month.getMonth() + 1, 1)
    supabase
      .from('expenses')
      .select('*, ingredients(name, unit)')
      .gte('date', ymd(month))
      .lt('date', ymd(next))
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setExpenses(data as Expense[])
        setLoading(false)
      })
  }, [month])

  function shiftMonth(delta: number) {
    setLoading(true)
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1))
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const byCategory = (Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]).map((c) => ({
    category: c,
    amount: expenses.filter((e) => e.category === c).reduce((sum, e) => sum + Number(e.amount), 0),
  }))
  const days = [...new Set(expenses.map((e) => e.date))]
  const isCurrentMonth = ymd(month) === ymd(thisMonth)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Expenses</h2>
        <Link to="/expenses/new" className="btn-primary py-2">+ Add</Link>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <button onClick={() => shiftMonth(-1)} className="px-3 text-xl text-stone-500" aria-label="Previous month">‹</button>
          <span className="font-semibold">{monthFormat.format(month)}</span>
          <button onClick={() => shiftMonth(1)} disabled={isCurrentMonth} className="px-3 text-xl text-stone-500 disabled:opacity-30" aria-label="Next month">›</button>
        </div>
        <p className="text-center text-2xl font-bold">{formatMoney(total)}</p>
        <div className="grid grid-cols-3 text-center text-sm">
          {byCategory.map((c) => (
            <div key={c.category}>
              <p className="text-stone-500">{EXPENSE_CATEGORIES[c.category]}</p>
              <p className="font-medium">{formatMoney(c.amount)}</p>
            </div>
          ))}
        </div>
      </div>

      <ErrorMessage message={error} />
      {loading && <p className="text-stone-500">Loading…</p>}
      {!loading && !error && expenses.length === 0 && <p className="card text-stone-500">No expenses this month.</p>}

      {!loading &&
        days.map((day) => (
          <section key={day}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">{formatDay(day)}</h3>
            <ul className="card divide-y divide-stone-100 p-0 dark:divide-stone-800">
              {expenses
                .filter((e) => e.date === day)
                .map((e) => (
                  <li key={e.id}>
                    <Link to={`/expenses/${e.id}`} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="font-medium">
                          {e.ingredients
                            ? `${e.ingredients.name}${e.quantity ? ` · ${formatQty(e.quantity, e.ingredients.unit)}` : ''}`
                            : e.notes || EXPENSE_CATEGORIES[e.category]}
                        </p>
                        <p className="text-sm text-stone-500">
                          {EXPENSE_CATEGORIES[e.category]}
                          {e.ingredients && e.notes ? ` · ${e.notes}` : ''}
                        </p>
                      </div>
                      <span className="font-semibold">{formatMoney(e.amount)}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}
    </div>
  )
}
