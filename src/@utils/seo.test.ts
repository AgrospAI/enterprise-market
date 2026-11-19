/* eslint-disable @typescript-eslint/no-var-requires */
import { contentSite as siteContent } from '../i18n/content'

function loadSeo(config: { siteUrl?: string | null; allowIndexing?: string }) {
  jest.resetModules()
  jest.doMock('../../app.config.cjs', () => ({
    __esModule: true,
    siteUrl: config.siteUrl ?? null,
    allowIndexing: config.allowIndexing ?? 'false'
  }))
  return require('./seo') as typeof import('./seo')
}

describe('seo utils', () => {
  afterEach(() => {
    jest.dontMock('../../app.config.cjs')
  })

  it('prefers NEXT_PUBLIC_SITE_URL and strips query strings and hashes', () => {
    const { getAbsoluteUrl } = loadSeo({
      siteUrl: 'https://market.example.com/'
    })
    expect(getAbsoluteUrl('/asset/did:op:123?tab=1#top')).toBe(
      'https://market.example.com/asset/did:op:123'
    )
    expect(getAbsoluteUrl('/')).toBe('https://market.example.com')
  })

  it('falls back to the origin the page is served from', () => {
    const { getSiteOrigin } = loadSeo({ siteUrl: null })
    // jsdom serves tests from http://localhost
    expect(getSiteOrigin('https://ignored.example.com')).toBe(
      window.location.origin
    )
  })

  it('only allows indexing on the configured host or when forced', () => {
    const configured = loadSeo({ siteUrl: 'https://market.example.com' })
    expect(configured.isIndexingAllowed('market.example.com')).toBe(true)
    expect(configured.isIndexingAllowed('preview.example.com')).toBe(false)
    expect(configured.isIndexingAllowed(null)).toBe(false)

    const forced = loadSeo({ siteUrl: null, allowIndexing: 'true' })
    expect(forced.isIndexingAllowed('anything.example.com')).toBe(true)
  })

  it('assumes the configured host for pages rendered without a request', () => {
    const configured = loadSeo({ siteUrl: 'https://market.example.com' })
    expect(configured.getServerRobots(null)).toBe('index,follow')
    expect(configured.getServerRobots('market.example.com')).toBe(
      'index,follow'
    )
    expect(configured.getServerRobots('preview.example.com')).toBe(
      'noindex,nofollow'
    )

    const unconfigured = loadSeo({ siteUrl: null })
    expect(unconfigured.getServerRobots(null)).toBe('noindex,nofollow')
    expect(unconfigured.isSiteUrlConfigured()).toBe(false)
    expect(configured.isSiteUrlConfigured()).toBe(true)
  })

  it('builds plain-text descriptions of at most 160 characters', () => {
    const { toMetaDescription } = loadSeo({})
    expect(toMetaDescription('**Bold** and [a link](https://x.y)')).toBe(
      'Bold and a link'
    )
    const long = toMetaDescription('word '.repeat(80))
    expect(long.length).toBeLessThanOrEqual(160)
    expect(long.endsWith('…')).toBe(true)
  })

  it('appends the site name to page titles exactly once', () => {
    const { getPageTitle } = loadSeo({})
    const { siteTitle } = siteContent
    expect(getPageTitle('Publish')).toBe(`Publish - ${siteTitle}`)
    expect(getPageTitle(siteTitle)).toBe(siteTitle)
    expect(getPageTitle('Anything', true)).toBe(siteTitle)
  })
})

describe('robots.txt and sitemap.xml', () => {
  it('point at the configured site URL', () => {
    jest.resetModules()
    jest.doMock('../../app.config.cjs', () => ({
      __esModule: true,
      siteUrl: 'https://market.example.com',
      allowIndexing: 'false'
    }))
    const { buildRobotsTxt } = require('../pages/robots.txt')
    const { buildSitemap } = require('../pages/sitemap.xml')

    expect(buildRobotsTxt()).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: https://market.example.com/sitemap.xml\n'
    )
    const sitemap = buildSitemap()
    expect(sitemap).toContain('<loc>https://market.example.com</loc>')
    expect(sitemap).toContain('<loc>https://market.example.com/search</loc>')
    expect(sitemap).not.toContain('/publish/1')
    expect(sitemap).not.toContain('/bookmarks')
    expect(sitemap).toContain(
      '<loc>https://market.example.com/privacy/terms</loc>'
    )
    jest.dontMock('../../app.config.cjs')
  })
})
