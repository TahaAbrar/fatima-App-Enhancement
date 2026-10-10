import { Router } from 'express'
import { getPool } from './db.js'

export const dashboardRouter = Router()

const STATUS_SQL = `(L.Status IS NULL OR L.Status = N'Posted')`
/** Unposted only — Posted rows drop out of today's credit/debit/tx cards. */
const UNPOSTED_SQL = `(L.Status IS NULL OR LTRIM(RTRIM(L.Status)) = N'')`
const TODAY_SQL = `CAST(L.Dated AS date) = CAST(GETDATE() AS date)`
const BANKS_GROUP = `N'BANKS'`

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function money(value) {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function cleanText(value) {
  if (value == null) return ''
  return String(value).trim()
}

function dbFail(res, err) {
  console.error('[dashboard] db error', err.message)
  return res.status(503).json({
    ok: false,
    message: 'Dashboard service temporarily unavailable',
  })
}

function utcDayKey(date) {
  const d = date instanceof Date ? date : new Date(date)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDayLabel(date) {
  const d = date instanceof Date ? date : new Date(date)
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${day} ${MONTHS[d.getUTCMonth()]}`
}

function startUtcDate(daysBack) {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - daysBack)
  return d
}

function buildDailySeries(rows, days = 7) {
  const map = new Map()
  for (const row of rows) {
    const key = utcDayKey(row.Bucket)
    map.set(key, row)
  }
  const result = []
  const start = startUtcDate(days - 1)
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    const key = utcDayKey(d)
    const row = map.get(key)
    result.push({
      label: formatDayLabel(d),
      credit: money(row?.Credit),
      debit: money(row?.Debit),
      net: money(row?.Credit) - money(row?.Debit),
    })
  }
  return result
}

dashboardRouter.get('/stats', async (_req, res) => {
  try {
    const pool = await getPool()
    // Headings stay Total Credit / Total Debit / Today's Transactions.
    // Values = today's Unposted only (NULL/blank Status). Posted → amounts leave the cards.
    // Fuel cards = max duty (PTS.DNo): Diesel/Petrol × Cash/Udhar as Qty liters.
    const maxDuty = `(SELECT MAX(DNo) FROM dbo.PTS WHERE DNo IS NOT NULL)`
    const result = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.AccReg) AS TotalCustomers,
        (SELECT SUM(CASE WHEN ISNULL(L.Credit, 0) > 0 THEN L.Credit ELSE 0 END)
         FROM dbo.Leger L
         INNER JOIN dbo.AccReg A ON A.Accid = L.Accid
         INNER JOIN dbo.GroupReg G ON G.GroupId = A.GroupId
         WHERE ${UNPOSTED_SQL}
           AND ${TODAY_SQL}) AS TotalCredit,
        (SELECT SUM(CASE WHEN ISNULL(L.Debit, 0) > 0 THEN L.Debit ELSE 0 END)
         FROM dbo.Leger L
         INNER JOIN dbo.AccReg A ON A.Accid = L.Accid
         INNER JOIN dbo.GroupReg G ON G.GroupId = A.GroupId
         WHERE ${UNPOSTED_SQL}
           AND ${TODAY_SQL}) AS TotalDebit,
        (SELECT COUNT(*)
         FROM dbo.Leger L
         INNER JOIN dbo.AccReg A ON A.Accid = L.Accid
         INNER JOIN dbo.GroupReg G ON G.GroupId = A.GroupId
         WHERE ${UNPOSTED_SQL}
           AND ${TODAY_SQL}) AS TodayTransactions,
        (SELECT SUM(ISNULL(P.Qty, 0))
         FROM dbo.PTS P
         WHERE P.DNo = ${maxDuty} AND P.Itemid = 1 AND P.Accid IS NULL) AS DieselCash,
        (SELECT SUM(ISNULL(P.Qty, 0))
         FROM dbo.PTS P
         WHERE P.DNo = ${maxDuty} AND P.Itemid = 1 AND P.Accid IS NOT NULL) AS DieselUdhar,
        (SELECT SUM(ISNULL(P.Qty, 0))
         FROM dbo.PTS P
         WHERE P.DNo = ${maxDuty} AND P.Itemid = 1) AS DieselSale,
        (SELECT SUM(ISNULL(P.Qty, 0))
         FROM dbo.PTS P
         WHERE P.DNo = ${maxDuty} AND P.Itemid = 2 AND P.Accid IS NULL) AS PetrolCash,
        (SELECT SUM(ISNULL(P.Qty, 0))
         FROM dbo.PTS P
         WHERE P.DNo = ${maxDuty} AND P.Itemid = 2 AND P.Accid IS NOT NULL) AS PetrolUdhar,
        (SELECT SUM(ISNULL(P.Qty, 0))
         FROM dbo.PTS P
         WHERE P.DNo = ${maxDuty} AND P.Itemid = 2) AS PetrolSale
    `)
    const row = result.recordset[0] || {}
    return res.json({
      ok: true,
      stats: {
        totalCustomers: money(row.TotalCustomers),
        totalCredit: money(row.TotalCredit),
        totalDebit: money(row.TotalDebit),
        todayTransactions: money(row.TodayTransactions),
        dieselCash: money(row.DieselCash),
        dieselUdhar: money(row.DieselUdhar),
        dieselSale: money(row.DieselSale),
        petrolCash: money(row.PetrolCash),
        petrolUdhar: money(row.PetrolUdhar),
        petrolSale: money(row.PetrolSale),
      },
    })
  } catch (err) {
    return dbFail(res, err)
  }
})

