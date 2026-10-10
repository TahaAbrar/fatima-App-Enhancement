import { DashboardShell } from '../dashboard/DashboardShell'
import { unitConfig } from '../dashboard/nav'

/** UserReg Type=Unit portal — UNIT pump summary only */
export default function UnitDashboard() {
  return <DashboardShell config={unitConfig()} />
}
