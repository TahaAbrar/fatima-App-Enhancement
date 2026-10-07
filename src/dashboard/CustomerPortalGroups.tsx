import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from '../toast'
import { BackChevron, PkrValue } from './customerDetails/ui'
import { applyDateRange, DateRangeFilter } from './filters'
import { LoadingHint } from './loading'
import { PortalGroupAccountsTable } from './PortalGroupAccountsTable'
import {
  fetchPortalGroupDetail,
  fetchPortalGroups,
  type PortalGroupAccount,
  type PortalGroupDetail,
} from './portal'
import { panel } from './styles'

type Props = {
  homePath: string
  groupsPath: string
}

export function CustomerPortalGroups({ homePath, groupsPath }: Props) {
  const navigate = useNavigate()
  const { groupId: groupIdParam } = useParams()
  const groupId = groupIdParam ? Number(groupIdParam) : null
  const validGroupId =
    groupId != null && Number.isInteger(groupId) && groupId > 0 ? groupId : null

  useEffect(() => {
    if (validGroupId != null) return

    const ac = new AbortController()
    fetchPortalGroups(ac.signal)
      .then((groups) => {
        if (ac.signal.aborted) return
        const first = groups[0]
        if (first) {
          navigate(`${groupsPath}/${first.groupId}`, { replace: true })
          return
        }
        navigate(homePath, { replace: true })
      })
      .catch(() => {
        if (!ac.signal.aborted) navigate(homePath, { replace: true })
      })

    return () => ac.abort()
  }, [validGroupId, groupsPath, homePath, navigate])

  if (validGroupId == null) {
    return <LoadingHint label="Loading group…" />
  }

  return <CustomerPortalGroupDetail groupId={validGroupId} homePath={homePath} />
}

function CustomerPortalGroupDetail({
  groupId,
  homePath,
}: {
  groupId: number
  homePath: string
}) {
  const navigate = useNavigate()
  const [groupName, setGroupName] = useState('')
  const [summary, setSummary] = useState<PortalGroupDetail | null>(null)
  const [accounts, setAccounts] = useState<PortalGroupAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    const ac = new AbortController()
    setLoading(true)
    fetchPortalGroupDetail(
      groupId,
      {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      },
      ac.signal,
    )
      .then((data) => {
        if (ac.signal.aborted) return
        setGroupName(data.group.groupName)
        setSummary(data.group)
        setAccounts(data.accounts)
      })
      .catch((err) => {
        if (ac.signal.aborted) return
        toast.error(err instanceof Error ? err.message : 'Could not load group details')
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false)
      })
    return () => ac.abort()
  }, [groupId, dateFrom, dateTo])

  const emptyMessage =
    dateFrom || dateTo ? 'No accounts in this date range' : 'No accounts found in this group.'

  return (
    <div className="flex flex-col gap-3.5 lg:gap-4">
      <div className="flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => navigate(homePath)}
          className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent px-0 py-1 text-[0.9rem] font-bold text-[#c99700]"
        >
          <BackChevron />
          Back
        </button>
        <h1 className="m-0 flex-1 pr-12 text-center text-[1.1rem] font-extrabold tracking-[-0.02em] text-ink">
          {groupName || 'Group'}
        </h1>
      </div>

      <div className="hidden items-center justify-between gap-3 lg:flex">
        <div>
          <p className="m-0 text-[0.82rem] font-medium text-muted">
            <button
              type="button"
              onClick={() => navigate(homePath)}
              className="cursor-pointer border-0 bg-transparent p-0 font-medium text-muted hover:text-ink"
            >
              My Account
            </button>
            <span className="mx-1.5 text-[#c4c9d2]">›</span>
            <span className="font-semibold text-ink">{groupName || 'Group'}</span>
          </p>
          <h1 className="mt-1 mb-0 text-[1.45rem] font-extrabold tracking-[-0.03em] text-ink">
            {groupName || 'Group'}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => navigate(homePath)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-[0.84rem] font-bold text-ink hover:bg-[#f7f8fa]"
        >
          <BackChevron />
          Back to My Account
        </button>
      </div>

      <section className={`${panel} rounded-2xl p-4 lg:px-5 lg:py-4`} aria-label="Group header">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="m-0 text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-muted">
              Group Name
            </p>
            <p className="mt-1 mb-0 text-[1.05rem] font-extrabold text-ink">
              {groupName || 'Loading…'}
            </p>
            <p className="mt-1 mb-0 text-[0.84rem] font-medium text-muted">
              Accounts: {loading ? '…' : String(summary?.accCount ?? 0)}
            </p>
            <div className="mt-3 grid max-w-md grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-line bg-[#fafbfc] px-3.5 py-3">
                <p className="m-0 text-[0.72rem] font-semibold text-muted">Opening Balance</p>
                <div className="mt-1 text-[0.95rem] font-extrabold text-ink">
                  {loading ? (
                    '…'
                  ) : (
                    <PkrValue value={summary?.totalOpening ?? 0} amountClass="font-extrabold" />
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-line bg-[#fafbfc] px-3.5 py-3">
                <p className="m-0 text-[0.72rem] font-semibold text-muted">Closing Balance</p>
                <div className="mt-1 text-[0.95rem] font-extrabold text-ink">
                  {loading ? (
                    '…'
                  ) : (
                    <PkrValue
                      value={summary?.totalBalance ?? 0}
                      amountClass="font-extrabold"
                      className={
                        (summary?.totalBalance ?? 0) < 0 ? 'text-debit' : 'text-credit'
                      }
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
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
      </section>

      <PortalGroupAccountsTable
        rows={accounts}
        totalDebit={summary?.totalDebit ?? 0}
        totalCredit={summary?.totalCredit ?? 0}
        showTotals
        loading={loading}
        emptyMessage={emptyMessage}
        onRowClick={(row) =>
          navigate(`/customer/transactions?accid=${row.accid}&groupId=${groupId}`)
        }
      />
    </div>
  )
}
