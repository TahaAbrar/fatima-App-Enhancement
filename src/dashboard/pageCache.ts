import { getUserRole } from '../lib/auth'
import {
  fetchCustomerGroups,
  fetchCustomers,
  type Customer,
  type CustomerGroup,
  type CustomerStatus,
} from './customers'
import { fetchDashboardStats, fetchBanks } from './dashboard'
import {
  fetchKindStats,
  fetchTransactionCustomers,
  fetchTransactions,
  normalizeTransactionRow,
  type TransactionCustomer,
  type TransactionListParams,
  type TransactionRow,
  type TransactionSummary,
} from './transactions'

export const CUSTOMER_BATCH = 40
export const CUSTOMER_CHUNK = 15
export const TX_PAGE_SIZE = 20
export const TX_CHUNK = 15

export type CustomerListParams = {
  q?: string
  dateFrom?: string
  dateTo?: string
  status?: CustomerStatus | ''
  type?: string
}

export const EMPTY_CUSTOMER_FILTERS: CustomerListParams = {
  q: '',
  dateFrom: '',
  dateTo: '',
  status: '',
  type: '',
}

export const EMPTY_TX_FILTERS: TransactionListParams = {
  q: '',
  accid: '',
  dateFrom: '',
  dateTo: '',
  type: '',
  kind: 'all',
  status: 'unposted',
  sort: 'recent',
}

type CustomerListEntry = {
  customers: Customer[]
  total: number
  at: number
}

type TxPageEntry = {
  rows: TransactionRow[]
  total: number
  page: number
  summary: TransactionSummary
  at: number
}

const listCache = new Map<string, CustomerListEntry>()
const listInflight = new Map<string, Promise<{ customers: Customer[]; total: number; page: number }>>()
let groupsCache: { groups: CustomerGroup[]; at: number } | null = null
let groupsInflight: Promise<CustomerGroup[]> | null = null
const txCache = new Map<string, TxPageEntry>()
const txInflight = new Map<string, Promise<TxPageEntry>>()
let txCustomersCache: { customers: TransactionCustomer[]; at: number } | null = null
let txCustomersInflight: Promise<TransactionCustomer[]> | null = null

export function customerListKey(params: CustomerListParams) {
  return JSON.stringify({
    q: params.q?.trim() ?? '',
    dateFrom: params.dateFrom ?? '',
    dateTo: params.dateTo ?? '',
    status: params.status ?? '',
    type: params.type ?? '',
  })
}

export function transactionListKey(params: TransactionListParams) {
  return JSON.stringify({
    q: params.q?.trim() ?? '',
    accid: params.accid || '',
    dateFrom: params.dateFrom ?? '',
    dateTo: params.dateTo ?? '',
    type: params.type ?? '',
    kind: params.kind ?? 'all',
    status: params.status ?? 'unposted',
    sort: params.sort ?? 'recent',
  })
}

export function peekCustomerList(params: CustomerListParams) {
  return listCache.get(customerListKey(params)) ?? null
}

export function peekCustomerGroups() {
  return groupsCache?.groups ?? null
}

export function peekTransactions(params: TransactionListParams = EMPTY_TX_FILTERS, page = 1) {
  const entry = txCache.get(`${transactionListKey(params)}:${TX_PAGE_SIZE}:${page}`) ?? null
  if (!entry) return null
  return { ...entry, rows: entry.rows.map(normalizeTransactionRow) }
}

export function peekTransactionCustomers() {
  return txCustomersCache?.customers ?? null
}

export function clearPageCache() {
  listCache.clear()
  listInflight.clear()
  groupsCache = null
  groupsInflight = null
  txCache.clear()
  txInflight.clear()
  txCustomersCache = null
  txCustomersInflight = null
}

