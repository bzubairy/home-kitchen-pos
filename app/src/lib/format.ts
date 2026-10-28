import brand from '../brand'

const money = new Intl.NumberFormat(brand.locale, { maximumFractionDigits: 0 })

/** Formats an amount in the business's currency, e.g. 1250 → "Rs 1,250". */
export function formatMoney(amount: number): string {
  return `${brand.currencySymbol} ${money.format(Math.round(amount))}`
}
