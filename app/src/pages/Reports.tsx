import { useEffect, useState, type ReactNode } from 'react'
import ErrorMessage from '../components/ErrorMessage'
import Row from '../components/SummaryRow'
import { EXPENSE_CATEGORIES, formatDay } from '../lib/expenses'
import { formatMoney } from '../lib/format'
import { CHANNELS } from '../lib/orders'
import { loadReport, PERIODS, profitOf, type PeriodKey, type ReportSummary } from '../lib/reports'
import type { ExpenseCategory } from '../lib/types'

export default function Reports() {
  const [period, setPeriod] = useState<PeriodKey>('month')
  const [report, setReport] = useState<ReportSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadReport(period).then(({ data, error }) => {
      setError(error)
      setReport(data)
    })
  }, [period])

  function choose(p: PeriodKey) {
    setReport(null)
    setPeriod(p)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Reports</h2>

      <div className="grid grid-cols-4 rounded-xl bg-stone-200 p-1 dark:bg-stone-800">
        {(Object.keys(PERIODS) as PeriodKey[]).map((p) => (
          <button
            key={p}
            onClick={() => choose(p)}
            className={`rounded-lg py-1.5 text-xs font-medium ${period === p ? 'bg-white shadow-sm dark:bg-stone-900' : 'text-stone-500'}`}
          >
            {PERIODS[p]}
          </button>
        ))}
      </div>

      <ErrorMessage message={error} />
      {!report && !error && <p className="text-stone-500">Loading…</p>}
      {report && <ReportBody report={report} showDays={period !== 'today'} />}
    </div>
  )
}

function ReportBody({ report, showDays }: { report: ReportSummary; showDays: boolean }) {
  const profit = profitOf(report)

  return (
    <>
      <div className="card space-y-1">
        <Row label={`Sales (${report.orders} order${report.orders === 1 ? '' : 's'})`} value={formatMoney(report.sales)} />
        {report.commission > 0 && <Row label="Foodpanda commission" value={`− ${formatMoney(report.commission)}`} />}
        {(Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]).map(
          (c) =>
            report.expenses_by_category[c] && (
              <Row key={c} label={`${EXPENSE_CATEGORIES[c]} bought`} value={`− ${formatMoney(report.expenses_by_category[c]!)}`} />
            ),
        )}
        <hr className="my-2 border-stone-200 dark:border-stone-800" />
        <div className="flex justify-between text-lg font-bold">
          <span>Profit</span>
          <span className={profit < 0 ? 'text-red-600' : 'text-green-600'}>{formatMoney(profit)}</span>
        </div>
        {report.orders > 0 && (
          <p className="pt-1 text-sm text-stone-500">Average order {formatMoney(report.sales / report.orders)}</p>
        )}
      </div>

      {report.by_channel.length > 0 && (
        <Section title="By channel">
          <table className="w-full text-sm">
            <thead className="text-stone-500">
              <tr>
                <th className="pb-1 text-left font-normal">Channel</th>
                <th className="pb-1 text-right font-normal">Orders</th>
                <th className="pb-1 text-right font-normal">Sales</th>
                <th className="pb-1 text-right font-normal">You keep</th>
              </tr>
            </thead>
            <tbody>
              {report.by_channel.map((c) => (
                <tr key={c.channel}>
                  <td className="py-1">{CHANNELS[c.channel]}</td>
                  <td className="py-1 text-right tabular-nums">{c.orders}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(c.sales)}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(c.sales - c.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {report.items.length > 0 && (
        <Section title="Best sellers">
          <table className="w-full text-sm">
            <thead className="text-stone-500">
              <tr>
                <th className="pb-1 text-left font-normal">Item</th>
                <th className="pb-1 text-right font-normal">Sold</th>
                <th className="pb-1 text-right font-normal">Sales</th>
                <th className="pb-1 text-right font-normal">Est. profit</th>
              </tr>
            </thead>
            <tbody>
              {report.items.map((i) => (
                <tr key={i.name}>
                  <td className="py-1">{i.name}</td>
                  <td className="py-1 text-right tabular-nums">{i.quantity}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(i.sales)}</td>
                  <td className="py-1 text-right tabular-nums">{formatMoney(i.sales - i.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-stone-500">
            Est. profit = sales − recipe cost at today's ingredient prices, before discounts and Foodpanda commission.
          </p>
        </Section>
      )}

      {showDays && report.by_day.length > 0 && (
        <Section title="By day">
          <div className="space-y-1">
            {[...report.by_day].reverse().map((d) => (
              <Row key={d.day} label={`${formatDay(d.day)} · ${d.orders} order${d.orders === 1 ? '' : 's'}`} value={formatMoney(d.sales)} />
            ))}
          </div>
        </Section>
      )}

      {report.orders === 0 && <p className="card text-stone-500">No delivered orders in this period.</p>}
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">{title}</h3>
      <div className="card">{children}</div>
    </section>
  )
}
