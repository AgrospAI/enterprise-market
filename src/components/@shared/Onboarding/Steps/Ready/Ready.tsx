import { Trans, useLingui } from '@lingui/react'
import { i18n } from '../../../../../i18n/index'
import { ReactElement } from 'react'
import { useRouter } from 'next/router'
import styles from './index.module.css'
import { contentOnboardingStepsReady as content } from '../../../../../i18n/content'
import SuccessConfetti from '@components/@shared/SuccessConfetti'
import Button from '@shared/atoms/Button'

interface ReadyStep {
  title: string
  body: string
  image: string
}

export default function Ready(): ReactElement {
  useLingui()

  const { title, body, image }: ReadyStep = content
  const router = useRouter()

  const handlePublish = () => {
    router.push('/publish/1')
  }

  const handleCatalogue = () => {
    router.push('/search?sort=indexedMetadata.event.block&sortOrder=desc')
  }

  return (
    <div className={styles.container}>
      <SuccessConfetti success={body} className={styles.body} />
      <img src={image} alt={i18n._('Ready')} className={styles.image} />
      <div className={styles.footer}>
        <h3 className={styles.title}>{title}</h3>

        <div className={styles.buttonsWrapper}>
          <Button onClick={handlePublish} style="primary" size="small">
            <Trans id="Publish New Asset" />{' '}
          </Button>

          <Button onClick={handleCatalogue} style="primary" size="small">
            <Trans id="View Catalogue" />{' '}
          </Button>
        </div>
      </div>
    </div>
  )
}
