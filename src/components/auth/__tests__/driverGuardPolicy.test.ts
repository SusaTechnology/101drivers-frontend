// Driver lifecycle route-policy regression tests (Task 79 hardening).
//
// The incident these lock in: an APPROVED driver whose CACHED session still
// carried onboardingCompleted:false (a pre-approval login persisted in
// localStorage) was bounced through /driver-onboarding-complete on every
// navigation — the old guard gated APPROVED on the stale flag. The policy
// under test now short-circuits APPROVED before any flag check and fails
// CLOSED for every non-approved (or unknown/null) status onto the status
// board, so a pending driver can never render the dashboard/map.
//
// Run: npm test (vitest).
import { beforeAll, describe, expect, it, vi } from 'vitest'

// Minimal window fake — safeStorage touches window.localStorage via
// optional chaining, and some lib modules (driver-feed-tracker) register
// window listeners at import time, so all of it is stubbed no-op.
const store = new Map<string, string>()
vi.stubGlobal('window', {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
})
// dataQuery.ts registers document listeners inside a `typeof window` guard —
// stubbing window therefore requires a no-op document global too.
vi.stubGlobal('document', {
  addEventListener: () => {},
  removeEventListener: () => {},
  visibilityState: 'visible',
})

let computeDriverGuardAccess: (
  pathname: string,
) => { state: string; message: string }
// Drive session state through the module's own setters — getUser() memoizes
// the parsed user, so raw localStorage writes alone would be invisible.
let setUser: (user: any) => void
let setAccessToken: (token: string | null) => void
let clearAuth: () => void

beforeAll(async () => {
  ;({ computeDriverGuardAccess } = await import('../DriverRouteGuard'))
  ;({ setUser, setAccessToken, clearAuth } = await import('@/lib/tanstack/dataQuery'))
})

function seedSession(user: Record<string, unknown> | null) {
  if (user) {
    setAccessToken('test-access-token')
    setUser(user)
  } else {
    clearAuth()
  }
}

const driverSession = (overrides: Record<string, unknown>) => ({
  id: 'user-1',
  profileId: 'driver-1',
  username: 'driver',
  roles: ['DRIVER'],
  driverStatus: 'APPROVED',
  onboardingCompleted: true,
  onboardingToken: 'tok',
  ...overrides,
})

describe('computeDriverGuardAccess — lifecycle policy matrix', () => {
  it('THE INCIDENT: APPROVED + stale onboardingCompleted:false → authenticated, never onboarding', () => {
    seedSession(driverSession({ onboardingCompleted: false }))
    const result = computeDriverGuardAccess('/driver/dashboard')
    expect(result.state).toBe('authenticated')
    expect(result.state).not.toBe('needs_onboarding')
  })

  it('APPROVED + missing onboarding token → authenticated', () => {
    seedSession(driverSession({ onboardingToken: null }))
    expect(computeDriverGuardAccess('/driver/dashboard').state).toBe('authenticated')
  })

  it('APPROVED driver reaches every operational driver route', () => {
    seedSession(driverSession({}))
    for (const path of [
      '/driver/dashboard',
      '/driver/active',
      '/driver/completed',
      '/driver/wallet',
      '/driver/menu',
      '/driver/inbox',
      '/driver/booked-later',
      '/driver/job-list',
    ]) {
      expect(computeDriverGuardAccess(path).state).toBe('authenticated')
    }
  })

  it.each([
    'PENDING',
    'PENDING_APPROVAL',
    'MEETING_REQUESTED',
    'WAITLISTED',
    'INVITED',
    'ON_HOLD',
    'SUSPENDED',
    'REJECTED',
  ])('%s → status board (never operational access)', (status) => {
    seedSession(driverSession({ driverStatus: status }))
    expect(computeDriverGuardAccess('/driver/dashboard').state).toBe('status_board')
  })

  it.each([null, undefined, 'SOME_RETIRE_STATUS'])(
    'unknown/missing status (%s) fails CLOSED to the status board',
    (status) => {
      seedSession(driverSession({ driverStatus: status }))
      expect(computeDriverGuardAccess('/driver/dashboard').state).toBe('status_board')
    }
  )

  it('a pending driver cannot reach ANY operational route', () => {
    seedSession(driverSession({ driverStatus: 'PENDING_APPROVAL' }))
    for (const path of [
      '/driver/dashboard',
      '/driver/active',
      '/driver/wallet',
      '/driver/booked-later',
    ]) {
      expect(computeDriverGuardAccess(path).state).toBe('status_board')
    }
  })

  it('support routes stay open to non-approved drivers (the escape channel)', () => {
    seedSession(driverSession({ driverStatus: 'SUSPENDED' }))
    expect(computeDriverGuardAccess('/driver-support-list').state).toBe('authenticated')
  })

  it('no session → needs_signin', () => {
    seedSession(null)
    expect(computeDriverGuardAccess('/driver/dashboard').state).toBe('needs_signin')
  })

  it('non-DRIVER role → forbidden_role (no dashboard, no board)', () => {
    seedSession({
      id: 'user-2',
      roles: ['PRIVATE_CUSTOMER'],
      driverStatus: null,
    })
    expect(computeDriverGuardAccess('/driver/dashboard').state).toBe('forbidden_role')
  })
})
