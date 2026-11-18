import { PORTAL_TAG, withPortalTag, withoutPortalTag } from './portalTag'

describe('portalTag', () => {
  it('reads the portal tag from queryFilter.config.cjs', () => {
    expect(PORTAL_TAG).toBe('tareando')
  })

  it('adds the portal tag when missing', () => {
    expect(withPortalTag(undefined)).toEqual(['tareando'])
    expect(withPortalTag([])).toEqual(['tareando'])
    expect(withPortalTag(['olive', 'soil'])).toEqual([
      'olive',
      'soil',
      'tareando'
    ])
  })

  it('does not duplicate the portal tag', () => {
    expect(withPortalTag(['tareando', 'soil'])).toEqual(['tareando', 'soil'])
    expect(withPortalTag(['Tareando'])).toEqual(['Tareando'])
  })

  it('removes the portal tag', () => {
    expect(withoutPortalTag(['tareando', 'soil'])).toEqual(['soil'])
    expect(withoutPortalTag(undefined)).toEqual([])
  })
})
