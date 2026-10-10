import { z } from 'zod'
import { findCustomerByWebUser, findUserByUsername } from './db.js'
import {
  clearLoginAttempts,
  dashboardPathForRole,
  getLockStatus,
  normalizeRole,
  registerFailedLogin,
  safeEqualPassword,
  signToken,
} from './security.js'
import { env } from './config.js'

const COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000

function setAuthCookie(res, token, req) {
  // COOKIE_SECURE=true is for HTTPS prod; Cursor/local http must not get Secure cookies
  const secure =
    env.cookieSecure &&
    Boolean(req?.secure || req?.headers?.['x-forwarded-proto'] === 'https')
  res.cookie('fl_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  })
}

const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'Username is required')
    .max(100)
    .regex(/^[a-zA-Z0-9._@\- ]+$/, 'Invalid username characters'),
  password: z.string().min(1, 'Password is required').max(128),
})

function clientIp(req) {
  const xf = req.headers['x-forwarded-for']
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim()
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

function isDisabledStatus(value) {
  const status = String(value || '')
    .trim()
    .toLowerCase()
  return ['inactive', 'disabled', 'blocked', 'lock', 'locked'].includes(status)
}

export async function loginHandler(req, res) {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      message: parsed.error.issues[0]?.message || 'Invalid input',
    })
  }

  const { username, password } = parsed.data
  const ip = clientIp(req)

  const lock = getLockStatus(ip, username)
  if (lock.locked) {
    const mins = Math.ceil(lock.remainingMs / 60000)
    return res.status(429).json({
      ok: false,
      message: `Too many failed attempts. Try again in ~${mins} minute(s).`,
      locked: true,
    })
  }

  let staffUser = null
  let customer = null
  try {
    staffUser = await findUserByUsername(username)
    if (!staffUser) {
      customer = await findCustomerByWebUser(username)
    }
  } catch (err) {
    console.error('[auth] db error', err.message)
    return res.status(503).json({
      ok: false,
      message: 'Authentication service temporarily unavailable',
    })
  }

  // Staff (UserReg) takes precedence when username exists there
  if (staffUser) {
    const storedPass = staffUser.UserPass ?? cryptoRandomDummy()
    const passwordOk = safeEqualPassword(password, storedPass)

    if (!passwordOk) {
      const fail = registerFailedLogin(ip, username)
      return res.status(401).json({
        ok: false,
        message: 'Invalid username or password',
        attemptsRemaining: Math.max(0, env.loginMaxAttempts - fail.fails),
        locked: fail.locked,
      })
    }

    const role = normalizeRole(staffUser.Type)
    // UserReg Type=User is blocked; Type=Unit is allowed (UNIT view-only portal).
    if (isDisabledStatus(staffUser.Status) || role === 'User') {
      return res.status(403).json({
        ok: false,
        message: 'Account is disabled. Contact administrator.',
      })
    }

    clearLoginAttempts(ip, username)

    const redirectTo = dashboardPathForRole(role)
    const token = signToken({
      sub: String(staffUser.UserId),
      username: staffUser.UserName,
      role,
    })

    setAuthCookie(res, token, req)

    return res.json({
      ok: true,
      user: {
        id: staffUser.UserId,
        username: staffUser.UserName,
        role,
      },
      redirectTo,
      token,
    })
  }

  // Customer portal — AccReg.WebUser / WebPass
  const storedPass = customer?.WebPass ?? cryptoRandomDummy()
  const passwordOk = safeEqualPassword(password, storedPass)
  const customerOk = Boolean(customer)

  if (!customerOk || !passwordOk) {
    const fail = registerFailedLogin(ip, username)
    return res.status(401).json({
      ok: false,
      message: 'Invalid username or password',
      attemptsRemaining: Math.max(0, env.loginMaxAttempts - fail.fails),
      locked: fail.locked,
    })
  }

  if (isDisabledStatus(customer.Status) || isDisabledStatus(customer.WebStatus)) {
    return res.status(403).json({
      ok: false,
      message: 'Account is disabled. Contact administrator.',
    })
  }

  clearLoginAttempts(ip, username)

  const role = 'Customer'
  const redirectTo = dashboardPathForRole(role)
  const displayName = String(customer.AccName || customer.WebUser || 'Customer').trim()
  const token = signToken({
    sub: `c-${customer.Accid}`,
    username: customer.WebUser,
    role,
    accid: customer.Accid,
    name: displayName,
  })

  setAuthCookie(res, token, req)

  return res.json({
    ok: true,
    user: {
      id: customer.Accid,
      username: customer.WebUser,
      role,
      accid: customer.Accid,
      name: displayName,
    },
    redirectTo,
    token,
  })
}

function cryptoRandomDummy() {
  // Non-matching dummy so compare always runs when user missing
  return `__none__${Math.random()}`
}

export function meHandler(req, res) {
  return res.json({ ok: true, user: req.user })
}

export function logoutHandler(_req, res) {
  res.clearCookie('fl_token', { path: '/' })
  return res.json({ ok: true })
}
