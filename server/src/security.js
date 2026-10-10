import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { env } from './config.js'

/** In-memory brute-force protection (per IP + username). */
const attempts = new Map()

function attemptKey(ip, username) {
  return `${ip}::${username.toLowerCase()}`
}

export function getLockStatus(ip, username) {
  const key = attemptKey(ip, username)
  const row = attempts.get(key)
  if (!row) return { locked: false, remainingMs: 0, fails: 0 }

  if (row.lockedUntil && Date.now() < row.lockedUntil) {
    return {
      locked: true,
      remainingMs: row.lockedUntil - Date.now(),
      fails: row.fails,
    }
  }

  if (row.lockedUntil && Date.now() >= row.lockedUntil) {
    attempts.delete(key)
    return { locked: false, remainingMs: 0, fails: 0 }
  }

  return { locked: false, remainingMs: 0, fails: row.fails }
}

export function registerFailedLogin(ip, username) {
  const key = attemptKey(ip, username)
  const prev = attempts.get(key) || { fails: 0, lockedUntil: 0 }
  const fails = prev.fails + 1
  const lockedUntil =
    fails >= env.loginMaxAttempts
      ? Date.now() + env.loginLockMinutes * 60 * 1000
      : 0
  attempts.set(key, { fails, lockedUntil })
  return {
    fails,
    locked: lockedUntil > 0,
    remainingMs: lockedUntil ? lockedUntil - Date.now() : 0,
  }
}

export function clearLoginAttempts(ip, username) {
  attempts.delete(attemptKey(ip, username))
}

/** Constant-time string compare (pads hashes so length is not leaked easily). */
export function safeEqualPassword(input, stored) {
  const a = crypto.createHash('sha256').update(String(input ?? ''), 'utf8').digest()
  const b = crypto.createHash('sha256').update(String(stored ?? ''), 'utf8').digest()
  return crypto.timingSafeEqual(a, b)
}

export function normalizeRole(type) {
  const t = String(type || '').trim().toLowerCase()
  if (t === 'administrator' || t === 'admin') return 'Administrator'
  if (t === 'accountant') return 'Accountant'
  if (t === 'customer') return 'Customer'
  if (t === 'unit') return 'Unit'
  if (t === 'user') return 'User'
  return 'User'
}

export function dashboardPathForRole(role) {
  switch (role) {
    case 'Administrator':
      return '/dashboard'
    case 'Accountant':
      return '/accountant/dashboard'
    case 'Customer':
      return '/customer/dashboard'
    case 'Unit':
      return '/unit/dashboard'
    case 'User':
      return '/user/dashboard'
    default:
      return '/user/dashboard'
  }
}

export function signToken(payload) {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
    algorithm: 'HS256',
  })
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] })
}

/** Timing-safe compare for API_READ_KEY (length-independent via SHA-256). */
export function safeEqualKey(sent, expected) {
  const a = crypto.createHash('sha256').update(String(sent ?? ''), 'utf8').digest()
  const b = crypto.createHash('sha256').update(String(expected ?? ''), 'utf8').digest()
  return crypto.timingSafeEqual(a, b)
}
