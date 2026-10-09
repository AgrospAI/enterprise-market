import { renderToStaticMarkup } from 'react-dom/server'
import DocumentHead from './DocumentHead'
import siteContent from '../../../../../content/site.json'

describe('DocumentHead', () => {
  it('renders the server-side fallback title, description and share tags', () => {
    const view = renderToStaticMarkup(
      <DocumentHead
        page="/"
        asPath="/?utm_source=test"
        requestOrigin="https://market.example.com"
        requestHostname="market.example.com"
      />
    )

    expect(view).toContain(`<title>${siteContent.siteTitle}</title>`)
    expect(view).toContain('property="og:type" content="website"')
    expect(view).toContain('name="twitter:card" content="summary_large_image"')
    expect(view).toContain('name="theme-color" content="#004967"')
    expect(view).toContain('property="og:image:width" content="1200"')
    expect(view).toContain('property="og:image:height" content="630"')
    expect(view).toContain('data-next-head=""')
    expect(view).not.toContain('utm_source')
    expect(view).not.toContain('oceanprotocol')
  })

  it('uses markdown front matter for legal pages', () => {
    const view = renderToStaticMarkup(
      <DocumentHead
        page="/privacy/[slug]"
        asPath="/privacy/terms"
        pageProps={{
          frontmatter: {
            title: 'Terms and Conditions',
            description: 'Terms of use.'
          }
        }}
      />
    )

    expect(view).toContain(
      `<title>Terms and Conditions - ${siteContent.siteTitle}</title>`
    )
    expect(view).toContain('name="description" content="Terms of use."')
    expect(view).toContain('name="robots" content="noindex,nofollow"')
  })
})
