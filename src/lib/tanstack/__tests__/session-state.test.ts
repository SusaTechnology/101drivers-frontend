// Session-merge semantics regression tests (Task 79 hardening).
// The incident: the old refresh merge used `?? null` fallbacks, so an
// older backend whose refresh response OMITTED driverStatus/onboardingToken
// silently wiped what login had stored — an approved driver's cached
// session was corrupted on every 10-minute token refresh until the route
// guard misjudged it. mergeSessionUser makes omitted ≠ null ≠ false
// explicit. Run: npm test (vitest).
import { describe, expect, it } from 'vitest'
import { mergeSessionUser } from '../dataQuery'

type SessionUser = Record<string, unknown>

const baseUser: SessionUser = {
  id: 'user-1',
  profileId: 'driver-1',
  username: 'solomonyalew999_1778947017553',
  email: 'solomonyalew999@gmail.com',
  fullName: 'Solomon Yalew',
  roles: ['DRIVER'],
  customerApprovalStatus: null,
  driverStatus: 'APPROVED',
  onboardingCompleted: true,
  onboardingToken: 'ff17dc68be454e7754efc20eb7d3a0d52d3ac96e8a901bb0076e9532dfe5c418',
  isActive: true,
  isSuperAdmin: false,
}

describe('mergeSessionUser — partial refresh responses', () => {
  it('applies a complete server snapshot', () => {
    const merged = mergeSessionUser(baseUser as any, {
      ...baseUser,
      driverStatus: 'SUSPENDED',
      email: 'new@example.com',
    })
    expect(merged.driverStatus).toBe('SUSPENDED')
    expect(merged.email).toBe('new@example.com')
    expect(merged.onboardingToken).toBe(baseUser.onboardingToken)
  })

  it('PRESERVES cached lifecycle fields the response OMITS (the incident)', () => {
    // Older backend: no driver lifecycle fields in the refresh body at all.
    const merged = mergeSessionUser(baseUser as any, {
      id: 'user-1',
      username: 'solomonyalew999_1778947017553',
      roles: ['DRIVER'],
      accessToken: 'should-be-ignored',
      refreshToken: 'should-be-ignored',
    })
    expect(merged.driverStatus).toBe('APPROVED')
    expect(merged.onboardingCompleted).toBe(true)
    expect(merged.onboardingToken).toBe(baseUser.onboardingToken)
    // Token fields are never merged into the session user.
    expect((merged as any).accessToken).toBeUndefined()
    expect((merged as any).refreshToken).toBeUndefined()
  })

  it('takes an explicit null as a server fact (relation gone)', () => {
    const merged = mergeSessionUser(baseUser as any, { driverStatus: null })
    expect(merged.driverStatus).toBeNull()
  })

  it('takes an explicit false as a server fact (never "missing")', () => {
    const merged = mergeSessionUser(baseUser as any, { onboardingCompleted: false })
    expect(merged.onboardingCompleted).toBe(false)
  })

  it('takes a new valid lifecycle value', () => {
    const merged = mergeSessionUser(baseUser as any, { driverStatus: 'ON_HOLD' })
    expect(merged.driverStatus).toBe('ON_HOLD')
  })

  it('replaces the cache wholesale when the response is for a DIFFERENT user', () => {
    const merged = mergeSessionUser(baseUser as any, {
      ...baseUser,
      id: 'user-2',
      username: 'other-user',
      driverStatus: null,
    })
    expect(merged.id).toBe('user-2')
    expect(merged.username).toBe('other-user')
  })

  it('trusts the server outright when the cache is empty (fresh session)', () => {
    const merged = mergeSessionUser(null, baseUser)
    expect(merged.id).toBe('user-1')
    expect(merged.driverStatus).toBe('APPROVED')
  })

  it('returns the previous user untouched for an empty response', () => {
    const merged = mergeSessionUser(baseUser as any, null)
    expect(merged).toBe(baseUser)
  })

  it('does not mutate the previous cached object', () => {
    mergeSessionUser(baseUser as any, { driverStatus: 'REJECTED' })
    expect(baseUser.driverStatus).toBe('APPROVED')
  })
})
