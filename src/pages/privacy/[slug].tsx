import { i18n } from '../../i18n/index'
import { useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import { markdownToHtmlWithToc } from '@utils/markdown'
import { getPageBySlug, PageData } from '@utils/markdownPages'
import { extractHeadingsFromMarkdown, Heading } from '@utils/extractHeadings'
import Page from '@shared/Page'
import styles from '@shared/Page/PageMarkdown.module.css'
import Container from '@shared/atoms/Container'
import PrivacyPolicyHeader from '../../components/Privacy/PrivacyHeader'
import TableOfContents from '../../components/@shared/TableOfContents'
import StickySidebarLayout from '../../components/@shared/StickySidebarLayout'
import HashScrollHandler from '../../components/@shared/HashScrollHandler'
import { useRouter } from 'next/router'

interface PrivacyPageData extends PageData {
  headings: Heading[]
  markdown?: string
}

export default function PageMarkdown(page: PrivacyPageData): ReactElement {
  useLingui()

  const router = useRouter()
  const { lastUpdated } = page.frontmatter
  const title = i18n._(page.frontmatter.title || '')
  const description = i18n._(page.frontmatter.description || '')
  const { fileLastUpdated } = page
  const translatedMarkdown = page.markdown
    ?.split(/\n\s*\n/)
    .map((block) => (/[a-zA-Z]/.test(block) ? i18n._(block) : block))
    .join('\n\n')
  const content = translatedMarkdown
    ? markdownToHtmlWithToc(translatedMarkdown)
    : page.content
  const headings = translatedMarkdown
    ? extractHeadingsFromMarkdown(translatedMarkdown)
    : page.headings

  if (!page || page.content === '') return null

  return (
    <Page
      title={title}
      description={description}
      uri={router.asPath}
      headerCenter
    >
      <Container>
        <HashScrollHandler />
        <PrivacyPolicyHeader
          documentDate={lastUpdated}
          fileLastUpdated={fileLastUpdated}
        />
        {headings.length > 0 ? (
          <StickySidebarLayout
            sidebar={<TableOfContents headings={headings} />}
          >
            <div className={styles.section}>
              <div
                className={styles.content}
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </div>
          </StickySidebarLayout>
        ) : (
          <div className={styles.section}>
            <div
              className={styles.content}
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </div>
        )}
      </Container>
    </Page>
  )
}

export async function getServerSideProps({
  params
}: {
  params: { slug: string }
}) {
  const page = await getPageBySlug(params.slug, 'privacy')

  // A slug with no document behind it must 404 rather than render an empty
  // page. Withdrawn legal documents would otherwise keep answering 200.
  if (!page?.content || page.notFound) {
    return { notFound: true }
  }

  const content = markdownToHtmlWithToc(page.content)
  const headings = extractHeadingsFromMarkdown(page.content)

  return {
    props: { ...page, markdown: page.content, content, headings }
  }
}
