# Fuel Pro — Shared Agent Context

## Project
- Repo: Petroleum-App-Enhancement (cloned into `/home/hanan/fuel-pro`)
- Frontend: Vite + React + Tailwind (`npm run dev`) — default Vite port **5173**
- Backend: Express API in `server/` (`npm run dev:api`) — default **PORT=4000**
- Vite proxies `/api` → `http://127.0.0.1:4001` (hardcoded; BE tmux uses PORT=4001)
- Dev CORS allows public/LAN Origin (e.g. `http://169.58.29.84:5173`), not only localhost
- SQL Server expected on **1433** (`DB_PORT` in `server/.env.example`)

## Server host
- Public IP: `169.58.29.84`
- User: `hanan`

## Port check (2026-08-26)

### Already in use (do not bind these for new FE/BE without stopping existing process)
| Port | Status | Notes |
|------|--------|-------|
| 4000 | IN USE | Project default BE — something already listening on `*:4000` |
| 5173 | IN USE | Project default FE (Vite) — listening on `127.0.0.1:5173` |
| 5180 | IN USE | Another Vite-like local listener |
| 1433 | IN USE | SQL Server (Docker/host) — needed by BE |
| 80 / 443 / 8443 | IN USE | HTTP/HTTPS / alt TLS |
| 22 | IN USE | SSH |
| 5432 | IN USE | PostgreSQL (localhost) |
| 7771–7777 | IN USE | Other services |
| 44444 | IN USE | Other service |

### Free / available for FE & BE alternatives
| Port | Suggested use |
|------|----------------|
| **5174** | Frontend (Vite alt) if 5173 busy |
| **3000** / **3001** | Frontend alt |
| **4173** | Vite preview |
| **5000** | Backend alt |
| **8000** / **8080** / **8081** | Backend alt |
| **8888** / **9000** | General free |

### Recommended for this project
- **FE**: prefer **5173** (default). If conflict → **5174** (update CORS if changed).
- **BE**: prefer **4000** (default). If conflict → **5000** or **8080** (update Vite proxy + `PORT` in `server/.env`).

## Run with host (network access)

Defaults `5173` / `4000` are busy — use free ports:

```bash
# Terminal 1 — Backend (already binds 0.0.0.0 by default)
cd /home/hanan/fuel-pro/server
PORT=5000 npm run dev

# Terminal 2 — Frontend with --host
cd /home/hanan/fuel-pro
npm run dev -- --host 0.0.0.0 --port 5174
```

- FE URL: `http://169.58.29.84:5174`
- BE URL: `http://169.58.29.84:5000`
- If FE uses Vite proxy, set proxy target to `http://127.0.0.1:5000` and add public FE origin to `CORS_ORIGIN`.

## Transactions page (2026-08-26, live)

**Status:** Live SQL via `GET /api/transactions`. Dummy `transactionsData.ts` removed.

### Files
- `src/dashboard/TransactionsPage.tsx` — filters, live summary, table/cards, lazy reveal + pager
- `src/dashboard/transactions.ts` — types + `fetchTransactions` / `fetchTransactionCustomers`
- `server/src/transactionRoutes.js` — SELECT-only list/summary + customer names
- Wired in `DashboardShell` when `active === 'transactions'` (all roles: `/transactions`, `/accountant/transactions`, `/user/transactions`)

### Behavior
- Prefetch on login/dashboard: first 50 rows + summary + AccReg names (`pageCache.ts`)
- First paint **15** rows; after ~5th row / sentinel reveal **+15** until 50; numbered pager for the next 50 (scrolls to top)
- Filters: searchable customer menu (All customers + typeahead), From/To dates, type menu, Reset + Filter — dropdowns stack above summary cards
- Summary: live COUNT / SUM(Credit) / SUM(Debit) / Net Flow (Credit − Debit). No dummy percentages
- Table: ledger-style double-entry rows — **Date**, **V.No**, **Account Name**, **Type** (payment mode: Online / Transfer / Cash from `SlipType` + `Description` + account), **Debit**, **Credit**. Each voucher shows 2 rows (debit leg + credit leg) like the legacy report.
- **2026-08-28:** Pair debit/credit legs by **matching amount** + same date/type; show **same V.No** on both rows (Slip entries often use different VNo per leg in DB, e.g. 272/273). **Debit row first, credit row second**. Single-leg **Slip** rows (no counter-entry in DB — common for Awais Corporation fuel slips) get a synthetic **Cash In Hand** opposite line so the table always shows 2 rows per voucher like the legacy report.
- Removed: ID column, Export, “Showing 1 to 10” / n-per-page dropdown
- Route changes (sidebar) also scroll to top via `DashboardShell`

