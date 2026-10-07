import { formatPkrAmount } from './customers'
import { LoadingHint } from './loading'
import type { PortalGroupAccount } from './portal'
import { panel } from './styles'

type Props = {
  rows: PortalGroupAccount[]
  totalDebit?: number
  totalCredit?: number
  showTotals?: boolean
  loading?: boolean
  emptyMessage?: string
  onRowClick?: (row: PortalGroupAccount) => void
}

function Money({
  value,
  tone,
  hideZero = true,
}: {
  value: number
  tone?: 'debit' | 'credit' | 'balance'
  hideZero?: boolean
}) {
  const amount = Number.isFinite(value) ? value : 0
  if (hideZero && !amount) return null
  const cls =
    tone === 'debit' ? 'text-debit' : tone === 'credit' ? 'text-credit' : 'font-bold text-ink'
  return <span className={cls}>{formatPkrAmount(amount)}</span>
}

const th =
  'border border-[#c5c9d2] px-2 py-2 text-center text-[0.78rem] font-extrabold text-ink'
const td = 'border border-[#c5c9d2] px-2 py-2 align-top text-[0.82rem] text-ink'
const theadRow = 'bg-[#ffe58a]'

export function PortalGroupAccountsTable({
  rows,
  totalDebit = 0,
  totalCredit = 0,
  showTotals = true,
  loading = false,
  emptyMessage = 'No accounts found in this group.',
  onRowClick,
}: Props) {
  return (
    <div className={`${panel} overflow-hidden rounded-2xl`}>
      {/* Mobile */}
      <ul className="m-0 flex list-none flex-col p-0 lg:hidden">
        {rows.map((row) => (
          <li
            key={row.accid}
            role={onRowClick ? 'button' : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            onKeyDown={
              onRowClick
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onRowClick(row)
                    }
                  }
                : undefined
            }
            className={`flex flex-col gap-1.5 border-b border-[#ECEEF2] px-4 py-3${
              onRowClick ? ' cursor-pointer hover:bg-[#fcfcfd]' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 text-[0.78rem] font-bold text-muted">{row.date || '—'}</p>
                <p className="mt-1 mb-0 text-[0.84rem] font-semibold leading-snug text-ink">
                  {row.name}
                </p>
                <p className="mt-1 mb-0 text-[0.76rem] font-medium text-muted">
                  {row.phone || '—'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[0.78rem]">
              <span className="font-semibold text-ink">
                Opening {formatPkrAmount(row.openingBalance)}
              </span>
              <span className="font-semibold text-debit">
                Dr {row.debit ? formatPkrAmount(row.debit) : '—'}
              </span>
              <span className="font-semibold text-credit">
                Cr {row.credit ? formatPkrAmount(row.credit) : '—'}
              </span>
              <span className="font-extrabold text-ink">
                Closing {formatPkrAmount(row.currentBalance)}
              </span>
            </div>
          </li>
        ))}
        {loading && (
          <li className="px-4 py-3">
            <LoadingHint label="Loading accounts…" />
          </li>
        )}
        {!loading && rows.length === 0 && (
          <li className="px-4 py-8 text-center text-sm font-medium text-muted">{emptyMessage}</li>
        )}
        {showTotals && !loading && rows.length > 0 ? (
          <li className="border-t-2 border-ink/15 bg-[#f7f8fa] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[0.84rem]">
              <span className="font-extrabold text-ink">Total</span>
              <span className="font-extrabold text-debit">Dr {formatPkrAmount(totalDebit)}</span>
              <span className="font-extrabold text-credit">Cr {formatPkrAmount(totalCredit)}</span>
            </div>
          </li>
        ) : null}
      </ul>

      {/* Desktop ledger */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead>
            <tr className={theadRow}>
              <th className={`${th} w-[10%]`}>Date</th>
              <th className={`${th} w-[22%]`}>Name</th>
              <th className={`${th} w-[12%]`}>Phone</th>
              <th className={`${th} w-[14%]`}>Opening Balance</th>
              <th className={`${th} w-[14%]`}>Debit</th>
              <th className={`${th} w-[14%]`}>Credit</th>
              <th className={`${th} w-[14%]`}>Closing Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.accid}
                className={`bg-white${onRowClick ? ' cursor-pointer hover:bg-[#fcfcfd]' : ''}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                <td className={`${td} whitespace-nowrap text-center`}>{row.date || '—'}</td>
                <td className={`${td} font-semibold`}>{row.name}</td>
                <td className={`${td} text-center`}>{row.phone || '—'}</td>
                <td className={`${td} text-right`}>
                  <Money value={row.openingBalance} tone="balance" hideZero={false} />
                </td>
                <td className={`${td} text-right`}>
                  <Money value={row.debit} tone="debit" hideZero={false} />
                </td>
                <td className={`${td} text-right`}>
                  <Money value={row.credit} tone="credit" hideZero={false} />
                </td>
                <td className={`${td} text-right`}>
                  <Money value={row.currentBalance} tone="balance" hideZero={false} />
                </td>
              </tr>
            ))}
            {showTotals && !loading && rows.length > 0 ? (
              <tr className="bg-[#f7f8fa]">
                <td className={`${td} font-extrabold`} colSpan={4}>
                  Total
                </td>
                <td className={`${td} text-right font-extrabold text-debit`}>
                  {formatPkrAmount(totalDebit)}
                </td>
                <td className={`${td} text-right font-extrabold text-credit`}>
                  {formatPkrAmount(totalCredit)}
                </td>
                <td className={td} />
              </tr>
            ) : null}
          </tbody>
        </table>
        {loading && (
          <div className="p-4">
            <LoadingHint label="Loading accounts…" />
          </div>
        )}
        {!loading && rows.length === 0 && (
          <p className="py-8 text-center text-sm font-medium text-muted">{emptyMessage}</p>
        )}
      </div>
    </div>
  )
}
