import type { ExpenseCategory } from './types'
import brand from '../brand'

export const EXPENSE_CATEGORIES: Record<ExpenseCategory, string> = {
  ingredients: 'Ingredients',
  packaging: 'Packaging',
  other: 'Other',
}

const dayFormat = new Intl.DateTimeFormat(brand.locale, { weekday: 'short', day: 'numeric', month: 'short' })

/** Formats a "YYYY-MM-DD" date column without timezone shifts. */
export function formatDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return dayFormat.format(new Date(y, m - 1, d))
}
