import { useEffect, useState, type FormEvent } from 'react'
import { LoadingHint } from './loading'
import { panel } from './styles'
import { toast } from '../toast'
import {
  fetchUnitDashboard,
  formatUnitMoney,
  formatUnitNum,
  unitFuelTotals,
  type UnitDashboardRow,
} from './unitDashboard'

export function UnitDashboardPage() {
  const [mode, setMode] = useState<'today' | 'duty_no'>('today')
  const [dutyInput, setDutyInput] = useState('')
  const [dutyNo, setDutyNo] = useState('')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<UnitDashboardRow[]>([])
  const [pendingTotal, setPendingTotal] = useState(0)

  const filterDuty = mode === 'duty_no' ? dutyNo : ''
  const needDuty = mode === 'duty_no' && !dutyNo

  useEffect(() => {
    if (needDuty) {
      setLoading(false)
      setRows([])
      setPendingTotal(0)
      return
    }

    const ac = new AbortController()
    setLoading(true)
    fetchUnitDashboard({
      dutyNo: filterDuty || undefined,
      signal: ac.signal,
    })
      .then((data) => {
        if (ac.signal.aborted) return
        setRows(data.transactions || [])
        setPendingTotal(Number(data.pending_total_amount) || 0)
      })
      .catch((err) => {
        if (ac.signal.aborted) return
        toast.error(err instanceof Error ? err.message : 'Unable to load UNIT summary')
        setRows([])
        setPendingTotal(0)
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false)
      })

    return () => ac.abort()
  }, [mode, dutyNo, needDuty, filterDuty])

  function applyDuty(event: FormEvent) {
    event.preventDefault()
    const next = dutyInput.trim()
    if (!next) {
      toast.error('Enter a Duty No to filter.')
      return
    }
    setDutyNo(next)
  }

  const totals = unitFuelTotals(rows)

  return (
    <div className="flex flex-col gap-3.5 lg:gap-4">
      <section className="overflow-hidden rounded-[1.1rem] border border-navy/80 bg-navy p-5 text-white shadow-card sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-fuel-soft">
              UNIT admin · view only
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Pump summary</h2>
            <p className="mt-1.5 max-w-lg text-sm text-white/70">
              Today&apos;s PTS aggregates by nozzle and item (posted + unposted). Diff and Difference
              are calculated in the table only.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMode('today')}
                className={`min-h-11 rounded-2xl px-4 py-2 text-sm font-bold transition ${
                  mode === 'today'
                    ? 'bg-gradient-to-br from-fuel via-fuel to-fuel-deep text-ink ring-2 ring-white/20'
                    : 'border border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setMode('duty_no')}
                className={`min-h-11 rounded-2xl px-4 py-2 text-sm font-bold transition ${
                  mode === 'duty_no'
                    ? 'bg-gradient-to-br from-fuel via-fuel to-fuel-deep text-ink ring-2 ring-white/20'
                    : 'border border-white/15 bg-white/5 text-zinc-200 hover:bg-white/10'
                }`}
              >
                By Duty No
              </button>
            </div>

            {mode === 'duty_no' ? (
              <form onSubmit={applyDuty} className="mt-4 flex flex-wrap gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={dutyInput}
                  onChange={(e) => setDutyInput(e.target.value)}
                  placeholder="e.g. 10"
                  className="min-h-11 min-w-[8rem] flex-1 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-fuel sm:max-w-xs"
                />
                <button
                  type="submit"
                  className="min-h-11 rounded-2xl bg-fuel px-5 text-sm font-bold text-ink hover:bg-fuel-deep"
                >
                  Apply
                </button>
              </form>
            ) : null}
          </div>

          <div className="w-full shrink-0 rounded-2xl border border-white/10 bg-gradient-to-br from-fuel via-fuel to-fuel-deep p-4 shadow-lg shadow-fuel-deep/30 sm:max-w-sm lg:w-64">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink/70">
              TAmount total
            </p>
            <p className="mt-2 break-words text-lg font-bold leading-snug tabular-nums text-ink sm:text-xl">
              {formatUnitMoney(pendingTotal)}
            </p>
            <p className="mt-2 text-xs text-ink/80">
              {filterDuty ? `Duty No ${filterDuty}` : 'Today · posted + unposted'} · {rows.length}{' '}
              rows
            </p>
          </div>
        </div>
      </section>

      {needDuty ? (
        <div className={`${panel} border-dashed p-12 text-center text-sm text-muted`}>
          Enter a Duty No and press Apply.
        </div>
      ) : null}

      {!needDuty && loading ? <LoadingHint label="Loading UNIT summary…" /> : null}

      {!needDuty && !loading ? (
        <>
          <section className="overflow-x-auto rounded-[1.1rem] border border-line bg-white shadow-card">
            {rows.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted">No rows for this filter.</div>
            ) : (
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-[#fafbfc] text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="border border-line px-4 py-3 font-bold">Nozzle</th>
                    <th className="border border-line px-4 py-3 font-bold">Item Name</th>
                    <th className="border border-line px-4 py-3 font-bold">Liters</th>
                    <th className="border border-line px-4 py-3 font-bold">Amount</th>
                    <th className="border border-line px-4 py-3 font-bold">TAmount</th>
                    <th className="border border-line px-4 py-3 font-bold">Diff</th>
                    <th className="border border-line px-4 py-3 font-bold">Opening Balance</th>
                    <th className="border border-line px-4 py-3 font-bold">Closing Balance</th>
                    <th className="border border-line px-4 py-3 font-bold">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.nozzle}-${row.item_id}-${index}`}>
                      <td className="border border-line px-4 py-3 font-semibold text-ink">
                        {row.nozzle ?? '—'}
                      </td>
                      <td className="border border-line px-4 py-3 font-semibold text-ink">
                        {row.item_name || '—'}
                      </td>
                      <td className="border border-line px-4 py-3 text-ink/90">
                        {formatUnitNum(row.liters)}
                      </td>
                      <td className="border border-line px-4 py-3 text-ink/90">
                        {formatUnitMoney(row.amount)}
                      </td>
                      <td className="border border-line px-4 py-3 font-semibold text-ink">
                        {formatUnitMoney(row.t_amount)}
                      </td>
                      <td className="border border-line px-4 py-3 font-semibold text-ink">
                        {formatUnitMoney(
                          (Number(row.t_amount) || 0) - (Number(row.amount) || 0),
                        )}
                      </td>
                      <td className="border border-line px-4 py-3 text-muted">
                        {formatUnitNum(row.opening_reading)}
                      </td>
                      <td className="border border-line px-4 py-3 text-muted">
                        {formatUnitNum(row.closing_reading)}
                      </td>
                      <td className="border border-line px-4 py-3 font-semibold text-ink">
                        {formatUnitNum(
                          (Number(row.closing_reading) || 0) -
                            (Number(row.opening_reading) || 0),
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {rows.length > 0 ? (
            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Diesel</p>
                <p className="mt-2 text-xl font-bold text-ink">
                  {formatUnitNum(totals.diesel.liters)} L
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-600">
                  {formatUnitMoney(totals.diesel.amount)}
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Petrol</p>
                <p className="mt-2 text-xl font-bold text-ink">
                  {formatUnitNum(totals.petrol.liters)} L
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-600">
                  {formatUnitMoney(totals.petrol.amount)}
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
                  High Octane
                </p>
                <p className="mt-2 text-xl font-bold text-ink">
                  {formatUnitNum(totals.hobc.liters)} L
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-600">
                  {formatUnitMoney(totals.hobc.amount)}
                </p>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
