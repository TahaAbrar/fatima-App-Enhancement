import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { env } from './config.js'
import { getPool } from './db.js'
import { loginHandler, logoutHandler, meHandler } from './authRoutes.js'
import { requireAuth, requireReadKey, requireRoles } from './middleware.js'
import { customerRouter } from './customerRoutes.js'
import { transactionRouter } from './transactionRoutes.js'
import { dashboardRouter } from './dashboardRoutes.js'
import { companyRouter } from './companyRoutes.js'
import { coaRouter } from './coaRoutes.js'
import { reportsRouter } from './reportsRoutes.js'
import { portalRouter } from './portalRoutes.js'
import { cashbookRouter } from './cashbookRoutes.js'
import { pushRouter } from './pushRoutes.js'
import { unitRouter } from './unitRoutes.js'
import { startPushWatcher } from './push.js'

const app = express()

app.set('trust proxy', 1)
app.use(helmet())
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || env.corsOrigin.includes(origin)) return cb(null, true)
      // Cursor / IDE port-forward uses random localhost ports (e.g. :45783)
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
        return cb(null, true)
      }
      // Vite `--host 0.0.0.0` sends Origin as the public/LAN URL, not localhost
      if (env.nodeEnv !== 'production' && /^https?:\/\//.test(origin)) return cb(null, true)
      return cb(new Error('Not allowed by CORS'))
    },
    credentials: true,
  }),
)
app.use(express.json({ limit: '32kb' }))
app.use(cookieParser())

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: 'Too many login requests from this IP. Please wait and try again.',
  },
})

app.get('/api/health', async (_req, res) => {
  const serverLabel = env.db.instanceName
    ? `${env.db.server}\\${env.db.instanceName}`
    : `${env.db.server}:${env.db.port}`
  try {
    await getPool()
    res.json({
      ok: true,
      db: 'up',
      service: 'fuelledger-api',
      server: serverLabel,
      database: env.db.database,
    })
  } catch (err) {
    res.status(503).json({
      ok: false,
      db: 'down',
      service: 'fuelledger-api',
      server: serverLabel,
      database: env.db.database,
      message: err?.message || 'DB unavailable',
    })
  }
})

app.post('/api/auth/login', loginLimiter, loginHandler)
app.post('/api/auth/logout', logoutHandler)
app.get('/api/auth/me', requireAuth, meHandler)

const customerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: 'Too many customer requests. Please wait and try again.',
  },
})

app.use(
  '/api/customers',
  customerLimiter,
  requireReadKey,
  requireAuth,
  requireRoles('Administrator', 'Accountant'),
  customerRouter,
)

/** Shared by transactions, dashboard, COA, reports, cashbook, push — dashboard polls several endpoints. */
const apiReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: 'Too many requests. Please wait and try again.',
  },
})

app.use(
  '/api/transactions',
  apiReadLimiter,
  requireReadKey,
  requireAuth,
  requireRoles('Administrator', 'Accountant'),
  transactionRouter,
)

app.use(
  '/api/dashboard',
  apiReadLimiter,
  requireReadKey,
  requireAuth,
  requireRoles('Administrator', 'Accountant'),
  dashboardRouter,
)

app.use(
  '/api/company',
  apiReadLimiter,
  requireReadKey,
  requireAuth,
  requireRoles('Administrator', 'Accountant', 'Customer', 'Unit'),
  companyRouter,
)

app.use(
  '/api/unit',
  apiReadLimiter,
  requireReadKey,
  requireAuth,
  requireRoles('Unit', 'Administrator'),
  unitRouter,
)

app.use(
  '/api/portal',
  apiReadLimiter,
  requireReadKey,
  requireAuth,
  requireRoles('Customer'),
  portalRouter,
)

app.use(
  '/api/chart-of-accounts',
  apiReadLimiter,
  requireReadKey,
  requireAuth,
  requireRoles('Administrator', 'Accountant'),
  coaRouter,
)

app.use(
  '/api/reports',
  apiReadLimiter,
  requireReadKey,
  requireAuth,
  requireRoles('Administrator', 'Accountant'),
  reportsRouter,
)

app.use(
  '/api/cashbook',
  apiReadLimiter,
  requireReadKey,
  requireAuth,
  requireRoles('Administrator', 'Accountant'),
  cashbookRouter,
)

app.use(
  '/api/push',
  apiReadLimiter,
  requireReadKey,
  requireAuth,
  requireRoles('Administrator', 'Accountant'),
  pushRouter,
)

app.all(/^\/api\/.*/, (_req, res) => {
  res.status(404).json({ ok: false, message: 'Not found' })
})

app.use((err, _req, res, _next) => {
  if (err?.message === 'Not allowed by CORS') {
    return res.status(403).json({ ok: false, message: 'CORS blocked' })
  }
  console.error('[api]', err)
  return res.status(500).json({ ok: false, message: 'Server error' })
})

async function start() {
  try {
    await getPool()
  } catch (err) {
    // Keep API up so /api/health can report db:down; VPN/SQL may come online later
    console.error('[fuelledger-api] DB not ready at startup —', err.message)
  }
  app.listen(env.port, () => {
    console.log(`[fuelledger-api] listening on :${env.port} (SELECT-only auth + customers + transactions)`)
    startPushWatcher()
  })
}

start().catch((err) => {
  console.error('[fuelledger-api] failed to start', err.message)
  process.exit(1)
})
