export default function QtyControl({ name, qty, onChange, disabled }: {
  name: string
  qty: number
  onChange: (delta: number) => void
  disabled?: boolean
}) {
  if (qty === 0) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(1)}
        className="rounded-full bg-mustard px-4 py-2 font-display font-semibold text-ink active:scale-95 disabled:opacity-40"
        aria-label={`Add ${name}`}
      >
        Add +
      </button>
    )
  }
  return (
    <div className="flex items-center gap-2 rounded-full bg-ink p-1 text-mustard">
      <button type="button" onClick={() => onChange(-1)} className="h-8 w-8 rounded-full text-xl leading-none active:bg-white/10" aria-label={`Remove one ${name}`}>−</button>
      <span className="w-5 text-center font-display font-semibold" aria-live="polite">{qty}</span>
      <button type="button" disabled={disabled} onClick={() => onChange(1)} className="h-8 w-8 rounded-full text-xl leading-none active:bg-white/10 disabled:opacity-40" aria-label={`Add one more ${name}`}>+</button>
    </div>
  )
}
