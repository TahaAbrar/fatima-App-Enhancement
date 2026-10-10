import { Router } from 'express'
import { getPool, sql } from './db.js'

export const unitRouter = Router()

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
  console.error('[unit] db error', err.message)
  return res.status(503).json({
    ok: false,
    message: 'UNIT dashboard temporarily unavailable',
  })
}

/**
 * UNIT aggregate by Nozal+ItemId.
 * Closing = Max(Reading1), Opening = Max(Reading1) - Sum(Qty)
 * so Closing − Opening always equals Liters.
 *
 * Default (no duty_no): today's PTS (posted + unposted) via Timed day window.
 * With duty_no: that DNo only (any date / status).
 */
unitRouter.get('/dashboard', async (req, res) => {
  const dutyRaw = cleanText(req.query.duty_no || req.query.dutyNo || '')
  let duty = null
  if (dutyRaw) {
    const n = Number(dutyRaw)
    duty = Number.isFinite(n) ? n : dutyRaw
  }

  try {
    const pool = await getPool()
    const request = pool.request()

    let whereSql =
      'WHERE Pts.Timed >= CAST(GETDATE() AS DATE)' +
      ' AND Pts.Timed < DATEADD(day, 1, CAST(GETDATE() AS DATE))'
    if (duty != null) {
      request.input('dutyNo', sql.Int, Number(duty))
      whereSql = 'WHERE Pts.DNo = @dutyNo'
    }

    const result = await request.query(`
      SELECT
        Pts.Nozal,
        Pts.Itemid,
        ItemReg.ItemName,
        Sum(isnull(Pts.Qty, 0)) AS Liters,
        Sum(isnull(Pts.Qty, 0) * isnull(Pts.Rate, 0)) AS Amount,
        Sum(isnull(Pts.Amount, 0)) AS TAmount,
        Max(Pts.Reading1) - Sum(isnull(Pts.Qty, 0)) AS OpeningReading,
        Max(Pts.Reading1) AS ClosingReading
      FROM dbo.PTS Pts WITH (NOLOCK)
      LEFT JOIN dbo.ItemReg WITH (NOLOCK) ON Pts.Itemid = ItemReg.ItemId
      ${whereSql}
      GROUP BY Pts.Nozal, Pts.ItemId, ItemReg.ItemName
      ORDER BY Pts.Nozal, ItemReg.ItemName
    `)

    const rows = result.recordset || []
    let total = 0
    const transactions = rows.map((r) => {
      const tAmount = money(r.TAmount)
      total += tAmount
      const nozal = r.Nozal
      return {
        nozzle: nozal != null ? String(Number(nozal)).padStart(2, '0') : null,
        item_id: r.Itemid,
        item_name: cleanText(r.ItemName) || null,
        liters: Math.round(money(r.Liters) * 1000) / 1000,
        amount: Math.round(money(r.Amount) * 100) / 100,
        t_amount: Math.round(tAmount * 100) / 100,
        opening_reading: Math.round(money(r.OpeningReading) * 1000) / 1000,
        closing_reading: Math.round(money(r.ClosingReading) * 1000) / 1000,
      }
    })

    return res.json({
      ok: true,
      pending_total_amount: Math.round(total * 100) / 100,
      todays_transactions: transactions.length,
      pending_vehicle_details: transactions.length,
      selected_duty_no: duty != null ? String(duty) : null,
      transactions,
    })
  } catch (err) {
    return dbFail(res, err)
  }
})
