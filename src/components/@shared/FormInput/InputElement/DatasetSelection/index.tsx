import { useLingui } from '@lingui/react'
import { i18n } from '../../../../../i18n/index'
import { useEffect, useState } from 'react'
import Loader from '@shared/atoms/Loader'
import { truncateDid } from '@utils/string'
import styles from './index.module.css'
import SearchSection from '@shared/SearchSection'
import Button from '../../../atoms/Button'
import NetworkName from '@shared/NetworkName'
import External from '@images/external.svg'
import { AssetSelectionAsset } from '@shared/FormInput/InputElement/AssetSelection'
import { AssetExtended } from 'src/@types/AssetExtended'
import Link from 'next/link'
import Tooltip from '@shared/atoms/Tooltip'
import InfoIcon from '@images/info.svg'
import { LanguageValueObject } from 'src/@types/ddo/LanguageValueObject'

interface DatasetSelectionDataset
  extends Omit<AssetSelectionAsset, 'description' | 'serviceDescription'> {
  description?: string | LanguageValueObject
  serviceDescription?: string | LanguageValueObject
  checked: boolean
  value?: string
}

function descriptionValue(value: unknown): string | undefined {
  const text =
    typeof value === 'string'
      ? value
      : value && typeof value === 'object' && '@value' in value
      ? value['@value']
      : undefined
  return typeof text === 'string' && text.trim() ? text.trim() : undefined
}

function Empty({ message }: { message: string }) {
  useLingui()

  return <div className={styles.empty}>{message}</div>
}

export default function DatasetSelection({
  asset,
  networkId,
  datasets,
  selected = [],
  disabled,
  onChange,
  searchValue: externalSearch,
  onSearchChange,
  onSearch,
  loading = false,
  assetType = 'dataset'
}: {
  asset?: AssetExtended
  networkId?: number
  datasets?: DatasetSelectionDataset[]
  selected?: string[]
  disabled?: boolean
  onChange?: (value: string) => void
  searchValue?: string
  onSearchChange?: (value: string) => void
  onSearch?: () => void
  loading?: boolean
  assetType?: 'dataset' | 'algorithm'
}): JSX.Element {
  useLingui()

  const [localSearch, setSearchValue] = useState('')
  const searchValue = externalSearch ?? localSearch
  const [filteredDatasets, setfilteredDatasets] = useState<
    DatasetSelectionDataset[]
  >([])

  useEffect(() => {
    const realDatasets = datasets && Array.isArray(datasets) ? datasets : []
    const result = realDatasets.filter((dataset) => {
      const searchLower = searchValue.toLowerCase()
      return externalSearch === undefined && searchValue !== ''
        ? dataset.did.toLowerCase().includes(searchLower) ||
            dataset.name.toLowerCase().includes(searchLower) ||
            dataset.serviceName?.toLowerCase().includes(searchLower)
        : true
    })

    setfilteredDatasets(result)
  }, [datasets, searchValue, externalSearch])

  const handleDatasetSelect = (envId: string) => {
    if (typeof onChange === 'function') {
      onChange(envId)
    }
  }

  return (
    <div className={styles.root}>
      <SearchSection
        placeholder={
          assetType === 'algorithm'
            ? i18n._('Search algorithms by name')
            : i18n._('Search datasets by name')
        }
        label={
          assetType === 'algorithm'
            ? i18n._('Search algorithms')
            : i18n._('Search datasets')
        }
        onSearch={onSearch}
        value={searchValue}
        onChange={onSearchChange || setSearchValue}
        disabled={disabled}
      />
      <div className={styles.scroll}>
        {loading ? (
          <Loader
            message={
              assetType === 'algorithm'
                ? i18n._('Loading algorithms…')
                : i18n._('Loading datasets…')
            }
          />
        ) : filteredDatasets.length === 0 ? (
          <Empty
            message={
              assetType === 'algorithm'
                ? i18n._('No algorithms found. Try another search.')
                : i18n._('No datasets found. Try another search.')
            }
          />
        ) : (
          <>
            {filteredDatasets.map((dataset) => {
              const selectionValue = dataset.value || dataset.did
              const isSelected = selected.includes(selectionValue)
              const descriptionText =
                descriptionValue(dataset.description) ||
                descriptionValue(dataset.serviceDescription) ||
                i18n._('No description available.')
              return (
                <div
                  key={selectionValue}
                  className={`${styles.datasetCard} ${
                    isSelected ? styles.selected : ''
                  } ${dataset.selectionDisabled ? styles.itemDisabled : ''}`}
                  onClick={() =>
                    !disabled &&
                    !dataset.selectionDisabled &&
                    handleDatasetSelect(selectionValue)
                  }
                >
                  <div className={styles.cardHeader}>
                    <div className={styles.titleSection}>
                      <h3 className={styles.title}>{dataset.name}</h3>
                      {dataset.serviceName && (
                        <span className={styles.serviceName}>
                          {dataset.serviceName}
                        </span>
                      )}
                      <div className={styles.envId}>
                        {truncateDid(dataset.did)}
                        {dataset.did && (
                          <Link
                            href={`/asset/${encodeURIComponent(dataset.did)}`}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.externalLink}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <External />
                          </Link>
                        )}
                      </div>
                      {dataset.tokenSymbol && (
                        <div className={styles.tokenSymbol}>
                          {dataset.tokenSymbol}
                        </div>
                      )}
                    </div>
                    {(networkId || asset?.credentialSubject?.chainId) && (
                      <NetworkName
                        networkId={
                          networkId || asset?.credentialSubject?.chainId
                        }
                        className={styles.network}
                      />
                    )}
                  </div>
                  <div className={styles.cardContent}>
                    <p className={styles.description}>
                      {descriptionText.slice(0, 160)}
                      {descriptionText.length > 160 ? '...' : ''}
                    </p>

                    <div className={styles.cardActions}>
                      {dataset.selectionDisabledReason && (
                        <Tooltip
                          content={dataset.selectionDisabledReason}
                          placement="top"
                        >
                          <button
                            type="button"
                            className={styles.updateInfoButton}
                            aria-label={
                              assetType === 'algorithm'
                                ? i18n._('Why is this algorithm unavailable?')
                                : i18n._('Why is this dataset unavailable?')
                            }
                            onClick={(event) => event.stopPropagation()}
                          >
                            <InfoIcon className={styles.updateInfoIcon} />
                          </button>
                        </Tooltip>
                      )}
                      <Button
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={
                          isSelected
                            ? i18n._('Selected {name}, {service}', {
                                name: dataset.name,
                                service:
                                  dataset.serviceName || dataset.serviceId
                              })
                            : i18n._('Select {name}, {service}', {
                                name: dataset.name,
                                service:
                                  dataset.serviceName || dataset.serviceId
                              })
                        }
                        style="slim"
                        disabled={disabled || dataset.selectionDisabled}
                        onClick={(event) => {
                          event.stopPropagation()
                          if (!dataset.selectionDisabled) {
                            onChange?.(selectionValue)
                          }
                        }}
                      >
                        {dataset.selectionDisabled
                          ? i18n._('Update required')
                          : isSelected
                          ? i18n._('Selected')
                          : i18n._('Select')}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