export function prefetchDashboardPages() {
  const role = getUserRole()
  if (role === 'Customer' || role === 'Unit') return
  if (role === 'Administrator' || role === 'Accountant') {
    void loadCustomerListPage(EMPTY_CUSTOMER_FILTERS, 1, { force: true })
    void loadCustomerGroups({ force: true })
  }
  void loadTransactionCustomers({ force: true })
  void loadTransactionsPage(EMPTY_TX_FILTERS, 1, { force: true })
  void fetchDashboardStats().catch(() => {})
  void fetchBanks().catch(() => {})
  void fetchKindStats('credit').catch(() => {})
  void fetchKindStats('debit').catch(() => {})
}

export async function loadCustomerGroups(opts?: { force?: boolean }) {
  if (!opts?.force && groupsCache) return groupsCache.groups
  if (groupsInflight) return groupsInflight
  groupsInflight = fetchCustomerGroups()
    .then((groups) => {
      groupsCache = { groups, at: Date.now() }
      return groups
    })
    .finally(() => {
      groupsInflight = null
    })
  return groupsInflight
}

export async function loadCustomerListPage(
  params: CustomerListParams,
  page: number,
  opts?: { force?: boolean },
) {
  const key = customerListKey(params)
  const inflightKey = `${key}:${page}`
  const cached = listCache.get(key)

  if (page === 1 && !opts?.force && cached) {
    const existing = listInflight.get(inflightKey)
    if (existing) return existing
    return { customers: cached.customers, total: cached.total, page: 1 }
  }
  const existing = listInflight.get(inflightKey)
  if (existing) return existing

  const request = fetchCustomers({
    q: params.q,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
    status: params.status,
    type: params.type,
    page,
    pageSize: CUSTOMER_BATCH,
  }).then((data) => {
    if (page === 1) {
      listCache.set(key, {
        customers: data.customers,
        total: data.total,
        at: Date.now(),
      })
    } else {
      const prev = listCache.get(key)
      const seen = new Set((prev?.customers ?? []).map((row) => row.accid))
      listCache.set(key, {
        total: data.total,
        at: Date.now(),
        customers: [...(prev?.customers ?? []), ...data.customers.filter((row) => !seen.has(row.accid))],
      })
    }
    return { customers: data.customers, total: data.total, page: data.page }
  })

  listInflight.set(inflightKey, request)
  try {
    return await request
  } finally {
    listInflight.delete(inflightKey)
  }
}

export async function loadTransactionCustomers(opts?: { force?: boolean }) {
  if (!opts?.force && txCustomersCache) return txCustomersCache.customers
  if (txCustomersInflight) return txCustomersInflight
  txCustomersInflight = fetchTransactionCustomers()
    .then((customers) => {
      txCustomersCache = { customers, at: Date.now() }
      return customers
    })
    .finally(() => {
      txCustomersInflight = null
    })
  return txCustomersInflight
}

export async function loadTransactionsPage(
  params: TransactionListParams,
  page: number,
  opts?: { force?: boolean },
) {
  const inflightKey = `${transactionListKey(params)}:${TX_PAGE_SIZE}:${page}`
  const cached = txCache.get(inflightKey)
  if (!opts?.force && cached) {
    const existing = txInflight.get(inflightKey)
    if (existing) return existing
    return cached
  }
  const existing = txInflight.get(inflightKey)
  if (existing) return existing

  const request = fetchTransactions({
    q: params.q,
    accid: params.accid || undefined,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
    type: params.type || undefined,
    kind: params.kind,
    status: params.status,
    sort: params.sort,
    page,
    pageSize: TX_PAGE_SIZE,
  }).then((data) => {
    const entry: TxPageEntry = {
      rows: data.transactions,
      total: data.total,
      page: data.page,
      summary: data.summary,
      at: Date.now(),
    }
    txCache.set(inflightKey, entry)
    return entry
  })

  txInflight.set(inflightKey, request)
  try {
    return await request
  } finally {
    txInflight.delete(inflightKey)
  }
}