## Credit page (2026-08-26)

**Status:** Dummy UI done — responsive desktop + mobile. No Add Credit form (deferred). Theme uses existing FuelLedger yellow (`fuel`), not purple.

### Files
- `src/dashboard/CreditPage.tsx`
- `src/dashboard/creditData.ts`
- Wired in `DashboardShell` when `active === 'credit'` (`/credit`, `/accountant/credit`)

### UI
- Desktop: title + breadcrumbs, Filter + Add Credit (toast stub), 4 summary cards, recent credits table (View All → tx path)
- Mobile: title + subtitle, horizontal pastel summary strip, recent list with green +amounts
- Explicitly omitted: Add Credit Transaction form card

## Debit page (2026-08-26)

**Status:** Dummy UI done — same pattern as Credit. No Add Debit form. FuelLedger yellow theme (no purple).

### Files
- `src/dashboard/DebitPage.tsx`
- `src/dashboard/debitData.ts`
- Wired in `DashboardShell` when `active === 'debit'` (`/debit`, `/accountant/debit`)

### UI
- Desktop: title + breadcrumbs, Filter + Add Debit (toast stub), 4 summary cards, recent debit table (ID, Customer, Date, Product, Qty, Rate, Amount red, Balance, Created By)
- Mobile: title + subtitle, horizontal pastel summary strip, recent list with red `-amounts`
- Explicitly omitted: Add Debit Transaction form card

## Settings removed (2026-08-26)
- Removed Settings from sidebar nav, routes (`/settings`, `/accountant/settings`, `/user/settings`), and profile menu.
- Profile menu now only has Logout. Bottom "More" opens sidebar (path → reports).

## Logout confirm modal (2026-08-26)
- Logout in profile menu opens confirmation dialog; Confirm runs `apiLogout`, Cancel/backdrop/Esc closes.

## Merge conflict resolve (2026-08-26)
- Conflict only in `DashboardShell.tsx` after `git pull origin main --no-rebase`.
- Kept both: remote `CustomersPage` + local Transactions/Credit/Debit routing + logout modal.
- Settings remains removed (`showSection = active !== 'dashboard'`, `isCustomers = active === 'customers'`).
- Staged resolution; merge commit still needed by user if not committed yet.

## Merge conflict resolve (2026-08-26, Reports + pageCache)
- Unmerged: `src/dashboard/DashboardShell.tsx` on `feature/CustomerPage` while merging Reports from main.
- Resolution: keep **both** `pageCache` (`clearPageCache` / `prefetchDashboardPages`) and `ReportsPage` imports.
- Bottom nav: incoming renamed More → Reports (real page). Dropped HEAD `more`/`moreActive` + sidebar-open click. Kept HEAD nested Customers path match so details URLs stay on the Customers tab.
- Staged; merge commit not created unless requested.

## Customer Details page (2026-08-26, live)

- Opens at `/customers/{slug}` (or `/accountant/customers/{slug}`) — slug is `kebab-name-accid`, data loaded via `GET /api/customers/slug/:slug`
- **No** +Credit / +Debit buttons; **View All Transactions removed**
- Fields: AccNo (Customer ID), NIC (CNIC), Opening (ledger before today), Closing (full SUM Debit-Credit), name/phone/email/address/notes/Dated
- Summary: SUM(Credit), SUM(Debit), COUNT(Trid) — credit is 0 when Leger.Credit is 0 in DB
- History table uses `table-fixed`; long Product/Service wraps (2 lines); amounts stack PKR so columns stay inside the card.
- History date filter is **From – To** range (`dateFrom`/`dateTo` query params, inclusive). Empty range = all dates. Tab switch clears the range.
- Shared `src/dashboard/filters.tsx`: DateRangeFilter + MenuFilter. Entire control is clickable (`showPicker` / custom list). Customers list Status/Type use the styled menu; list date is From–To on `AccReg.Dated`.
- Dashboard prefetch: login + every visit to dashboard starts background fetch of customers (40) + groups + **live** transactions page 1 (50) + transaction customer names (`pageCache.ts`). Customers list shows 15, then +15 after scrolling ~5 rows (API batch 40). LoadingHint spinner with text.

## Customer details split (2026-08-26)

