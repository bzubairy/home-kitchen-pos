export default function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold' : 'text-stone-600 dark:text-stone-400'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
