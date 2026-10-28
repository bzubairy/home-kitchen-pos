// Receipt printer settings are per phone (each phone may pair with a different printer).

export type PaperWidth = 58 | 80

const KEY = 'kitchen.receiptPaper'

export function getPaperWidth(): PaperWidth {
  try {
    return localStorage.getItem(KEY) === '80' ? 80 : 58
  } catch {
    return 58
  }
}

export function setPaperWidth(width: PaperWidth) {
  try {
    localStorage.setItem(KEY, String(width))
  } catch {
    // Falls back to 58 mm next time.
  }
}

/** Printable width inside the paper's margins. */
export const PRINT_AREA_MM: Record<PaperWidth, number> = { 58: 48, 80: 72 }
