import { supabase } from './supabase'
import type { Channel, ExpenseCategory } from './types'

export type ReportSummary = {
  orders: number
  sales: number
  commission: number
  expenses: number
  expenses_by_category: Partial<Record<ExpenseCategory, number>>
  by_channel: { channel: Channel; orders: number; sales: number; commission: number }[]
  by_day: { day: string; orders: number; sales: number }[]
  items: { name: string; quantity: number; sales: number; cost: number }[]
}

/** Profit = sales − Foodpanda commission − expenses (ingredients and packaging bought). */
export const profitOf = (r: ReportSummary) => r.sales - r.commission - r.expenses

const ymd = (d: Date) => d.toLocaleDateString('en-CA')
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

export type PeriodKey = 'today' | 'week' | 'month' | 'last_month'

export const PERIODS: Record<PeriodKey, string> = {
  today: 'Today',
  week: 'This week',
  month: 'This month',
  last_month: 'Last month',
}

/** Date range [from, to) for a period; weeks start on Monday. */
export function periodRange(period: PeriodKey, now = new Date()): { from: string; to: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (period) {
    case 'today':
      return { from: ymd(today), to: ymd(addDays(today, 1)) }
    case 'week': {
      const monday = addDays(today, -((today.getDay() + 6) % 7))
      return { from: ymd(monday), to: ymd(addDays(monday, 7)) }
    }
    case 'month':
      return {
        from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)),
        to: ymd(new Date(today.getFullYear(), today.getMonth() + 1, 1)),
      }
    case 'last_month':
      return {
        from: ymd(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        to: ymd(new Date(today.getFullYear(), today.getMonth(), 1)),
      }
  }
}

export async function loadReport(period: PeriodKey) {
  const { from, to } = periodRange(period)
  const { data, error } = await supabase.rpc('report_summary', { p_from: from, p_to: to })
  if (error) return { data: null, error: error.message }
  return { data: data as ReportSummary, error: null }
}