`CustomerDetailsPage.tsx` was 1000+ lines; split without behavior change. `CustomersPage` still imports `./CustomerDetailsPage`.

| File | Role |
|------|------|
| `dashboard/CustomerDetailsPage.tsx` | Fetch slug, tab/date/sort state, compose panels (~100 lines) |
| `dashboard/customerDetails/useCustomerHistory.ts` | Lazy history fetch / reveal / prefetch hook |
| `dashboard/customerDetails/Profile.tsx` | Back nav, profile, balances, info, summary |
| `dashboard/customerDetails/HistoryPanel.tsx` | Tabs, date/sort, mobile list + desktop table + intersection observers |
| `dashboard/customerDetails/ui.tsx` | Pills, chips, cards, table cells, icons |

Verified: login → `/customers` → open **Aarzi Dasti Khata** → details/info/summary/history → Credit History tab → Back to Customers.

## Backend inventory (2026-08-26, updated)

- **Only backend:** `app-enhancement/server/` — Express 5 + `mssql` (tedious). No Nest/Prisma.
- **Routes:** health, auth login/logout/me, **customers list/groups/slug/:slug/:accid/:accid/transactions**, **transactions list/customers**
- **SQL:** parameterized SELECT on `UserReg`, `AccReg`, `Leger`, `GroupReg` — never INSERT/UPDATE/DELETE
- **Auth:** JWT HS256 (`fl_token` + Bearer) + `requireRoles(Administrator, Accountant)` on customer routes + `requireRoles(Administrator, Accountant, User)` on transaction routes + `X-FuelLedger-Key` (`API_READ_KEY`) + 60/min rate limit
- **DB env:** `server/.env` — `DB_*`, `JWT_*`, `API_READ_KEY`
- **FE:** `src/lib/api.ts` sends Bearer + key; `customers.ts` is live helpers (mock array removed)
- **Balance:** `ISNULL(OpBal,0) + SUM(Debit) - SUM(Credit)`; history running balance via window on Trid; include Posted + NULL ledger rows

## Reports page (2026-08-30, Stock statement)

**Status:** Page heading is **Stock statement**. Nav label **Stock** (path still `/reports`). Filters/KPIs removed. Live SQL via `GET /api/reports/stock-statement`.

### Files
- `server/src/reportsRoutes.js` — `GET /stock-statement` + `GET /stock-statement/:itemId` ledger
- `src/dashboard/reports.ts` — `fetchStockStatement` / `fetchStockLedger` + formatters
- `src/dashboard/ReportsPage.tsx` — list with **Open ›** (COA-style); routes to item ledger
- `src/dashboard/StockLedgerPage.tsx` — full stock ledger detail (Date, V.No, Description, SX, Rate, Reference, Stock In, Stock Out, Balance)

### List columns (from DB)
- **Item Name** — `ItemId` + `ItemReg.ItemName`
- **Stock** / **Last Rate** / **Stock Value** — `StockValue` view + `ItemReg.PrRate`
- **Total box** — sum of Stock Value
- Row click / Open → `/reports/item/:itemId` (accountant/user prefixes too)

### Stock Ledger detail
- Header: date range (min–max), Item ID, Item Name, Brand (`BrandReg`), Opening Stock `0.00`
- Rows from `Stockleger` with running Balance; Rate = RateIn (in) or RateOut (out)
- Bottom boxes: Total Stock In, Total Stock Out, Closing Balance, **Total Stock Value**
- Back returns to stock statement; sidebar stays on Stock

### Notes
- Older `/api/reports/filters|summary|products|recent` unused by this page
- Dummy `reportsData.ts` unused

## Reports page (2026-08-26)
- `src/dashboard/ReportsPage.tsx` + `reportsData.ts` — dummy UI
- Desktop: filters (+ product), Export, Generate, 4 KPIs, Product / Service Summary table only (no period selector on card; Top Customers removed 2026-08-28)
- Mobile: filters (no product), Generate, 2×2 KPIs, Recent Transactions
- Charts removed: Credit vs Debit, Daily Net Flow
- Wired in `DashboardShell` when `active === 'reports'`; bottom nav **Reports**

## Cash Book (2026-08-31, live write)

**Status:** Full entry + save. Route `/cashbook` (+ accountant). Nav **Cash Book**.

