import { Trans, useLingui } from '@lingui/react'
import { i18n } from '../../i18n/index'
import { ReactElement, useEffect } from 'react'
import { addExistingParamsToUrl } from './utils'
import styles from './sort.module.css'
import {
  SortDirectionOptions,
  SortTermOptions
} from '../../@types/aquarius/SearchQuery'
import { useRouter } from 'next/router'
import Accordion from '@components/@shared/Accordion'
import Input from '@components/@shared/FormInput'
import { Sort as SortInterface, useFilter } from '@context/Filter'
import queryString from 'query-string'

const sortItems = [
  {
    get display() {
      return i18n._('Relevance')
    },
    value: SortTermOptions.Relevance
  },
  {
    get display() {
      return i18n._('Published')
    },
    value: SortTermOptions.Created
  },
  {
    get display() {
      return i18n._('Sales')
    },
    value: SortTermOptions.Orders
  },
  {
    get display() {
      return i18n._('Price')
    },
    value: SortTermOptions.Price
  }
]

const sortDirections = [
  {
    get display() {
      return i18n._('↑ Ascending')
    },
    value: SortDirectionOptions.Ascending
  },
  {
    get display() {
      return i18n._('↓ Descending')
    },
    value: SortDirectionOptions.Descending
  }
]

function getInitialFilters(
  parsedUrlParams: queryString.ParsedQuery<string>,
  filterIds: (keyof SortInterface)[]
): SortInterface {
  if (!parsedUrlParams || !filterIds) return

  const initialFilters = {}
  filterIds.forEach((id) => (initialFilters[id] = parsedUrlParams?.[id]))

  return initialFilters as SortInterface
}

export default function Sort({
  expanded
}: {
  expanded?: boolean
}): ReactElement {
  useLingui()

  const { sort, setSort } = useFilter()

  const router = useRouter()

  const parsedUrl = queryString.parse(location.search, {
    arrayFormat: 'separator'
  })

  useEffect(() => {
    const initialFilters = getInitialFilters(
      parsedUrl,
      Object.keys(sort) as (keyof SortInterface)[]
    )
    setSort(initialFilters)
  }, [])

  async function sortResults(
    sortBy?: SortTermOptions,
    direction?: SortDirectionOptions
  ) {
    let urlLocation: string
    if (sortBy) {
      urlLocation = await addExistingParamsToUrl(location, ['sort'])
      urlLocation = `${urlLocation}&sort=${sortBy}`
      setSort({ ...sort, sort: sortBy })
    } else if (direction) {
      urlLocation = await addExistingParamsToUrl(location, ['sortOrder'])
      urlLocation = `${urlLocation}&sortOrder=${direction}`
      setSort({ ...sort, sortOrder: direction })
    }
    router.push(urlLocation)
  }

  return (
    <>
      <div className={styles.sidePositioning}>
        <Accordion title={i18n._('Sort')} defaultExpanded={expanded}>
          <div className={styles.sortList}>
            <div className={styles.sortType}>
              <h5 className={styles.sortTypeLabel}>
                <Trans id="Type" />
              </h5>
              {sortItems.map((item) => (
                <Input
                  key={item.value}
                  name="sortType"
                  type="radio"
                  options={[item.display]}
                  value={item.value}
                  checked={sort.sort === item.value}
                  onChange={() => sortResults(item.value, null)}
                />
              ))}
            </div>
            <div className={styles.sortDirection}>
              <h5 className={styles.sortDirectionLabel}>
                <Trans id="Direction" />
              </h5>
              {sortDirections.map((item) => (
                <Input
                  key={item.value}
                  name="sortDirection"
                  type="radio"
                  options={[item.display]}
                  value={item.value}
                  checked={sort.sortOrder === item.value}
                  onChange={() => sortResults(null, item.value)}
                />
              ))}
            </div>
          </div>
        </Accordion>
      </div>
      <div className={styles.topPositioning}>
        <div className={styles.compactFilterContainer}>
          <Accordion title={i18n._('Sort Type')} compact>
            <div className={styles.compactOptionsContainer}>
              {sortItems.map((item) => (
                <Input
                  key={item.value}
                  name="sortTypeCompact"
                  type="radio"
                  options={[item.display]}
                  value={item.value}
                  checked={sort.sort === item.value}
                  onChange={() => sortResults(item.value, null)}
                />
              ))}
            </div>
          </Accordion>
        </div>
        <div className={styles.compactFilterContainer}>
          <Accordion title={i18n._('Sort Direction')} compact>
            <div className={styles.compactOptionsContainer}>
              {sortDirections.map((item) => (
                <Input
                  key={item.value}
                  name="sortDirectionCompact"
                  type="radio"
                  options={[item.display]}
                  value={item.value}
                  checked={sort.sortOrder === item.value}
                  onChange={() => sortResults(null, item.value)}
                />
              ))}
            </div>
          </Accordion>
        </div>
      </div>
    </>
  )
}
