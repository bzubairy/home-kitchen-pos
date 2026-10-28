import type { Unit } from './types'
import brand from '../brand'

/**
 * Recipes and the database use base units (g, ml, pcs). People buy and count
 * stock in bulk units (kg, litre, pcs), so forms convert between the two.
 */
export const UNITS: Record<Unit, { label: string; bulk: string; factor: number }> = {
  g: { label: 'grams (g)', bulk: 'kg', factor: 1000 },
  ml: { label: 'millilitres (ml)', bulk: 'litre', factor: 1000 },
  pcs: { label: 'pieces (pcs)', bulk: 'pc', factor: 1 },
}

export const toBulk = (qty: number, unit: Unit) => qty / UNITS[unit].factor
export const fromBulk = (qty: number, unit: Unit) => qty * UNITS[unit].factor

const num = new Intl.NumberFormat(brand.locale, { maximumFractionDigits: 2 })

/** Formats a base-unit quantity for display, e.g. 2500 g → "2.5 kg". */
export function formatQty(qty: number, unit: Unit): string {
  if (unit !== 'pcs' && Math.abs(qty) >= 1000) {
    return `${num.format(toBulk(qty, unit))} ${UNITS[unit].bulk}`
  }
  return `${num.format(qty)} ${unit}`
}
