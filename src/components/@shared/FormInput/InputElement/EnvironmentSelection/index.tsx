import { Trans, useLingui } from '@lingui/react'
import { i18n } from '../../../../../i18n/index'
import { ChangeEvent, useState, useMemo } from 'react'
import { ComputeEnvironment } from '@oceanprotocol/lib'
import Loader from '@shared/atoms/Loader'
import { truncateDid } from '@utils/string'
import styles from './index.module.css'
import SearchSection from '@shared/SearchSection'
import StatusTag from '../../../atoms/StatusTag'
import Button from '../../../atoms/Button'
import ProviderOwnerInfoModal from '@shared/ProviderOwnerInfoModal'

export interface EnvironmentSelectionEnvironment extends ComputeEnvironment {
  checked?: boolean
}

function Empty({ message }: { message: string }) {
  useLingui()

  return <div className={styles.empty}>{message}</div>
}
const hasGPUResource = (env: ComputeEnvironment): boolean => {
  if (
    env.resources?.some(
      (resource) =>
        resource.type === 'gpu' ||
        resource.id?.toLowerCase().includes('gpu') ||
        resource.description?.toLowerCase().includes('gpu')
    )
  ) {
    return true
  }

  if (
    env.free?.resources?.some(
      (resource) =>
        resource.type === 'gpu' ||
        resource.id?.toLowerCase().includes('gpu') ||
        resource.description?.toLowerCase().includes('gpu')
    )
  ) {
    return true
  }

  if (env.fees) {
    for (const chainId in env.fees) {
      const feeConfigs = env.fees[chainId]
      for (const feeConfig of feeConfigs) {
        if (
          feeConfig.prices?.some((price) =>
            price.id?.toLowerCase().includes('gpu')
          )
        ) {
          return true
        }
      }
    }
  }

  return false
}

const getGPUDescription = (env: ComputeEnvironment): string | undefined => {
  const gpuResource = env.resources?.find(
    (r) => r.type === 'gpu' || r.id?.toLowerCase().includes('gpu')
  )
  if (gpuResource?.description) {
    return gpuResource.description
  }

  const freeGpuResource = env.free?.resources?.find(
    (r) => r.type === 'gpu' || r.id?.toLowerCase().includes('gpu')
  )
  if (freeGpuResource?.description) {
    return freeGpuResource.description
  }

  return undefined
}

export default function EnvironmentSelection({
  environments,
  selected,
  nodeUrl,
  disabled,
  onChange
}: {
  environments: EnvironmentSelectionEnvironment[]
  selected?: string
  nodeUrl?: string
  disabled?: boolean
  onChange?:
    | ((value: string) => void)
    | ((e: ChangeEvent<HTMLInputElement>) => void)
}): JSX.Element {
  useLingui()

  const [searchValue, setSearchValue] = useState('')
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false)

  const filteredEnvironments = useMemo(() => {
    const realEnvs =
      environments && Array.isArray(environments) ? environments : []
    const allEnvironments = [...realEnvs]

    if (!allEnvironments || allEnvironments.length === 0) {
      return []
    }

    return allEnvironments.filter((env) =>
      searchValue !== ''
        ? env.id.toLowerCase().includes(searchValue.toLowerCase()) ||
          (env.description &&
            env.description.toLowerCase().includes(searchValue.toLowerCase()))
        : true
    )
  }, [environments, searchValue])

  const handleEnvironmentSelect = (envId: string) => {
    if (onChange) {
      if (typeof onChange === 'function') {
        const firstParam = onChange.toString().includes('target')
          ? ({ target: { value: envId } } as ChangeEvent<HTMLInputElement>)
          : envId
        onChange(firstParam as any)
      }
    }
  }

  const handleOpenInfo = () => {
    setIsInfoModalOpen(true)
  }

  return (
    <div className={styles.root}>
      <SearchSection
        placeholder={i18n._('Search for C2D Environments')}
        value={searchValue}
        onChange={setSearchValue}
        disabled={disabled}
      />
      <div className={styles.scroll}>
        {!filteredEnvironments ? (
          <Loader />
        ) : filteredEnvironments && !filteredEnvironments.length ? (
          <Empty message="No environments found." />
        ) : (
          <>
            {filteredEnvironments.map(
              (env: EnvironmentSelectionEnvironment, index: number) => {
                const isSelected = selected === env.id
                const freeAvailable = !!env.free
                const hasPaid = env.fees && Object.keys(env.fees).length > 0
                const gpuAvailable = hasGPUResource(env)
                const gpuDescription = getGPUDescription(env)

                return (
                  <div
                    key={env.id}
                    className={`${styles.environmentCard} ${
                      isSelected ? styles.selected : ''
                    }`}
                    onClick={() => !disabled && handleEnvironmentSelect(env.id)}
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.titleSection}>
                        <div className={styles.titleRow}>
                          <h3 className={styles.title}>
                            <Trans
                              id="Environment {number}"
                              values={{ number: index + 1 }}
                            />
                          </h3>
                          <Button
                            style="outlined"
                            size="small"
                            className={styles.infoButton}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenInfo()
                            }}
                          >
                            <Trans id="Info" />{' '}
                          </Button>
                        </div>
                        <div className={styles.envId}>
                          {truncateDid(env.id)}
                        </div>
                      </div>
                      <div className={styles.statusTags}>
                        {freeAvailable && (
                          <StatusTag type="free">
                            <Trans id="Free" />
                          </StatusTag>
                        )}
                        {hasPaid && (
                          <StatusTag type="paid">
                            <Trans id="Paid" />
                          </StatusTag>
                        )}
                        {gpuAvailable && (
                          <StatusTag
                            type="gpu"
                            tooltip={
                              gpuDescription ||
                              i18n._('GPU accelerated environment')
                            }
                          >
                            <Trans id="GPU" />{' '}
                          </StatusTag>
                        )}
                      </div>
                    </div>

                    <div className={styles.cardContent}>
                      <p className={styles.description}>
                        {env.description ||
                          i18n._(
                            'Workspace configured for testing and running C2D processes.'
                          )}
                      </p>

                      <div className={styles.cardActions}>
                        {isSelected ? (
                          <Button
                            style="slim"
                            className={styles.selectedButton}
                          >
                            <Trans id="Selected" />{' '}
                          </Button>
                        ) : (
                          <Button style="slim">
                            <Trans id="Select" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              }
            )}
          </>
        )}
      </div>

      <ProviderOwnerInfoModal
        title={i18n._('Node Owner Info')}
        isOpen={isInfoModalOpen}
        providerUrl={nodeUrl}
        overlayClassName={styles.infoModalOverlay}
        className={styles.infoModalContent}
        onClose={() => setIsInfoModalOpen(false)}
      />
    </div>
  )
}
