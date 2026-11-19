import { translate } from '../../../i18n/translate'
import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement, useState, useEffect } from 'react'
import { useAsset } from '@context/Asset'
import styles from './index.module.css'
import Tabs from '@shared/atoms/Tabs'
import EditMetadata from './EditMetadata'
import Page from '@shared/Page'
import Loader from '@shared/atoms/Loader'
import Alert from '@shared/atoms/Alert'
import { contentPagesEdit as contentPage } from '../../../i18n/content'
import Container from '@shared/atoms/Container'
import EditServices from './EditServices'

export default function Edit({ uri }: { uri: string }): ReactElement {
  useLingui()

  const { asset, error, isInPurgatory, title, isOwner } = useAsset()
  const [pageTitle, setPageTitle] = useState<string>('')
  const [tabIndex, setTabIndex] = useState(0)

  useEffect(() => {
    if (!asset) return

    const pageTitle = isInPurgatory
      ? ''
      : !isOwner
      ? i18n._('Edit action not available')
      : i18n._('Edit {title}', { title })

    setPageTitle(pageTitle)
  }, [asset, isInPurgatory, title, isOwner])

  const tabs = [
    {
      title: i18n._('Edit Asset'),
      content: <EditMetadata asset={asset} />
    },
    {
      title: i18n._('Edit Services'),
      content: <EditServices asset={asset} />
    }
  ]

  return (
    <Page title={pageTitle} description={contentPage.description} uri={uri}>
      {!asset?.accessDetails ? (
        <Loader />
      ) : !isOwner ? (
        <Alert
          title={i18n._('Edit action available only to asset owner')}
          text={translate(error)}
          state="error"
        />
      ) : (
        <Container className={`${styles.container} ${styles.containerPublish}`}>
          <Tabs
            items={tabs}
            selectedIndex={tabIndex}
            onIndexSelected={setTabIndex}
            className={styles.edit}
            variant="accent"
            showRadio
            isEditPage
          />
        </Container>
      )}
    </Page>
  )
}
