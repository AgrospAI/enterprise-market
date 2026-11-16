import { useLingui } from '@lingui/react'
import { i18n } from '../i18n/index'
import { ReactElement, useState } from 'react'
import Search from '../components/Search'
import Page from '@shared/Page'
import { accountTruncate } from '@utils/wallet'
import { MAXIMUM_NUMBER_OF_PAGES_WITH_RESULTS } from '@utils/aquarius'
import { useRouter } from 'next/router'
import { isAddress } from 'ethers'
import { contentPagesSearch as content } from '../i18n/content'

export default function PageSearch(): ReactElement {
  useLingui()

  const router = useRouter()
  const parsed = router.query
  const { text, owner, tags, categories } = parsed
  const [totalResults, setTotalResults] = useState<number>()
  const [totalPagesNumber, setTotalPagesNumber] = useState<number>()

  const isETHAddress = isAddress(text as string)
  const searchValue =
    (isETHAddress ? accountTruncate(text as string) : text) ||
    tags ||
    categories
  const title = owner
    ? i18n._('Published by {value0}', {
        value0: accountTruncate(owner as string)
      })
    : `${
        totalResults !== undefined
          ? searchValue && searchValue !== ' '
            ? totalResults === 0
              ? i18n._('No results')
              : totalResults +
                (totalResults > 1 ? i18n._(' results') : i18n._(' result')) +
                i18n._(' for ') +
                searchValue
            : totalResults + i18n._(' results')
          : i18n._('Searching...')
      }`

  return (
    <Page
      title={
        totalPagesNumber > MAXIMUM_NUMBER_OF_PAGES_WITH_RESULTS
          ? i18n._('>10000 results {value0}', {
              value0:
                searchValue && searchValue !== ' '
                  ? i18n._('for {searchValue}', { searchValue })
                  : ''
            })
          : title
      }
      description={
        totalPagesNumber &&
        totalPagesNumber > MAXIMUM_NUMBER_OF_PAGES_WITH_RESULTS
          ? content.limitedResults
          : content.description
      }
      uri={router.route}
    >
      <Search
        setTotalResults={setTotalResults}
        setTotalPagesNumber={setTotalPagesNumber}
      />
    </Page>
  )
}
