import { apiGet } from '../lib/api'
import type { CustomerDetail, HistoryKind, HistorySort } from './customers'

export type PortalFuelSummary = {
  hsd: number
  pmg: number
  ho: number
  advance: number
  others: number
}

export type PortalTransaction = {
  trid: number
  date: string
  when: string
  description: string
  product: string
  ticket: string
  vno: string
  mvno: string
  debit: number
  credit: number
  balance: number
}

export type PortalGroupAccount = {
  accid: number
  id: string
  name: string
  phone: string
  date: string
  openingBalance: number
  currentBalance: number
  debit: number
  credit: number
}

export type PortalGroupDetail = {
  groupId: number
  groupName: string
  accCount: number
  totalOpening: number
  totalBalance: number
  totalDebit: number
  totalCredit: number
}

export type PortalAccountMeta = {
  id: string
  name: string
  groupName: string
}

type MeResponse = {
  ok: true
  customer: CustomerDetail
  summary: PortalFuelSummary
}

type SummaryResponse = {
  ok: true
  summary: PortalFuelSummary
}

type TxResponse = {
  ok: true
  total: number
  offset: number
  limit: number
  openingBalance: number
  totalDebit: number
  totalCredit: number
  account: PortalAccountMeta
  transactions: Array<Partial<PortalTransaction> & { trid: number; balance: number }>
}

export async function fetchPortalMe(
  params: { dateFrom?: string; dateTo?: string } = {},
  signal?: AbortSignal,
) {
  const q = new URLSearchParams()
  if (params.dateFrom) q.set('dateFrom', params.dateFrom)
  if (params.dateTo) q.set('dateTo', params.dateTo)
  const qs = q.toString()
  const data = await apiGet<MeResponse>(`/api/portal/me${qs ? `?${qs}` : ''}`, { signal })
  return { customer: data.customer, summary: data.summary }
}

export async function fetchPortalSummary(
  params: { dateFrom?: string; dateTo?: string } = {},
  signal?: AbortSignal,
) {
  const q = new URLSearchParams()
  if (params.dateFrom) q.set('dateFrom', params.dateFrom)
  if (params.dateTo) q.set('dateTo', params.dateTo)
  const qs = q.toString()
  const data = await apiGet<SummaryResponse>(`/api/portal/summary${qs ? `?${qs}` : ''}`, {
    signal,
  })
  return data.summary
}

function mapPortalTx(row: TxResponse['transactions'][number]): PortalTransaction {
  return {
    trid: row.trid,
    date: row.date || '',
    when: row.when || row.date || '',
    description: row.description || row.product || '—',
    product: row.product || row.description || '—',
    ticket: row.ticket || row.mvno || '0',
    vno: row.vno || '0',
    mvno: row.mvno || row.ticket || '0',
    debit: row.debit ?? 0,
    credit: row.credit ?? 0,
    balance: row.balance ?? 0,
  }
}

export async function fetchPortalTransactions(
  params: {
    kind?: HistoryKind
    dateFrom?: string
    dateTo?: string
    sort?: HistorySort
    offset?: number
    limit?: number
    accid?: number
  } = {},
  signal?: AbortSignal,
) {
  const q = new URLSearchParams()
  if (params.kind) q.set('kind', params.kind)
  if (params.dateFrom) q.set('dateFrom', params.dateFrom)
  if (params.dateTo) q.set('dateTo', params.dateTo)
  if (params.sort) q.set('sort', params.sort)
  if (params.offset != null) q.set('offset', String(params.offset))
  if (params.limit != null) q.set('limit', String(params.limit))
  if (params.accid != null) q.set('accid', String(params.accid))
  const qs = q.toString()
  const data = await apiGet<TxResponse>(`/api/portal/transactions${qs ? `?${qs}` : ''}`, {
    signal,
  })
  return {
    transactions: data.transactions.map(mapPortalTx),
    total: data.total,
    openingBalance: data.openingBalance ?? 0,
    totalDebit: data.totalDebit ?? 0,
    totalCredit: data.totalCredit ?? 0,
    account: data.account ?? { id: '—', name: '—', groupName: '—' },
  }
}

type GroupsResponse = {
  ok: true
  groups: Array<{
    groupId: number
    groupName: string
    accCount: number
    totalBalance: number
  }>
}

type GroupDetailResponse = {
  ok: true
  dateFrom?: string
  dateTo?: string
  group: PortalGroupDetail
  accounts: PortalGroupAccount[]
}

function toAmount(value: unknown) {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function mapGroupAccount(
  row: Partial<PortalGroupAccount> & { accid: number },
): PortalGroupAccount {
  return {
    accid: row.accid,
    id: row.id || String(row.accid),
    name: row.name || '—',
    phone: row.phone || '',
    date: row.date || '—',
    openingBalance: toAmount(row.openingBalance),
    currentBalance: toAmount(row.currentBalance),
    debit: toAmount(row.debit),
    credit: toAmount(row.credit),
  }
}

function mapGroupDetail(group: Partial<PortalGroupDetail> & { groupId: number; groupName: string }) {
  return {
    groupId: group.groupId,
    groupName: group.groupName || '—',
    accCount: toAmount(group.accCount),
    totalOpening: toAmount(group.totalOpening),
    totalBalance: toAmount(group.totalBalance),
    totalDebit: toAmount(group.totalDebit),
    totalCredit: toAmount(group.totalCredit),
  }
}

export async function fetchPortalGroups(signal?: AbortSignal) {
  const data = await apiGet<GroupsResponse>('/api/portal/groups', { signal })
  return data.groups
}

export async function fetchPortalGroupDetail(
  groupId: number,
  params: { dateFrom?: string; dateTo?: string } = {},
  signal?: AbortSignal,
) {
  const q = new URLSearchParams()
  if (params.dateFrom) q.set('dateFrom', params.dateFrom)
  if (params.dateTo) q.set('dateTo', params.dateTo)
  const qs = q.toString()
  const data = await apiGet<GroupDetailResponse>(
    `/api/portal/groups/${groupId}${qs ? `?${qs}` : ''}`,
    { signal },
  )
  return {
    dateFrom: data.dateFrom || '',
    dateTo: data.dateTo || '',
    group: mapGroupDetail(data.group),
    accounts: data.accounts.map(mapGroupAccount),
  }
}
