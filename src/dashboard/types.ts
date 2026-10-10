export type NavId =
  | 'dashboard'
  | 'customers'
  | 'credit'
  | 'debit'
  | 'cashbook'
  | 'transactions'
  | 'reports'
  | 'chartOfAccounts'
  | 'unit'

export type PortalRole = 'Administrator' | 'Accountant' | 'User' | 'Customer' | 'Unit'

export type NavItem = {
  id: NavId
  label: string
  icon: string
  path: string
}

export type BottomNavItem = {
  id: string
  label: string
  path: string
  icon: string
}

export type DashboardConfig = {
  portalTitle: string
  roleLabel: string
  nav: NavItem[]
  bottomNav: BottomNavItem[]
  homePath: string
  txPath: string
  kind?: 'staff' | 'customer' | 'unit'
}