### Files
- `server/src/cashbookRoutes.js` — accounts, meta (VNo/DNo/Cash In Hand), WEB entries list, POST dual INSERT
- `src/dashboard/cashbook.ts` — FE helpers + `saveCashbookEntry`
- `src/dashboard/CashBookPage.tsx` — form + WEB table
- `src/lib/api.ts` — `apiPost`

### Save rules
- Dated/Timed = server now (no date picker)
- **VNo** always auto: `COUNT(VNo)/2+1 WHERE RefNo='WEB'` (never skipped)
- **MVNo** optional: editable Voucher # field; if user types a manual number → `Leger.MVNo`; if left as auto display (untouched) → MVNo empty. VNo still saved either way.
- DNo: `ISNULL(MAX(DNo),0)+1 WHERE BizId=@bizId`
- Two `Leger` rows: Debit leg + Credit leg; `Type='JV'`, `RefNo='WEB'`
- Description: `{text} From {other account name}`
- **Bal:** new (post-entry) balance — debit `old+amount`, credit `old−amount`
- **Remarks:** `OldBal=<pre-entry Acc Bal>` (entry-time current balance shown on form)
- Cash Payment → credit locked Cash In Hand; Cash Received → debit locked Cash In Hand + credit row above debit
- **Voucher type change:** clears debit/credit account fields, then re-applies Cash In Hand lock if needed
- **Enter key:** moves to next form field; on Amount → same `handleSave()` as Save button (locked fields skipped in order)

## Chart of Accounts (2026-08-28, live)

**Status:** Steps 1–3 UI unchanged; live SQL. Step 4 = separate **Account Ledger** page on account click.

### Navigation (4 levels)
1. **Charts** — `ChartAcc` via `GET /api/chart-of-accounts/charts` (counts every `GroupReg` / `AccReg` under the chart, including accounts with no ledger)
2. **Sub Charts** — all groups for `ChartId`; account count = all `AccReg`; balance from `Leger` + `BizId` (0 if none)
3. **Accounts** — all `AccReg` in the group (`LEFT JOIN Leger`); ledger-less accounts still listed, balance 0
4. **Account Ledger** (new page, same shell) — `/chart-of-accounts/account/:accid` (+ accountant/user prefixes). Transactions + fuel summary (HSD/PMG/HO/Advance/Others). List always **oldest first** by `Trid ASC` (Recent/Oldest control removed).

### Files
- `server/src/coaRoutes.js` — charts, sub-charts, accounts, account detail, transactions, fuel summary (SELECT only; `BizId` from `CompanyPro.CompanyId`)
- `src/dashboard/chartOfAccounts.ts` — FE API helpers
- `src/dashboard/ChartOfAccountsPage.tsx` — steps 1–3 (UI same as dummy); account row → navigate to ledger
- `src/dashboard/CoaAccountLedgerPage.tsx` — step 4 transactions page
- `src/dashboard/coa/useCoaAccountHistory.ts` — lazy transaction load
- Routes: `App.tsx` + nested active tab in `DashboardShell` (like customers)
- Auth: Administrator, Accountant, **User** (all roles with COA nav)
- Sidebar order: Dashboard → **Chart of Accounts** (2nd) → Customers → …

### Back navigation
- Ledger **Back** returns to accounts list with `location.state.coaBack` restoring chart + sub-chart drill-down.

### Legacy
- `chartOfAccountsData.ts` — dummy data unused after live wiring; safe to remove later.

## Chart of Accounts — removed (2026-08-28)
- Restored from `main`; dummy UI in `ChartOfAccountsPage.tsx` + `chartOfAccountsData.ts`.
- **2026-08-28:** Removed **Code**, **Description**, **Type** columns (desktop + mobile) at all COA levels.

## Merge conflict resolve (2026-08-27, company brand)
- Unmerged: `src/dashboard/DashboardShell.tsx` on `feature/CustomerPage`.
- Working tree had dropped both import blocks while the body still used company helpers and `ChartOfAccountsPage`.
- Resolution: keep HEAD company brand (`./company`, pageCache, nested Customers tab, logout menus) **and** incoming `ChartOfAccountsPage` import/route.
- Staged; merge commit not created unless requested.

## Merge conflict resolve (2026-09-08, stash apply)

- Conflicts were leftover stash markers (`Updated upstream` vs `Stashed changes`), not a git merge.
- `CashBookPage.tsx`: kept upstream `visibleEntries` + `openPreview` (Print preview + date-filtered WEB table). Stash had deleted them while the rest of the file still called them.
- `CustomersPage.tsx`: kept upstream Search Account `z-0` (logout menu above filters), `MobileSearchField`, and filter grid `z-20`. Dropped stash `z-10` without the mobile search field.
- This `Cursor.MD` had **no** conflict markers.

