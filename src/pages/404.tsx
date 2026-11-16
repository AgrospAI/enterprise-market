import { useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import Page from '@shared/Page'
import Head from 'next/head'
import Button from '@shared/atoms/Button'
import { contentPages404 as content } from '../i18n/content'
import { useRouter } from 'next/router'

export default function Page404(): ReactElement {
  useLingui()

  const router = useRouter()
  const { title, description, actions } = content

  return (
    <>
      <Head>
        <style type="text/css">
          {
            '\n          main {\n            text-align: center;\n          }\n        '
          }
        </style>
      </Head>
      <Page
        title={title}
        description={description}
        uri={router.route}
        headerCenter
      >
        {actions.map((action: { title: string; url: string }) => (
          <Button style="primary" key={action.title} to={action.url}>
            {action.title}
          </Button>
        ))}
      </Page>
    </>
  )
}
