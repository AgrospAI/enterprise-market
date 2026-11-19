import { useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import Publish from '../../components/Publish'
import Page from '@shared/Page'
import { contentPublishIndex as content } from '../../i18n/content'
import router from 'next/router'

export default function PagePublish(): ReactElement {
  useLingui()

  const { title, description } = content

  return (
    <Page
      title={title}
      description={description}
      uri={router.route}
      noPageHeader
    >
      <Publish content={content} />
    </Page>
  )
}
