import { useState } from 'react'
import { getPaperWidth, setPaperWidth, type PaperWidth } from '../lib/receipt'

/** Receipt paper width for this phone's printer. Saved on the phone, not in the database. */
export default function PrinterSettings() {
  const [paper, setPaper] = useState<PaperWidth>(getPaperWidth)

  function choose(width: PaperWidth) {
    setPaper(width)
    setPaperWidth(width)
  }

  return (
    <div className="card space-y-2">
      <p className="font-medium">Receipt paper width (this phone)</p>
      <div className="grid grid-cols-2 rounded-xl bg-stone-200 p-1 dark:bg-stone-800">
        {([58, 80] as const).map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => choose(w)}
            className={`rounded-lg py-1.5 text-sm font-medium ${paper === w ? 'bg-white shadow-sm dark:bg-stone-900' : 'text-stone-500'}`}
          >
            {w} mm
          </button>
        ))}
      </div>
      <p className="text-sm text-stone-500">Measure the paper roll: about 5.8 cm wide → 58 mm, about 8 cm → 80 mm.</p>
    </div>
  )
}