dashboardRouter.get('/credit-debit', async (_req, res) => {
  const days = 7
  const startExpr = `DATEADD(day, -${days - 1}, CAST(GETDATE() AS date))`

  try {
    const pool = await getPool()
    const result = await pool.request().query(`
      SELECT
        CAST(L.Dated AS date) AS Bucket,
        SUM(CASE WHEN ISNULL(L.Credit, 0) > 0 THEN L.Credit ELSE 0 END) AS Credit,
        SUM(CASE WHEN ISNULL(L.Debit, 0) > 0 THEN L.Debit ELSE 0 END) AS Debit
      FROM dbo.Leger L
      INNER JOIN dbo.AccReg A ON A.Accid = L.Accid
      INNER JOIN dbo.GroupReg G ON G.GroupId = A.GroupId
      WHERE ${STATUS_SQL}
        AND CAST(L.Dated AS date) >= ${startExpr}
      GROUP BY CAST(L.Dated AS date)
      ORDER BY Bucket
    `)

    const creditDebit = buildDailySeries(result.recordset, days).map(({ label, credit, debit }) => ({
      label,
      credit,
      debit,
    }))

    return res.json({ ok: true, creditDebit })
  } catch (err) {
    return dbFail(res, err)
  }
})

/** BANKS group accounts + OpBal + ledger net. SELECT only. */
dashboardRouter.get('/banks', async (_req, res) => {
  try {
    const pool = await getPool()
    const result = await pool.request().query(`
      SELECT
        A.Accid,
        A.AccName,
        ISNULL(A.OpBal, 0) + ISNULL(B.Net, 0) AS Balance
      FROM dbo.AccReg A
      INNER JOIN dbo.GroupReg G ON G.GroupId = A.GroupId
      LEFT JOIN (
        SELECT
          L.Accid,
          SUM(ISNULL(L.Debit, 0)) - SUM(ISNULL(L.Credit, 0)) AS Net
        FROM dbo.Leger L
        GROUP BY L.Accid
      ) B ON B.Accid = A.Accid
      WHERE G.GroupName = ${BANKS_GROUP}
      ORDER BY A.SrNo, A.AccName
    `)

    const banks = result.recordset.map((row) => ({
      accid: money(row.Accid),
      name: cleanText(row.AccName) || '—',
      balance: money(row.Balance),
    }))
    const totalBalance = banks.reduce((sum, b) => sum + b.balance, 0)

    return res.json({ ok: true, totalBalance, banks })
  } catch (err) {
    return dbFail(res, err)
  }
})
