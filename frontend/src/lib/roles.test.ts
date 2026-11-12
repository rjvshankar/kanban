import { describe, expect, it } from 'vitest'
import { ROLE_INFO, ROLES } from './roles'

describe('roles', () => {
  it('lists roles from most to least powerful', () => expect(ROLES).toEqual(['owner', 'editor', 'viewer']))

  it('describes every role', () => {
    for (const r of ROLES) expect(ROLE_INFO[r].length).toBeGreaterThan(10)
  })
})
