import { apiGet } from '../lib/api'

export type UnitDashboardRow = {
  nozzle: string | null
  item_id: number | string | null
  item_name: string | null
  liters: number
  amount: number
  t_amount: number
  opening_reading: number
  closing_reading: number
}

export type UnitDashboardResponse = {
  ok: true
  pending_total_amount: number
  todays_transactions: number
  pending_vehicle_details: number
  selected_duty_no: string | null
  transactions: UnitDashboardRow[]
}

export function fetchUnitDashboard(opts?: {
  dutyNo?: string
  signal?: AbortSignal
}): Promise<UnitDashboardResponse> {
  const params = new URLSearchParams()
  if (opts?.dutyNo) params.set('duty_no', opts.dutyNo)
  const qs = params.toString()
  return apiGet<UnitDashboardResponse>(`/api/unit/dashboard${qs ? `?${qs}` : ''}`, {
    signal: opts?.signal,
  })
}

export function formatUnitMoney(value: number) {
  return `Rs. ${(Number(value) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatUnitNum(value: number) {
  return (Number(value) || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })
}

export function unitFuelTotals(rows: UnitDashboardRow[]) {
  const totals = {
    diesel: { amount: 0, liters: 0 },
    petrol: { amount: 0, liters: 0 },
    hobc: { amount: 0, liters: 0 },
  }
  for (const row of rows) {
    const name = (row.item_name || '').toUpperCase()
    const amt = Number(row.amount) || 0
    const liters = Number(row.liters) || 0
    let key: keyof typeof totals | null = null
    if (name.includes('HSD') || name.includes('DIESEL')) key = 'diesel'
    else if (name.includes('PMG') || name.includes('PETROL')) key = 'petrol'
    else if (name.includes('HOBC') || name.includes('OCTANE')) key = 'hobc'
    if (!key) continue
    totals[key].amount += amt
    totals[key].liters += liters
  }
  return totals
}