## UNIT portal (2026-10-10)

Ported from Sukka-petrol into FatimaFS. View-only PTS pump summary.

- Roles: `Unit` → `/unit/dashboard` (nav = UNIT only); `Administrator` → sidebar **UNIT** → `/unit`; Accountant/Customer/User → no tab, API 403
- API: `GET /api/unit/dashboard?duty_no=` — `requireRoles('Unit','Administrator')` + read key
- SQL: today = `Timed` day window; duty = `DNo`; Opening = Max(Reading1)−Sum(Qty); Closing = Max(Reading1)
- FE: `UnitDashboardPage.tsx`, `unitDashboard.ts`, `unitConfig()`, shell `kind === 'unit'`
- Company API allows Unit for shell brand. No PTS writes. No push for Unit portal.

## Agent notes
- Multiple agents: read this file before work; update after meaningful changes.
- 2026-08-27: Public login 403 was CORS + proxy port. Vite now proxies to **4001**. Dev CORS allows `--host` public Origin. Both tmux sessions restarted.
- 2026-08-29: UI: COA ledger top fuel cards removed; Customers Status dropdown removed; Reports Export/Generate + demo dates removed; Tx/Credit/Debit auto-filter, Reset/Filter buttons removed.
- 2026-08-30: Reports page → **Stock statement**. Removed all filters + KPI cards. Table columns: Item Name, Stock, Last Rate, Stock Value from `ItemReg`/`StockValue`. Total Stock Value box under the last column. Backend `GET /api/reports/stock-statement`. API restarted on :4001.
- 2026-08-30: Nav **Reports** → **Stock**. Stock row Open › opens **Stock Ledger** (`/reports/item/:itemId`) from `Stockleger` (Date, V.No, Description, SX, Rate, Reference, In, Out, Balance) + bottom total boxes including Total Stock Value.
- 2026-08-30: **Credit/Debit save research (read-only):** No SQL stored procedures / triggers in DB. Money lives in `dbo.Leger.Debit` / `dbo.Leger.Credit`. Customer fuel/receipts also write `Slip` + `SlipDet`. Simple balanced entries use `Type='JV'` (2 legs, same VNo). Stock qty for duty/purchase uses `Stockleger` (`RefNo` DSales/Purchases/Sales — not Slip). Current API remains SELECT-only.
- 2026-08-31: **Cash Book** (`/cashbook`, Admin+Accountant). FuelLedger theme. AccNo Ref dropdown + name-only account dropdowns; Acc Bal boxes. **Save live:** auto Dated/Timed; VNo from `COUNT(VNo)/2+1 WHERE RefNo='WEB'` (read-only); DNo `MAX+1`; dual parameterized `Leger` INSERT (`Type=JV`, `RefNo=WEB`); Cash Payment locks credit=Cash In Hand (Accid 1); Cash Received locks debit=Cash In Hand and shows Credit row above Debit; other types both editable. Bottom table = WEB entries only. APIs: `GET /accounts|/meta|/entries`, `POST /entries`. `apiPost` in `lib/api.ts`.
- 2026-08-31: Cash Book **Enter** = next field; Enter on Amount = save (same validation as Save btn).
- 2026-08-31: Cash Book — voucher type change clears accounts; Voucher # editable → optional **MVNo**; **VNo** always auto; **Bal** = Acc Bal box value.
- 2026-08-31: Mobile — sidebar/backdrop above page filters; bottom **+** FAB → Cash Book.
- 2026-09-08: Live deploy of current FE/BE to `https://fatimafs.alicomz.com` (`npm run build` → `/var/www/html/fatimafs`, restart `fatimafs-api`). HTTP→HTTPS 301. Deploy copies in `app-enhancement/deploy/`.
- 2026-09-09: Credit/Debit table columns reordered in `KindLedgerPage`: Date, REF, Account (bold highlight), Product / Service, Amount, Balance, Created By — matches Cash Book AccName/header style.
- 2026-09-09: Same Cash Book table header style on Transactions, Search Account, COA, Stock (+ ledger); live deploy to fatimafs.
- 2026-09-09: Cash Book `Leger.Bal` = **new** balance; `Remarks` = `OldBal=<entry-time Acc Bal>`. Fixed WEB 50755/50756.
- 2026-09-13: **Login subtitle** — "Sign in to AliComz" → "Sign in to Fatima FS".
- 2026-09-13: **Stock ledger** — paginated 20 + scroll more; From/To date filter; ascending by date. FE needs deploy for live site.
- 2026-09-13: **COA account ledger** — Recent/Oldest dropdown removed; list always oldest-first by `Trid ASC` (JV-449 before JV-450).
- 2026-09-13: **Date filter spacing** — From/To always grouped in one flex row; narrower date boxes (`9.25rem`).
- 2026-09-14: **Transactions Group filter** — Type (Credit/Debit) UI removed; Group filter added (unposted only). **COA sub-chart** — From/To + all-account transactions under accounts list; 30/10 infinite scroll; Posted+Unposted.
- 2026-09-14: **Live deploy** — build → `/var/www/html/fatimafs`; restarted `fatimafs-api`. https://fatimafs.alicomz.com 200.
- 2026-09-14: **COA tx columns** — sub-chart table = Transactions fields (Date, V.No, Account, Description, Type, Debit, Credit, Acc Bal.) + Total Debit/Credit under table; redeployed (`index-Baxv877O.js`).
- 2026-09-14: **COA accounts cols** — Normal Balance + Status removed; Debit + Credit totals after Balance; live `index-CoRxvhFB.js`.
- 2026-09-14: **COA date Search** — default From=month 01 / To=today; Search applies filter to accounts Debit/Credit + transactions; live `index-Bmf0bfzE.js`.
- 2026-09-15: **Fuel Sales + Sales page** — Balance Trend removed. Dashboard Fuel Sales chart = last 20 PTS DNo (Diesel/Petrol/Udhar=Total−Cash). SELECT-only `GET /api/sales/trend` + `GET /api/sales`. Sales page `/sales` + `/accountant/sales`. View More on chart. No PTS writes.
- 2026-09-15: **Live deploy** — `index-DGXA3w5b.js` → `/var/www/html/fatimafs`; `fatimafs-api` restarted; site 200 + db:up.
- 2026-09-15: **Fuel Sales table** — dashboard chart replaced with 20-row table (Date, ItemQty, Rate, Amount, Cash, Udhar); Sales page all columns. Live `index-DcRDOOeS.js`.
- 2026-09-15: **Dashboard fuel cards + Banks** — Sales page removed. 4 cards Diesel/Petrol/Cash/Udhar; Banks panel with Total Balance. Live `index-DJay2R15.js`.
- 2026-09-15: **+ Total diesel/petrol** — 6 cards (Cash/Udhar + Total Diesel + Total Petrol, max DNo Qty L). Live `index-DOFacFsB.js`.
- 2026-09-15: **Fuel card order** — Total Diesel → Cash → Udhar; Total Petrol → Cash → Udhar.
- 2026-09-16: **Fuel panel replaces chart** — Credit vs Debit removed; Fuel Sales 2-col Diesel|Petrol (Total→Udhar→Cash) beside Banks; top fuel cards removed. Live `index-Bb4VonzF.js`.
- `knowledge_base/` is the shared coordination folder.

