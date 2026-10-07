import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '../toast'
import type { HistoryKind, HistorySort } from './customers'
import {
  fetchPortalTransactions,
  type PortalAccountMeta,
  type PortalTransaction,
} from './portal'

const PAGE = 20
const PREFETCH = 60

export type PortalHistoryState = {
  rows: PortalTransaction[]
  total: number
  openingBalance: number
  totalDebit: number
  totalCredit: number
  account: PortalAccountMeta | null
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  emptyRange: boolean
  revealMore: () => void
  prefetch: () => void
}

const EMPTY_ACCOUNT: PortalAccountMeta = { id: '—', name: '—', groupName: '—' }

export function usePortalHistory(
  kind: HistoryKind,
  dateFrom: string,
  dateTo: string,
  sort: HistorySort,
  accid?: number,
): PortalHistoryState {
  const [fetched, setFetched] = useState<PortalTransaction[]>([])
  const [total, setTotal] = useState(0)
  const [openingBalance, setOpeningBalance] = useState(0)
  const [totalDebit, setTotalDebit] = useState(0)
  const [totalCredit, setTotalCredit] = useState(0)
  const [account, setAccount] = useState<PortalAccountMeta | null>(null)
  const [visible, setVisible] = useState(PAGE)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const inflight = useRef(false)
  const fetchedRef = useRef<PortalTransaction[]>([])
  const totalRef = useRef(0)
  const gen = useRef(0)

  useEffect(() => {
    fetchedRef.current = fetched
  }, [fetched])
  useEffect(() => {
    totalRef.current = total
  }, [total])

  useEffect(() => {
    const id = ++gen.current
    const ac = new AbortController()
    inflight.current = true
    setLoading(true)
    setFetched([])
    setVisible(PAGE)
    setTotal(0)
    fetchPortalTransactions(
      {
        kind,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sort,
        offset: 0,
        limit: PAGE,
        accid,
      },
      ac.signal,
    )
      .then((data) => {
        if (id !== gen.current) return
        setFetched(data.transactions)
        setTotal(data.total)
        setOpeningBalance(data.openingBalance)
        setTotalDebit(data.totalDebit)
        setTotalCredit(data.totalCredit)
        setAccount(data.account)
        setVisible(Math.min(PAGE, data.total))
      })
      .catch((err) => {
        if (ac.signal.aborted || id !== gen.current) return
        setFetched([])
        setTotal(0)
        setAccount(null)
        toast.error(err instanceof Error ? err.message : 'Could not load transactions')
      })
      .finally(() => {
        if (id === gen.current) {
          inflight.current = false
          setLoading(false)
        }
      })
    return () => {
      ac.abort()
      inflight.current = false
    }
  }, [kind, dateFrom, dateTo, sort, accid])

  const loadFromServer = useCallback(
    async (limit: number) => {
      if (inflight.current) return
      const offset = fetchedRef.current.length
      if (offset >= totalRef.current) return
      inflight.current = true
      setLoadingMore(true)
      try {
        const data = await fetchPortalTransactions({
          kind,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          sort,
          offset,
          limit: Math.min(limit, 50),
          accid,
        })
        setTotal(data.total)
        setOpeningBalance(data.openingBalance)
        setTotalDebit(data.totalDebit)
        setTotalCredit(data.totalCredit)
        setAccount(data.account)
        setFetched((prev) => {
          const seen = new Set(prev.map((row) => row.trid))
          return [...prev, ...data.transactions.filter((row) => !seen.has(row.trid))]
        })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not load more transactions')
      } finally {
        inflight.current = false
        setLoadingMore(false)
      }
    },
    [kind, dateFrom, dateTo, sort, accid],
  )

  const revealMore = useCallback(() => {
    if (visible >= totalRef.current) return
    const next = visible + PAGE
    if (fetchedRef.current.length < Math.min(next, totalRef.current)) {
      void loadFromServer(PREFETCH)
    }
    setVisible((v) => Math.min(v + PAGE, totalRef.current || v + PAGE))
  }, [visible, loadFromServer])

  const prefetch = useCallback(() => {
    if (fetchedRef.current.length >= totalRef.current) return
    void loadFromServer(PREFETCH)
  }, [loadFromServer])

  useEffect(() => {
    if (loading) return
    void loadFromServer(PREFETCH)
  }, [loading, loadFromServer])

  return {
    rows: fetched.slice(0, Math.min(visible, fetched.length)),
    total,
    openingBalance,
    totalDebit,
    totalCredit,
    account: account ?? (loading ? null : EMPTY_ACCOUNT),
    loading,
    loadingMore,
    hasMore: visible < total,
    emptyRange: Boolean(dateFrom || dateTo) && !loading && total === 0,
    revealMore,
    prefetch,
  }
}
