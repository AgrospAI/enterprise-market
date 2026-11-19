import { Trans, useLingui } from '@lingui/react'
import { i18n } from '../../i18n/index'
import { ReactElement, useEffect } from 'react'
import classNames from 'classnames/bind'
import { addExistingParamsToUrl } from './utils'
import Button from '@shared/atoms/Button'
import {
  FilterByAccessOptions,
  FilterByPriceOptions,
  FilterByTimeOptions,
  FilterByTypeOptions
} from '../../@types/aquarius/SearchQuery'
import { useRouter } from 'next/router'
import queryString from 'query-string'
import styles from './Filter.module.css'
import { useFilter, Filters } from '@context/Filter'
import Input from '@components/@shared/FormInput'
import Accordion from '@components/@shared/Accordion'
import customFilters from '../../../filters.config.cjs'
import { State } from 'src/@types/ddo/State'
import { nodeUriIndex } from '../../../app.config.cjs'
import networkdata from '../../../content/networks-metadata.json'
import {
  getNetworkDataById,
  getNetworkDisplayName
} from '@hooks/useNetworkMetadata'
import { useConnectorSupportedChains } from '@hooks/useDfnsWalletsByChain'

const cx = classNames.bind(styles)

function formatProviderLabel(providerUrl: string): string {
  const providerWithoutProtocol = providerUrl.replace(/^https?:\/\//, '')
  const firstDotIndex = providerWithoutProtocol.indexOf('.')

  if (firstDotIndex > 0) {
    return providerWithoutProtocol.slice(0, firstDotIndex)
  }

  return providerWithoutProtocol.slice(0, 10)
}

interface FilterStructure {
  id: string
  label: string
  type: string
  options: {
    label: string
    value: any
    title?: string
  }[]
}

export const filterSets = customFilters?.filterSets || {}
const purgatoryFilterItem = { display: 'show purgatory', value: 'purgatory' }

export function getInitialFilters(
  parsedUrlParams: queryString.ParsedQuery<string>,
  filterIds: string[]
): Filters {
  if (!parsedUrlParams || !filterIds) return

  const initialFilters = {}
  filterIds.forEach((id) =>
    !parsedUrlParams?.[id]
      ? (initialFilters[id] = [])
      : Array.isArray(parsedUrlParams?.[id])
      ? (initialFilters[id] = parsedUrlParams?.[id])
      : (initialFilters[id] = [parsedUrlParams?.[id]])
  )

  return initialFilters as Filters
}

export default function Filter({
  addFiltersToUrl,
  showPurgatoryOption,
  expanded,
  className,
  showTime,
  showPrice
}: {
  addFiltersToUrl?: boolean
  showPurgatoryOption?: boolean
  expanded?: boolean
  className?: string
  showTime?: boolean
  showPrice?: boolean
}): ReactElement {
  useLingui()

  const { filters, setFilters, ignorePurgatory, setIgnorePurgatory } =
    useFilter()
  const connectorSupportedChains = useConnectorSupportedChains()

  const router = useRouter()

  const parsedUrl = queryString.parse(location.search, {
    arrayFormat: 'separator'
  })

  useEffect(() => {
    const initialFilters = getInitialFilters(parsedUrl, Object.keys(filters))
    setFilters(initialFilters)
  }, [])

  async function applyFilter(filter: string[], filterId: string) {
    if (!addFiltersToUrl) return
    let urlLocation = await addExistingParamsToUrl(location, [filterId, 'page'])
    if (filter.length > 0 && urlLocation.indexOf(filterId) === -1) {
      const parsedFilter = filter.join(',')
      urlLocation = `${urlLocation}&${filterId}=${parsedFilter}`
    }
    router.push(urlLocation)
  }

  async function handleSelectedFilter(value: string, filterId: string) {
    let updatedFilters = { ...filters }
    if (filterId === 'filterTime') {
      if (filters[filterId].includes(value)) {
        updatedFilters[filterId] = []
      } else {
        updatedFilters[filterId] = [value]
      }
    } else if (filterId === 'supportedBlockchain') {
      const nextValues = filters[filterId].includes(value)
        ? filters[filterId].filter((entry) => entry !== value)
        : [...filters[filterId], value]

      updatedFilters[filterId] = nextValues.length === 0 ? [] : nextValues
    } else {
      updatedFilters = filters[filterId].includes(value)
        ? {
            ...filters,
            [filterId]: filters[filterId].filter((e) => e !== value)
          }
        : { ...filters, [filterId]: [...filters[filterId], value] }
    }

    setFilters(updatedFilters)
    await applyFilter(updatedFilters[filterId], filterId)
  }

  async function clearFilters(addFiltersToUrl: boolean) {
    const clearedFilters = { ...filters }
    Object.keys(clearedFilters).forEach((key) => (clearedFilters[key] = []))
    setFilters(clearedFilters)

    if (ignorePurgatory !== undefined && setIgnorePurgatory !== undefined)
      setIgnorePurgatory(true)

    if (!addFiltersToUrl) return
    const urlLocation = await addExistingParamsToUrl(location, [
      ...Object.keys(clearedFilters),
      'page'
    ])
    router.push(urlLocation)
  }

  const filterList: FilterStructure[] = [
    {
      id: 'serviceType',
      label: i18n._('Service Type'),
      type: 'filterList',
      options: [
        { label: i18n._('Datasets'), value: FilterByTypeOptions.Data },
        { label: i18n._('Algorithms'), value: FilterByTypeOptions.Algorithm },
        { label: i18n._('SaaS'), value: FilterByTypeOptions.Saas }
      ]
    },
    {
      id: 'accessType',
      label: i18n._('Access Type'),
      type: 'filterList',
      options: [
        { label: i18n._('Download'), value: FilterByAccessOptions.Download },
        { label: i18n._('Compute'), value: FilterByAccessOptions.Compute }
      ]
    },
    ...(showPrice
      ? [
          {
            id: 'priceType',
            label: i18n._('Price'),
            type: 'filterList',
            options: [
              { label: i18n._('Free'), value: FilterByPriceOptions.Free },
              { label: i18n._('Paid'), value: FilterByPriceOptions.Paid }
            ]
          }
        ]
      : []),
    {
      id: 'assetState',
      label: i18n._('Asset State'),
      type: 'filterList',
      options: [
        { label: i18n._('Active'), value: State.Active },
        // { label: 'EndOfLife', value: State.EndOfLife },
        // { label: 'Deprecated', value: State.Deprecated },
        // { label: 'RevokedByPublisher', value: State.RevokedByPublisher },
        {
          label: i18n._('TemporaryDisabled'),
          value: State.OrderingIsTemporaryDisabled
        },
        { label: i18n._('Unlisted'), value: State.Unlisted }
      ]
    },
    ...(connectorSupportedChains.length > 1
      ? [
          {
            id: 'supportedBlockchain',
            label: i18n._('Blockchain'),
            type: 'filterList',
            options: connectorSupportedChains.map((chainId: number) => {
              const network = getNetworkDataById(networkdata, chainId)

              return {
                label: getNetworkDisplayName(network),
                value: String(chainId)
              }
            })
          }
        ]
      : []),
    ...(showTime
      ? [
          {
            id: 'filterTime',
            label: i18n._('Time'),
            type: 'filterList',
            options: [
              {
                label: i18n._('last 3 months'),
                value: FilterByTimeOptions.Last3Months
              },
              {
                label: i18n._('last 6 months'),
                value: FilterByTimeOptions.Last6Months
              },
              {
                label: i18n._('last year'),
                value: FilterByTimeOptions.LastYear
              }
            ]
          }
        ]
      : []),
    ...(Array.isArray(nodeUriIndex) && nodeUriIndex.length > 1
      ? [
          {
            id: 'nodeUriIndex',
            label: i18n._('Provider URL'),
            type: 'filterList',
            options: nodeUriIndex.map((nodeUri: string) => ({
              label: formatProviderLabel(nodeUri),
              value: nodeUri,
              title: nodeUri
            }))
          }
        ]
      : []),
    ...(Array.isArray(customFilters?.filters) &&
    customFilters?.filters?.length > 0 &&
    customFilters?.filters.some((filter) => filter !== undefined)
      ? // eslint-disable-next-line no-unsafe-optional-chaining
        customFilters?.filters
      : [])
  ]

  const styleClasses = cx({
    filterList: true,
    [className]: className
  })

  const selectedFiltersCount = Object.values(filters).reduce(
    (acc, filter) => acc + filter.length,
    showPurgatoryOption && ignorePurgatory ? 1 : 0
  )

  return (
    <>
      <div className={styles.sidePositioning}>
        <Accordion
          title={i18n._('Filters')}
          defaultExpanded={expanded}
          badgeNumber={selectedFiltersCount}
          action={
            selectedFiltersCount > 0 && (
              <Button
                size="small"
                style="text"
                onClick={async () => {
                  clearFilters(addFiltersToUrl)
                }}
              >
                <Trans id="Clear filters" />{' '}
              </Button>
            )
          }
        >
          <div className={styleClasses}>
            {filterList.map((filter) => (
              <div key={filter.id} className={styles.filterType}>
                <h5 className={styles.filterTypeLabel}>{filter.label}</h5>
                {filter.options.map((option) => {
                  const isSelected = filters[filter.id].includes(option.value)
                  return (
                    <Input
                      key={option.value}
                      name={option.label}
                      type="checkbox"
                      options={[option.label]}
                      optionTitles={[option.title || option.label]}
                      checked={isSelected}
                      onChange={async () => {
                        handleSelectedFilter(option.value, filter.id)
                      }}
                    />
                  )
                })}
              </div>
            ))}
            {showPurgatoryOption && (
              <div className={styles.filterType}>
                <h5 className={styles.filterTypeLabel}>
                  <Trans id="Purgatory" />
                </h5>
                <Input
                  name={purgatoryFilterItem.value}
                  type="checkbox"
                  options={[purgatoryFilterItem.display]}
                  checked={ignorePurgatory}
                  onChange={async () => {
                    setIgnorePurgatory(!ignorePurgatory)
                  }}
                />
              </div>
            )}
          </div>
        </Accordion>
      </div>
      <div className={styles.topPositioning}>
        {filterList.map((filter) => (
          <div key={filter.id} className={styles.compactFilterContainer}>
            <Accordion
              title={filter.label}
              badgeNumber={filters[filter.id].length}
              compact
            >
              <div className={styles.compactOptionsContainer}>
                {filter.options.map((option) => {
                  const isSelected = filters[filter.id].includes(option.value)
                  return (
                    <Input
                      key={option.value}
                      name={option.label}
                      type="checkbox"
                      options={[option.label]}
                      optionTitles={[option.title || option.label]}
                      checked={isSelected}
                      onChange={async () => {
                        handleSelectedFilter(option.value, filter.id)
                      }}
                    />
                  )
                })}
              </div>
            </Accordion>
          </div>
        ))}

        {showPurgatoryOption && (
          <div className={styles.compactFilterContainer}>
            <Accordion
              title={i18n._('Purgatory')}
              badgeNumber={ignorePurgatory ? 1 : 0}
              compact
            >
              <Input
                name={purgatoryFilterItem.value}
                type="checkbox"
                options={[purgatoryFilterItem.display]}
                checked={ignorePurgatory}
                onChange={async () => {
                  setIgnorePurgatory(!ignorePurgatory)
                }}
              />
            </Accordion>
          </div>
        )}
      </div>
    </>
  )
}
