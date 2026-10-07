import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { HistorySort } from './customers'
import { BackChevron } from './customerDetails/ui'
import { applyDateRange, DateRangeFilter } from './filters'
import { panel } from './styles'
import { PortalTxTable } from './PortalTxTable'
import { usePortalHistory } from './usePortalHistory'

type Props = {
  homePath: string
}

export function CustomerPortalTransactions({ homePath }: Props) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const viewAccidRaw = Number(searchParams.get('accid') || '')
  const viewAccid =
    Number.isInteger(viewAccidRaw) && viewAccidRaw > 0 ? viewAccidRaw : undefined
  const backGroupIdRaw = Number(searchParams.get('groupId') || '')
  const backPath =
    Number.isInteger(backGroupIdRaw) && backGroupIdRaw > 0
      ? `/customer/groups/${backGroupIdRaw}`
      : homePath
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort] = useState<HistorySort>('oldest')
  const history = usePortalHistory('all', dateFrom, dateTo, sort, viewAccid)

  const afterFiveMobileRef = useRef<HTMLLIElement | null>(null)
  const afterFiveDesktopRef = useRef<HTMLTableRowElement | null>(null)
  const mobileSentinelRef = useRef<HTMLDivElement | null>(null)
  const desktopSentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const observers: IntersectionObserver[] = []
    const watch = (target: Element | null) => {
      if (!target) return
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) history.revealMore()
        },
        { root: null, rootMargin: '160px 0px', threshold: 0.01 },
      )
      observer.observe(target)
      observers.push(observer)
    }
    watch(afterFiveMobileRef.current)
    watch(afterFiveDesktopRef.current)
    watch(mobileSentinelRef.current)
    watch(desktopSentinelRef.current)
    return () => observers.forEach((o) => o.disconnect())
  }, [history.revealMore, history.hasMore, history.rows.length])

  const emptyMessage = history.emptyRange
    ? 'No transactions in this date range'
    : 'No records found.'

  const account = history.account

  return (
    <div className="flex flex-col gap-3.5 lg:gap-4">
      <div className="flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => navigate(backPath)}
          className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent px-0 py-1 text-[0.9rem] font-bold text-[#c99700]"
        >
          <BackChevron />
          Back
        </button>
        <h1 className="m-0 flex-1 pr-12 text-center text-[1.1rem] font-extrabold tracking-[-0.02em] text-ink">
          Account Ledger
        </h1>
      </div>

      <div className="hidden items-center justify-between gap-3 lg:flex">
        <div>
          <p className="m-0 text-[0.82rem] font-medium text-muted">
            <button
              type="button"
              onClick={() => navigate(backPath)}
              className="cursor-pointer border-0 bg-transparent p-0 font-medium text-muted hover:text-ink"
            >
              {backPath === homePath ? 'My Account' : 'Group'}
            </button>
            <span className="mx-1.5 text-[#c4c9d2]">›</span>
            <span className="font-semibold text-ink">Account Ledger</span>
          </p>
          <h1 className="mt-1 mb-0 text-[1.45rem] font-extrabold tracking-[-0.03em] text-ink">
            Account Ledger
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate(backPath)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-[0.84rem] font-bold text-ink hover:bg-[#f7f8fa]"
        >
          <BackChevron />
          {backPath === homePath ? 'Back to My Account' : 'Back to Group'}
        </button>
      </div>

      <section
        className={`${panel} relative z-0 overflow-visible rounded-2xl p-4 lg:px-5 lg:py-4`}
        aria-label="Account header"
      >
        <div className="relative z-0 flex flex-col gap-3 overflow-visible sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="m-0 text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-muted">
              Account Name
            </p>
            <p className="mt-1 mb-0 text-[1.05rem] font-extrabold text-ink">
              {account ? `${account.id} ${account.name}` : 'Loading…'}
            </p>
            <p className="mt-1 mb-0 text-[0.84rem] font-medium text-muted">
              Group: {account?.groupName || '—'}
            </p>
          </div>
          <div className="relative z-20 shrink-0 overflow-visible">
            <DateRangeFilter
              variant="pill"
              grouped
              from={dateFrom}
              to={dateTo}
              onFromChange={(next) => {
                const range = applyDateRange('from', next, dateFrom, dateTo)
                setDateFrom(range.from)
                setDateTo(range.to)
              }}
              onToChange={(next) => {
                const range = applyDateRange('to', next, dateFrom, dateTo)
                setDateFrom(range.from)
                setDateTo(range.to)
              }}
            />
          </div>
        </div>
      </section>

      <div className="relative z-0">
        <PortalTxTable
          rows={history.rows}
          openingBalance={history.openingBalance}
          totalDebit={history.totalDebit}
          totalCredit={history.totalCredit}
          showOpening
          showTotals
          loading={history.loading}
          loadingMore={history.loadingMore}
          emptyMessage={emptyMessage}
          afterFiveMobileRef={afterFiveMobileRef}
          afterFiveDesktopRef={afterFiveDesktopRef}
          mobileSentinelRef={mobileSentinelRef}
          desktopSentinelRef={desktopSentinelRef}
          onPrefetch={history.prefetch}
        />
      </div>
    </div>
  )
}
