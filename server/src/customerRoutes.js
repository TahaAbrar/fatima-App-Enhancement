import { Router } from 'express'
import { z } from 'zod'
import { getPool, sql } from './db.js'

/**
 * Customer / account read APIs.
 * SELECT only — never INSERT / UPDATE / DELETE.
 * Never returns AccReg.WebUser, WebPass, or Pic.
 */

export const customerRouter = Router()

const optionalIsoDate = z
  .union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
  .optional()
  .transform((value) => value || undefined)

const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  date: optionalIsoDate,
  dateFrom: optionalIsoDate,
  dateTo: optionalIsoDate,
  status: z.enum(['', 'Active', 'Inactive']).optional().default(''),
  type: z
    .string()
    .trim()
    .max(100)
    .regex(/^[a-zA-Z0-9 ._'-]*$/)
    .optional()
    .default(''),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
})

const accidSchema = z.coerce.number().int().positive().max(2_147_483_647)

const txQuerySchema = z.object({
  kind: z.enum(['all', 'credit', 'debit']).default('all'),
  date: optionalIsoDate,
  dateFrom: optionalIsoDate,
  dateTo: optionalIsoDate,
  sort: z.enum(['recent', 'oldest']).default('recent'),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(15),
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

function likeContains(value) {
  return `%${String(value).replace(/([%_[\]])/g, '[$1]')}%`
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
  const prefix = String(type || 'TXN')
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

function accidFromSlug(slug) {
  const match = String(slug).match(/-(\d+)$/)
  if (!match) return null
  const accid = Number(match[1])
  return Number.isInteger(accid) && accid > 0 ? accid : null
}

function mapCustomerRow(row) {
  const name = cleanText(row.AccName) || '—'
  const accid = row.Accid
  return {
    accid,
    id: cleanText(row.AccNo) || String(accid),
    slug: toCustomerSlug(name, accid),
    name,
    phone: cleanText(row.Ph),
    email: cleanText(row.Email),
    cnic: cleanText(row.NIC),
    address: cleanText(row.Address),
    notes: cleanText(row.Description),
    currentBalance: money(row.CurrentBalance),
    openingBalance: money(row.OpeningBalance),
    status: mapStatus(row.Status),
    type: cleanText(row.GroupName),
    createdAt: isoDate(row.Dated),
  }
}

function accountFilters(request, { q, date, dateFrom, dateTo, status, type }) {
  const where = ['1 = 1']
  if (q) {
    where.push('A.AccName LIKE @q')
    request.input('q', sql.NVarChar(120), likeContains(q))
  }
  const range = resolveTxDateRange({ date, dateFrom, dateTo })
  if (range.from) {
    where.push('CAST(A.Dated AS date) >= @accDateFrom')
    request.input('accDateFrom', sql.Date, range.from)
  }
  if (range.to) {
    where.push('CAST(A.Dated AS date) <= @accDateTo')
    request.input('accDateTo', sql.Date, range.to)
  }
  if (status === 'Active') {
    where.push(
      "(A.Status IS NULL OR LTRIM(RTRIM(A.Status)) = N'' OR A.Status = N'Active')",
    )
  } else if (status === 'Inactive') {
    where.push("A.Status IN (N'Inactive', N'Disabled', N'Blocked')")
  }
  if (type) {
    where.push('G.GroupName = @groupName')
    request.input('groupName', sql.NVarChar(100), type)
  }
  return where.join(' AND ')
}

function dbFail(res, err) {
  console.error('[customers] db error', err.message)
  return res.status(503).json({
    ok: false,
    message: 'Customer service temporarily unavailable',
  })
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
    A.Description, A.Dated, A.Status, A.GroupId, G.GroupName
`

async function loadCustomerDetail(accid) {
  const pool = await getPool()
  const result = await pool.request().input('accid', sql.Int, accid).query(DETAIL_SQL)
  const row = result.recordset[0]
  if (!row) return null
  return {
    ...mapCustomerRow(row),
    totalCredit: money(row.TotalCredit),
    totalDebit: money(row.TotalDebit),
    transactionCount: money(row.TransactionCount),
  }
}

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

customerRouter.get('/groups', async (_req, res) => {
  try {
    const pool = await getPool()
    const result = await pool.request().query(`
      SELECT G.GroupId, G.GroupName, COUNT(A.Accid) AS AccCount
      FROM dbo.GroupReg G
      INNER JOIN dbo.AccReg A ON A.GroupId = G.GroupId
      GROUP BY G.GroupId, G.GroupName
      HAVING COUNT(A.Accid) > 0
      ORDER BY G.GroupName
    `)
    return res.json({
      ok: true,
      groups: result.recordset.map((row) => ({
        groupId: row.GroupId,
        groupName: cleanText(row.GroupName),
        accCount: money(row.AccCount),
      })),
    })
  } catch (err) {
    return dbFail(res, err)
  }
})

customerRouter.get('/', async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      message: parsed.error.issues[0]?.message || 'Invalid query',
    })
  }

  const { q, date, dateFrom, dateTo, status, type, page, pageSize } = parsed.data
  const offset = (page - 1) * pageSize

  try {
    const pool = await getPool()
    const countReq = pool.request()
    const whereSql = accountFilters(countReq, { q, date, dateFrom, dateTo, status, type })
    const countResult = await countReq.query(`
      SELECT COUNT(*) AS Total
      FROM dbo.GroupReg G
      INNER JOIN dbo.AccReg A ON G.GroupId = A.GroupId
      WHERE ${whereSql}
    `)
    const total = money(countResult.recordset[0]?.Total)

    const listReq = pool.request()
    const listWhere = accountFilters(listReq, { q, date, dateFrom, dateTo, status, type })
    listReq.input('offset', sql.Int, offset)
    listReq.input('limit', sql.Int, pageSize)
    const listResult = await listReq.query(`
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
        G.GroupName,
        ISNULL((
          SELECT SUM(ISNULL(L2.Debit, 0)) - SUM(ISNULL(L2.Credit, 0))
          FROM dbo.Leger L2
          WHERE L2.Accid = A.Accid
            AND L2.Dated < CAST(GETDATE() AS date)
        ), 0) AS OpeningBalance,
        SUM(ISNULL(L.Debit, 0)) - SUM(ISNULL(L.Credit, 0)) AS CurrentBalance
      FROM dbo.GroupReg G
      INNER JOIN dbo.AccReg A ON G.GroupId = A.GroupId
      LEFT JOIN dbo.Leger L ON A.Accid = L.Accid
      WHERE ${listWhere}
      GROUP BY
        A.Accid, A.AccNo, A.AccName, A.Ph, A.Email, A.NIC, A.Address,
        A.Description, A.Dated, A.Status, A.GroupId, G.GroupName
      ORDER BY A.AccName
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `)

    return res.json({
      ok: true,
      total,
      page,
      pageSize,
      customers: listResult.recordset.map(mapCustomerRow),
    })
  } catch (err) {
    return dbFail(res, err)
  }
})

customerRouter.get('/slug/:slug', async (req, res) => {
  const parsed = slugSchema.safeParse(String(req.params.slug || '').toLowerCase())
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: 'Invalid customer slug' })
  }

  const slug = parsed.data
  const accid = accidFromSlug(slug)

  try {
    if (accid) {
      const customer = await loadCustomerDetail(accid)
      if (!customer) {
        return res.status(404).json({ ok: false, message: 'Customer not found' })
      }
      return res.json({ ok: true, customer })
    }

    const pool = await getPool()
    const found = await pool
      .request()
      .input('accNo', sql.NVarChar(50), slug)
      .query(`
        SELECT TOP (1) Accid
        FROM dbo.AccReg
        WHERE LOWER(REPLACE(LTRIM(RTRIM(ISNULL(AccNo, N''))), N' ', N'')) = @accNo
      `)
    const byAccNo = found.recordset[0]?.Accid
    if (!byAccNo) {
      return res.status(404).json({ ok: false, message: 'Customer not found' })
    }
    const customer = await loadCustomerDetail(byAccNo)
    if (!customer) {
      return res.status(404).json({ ok: false, message: 'Customer not found' })
    }
    return res.json({ ok: true, customer })
  } catch (err) {
    return dbFail(res, err)
  }
})

customerRouter.get('/:accid/transactions', async (req, res) => {
  const accidParsed = accidSchema.safeParse(req.params.accid)
  const queryParsed = txQuerySchema.safeParse(req.query)
  if (!accidParsed.success || !queryParsed.success) {
    return res.status(400).json({ ok: false, message: 'Invalid request' })
  }

  const accid = accidParsed.data
  const { kind, sort, offset, limit } = queryParsed.data
  const { from: dateFrom, to: dateTo } = resolveTxDateRange(queryParsed.data)

  try {
    const pool = await getPool()
    const exists = await pool
      .request()
      .input('accid', sql.Int, accid)
      .query('SELECT Accid FROM dbo.AccReg WHERE Accid = @accid')
    if (!exists.recordset[0]) {
      return res.status(404).json({ ok: false, message: 'Customer not found' })
    }

    const filterSql = `
      WHERE 1 = 1
        AND (@hasFrom = 0 OR CAST(Tx.Dated AS date) >= @dateFrom)
        AND (@hasTo = 0 OR CAST(Tx.Dated AS date) <= @dateTo)
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
          ISNULL(A.OpBal, 0) + SUM(ISNULL(L.Debit, 0) - ISNULL(L.Credit, 0))
            OVER (ORDER BY L.Trid ROWS UNBOUNDED PRECEDING) AS RunningBalance
        FROM dbo.Leger L
        INNER JOIN dbo.AccReg A ON A.Accid = L.Accid
        WHERE L.Accid = @accid
      )
    `

    const countReq = pool.request()
    countReq.input('accid', sql.Int, accid)
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
        CASE WHEN @sort = N'recent' THEN Tx.Dated END DESC,
        CASE WHEN @sort = N'recent' THEN Tx.Trid END DESC,
        CASE WHEN @sort = N'oldest' THEN Tx.Dated END ASC,
        CASE WHEN @sort = N'oldest' THEN Tx.Trid END ASC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `)

    const transactions = listResult.recordset.map((row) => {
      const { type, amount } = mapAmount(row, kind)
      const product = productFields(row)
      const desc = cleanText(row.Description)
      return {
        trid: row.Trid,
        id: txDisplayId(row.Type, row.VNo, row.Trid),
        vno: row.VNo != null && row.VNo !== '' ? String(row.VNo) : '—',
        when: formatWhen(row.Dated, row.Timed),
        type,
        product: product.product,
        description: desc || product.product || '—',
        quantity: product.quantity,
        rate: product.rate,
        amount,
        debit: money(row.Debit),
        credit: money(row.Credit),
        balance: money(row.RunningBalance),
        by: cleanText(row.UserName) || cleanText(row.UserType) || '—',
      }
    })

    return res.json({
      ok: true,
      total,
      totalDebit,
      totalCredit,
      offset,
      limit,
      transactions,
    })
  } catch (err) {
    return dbFail(res, err)
  }
})

customerRouter.get('/:accid', async (req, res) => {
  const parsed = accidSchema.safeParse(req.params.accid)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: 'Invalid customer id' })
  }

  try {
    const customer = await loadCustomerDetail(parsed.data)
    if (!customer) {
      return res.status(404).json({ ok: false, message: 'Customer not found' })
    }
    return res.json({ ok: true, customer })
  } catch (err) {
    return dbFail(res, err)
  }
})
