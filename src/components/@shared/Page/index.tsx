import { useLingui } from '@lingui/react'
import { ReactNode, ReactElement } from 'react'
import PageHeader from './PageHeader'
import Seo from './Seo'
import Container from '@shared/atoms/Container'
import { useUserPreferences } from '@context/UserPreferences'
import ExternalContentWarning from '../ExternalContentWarning'
import styles from './index.module.css'

interface PageProps {
  children: ReactNode
  title?: string
  uri: string
  description?: string
  noPageHeader?: boolean
  headerCenter?: boolean
  fullWidth?: boolean
}

export default function Page({
  children,
  title,
  uri,
  description,
  noPageHeader,
  headerCenter,
  fullWidth
}: PageProps): ReactElement {
  useLingui()

  const { allowExternalContent } = useUserPreferences()

  const isHome = uri === '/'
  // const isSearchPage = uri.startsWith('/search')
  const isAssetPage = uri.startsWith('/asset')
  const mainStyle = fullWidth
    ? { display: 'flex', flex: 1, minHeight: 0 }
    : undefined

  return (
    <>
      <Seo title={title} description={description} uri={uri} />

      {/* Header section - always wrapped in Container except for home page */}
      {!isHome && (
        <Container>
          {/* <SearchBar
            placeholder="Search for service offerings"
            isSearchPage={isSearchPage}
          /> */}
          {isAssetPage && !allowExternalContent && <ExternalContentWarning />}
          {title && !noPageHeader && (
            <PageHeader
              title={title}
              description={description}
              center={headerCenter}
              isHome={isHome}
            />
          )}
        </Container>
      )}

      {/* Main content - full width for home, contained for others */}
      <main
        className={isHome || fullWidth ? 'full-width' : ''}
        style={mainStyle}
      >
        {isHome || fullWidth ? (
          children
        ) : (
          <Container className={styles.contentContainer}>{children}</Container>
        )}
      </main>
    </>
  )
}
