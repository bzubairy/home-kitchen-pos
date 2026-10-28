// Business branding and regional settings, shared by the staff app and the customer site.
// Edit brand.json at the root of the repository to make this your own.
import brand from '../../brand.json'

export type Brand = {
  name: string
  tagline: string
  /** Instagram username without @; leave empty to hide Instagram everywhere. */
  instagramHandle: string
  currencySymbol: string
  /** Formatting for numbers and dates, e.g. "en-PK", "en-IN", "en-GB". */
  locale: string
  /** IANA time zone, e.g. "Asia/Karachi". Must match settings.time_zone in the database. */
  timeZone: string
  /** Country calling code without +, used for WhatsApp links (local numbers starting with 0). */
  phoneCountryCode: string
  /** Mobile wallet customers can pay with, e.g. "JazzCash", "Easypaisa". */
  walletName: string
  /** WhatsApp messages to customers. Placeholders: {firstName}, {business}, {code}. */
  messages: { preparing: string; delivered: string }
  categoryOrder: string[]
  categoryEmoji: Record<string, string>
  defaultEmoji: string
}

export default brand as Brand

export const instagramUrl = (b: Brand) => (b.instagramHandle ? `https://www.instagram.com/${b.instagramHandle}` : '')