## Frontend `src/` architecture (2026-08-26 exploration)

### Routing model
- Single router in `src/App.tsx` (react-router-dom `BrowserRouter`).
- Role-gated routes all render thin page wrappers that mount `DashboardShell` with a role config.
- Non-dashboard paths (customers, credit, debit, **transactions**, reports) render real page components via `DashboardShell`.

### Key paths
- Shell: `src/dashboard/DashboardShell.tsx` (sidebar + header + mobile bottom nav)
- Home content: `src/dashboard/DashboardHome.tsx` — live **Recent Transactions** (top 5 from `/api/transactions`, force-refresh on visit)
- Nav/config: `src/dashboard/nav.ts` (`adminConfig` / `accountantConfig` / `userConfig`)
- Tokens: `src/index.css` `@theme` (`fuel` yellow `#f5c518`, surface, ink, credit/debit)
- Style helpers: `src/dashboard/styles.ts` (`panel`, `selectBtn`) — **no Button/Card/Table component library**
- Auth: `src/lib/auth.ts` + `src/components/ProtectedRoute.tsx` (`RoleRoute`, `PublicOnlyRoute`)

### Transactions routes (live)
- Admin: `/transactions`
- Accountant: `/accountant/transactions`
- User: `/user/transactions`
- Data: `GET /api/transactions` + `GET /api/transactions/customers`
