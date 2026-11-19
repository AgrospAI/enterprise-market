import { Trans, useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import { getPageBySlug, PageData } from '@utils/markdownPages'
import Page from '@shared/Page'
import styles from '@shared/Page/PageMarkdown.module.css'
import Container from '@shared/atoms/Container'
import Time from '@shared/atoms/Time'
import { useRouter } from 'next/router'
import { markdownToHtmlWithToc } from '@utils/markdown'

export default function PageMarkdown(page: PageData): ReactElement {
  useLingui()

  const router = useRouter()
  if (!page || page.content === '') return null

  const { title, description, showLastUpdated, lastUpdated } = page.frontmatter
  const { content, fileLastUpdated } = page
  const resolvedLastUpdated = lastUpdated || fileLastUpdated

  return (
    <Page
      title={title}
      description={description}
      uri={router.asPath}
      headerCenter
    >
      <Container narrow>
        <div className={styles.section}>
          <h2 className={styles.title}>{title}</h2>
          {showLastUpdated && (
            <p className={styles.lastUpdated}>
              <em>
                <Trans id="Last updated on" />{' '}
                <Time
                  date={resolvedLastUpdated}
                  displayFormat="MMMM dd, yyyy."
                />
              </em>
            </p>
          )}
          <div
            className={styles.content}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>
      </Container>
    </Page>
  )
}

export async function getServerSideProps({
  params
}: {
  params: { slug: string }
}) {
  const page = await getPageBySlug(params.slug)

  // A slug with no document behind it must 404 rather than render an empty
  // page. Withdrawn legal documents would otherwise keep answering 200.
  if (!page?.content || page.notFound) {
    return { notFound: true }
  }

  const content = markdownToHtmlWithToc(page.content)

  return {
    props: { ...page, content }
  }
}
