import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BrandMark } from '../components/BrandMark'
import { apiLogout, getSession } from '../lib/auth'
import { disablePush, enablePush } from '../lib/push'
import { toast } from '../toast'
import type { DashboardConfig } from './types'
import { BottomIcon, NavIcon } from './icons'
import { CustomersPage } from './CustomersPage'
import { DashboardHome, SectionPlaceholder } from './DashboardHome'
import { TransactionsPage } from './TransactionsPage'
import { CreditPage } from './CreditPage'
import { DebitPage } from './DebitPage'
import { clearPageCache, prefetchDashboardPages } from './pageCache'
import { ReportsPage } from './ReportsPage'
import { CashBookPage } from './CashBookPage'
import { ChartOfAccountsPage } from './ChartOfAccountsPage'
import { CustomerPortalHome } from './CustomerPortalHome'
import { CustomerPortalGroups } from './CustomerPortalGroups'
import { CustomerPortalTransactions } from './CustomerPortalTransactions'
import { UnitDashboardPage } from './UnitDashboardPage'
import {
  FALLBACK_COMPANY,
  loadCompany,
  peekCompany,
  truncateAddress,
  type CompanyProfile,
} from './company'

type Props = {
  config: DashboardConfig
}

export function DashboardShell({ config }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const session = getSession()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [companyCardOpen, setCompanyCardOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [company, setCompany] = useState<CompanyProfile>(() => peekCompany() ?? FALLBACK_COMPANY)

  const desktopMenuRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const companyBrandRef = useRef<HTMLDivElement>(null)
  const desktopHoverTimer = useRef<number | null>(null)

  const { nav, bottomNav, homePath, txPath, roleLabel, kind } = config
  const customersNav = nav.find((item) => item.id === 'customers')
  const coaNav = nav.find((item) => item.id === 'chartOfAccounts')
  const stockNav = nav.find((item) => item.id === 'reports')
  const stockPath = stockNav?.path ?? '/reports'
  const isCustomerPortal = kind === 'customer'
  const isUnitPortal = kind === 'unit'
  const customerGroupsPath = '/customer/groups'
  const isCustomerGroups =
    isCustomerPortal && location.pathname.startsWith(`${customerGroupsPath}`)
  const active =
    nav.find((item) => {
      if (item.id === 'customers') {
        return (
          location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
        )
      }
      if (item.id === 'chartOfAccounts') {
        return (
          location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
        )
      }
      if (item.id === 'reports') {
        return (
          location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
        )
      }
      if (item.id === 'dashboard' && isCustomerPortal) {
        return (
          location.pathname === item.path || location.pathname.startsWith(`${customerGroupsPath}`)
        )
      }
      return item.path === location.pathname
    })?.id ?? (isUnitPortal ? 'unit' : 'dashboard')
  const activeLabel = nav.find((n) => n.id === active)?.label || 'Dashboard'
  const activePath = nav.find((n) => n.id === active)?.path || homePath
  const displayName =
    session?.user?.name || session?.user?.username || (kind === 'customer' ? 'Customer' : 'User')
  const initial = displayName.charAt(0).toUpperCase()
  const showSection = active !== 'dashboard'
  const isCustomers = active === 'customers'
  const hideHeaderSearch =
    active === 'transactions' ||
    active === 'credit' ||
    active === 'debit' ||
    active === 'unit' ||
    isUnitPortal
  const shortAddress = truncateAddress(company.address)

  useEffect(() => {
    setQuery('')
  }, [location.pathname])

  useEffect(() => {
    let cancelled = false
    loadCompany()
      .then((data) => {
        if (!cancelled) setCompany(data)
      })
      .catch(() => {
        /* keep fallback */
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (isCustomerPortal || isUnitPortal) return
    void enablePush().catch(() => {
      /* permission denied or unsupported */
    })
  }, [isCustomerPortal, isUnitPortal])

  useEffect(() => {
    if (!mobileMenuOpen && !companyCardOpen) return

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node
      if (mobileMenuOpen && mobileMenuRef.current && !mobileMenuRef.current.contains(target)) {
        setMobileMenuOpen(false)
      }
      if (companyCardOpen && companyBrandRef.current && !companyBrandRef.current.contains(target)) {
        setCompanyCardOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
        setCompanyCardOpen(false)
        setDesktopMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [mobileMenuOpen, companyCardOpen])

  useEffect(() => {
    setMobileMenuOpen(false)
    setDesktopMenuOpen(false)
    setCompanyCardOpen(false)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.pathname])

  useEffect(() => {
    if (active !== 'dashboard' || isCustomerPortal) return
    prefetchDashboardPages()
  }, [active, isCustomerPortal])

  useEffect(() => {
    if (!logoutConfirmOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !loggingOut) setLogoutConfirmOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [logoutConfirmOpen, loggingOut])

  useEffect(() => {
    return () => {
      if (desktopHoverTimer.current) window.clearTimeout(desktopHoverTimer.current)
    }
  }, [])

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await disablePush().catch(() => {
        /* still log out */
      })
      await apiLogout()
      clearPageCache()
      setLogoutConfirmOpen(false)
      toast.info('You have been logged out.')
      navigate('/login', { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }

  function requestLogout() {
    setDesktopMenuOpen(false)
    setMobileMenuOpen(false)
    setLogoutConfirmOpen(true)
  }

  function openDesktopMenu() {
    if (desktopHoverTimer.current) window.clearTimeout(desktopHoverTimer.current)
    setDesktopMenuOpen(true)
  }

  function scheduleCloseDesktopMenu() {
    if (desktopHoverTimer.current) window.clearTimeout(desktopHoverTimer.current)
    desktopHoverTimer.current = window.setTimeout(() => setDesktopMenuOpen(false), 160)
  }

  return (
    <div className="grid min-h-dvh bg-surface text-ink lg:grid-cols-[250px_1fr]">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[45] border-0 bg-ink/35 lg:hidden"
          aria-label="Close menu"
          onClick={() => {
            setSidebarOpen(false)
            setCompanyCardOpen(false)
          }}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 flex h-dvh w-[min(280px,86vw)] flex-col gap-4 border-r border-line bg-white p-4 pt-5 pb-[calc(5.75rem+env(safe-area-inset-bottom))] transition-transform duration-300 lg:sticky lg:z-auto lg:w-auto lg:translate-x-0 lg:overflow-visible lg:pb-4 ${
          sidebarOpen
            ? 'translate-x-0 overflow-visible shadow-[12px_0_40px_rgba(0,0,0,0.12)]'
            : '-translate-x-[105%] overflow-hidden lg:translate-x-0 lg:overflow-visible'
        }`}
        aria-label="Main navigation"
      >
        <div ref={companyBrandRef} className="relative z-40 shrink-0 px-0.5 pb-1">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-2xl border-0 bg-transparent p-1.5 text-left hover:bg-[#f7f8fa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuel"
            aria-expanded={companyCardOpen}
            aria-haspopup="dialog"
            onClick={() => setCompanyCardOpen((v) => !v)}
            onMouseEnter={() => {
              if (window.matchMedia('(hover: hover)').matches) setCompanyCardOpen(true)
            }}
            onFocus={() => setCompanyCardOpen(true)}
          >
            <CompanyLogo logoUrl={company.logoUrl} size={40} />
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-[0.95rem] font-extrabold tracking-[-0.02em] leading-tight text-ink">
                {company.name}
              </strong>
              <span className="mt-0.5 block truncate text-[0.68rem] font-medium text-muted">
                {shortAddress || 'Company profile'}
              </span>
            </div>
          </button>

          {companyCardOpen ? (
            <div
              role="dialog"
              aria-label="Company details"
              className="absolute top-[calc(100%+0.4rem)] left-0 right-0 z-50 box-border rounded-2xl border border-line bg-white p-3.5 shadow-[0_16px_40px_rgba(26,29,33,0.16)]"
              onMouseLeave={() => {
                if (window.matchMedia('(hover: hover)').matches) setCompanyCardOpen(false)
              }}
            >
              <div className="flex items-start gap-3">
                <CompanyLogo logoUrl={company.logoUrl} size={52} rounded="xl" />
                <div className="min-w-0 flex-1 pr-0.5">
                  <p className="m-0 break-words text-[0.92rem] font-extrabold leading-snug tracking-[-0.02em] text-ink">
                    {company.name}
                  </p>
                  {company.phone ? (
                    <p className="mt-1 mb-0 text-[0.75rem] font-semibold text-[#c99700]">
                      {company.phone}
                    </p>
                  ) : null}
                </div>
              </div>
              {company.address ? (
                <p className="mt-3 mb-0 break-words rounded-xl bg-[#fafbfc] px-3 py-2.5 text-[0.78rem] font-medium leading-relaxed text-[#4b5563]">
                  {company.address}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain">
          {nav.map((item) => {
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  navigate(item.path)
                  setSidebarOpen(false)
                  setCompanyCardOpen(false)
                }}
                className={`flex w-full items-center gap-3 rounded-[0.9rem] border-0 px-[0.95rem] py-[0.78rem] text-left text-[0.9rem] font-semibold transition ${
                  isActive
                    ? 'bg-linear-to-r from-fuel via-[#ffe58a] to-[#fff3c0] text-ink shadow-[0_6px_16px_rgba(245,197,24,0.28)]'
                    : 'bg-transparent text-[#4b5563] hover:bg-[#f7f8fa] hover:text-ink'
                }`}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col pb-[6.25rem] lg:pb-0">
        <header className="sticky top-0 z-40 flex items-center justify-between bg-surface/95 px-4 py-3 backdrop-blur-md lg:hidden">
          <button
            type="button"
            className="grid size-10 place-items-center rounded-xl border-0 bg-transparent text-ink"
            aria-label="Open menu"
            onClick={() => setSidebarOpen(true)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <div className="flex min-w-0 items-center gap-2 px-1">
            <CompanyLogo logoUrl={company.logoUrl} size={28} />
            <strong className="max-w-[9.5rem] truncate text-[0.95rem] font-extrabold tracking-[-0.02em]">
              {company.name}
            </strong>
          </div>
          <div ref={mobileMenuRef} className="relative">
            <button
              type="button"
              className="grid size-10 place-items-center rounded-full border-0 bg-fuel text-sm font-extrabold text-ink"
              aria-label="Account menu"
              aria-expanded={mobileMenuOpen}
              aria-haspopup="menu"
              onClick={() => setMobileMenuOpen((v) => !v)}
            >
              {initial}
            </button>
            {mobileMenuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+0.45rem)] z-50 min-w-[11.5rem] overflow-hidden rounded-xl border border-line bg-white py-1 shadow-[0_12px_28px_rgba(26,29,33,0.14)]"
              >
                <div className="border-b border-line px-3.5 py-2.5">
                  <p className="m-0 truncate text-[0.85rem] font-bold text-ink">{displayName}</p>
                  <p className="mt-0.5 mb-0 truncate text-[0.72rem] font-medium text-muted">{roleLabel}</p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 border-0 bg-transparent px-3.5 py-2.5 text-left text-[0.85rem] font-semibold text-[#c62828] hover:bg-[#fff5f5]"
                  onClick={requestLogout}
                >
                  <LogoutIcon />
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <header className="sticky top-0 z-40 hidden items-center gap-4 border-b border-transparent bg-surface/90 px-6 py-3.5 backdrop-blur-[10px] lg:grid lg:grid-cols-[1fr_auto]">
          {hideHeaderSearch ? (
            <div />
          ) : (
            <label className="mx-auto flex w-full max-w-[520px] items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-muted shadow-[0_2px_10px_rgba(26,29,33,0.03)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
                <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                placeholder={isCustomers ? 'Search accounts...' : 'Search here...'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full border-0 bg-transparent text-[0.9rem] text-ink outline-none"
              />
            </label>
          )}
          <div className="flex items-center justify-end gap-3">
            <div
              ref={desktopMenuRef}
              className="relative"
              onMouseEnter={openDesktopMenu}
              onMouseLeave={scheduleCloseDesktopMenu}
            >
              <button
                type="button"
                className="flex items-center gap-2.5 rounded-full border-0 bg-transparent py-1 pr-1 pl-1 hover:bg-white/80"
                aria-expanded={desktopMenuOpen}
                aria-haspopup="menu"
                onClick={() => setDesktopMenuOpen((v) => !v)}
              >
                <div
                  className="grid size-9 place-items-center rounded-full bg-fuel text-xs font-extrabold text-ink"
                  aria-hidden
                >
                  {initial}
                </div>
                <div className="text-left">
                  <strong className="block text-[0.85rem] font-bold">{displayName}</strong>
                  <span className="block text-[0.72rem] text-muted">{roleLabel}</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-muted">
                  <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>

              {desktopMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+0.35rem)] z-50 min-w-[10rem] overflow-hidden rounded-xl border border-line bg-white py-1 shadow-[0_12px_28px_rgba(26,29,33,0.14)]"
                  onMouseEnter={openDesktopMenu}
                  onMouseLeave={scheduleCloseDesktopMenu}
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 border-0 bg-transparent px-3.5 py-2.5 text-left text-[0.85rem] font-semibold text-[#c62828] hover:bg-[#fff5f5]"
                    onClick={requestLogout}
                  >
                    <LogoutIcon />
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-3.5 px-4 pb-4 pt-1 lg:gap-[1.15rem] lg:px-6 lg:pb-8 lg:pt-2">
          {isUnitPortal || active === 'unit' ? (
            <UnitDashboardPage />
          ) : isCustomerPortal && isCustomerGroups ? (
            <CustomerPortalGroups homePath={homePath} groupsPath={customerGroupsPath} />
          ) : isCustomerPortal && active === 'dashboard' ? (
            <CustomerPortalHome txPath={txPath} groupsPath={customerGroupsPath} />
          ) : isCustomerPortal && active === 'transactions' ? (
            <CustomerPortalTransactions homePath={homePath} />
          ) : active === 'customers' ? (
            <CustomersPage
              searchQuery={query}
              onSearchChange={setQuery}
              txPath={txPath}
            />
          ) : active === 'transactions' ? (
            <TransactionsPage homePath={homePath} />
          ) : active === 'credit' ? (
            <CreditPage homePath={homePath} txPath={txPath} />
          ) : active === 'debit' ? (
            <DebitPage homePath={homePath} txPath={txPath} />
          ) : active === 'cashbook' ? (
            <CashBookPage homePath={homePath} />
          ) : active === 'reports' ? (
            <ReportsPage
              homePath={homePath}
              stockPath={stockPath}
              txPath={txPath}
              searchQuery={query}
              onSearchChange={setQuery}
            />
          ) : active === 'chartOfAccounts' ? (
            <ChartOfAccountsPage
              homePath={homePath}
              coaPath={coaNav?.path ?? '/chart-of-accounts'}
              searchQuery={query}
              onSearchChange={setQuery}
            />
          ) : showSection ? (
            <SectionPlaceholder title={activeLabel} path={activePath} />
          ) : (
            <DashboardHome
              txPath={txPath}
              searchQuery={query}
              onSearchChange={setQuery}
            />
          )}
        </div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-1 pt-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(26,29,33,0.06)] backdrop-blur-md lg:hidden"
        aria-label="Mobile navigation"
      >
        <div
          className={`relative mx-auto grid h-14 max-w-lg items-center ${
            bottomNav.length >= 5 ? 'grid-cols-5' : bottomNav.length === 4 ? 'grid-cols-4' : 'grid-cols-3'
          }`}
        >
          {bottomNav.map((item) => {
            if (item.id === 'fab') {
              return (
                <div key={item.id} className="relative flex h-full items-center justify-center">
                  <button
                    type="button"
                    aria-label="Add"
                    onClick={() => navigate(item.path)}
                    className="absolute -top-7 grid size-14 place-items-center rounded-full border-[3px] border-white bg-fuel text-white shadow-[0_10px_28px_rgba(245,197,24,0.5)]"
                  >
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M12 5v14M5 12h14"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              )
            }

            const activeTab =
              item.id === 'home'
                ? location.pathname === homePath
                : item.id === 'customers' && customersNav
                  ? location.pathname === customersNav.path ||
                    location.pathname.startsWith(`${customersNav.path}/`)
                  : item.id === 'reports'
                    ? location.pathname === item.path ||
                      location.pathname.startsWith(`${item.path}/`)
                    : location.pathname === item.path

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.path)}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 border-0 bg-transparent px-0.5 ${
                  activeTab ? 'text-fuel' : 'text-[#8B93A1]'
                }`}
              >
                <BottomIcon name={item.icon} />
                <span className="max-w-full truncate text-[0.62rem] font-semibold leading-none tracking-[0.01em]">
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            className="absolute inset-0 border-0 bg-ink/45 backdrop-blur-[2px]"
            aria-label="Close logout confirmation"
            disabled={loggingOut}
            onClick={() => {
              if (!loggingOut) setLogoutConfirmOpen(false)
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
            className="relative z-10 w-full max-w-[22rem] rounded-2xl border border-line bg-white p-5 shadow-[0_20px_50px_rgba(26,29,33,0.2)] animate-rise"
          >
            <h2
              id="logout-confirm-title"
              className="m-0 text-[1.1rem] font-extrabold tracking-[-0.02em] text-ink"
            >
              LogOut Confirmation
            </h2>
            <p className="mt-2 mb-0 text-[0.88rem] font-medium leading-relaxed text-muted">
              Are you sure you want to log out?
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => setLogoutConfirmOpen(false)}
                className="cursor-pointer rounded-xl border border-line bg-white px-4 py-2.5 text-[0.85rem] font-bold text-ink hover:bg-[#f7f8fa] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loggingOut}
                onClick={handleLogout}
                className="cursor-pointer rounded-xl border-0 bg-[#e11d48] px-4 py-2.5 text-[0.85rem] font-bold text-white shadow-[0_6px_14px_rgba(225,29,72,0.28)] hover:brightness-95 disabled:opacity-50"
              >
                {loggingOut ? 'Logging out…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CompanyLogo({
  logoUrl,
  size,
  rounded = 'full',
}: {
  logoUrl: string | null
  size: number
  rounded?: 'full' | 'xl'
}) {
  const radius = rounded === 'xl' ? 'rounded-xl' : 'rounded-full'
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 object-cover ring-1 ring-black/5 ${radius}`}
        style={{ width: size, height: size }}
      />
    )
  }
  return <BrandMark size={size} className="shrink-0" />
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M14 8l4 4-4 4M18 12H10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
