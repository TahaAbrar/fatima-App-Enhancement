import { Router } from 'express'
import { z } from 'zod'
import { getPool, sql } from './db.js'

/**
 * Customer portal APIs — SELECT only, scoped to JWT accid.
 * Never returns AccReg.WebUser, WebPass, or Pic.
 */

export const portalRouter = Router()

const optionalIsoDate = z
  .union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
  .optional()
  .transform((value) => value || undefined)

const txQuerySchema = z.object({
  kind: z.enum(['all', 'credit', 'debit']).default('all'),
  date: optionalIsoDate,
  dateFrom: optionalIsoDate,
  dateTo: optionalIsoDate,
  sort: z.enum(['recent', 'oldest']).default('recent'),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(15),
  /** Group-car ledger: optional Accid when WebStatus group allow */
  accid: z.coerce.number().int().positive().max(2_147_483_647).optional(),
})

function resolveTxDateRange({ date, dateFrom, dateTo }) {
  let from = dateFrom || date || ''
  let to = dateTo || date || ''
  if (from && to && from > to) {
    const swap = from
    from = to
    to = swap
  }
  return { from, to }
}

function money(value) {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function isoDate(value) {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function mapStatus(value) {
  const v = String(value || '')
    .trim()
    .toLowerCase()
  if (['inactive', 'disabled', 'blocked', 'lock', 'locked'].includes(v)) {
    return 'Inactive'
  }
  return 'Active'
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function slugifyName(name) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

function toCustomerSlug(name, accid) {
  const base = slugifyName(name) || 'customer'
  return `${base}-${accid}`
}

function formatQty(n) {
  if (Number.isInteger(n)) return String(n)
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function formatRate(value) {
  return money(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatWhen(dated, timed) {
  if (!dated) return '—'
  const d = dated instanceof Date ? dated : new Date(dated)
  if (Number.isNaN(d.getTime())) return '—'
  const day = String(d.getUTCDate()).padStart(2, '0')
  const mon = MONTHS[d.getUTCMonth()]
  const year = d.getUTCFullYear()

  let hours = 0
  let minutes = 0
  if (timed instanceof Date && !Number.isNaN(timed.getTime())) {
    hours = timed.getUTCHours()
    minutes = timed.getUTCMinutes()
  } else if (typeof timed === 'string') {
    const match = timed.match(/T?(\d{1,2}):(\d{2})/)
    if (match) {
      hours = Number(match[1])
      minutes = Number(match[2])
    }
  }

  const ampm = hours >= 12 ? 'PM' : 'AM'
  let h12 = hours % 12
  if (h12 === 0) h12 = 12
  return `${day} ${mon} ${year} ${h12}:${String(minutes).padStart(2, '0')} ${ampm}`
}

function txDisplayId(type, vno, trid) {
  const prefix =
    String(type || 'TXN')
      .replace(/\s+/g, '')
      .toUpperCase() || 'TXN'
  const num = vno != null && vno !== '' ? vno : trid
  return `${prefix}-${num}`
}

function productFields(row) {
  const pmg = money(row.PMG)
  const hsd = money(row.HSD)
  const ho = money(row.HO)
  if (pmg > 0) {
    return { product: 'PMG', quantity: `${formatQty(pmg)} Ltr`, rate: formatRate(row.RPMG) }
  }
  if (hsd > 0) {
    return { product: 'HSD', quantity: `${formatQty(hsd)} Ltr`, rate: formatRate(row.RHSD) }
  }
  if (ho > 0) {
    return { product: 'High Octane', quantity: `${formatQty(ho)} Ltr`, rate: formatRate(row.RHO) }
  }
  const desc = cleanText(row.Description)
  return { product: desc || '—', quantity: '—', rate: '—' }
}

function mapAmount(row, kind) {
  const debit = money(row.Debit)
  const credit = money(row.Credit)
  if (kind === 'credit') return { type: 'Credit', amount: credit }
  if (kind === 'debit') return { type: 'Debit', amount: debit }
  if (debit > 0 && credit === 0) return { type: 'Debit', amount: debit }
  if (credit > 0 && debit === 0) return { type: 'Credit', amount: credit }
  if (debit >= credit) return { type: 'Debit', amount: debit }
  return { type: 'Credit', amount: credit }
}

function requirePortalAccid(req, res) {
  const accid = Number(req.user?.accid)
  if (!Number.isInteger(accid) || accid <= 0) {
    res.status(403).json({ ok: false, message: 'Customer session required' })
    return null
  }
  return accid
}

let cachedBizId = null

async function resolveBizId(pool) {
  if (cachedBizId != null) return cachedBizId
  const result = await pool
    .request()
    .query('SELECT TOP (1) CompanyId FROM dbo.CompanyPro ORDER BY CompanyId')
  cachedBizId = result.recordset[0]?.CompanyId ?? 1
  return cachedBizId
}

function dbFail(res, err) {
  console.error('[portal] db error', err.message)
  return res.status(503).json({
    ok: false,
    message: 'Portal service temporarily unavailable',
  })
}

const summaryQuerySchema = z.object({
  date: optionalIsoDate,
  dateFrom: optionalIsoDate,
  dateTo: optionalIsoDate,
})

function parseGroupAllowed(gaValue, ownGroupId) {
  const ga = cleanText(gaValue)
  if (!ga) return { allowed: false, groupIds: [] }

  const parts = ga.split(/[,;|]/).map((part) => part.trim()).filter(Boolean)
  const numericIds = parts
    .map((part) => Number(part))
    .filter((id) => Number.isInteger(id) && id > 0)

  if (numericIds.length > 0) {
    return { allowed: true, groupIds: [...new Set(numericIds)] }
  }

  if (Number.isInteger(ownGroupId) && ownGroupId > 0) {
    return { allowed: true, groupIds: [ownGroupId] }
  }

  return { allowed: false, groupIds: [] }
}

async function loadCustomerGroupAccess(pool, accid) {
  const result = await pool.request().input('accid', sql.Int, accid).query(`
    SELECT A.GroupId, A.WebStatus
    FROM dbo.AccReg A
    WHERE A.Accid = @accid
  `)
  const row = result.recordset[0]
  if (!row) return { allowed: false, groupIds: [] }
  // WebStatus yes / GA (or numeric group ids) → group allow; empty → denied
  return parseGroupAllowed(row.WebStatus, row.GroupId)
}

const DETAIL_SQL = `
  SELECT
    A.Accid,
    A.AccNo,
    A.AccName,
    A.Ph,
    A.Email,
    A.NIC,
    A.Address,
    A.Description,
    A.Dated,
    A.Status,
    A.GroupId,
    A.WebStatus,
    G.GroupName,
    ISNULL((
      SELECT SUM(ISNULL(L2.Debit, 0)) - SUM(ISNULL(L2.Credit, 0))
      FROM dbo.Leger L2
      WHERE L2.Accid = A.Accid
        AND L2.Dated < CAST(GETDATE() AS date)
    ), 0) AS OpeningBalance,
    SUM(ISNULL(L.Debit, 0)) - SUM(ISNULL(L.Credit, 0)) AS CurrentBalance,
    SUM(ISNULL(L.Credit, 0)) AS TotalCredit,
    SUM(ISNULL(L.Debit, 0)) AS TotalDebit,
    COUNT(L.Trid) AS TransactionCount
  FROM dbo.AccReg A
  INNER JOIN dbo.GroupReg G ON G.GroupId = A.GroupId
  LEFT JOIN dbo.Leger L ON L.Accid = A.Accid
  WHERE A.Accid = @accid
  GROUP BY
    A.Accid, A.AccNo, A.AccName, A.Ph, A.Email, A.NIC, A.Address,
    A.Description, A.Dated, A.Status, A.GroupId, A.WebStatus, G.GroupName
`

async function loadFuelSummary(pool, accid, dateFrom, dateTo) {
  // Filter by Accid only — client Leger uses CompId (not BizId)
  const result = await pool
    .request()
    .input('accid', sql.Int, accid)
    .input('hasFrom', sql.Bit, dateFrom ? 1 : 0)
    .input('hasTo', sql.Bit, dateTo ? 1 : 0)
    .input('dateFrom', sql.Date, dateFrom || '1900-01-01')
    .input('dateTo', sql.Date, dateTo || '1900-01-01')
    .query(`
      SELECT
        SUM(ISNULL(HSD, 0)) AS HSD,
        SUM(ISNULL(PMG, 0)) AS PMG,
        SUM(ISNULL(HO, 0)) AS HO,
        SUM(ISNULL(Cash, 0)) AS Advance,
        SUM(ISNULL(Other, 0)) AS Others
      FROM dbo.Leger
      WHERE Accid = @accid
        AND (@hasFrom = 0 OR CAST(Dated AS date) >= @dateFrom)
        AND (@hasTo = 0 OR CAST(Dated AS date) <= @dateTo)
    `)
  const row = result.recordset[0] || {}
  return {
    hsd: money(row.HSD),
    pmg: money(row.PMG),
    ho: money(row.HO),
    advance: money(row.Advance),
    others: money(row.Others),
  }
}

portalRouter.get('/me', async (req, res) => {
  const accid = requirePortalAccid(req, res)
  if (accid == null) return

  const queryParsed = summaryQuerySchema.safeParse(req.query)
  if (!queryParsed.success) {
    return res.status(400).json({ ok: false, message: 'Invalid request' })
  }
  const { from: dateFrom, to: dateTo } = resolveTxDateRange(queryParsed.data)

  try {
    const pool = await getPool()
    const result = await pool.request().input('accid', sql.Int, accid).query(DETAIL_SQL)
    const row = result.recordset[0]
    if (!row) {
      return res.status(404).json({ ok: false, message: 'Customer account not found' })
    }

    const fuelSummary = await loadFuelSummary(pool, accid, dateFrom, dateTo)
    const groupAccess = parseGroupAllowed(row.WebStatus, row.GroupId)

    return res.json({
      ok: true,
      customer: {
        accid: row.Accid,
        id: cleanText(row.AccNo) || String(row.Accid),
        slug: toCustomerSlug(cleanText(row.AccName), row.Accid),
        name: cleanText(row.AccName) || '—',
        phone: cleanText(row.Ph),
        email: cleanText(row.Email),
        cnic: cleanText(row.NIC),
        address: cleanText(row.Address),
        notes: cleanText(row.Description),
        currentBalance: money(row.CurrentBalance),
        openingBalance: money(row.OpeningBalance),
        status: mapStatus(row.Status),
        type: cleanText(row.GroupName),
        groupId: row.GroupId,
        groupAllowed: groupAccess.allowed,
        createdAt: isoDate(row.Dated),
        totalCredit: money(row.TotalCredit),
        totalDebit: money(row.TotalDebit),
        transactionCount: money(row.TransactionCount),
      },
      summary: fuelSummary,
    })
  } catch (err) {
    return dbFail(res, err)
  }
})

portalRouter.get('/summary', async (req, res) => {
  const accid = requirePortalAccid(req, res)
  if (accid == null) return

  const queryParsed = summaryQuerySchema.safeParse(req.query)
  if (!queryParsed.success) {
    return res.status(400).json({ ok: false, message: 'Invalid request' })
  }
  const { from: dateFrom, to: dateTo } = resolveTxDateRange(queryParsed.data)

  try {
    const pool = await getPool()
    const summary = await loadFuelSummary(pool, accid, dateFrom, dateTo)
    return res.json({ ok: true, summary })
  } catch (err) {
    return dbFail(res, err)
  }
})

function formatLedgerDate(value) {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const day = String(d.getUTCDate()).padStart(2, '0')
  const mon = String(d.getUTCMonth() + 1).padStart(2, '0')
  const year = d.getUTCFullYear()
  return `${day}/${mon}/${year}`
}

function ledgerDescription(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim()
}

function ticketNo(mvno) {
  const s = cleanText(mvno)
  return s || '0'
}

portalRouter.get('/groups', async (req, res) => {
  const accid = requirePortalAccid(req, res)
  if (accid == null) return

  try {
    const pool = await getPool()
    const access = await loadCustomerGroupAccess(pool, accid)
    if (!access.allowed || access.groupIds.length === 0) {
      return res.status(403).json({ ok: false, message: 'Group access not allowed' })
    }

    const placeholders = access.groupIds.map((_, index) => `@gid${index}`).join(', ')
    const request = pool.request()
    access.groupIds.forEach((groupId, index) => {
      request.input(`gid${index}`, sql.Int, groupId)
    })

    const result = await request.query(`
      SELECT
        G.GroupId,
        G.GroupName,
        COUNT(A.Accid) AS AccCount,
        ISNULL(SUM(Bal.CurrentBalance), 0) AS TotalBalance
      FROM dbo.GroupReg G
      INNER JOIN dbo.AccReg A ON A.GroupId = G.GroupId
      OUTER APPLY (
        SELECT SUM(ISNULL(L.Debit, 0)) - SUM(ISNULL(L.Credit, 0)) AS CurrentBalance
        FROM dbo.Leger L
        WHERE L.Accid = A.Accid
      ) Bal
      WHERE G.GroupId IN (${placeholders})
      GROUP BY G.GroupId, G.GroupName
      ORDER BY G.GroupName
    `)

    return res.json({
      ok: true,
      groups: result.recordset.map((row) => ({
        groupId: row.GroupId,
        groupName: cleanText(row.GroupName) || '—',
        accCount: money(row.AccCount),
        totalBalance: money(row.TotalBalance),
      })),
    })
  } catch (err) {
    return dbFail(res, err)
  }
})

portalRouter.get('/groups/:groupId', async (req, res) => {
  const accid = requirePortalAccid(req, res)
  if (accid == null) return

  const groupId = Number(req.params.groupId)
  if (!Number.isInteger(groupId) || groupId <= 0) {
    return res.status(400).json({ ok: false, message: 'Invalid group' })
  }

  const queryParsed = summaryQuerySchema.safeParse(req.query)
  if (!queryParsed.success) {
    return res.status(400).json({ ok: false, message: 'Invalid request' })
  }
  const { from: dateFrom, to: dateTo } = resolveTxDateRange(queryParsed.data)
  const hasFrom = dateFrom ? 1 : 0
  const hasTo = dateTo ? 1 : 0

  try {
    const pool = await getPool()
    const access = await loadCustomerGroupAccess(pool, accid)
    if (!access.allowed || !access.groupIds.includes(groupId)) {
      return res.status(403).json({ ok: false, message: 'Group access not allowed' })
    }

    const groupResult = await pool
      .request()
      .input('groupId', sql.Int, groupId)
      .query(`
        SELECT GroupId, GroupName
        FROM dbo.GroupReg
        WHERE GroupId = @groupId
      `)
    const groupRow = groupResult.recordset[0]
    if (!groupRow) {
      return res.status(404).json({ ok: false, message: 'Group not found' })
    }

    const accountsResult = await pool
      .request()
      .input('groupId', sql.Int, groupId)
      .input('hasFrom', sql.Bit, hasFrom)
      .input('hasTo', sql.Bit, hasTo)
      .input('dateFrom', sql.Date, dateFrom || '1900-01-01')
      .input('dateTo', sql.Date, dateTo || '1900-01-01')
      .query(`
        SELECT
          A.Accid,
          A.AccNo,
          A.AccName,
          A.Ph,
          A.Email,
          A.Dated,
          A.Status,
          ISNULL(A.OpBal, 0) + ISNULL((
            SELECT SUM(ISNULL(L2.Debit, 0)) - SUM(ISNULL(L2.Credit, 0))
            FROM dbo.Leger L2
            WHERE L2.Accid = A.Accid
              AND (
                (@hasFrom = 1 AND CAST(L2.Dated AS date) < @dateFrom)
                OR (@hasFrom = 0 AND L2.Dated < CAST(GETDATE() AS date))
              )
          ), 0) AS OpeningBalance,
          ISNULL((
            SELECT SUM(ISNULL(L3.Debit, 0)) - SUM(ISNULL(L3.Credit, 0))
            FROM dbo.Leger L3
            WHERE L3.Accid = A.Accid
              AND (@hasTo = 0 OR CAST(L3.Dated AS date) <= @dateTo)
              AND (@hasFrom = 0 OR @hasTo = 1 OR CAST(L3.Dated AS date) >= @dateFrom)
          ), 0) AS CurrentBalance,
          ISNULL((
            SELECT SUM(ISNULL(L4.Debit, 0))
            FROM dbo.Leger L4
            WHERE L4.Accid = A.Accid
              AND (@hasFrom = 0 OR CAST(L4.Dated AS date) >= @dateFrom)
              AND (@hasTo = 0 OR CAST(L4.Dated AS date) <= @dateTo)
          ), 0) AS TotalDebit,
          ISNULL((
            SELECT SUM(ISNULL(L5.Credit, 0))
            FROM dbo.Leger L5
            WHERE L5.Accid = A.Accid
              AND (@hasFrom = 0 OR CAST(L5.Dated AS date) >= @dateFrom)
              AND (@hasTo = 0 OR CAST(L5.Dated AS date) <= @dateTo)
          ), 0) AS TotalCredit
        FROM dbo.AccReg A
        WHERE A.GroupId = @groupId
        ORDER BY A.AccName
      `)

    const accounts = accountsResult.recordset.map((row) => {
      const openingBalance = money(row.OpeningBalance)
      const debit = money(row.TotalDebit)
      const credit = money(row.TotalCredit)
      const currentBalance =
        hasFrom || hasTo ? openingBalance + debit - credit : money(row.CurrentBalance)

      return {
        accid: row.Accid,
        id: cleanText(row.AccNo) || String(row.Accid),
        name: cleanText(row.AccName) || '—',
        phone: cleanText(row.Ph),
        email: cleanText(row.Email),
        date: formatLedgerDate(row.Dated) || '—',
        status: mapStatus(row.Status),
        openingBalance,
        currentBalance,
        debit,
        credit,
      }
    })

    return res.json({
      ok: true,
      dateFrom: dateFrom || '',
      dateTo: dateTo || '',
      group: {
        groupId: groupRow.GroupId,
        groupName: cleanText(groupRow.GroupName) || '—',
        accCount: accounts.length,
        totalOpening: accounts.reduce((sum, row) => sum + row.openingBalance, 0),
        totalBalance: accounts.reduce((sum, row) => sum + row.currentBalance, 0),
        totalDebit: accounts.reduce((sum, row) => sum + row.debit, 0),
        totalCredit: accounts.reduce((sum, row) => sum + row.credit, 0),
      },
      accounts,
    })
  } catch (err) {
    return dbFail(res, err)
  }
})

portalRouter.get('/transactions', async (req, res) => {
  const selfAccid = requirePortalAccid(req, res)
  if (selfAccid == null) return

  const queryParsed = txQuerySchema.safeParse(req.query)
  if (!queryParsed.success) {
    return res.status(400).json({ ok: false, message: 'Invalid request' })
  }

  const { kind, sort, offset, limit, accid: requestedAccid } = queryParsed.data
  const { from: dateFrom, to: dateTo } = resolveTxDateRange(queryParsed.data)

  try {
    const pool = await getPool()

    let accid = selfAccid
    if (requestedAccid != null && requestedAccid !== selfAccid) {
      const access = await loadCustomerGroupAccess(pool, selfAccid)
      if (!access.allowed || access.groupIds.length === 0) {
        return res.status(403).json({ ok: false, message: 'Group access not allowed' })
      }
      const target = await pool
        .request()
        .input('accid', sql.Int, requestedAccid)
        .query(`SELECT TOP (1) Accid, GroupId FROM dbo.AccReg WHERE Accid = @accid`)
      const targetRow = target.recordset[0]
      if (!targetRow || !access.groupIds.includes(Number(targetRow.GroupId))) {
        return res.status(403).json({ ok: false, message: 'Account not in allowed group' })
      }
      accid = requestedAccid
    }

    const metaResult = await pool
      .request()
      .input('accid', sql.Int, accid)
      .input('hasFrom', sql.Bit, dateFrom ? 1 : 0)
      .input('dateFrom', sql.Date, dateFrom || '1900-01-01')
      .query(`
        SELECT
          A.AccNo,
          A.AccName,
          G.GroupName,
          ISNULL(A.OpBal, 0) + ISNULL((
            SELECT SUM(ISNULL(L.Debit, 0)) - SUM(ISNULL(L.Credit, 0))
            FROM dbo.Leger L
            WHERE L.Accid = A.Accid
              AND @hasFrom = 1
              AND CAST(L.Dated AS date) < @dateFrom
          ), 0) AS OpeningBalance
        FROM dbo.AccReg A
        INNER JOIN dbo.GroupReg G ON G.GroupId = A.GroupId
        WHERE A.Accid = @accid
      `)
    const meta = metaResult.recordset[0]
    if (!meta) {
      return res.status(404).json({ ok: false, message: 'Customer account not found' })
    }
    const openingBalance = money(meta.OpeningBalance)

    const filterSql = `
      WHERE 1 = 1
        AND (
          @kind = N'all'
          OR (@kind = N'credit' AND ISNULL(Tx.Credit, 0) > 0)
          OR (@kind = N'debit' AND ISNULL(Tx.Debit, 0) > 0)
        )
    `
    const cte = `
      WITH Tx AS (
        SELECT
          L.Trid,
          L.Dated,
          L.Timed,
          L.Type,
          L.VNo,
          L.MVNo,
          L.Debit,
          L.Credit,
          L.Description,
          L.UserId,
          L.HSD,
          L.RHSD,
          L.PMG,
          L.RPMG,
          L.HO,
          L.RHO,
          @opening + SUM(ISNULL(L.Debit, 0) - ISNULL(L.Credit, 0))
            OVER (ORDER BY L.Dated, L.Trid ROWS UNBOUNDED PRECEDING) AS RunningBalance
        FROM dbo.Leger L
        WHERE L.Accid = @accid
          AND (@hasFrom = 0 OR CAST(L.Dated AS date) >= @dateFrom)
          AND (@hasTo = 0 OR CAST(L.Dated AS date) <= @dateTo)
      )
    `

    const countReq = pool.request()
    countReq.input('accid', sql.Int, accid)
    countReq.input('opening', sql.Float, openingBalance)
    countReq.input('kind', sql.NVarChar(10), kind)
    countReq.input('hasFrom', sql.Bit, dateFrom ? 1 : 0)
    countReq.input('hasTo', sql.Bit, dateTo ? 1 : 0)
    countReq.input('dateFrom', sql.Date, dateFrom || '1900-01-01')
    countReq.input('dateTo', sql.Date, dateTo || '1900-01-01')
    const countResult = await countReq.query(`
      ${cte}
      SELECT
        COUNT(*) AS Total,
        SUM(ISNULL(Tx.Debit, 0)) AS TotalDebit,
        SUM(ISNULL(Tx.Credit, 0)) AS TotalCredit
      FROM Tx
      ${filterSql}
    `)
    const total = money(countResult.recordset[0]?.Total)
    const totalDebit = money(countResult.recordset[0]?.TotalDebit)
    const totalCredit = money(countResult.recordset[0]?.TotalCredit)

    const listReq = pool.request()
    listReq.input('accid', sql.Int, accid)
    listReq.input('opening', sql.Float, openingBalance)
    listReq.input('kind', sql.NVarChar(10), kind)
    listReq.input('hasFrom', sql.Bit, dateFrom ? 1 : 0)
    listReq.input('hasTo', sql.Bit, dateTo ? 1 : 0)
    listReq.input('dateFrom', sql.Date, dateFrom || '1900-01-01')
    listReq.input('dateTo', sql.Date, dateTo || '1900-01-01')
    listReq.input('sort', sql.NVarChar(10), sort)
    listReq.input('offset', sql.Int, offset)
    listReq.input('limit', sql.Int, limit)
    const listResult = await listReq.query(`
      ${cte}
      SELECT
        Tx.Trid,
        Tx.Dated,
        Tx.Timed,
        Tx.Type,
        Tx.VNo,
        Tx.MVNo,
        Tx.Debit,
        Tx.Credit,
        Tx.Description,
        Tx.HSD,
        Tx.RHSD,
        Tx.PMG,
        Tx.RPMG,
        Tx.HO,
        Tx.RHO,
        Tx.RunningBalance,
        U.UserName,
        U.Type AS UserType
      FROM Tx
      LEFT JOIN dbo.UserReg U ON U.UserId = Tx.UserId
      ${filterSql}
      ORDER BY
        CASE WHEN @sort = N'oldest' THEN Tx.Dated END ASC,
        CASE WHEN @sort = N'oldest' THEN Tx.Trid END ASC,
        CASE WHEN @sort = N'recent' THEN Tx.Dated END DESC,
        CASE WHEN @sort = N'recent' THEN Tx.Trid END DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `)

    return res.json({
      ok: true,
      total,
      offset,
      limit,
      openingBalance,
      totalDebit,
      totalCredit,
      account: {
        id: cleanText(meta.AccNo) || String(accid),
        name: cleanText(meta.AccName) || '—',
        groupName: cleanText(meta.GroupName) || '—',
      },
      transactions: listResult.recordset.map((row) => {
        const { type, amount } = mapAmount(row, kind)
        const product = productFields(row)
        const description = ledgerDescription(row.Description) || product.product
        return {
          trid: row.Trid,
          id: txDisplayId(row.Type, row.VNo, row.Trid),
          date: formatLedgerDate(row.Dated),
          when: formatWhen(row.Dated, row.Timed),
          type,
          product: description,
          description,
          quantity: product.quantity,
          rate: product.rate,
          ticket: ticketNo(row.MVNo),
          vno: row.VNo != null && row.VNo !== '' ? String(row.VNo) : '0',
          mvno: ticketNo(row.MVNo),
          debit: money(row.Debit),
          credit: money(row.Credit),
          amount,
          balance: money(row.RunningBalance),
          by: cleanText(row.UserName) || cleanText(row.UserType) || '—',
        }
      }),
    })
  } catch (err) {
    return dbFail(res, err)
  }
})
