'use client'
import { Trans, useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'

import {
  type RefObject,
  ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useFormikContext } from 'formik'
import { truncateDid } from '@utils/string'
import { formatServiceTimeout } from '@utils/ddo'
import Link from 'next/link'
import External from '@images/external.svg'
import styles from './index.module.css'
import StepTitle from '@shared/StepTitle'
import { ComputeFlow, FormComputeData } from '../_types'

type RawPreviewService = {
  id?: string
  serviceId?: string
  name?: string
  serviceName?: string
  description?: string
  serviceDescription?: string
  serviceDuration?: string | number
  duration?: string | number
  tokenSymbol?: string
  symbol?: string
  checked?: boolean
  userParameters?: unknown[]
}

type RawPreviewItem = {
  did?: string
  id?: string
  name?: string
  description?: string
  services?: RawPreviewService[]
}

type PreviewService = {
  id: string
  name: string
  description?: string
  duration: number
  tokenSymbol?: string
  userParameters?: unknown[]
}

type PreviewItem = {
  id: string
  name: string
  description?: string
  services: PreviewService[]
}

interface PreviewSelectionStepProps {
  flow: ComputeFlow
}

function DidLinkPill({ value }: { value: string }): ReactElement {
  useLingui()

  return (
    <Link
      href={`/asset/${value}`}
      target="_blank"
      rel="noreferrer"
      className={styles.selectionDidButton}
      title={value}
    >
      <span className={styles.selectionDid}>{truncateDid(value)}</span>
      <span className={styles.selectionDidStatus} aria-hidden="true">
        <External className={styles.selectionDidIcon} />
      </span>
    </Link>
  )
}

function normalizeDescription(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function useClampedOverflow<T extends HTMLElement>(
  ref: RefObject<T>,
  enabled: boolean,
  text: string
): boolean {
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setIsOverflowing(false)
      return
    }

    const element = ref.current
    if (!element) return

    const updateOverflow = () => {
      if (!ref.current) return
      setIsOverflowing(ref.current.scrollHeight > ref.current.clientHeight + 1)
    }

    updateOverflow()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateOverflow)
      observer.observe(element)
      return () => observer.disconnect()
    }

    window.addEventListener('resize', updateOverflow)
    return () => window.removeEventListener('resize', updateOverflow)
  }, [enabled, ref, text])

  return isOverflowing
}

function ExpandableText({
  text,
  className
}: {
  text: string
  className: string
}): ReactElement {
  useLingui()

  const [expanded, setExpanded] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)
  const isExpandable = useClampedOverflow(textRef, !expanded, text)

  return (
    <div className={styles.expandableText}>
      <p
        ref={textRef}
        className={`${className} ${
          expanded ? styles.expandedText : styles.collapsedText
        }`}
      >
        {text}
      </p>
      {(isExpandable || expanded) && (
        <button
          type="button"
          className={styles.descriptionToggle}
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? i18n._('Show less') : i18n._('Show more')}
        </button>
      )}
    </div>
  )
}

function SelectionCard({
  title,
  description,
  id,
  services
}: {
  title: string
  description?: string
  id: string
  services: PreviewService[]
}): ReactElement {
  useLingui()

  return (
    <article className={styles.selectionCard}>
      <div className={styles.selectionHeader}>
        <div className={styles.selectionHeading}>
          <h2 className={styles.selectionTitle}>{title}</h2>
          {description && (
            <ExpandableText
              text={description}
              className={styles.selectionDescription}
            />
          )}
        </div>

        <DidLinkPill value={id} />
      </div>

      <div className={styles.servicesSection}>
        <span className={styles.servicesSectionLabel}>
          {services.length > 1
            ? i18n._('Selected services')
            : i18n._('Selected service')}
        </span>
        <div className={styles.servicesList}>
          {services.map((service) => (
            <div key={service.id} className={styles.serviceRow}>
              <div className={styles.serviceContent}>
                <h3 className={styles.serviceName}>{service.name}</h3>
                {service.description && (
                  <ExpandableText
                    text={service.description}
                    className={styles.serviceDescription}
                  />
                )}
              </div>

              <div className={styles.serviceMeta}>
                {service.tokenSymbol && (
                  <span className={styles.metaPill}>
                    <Trans id="Currency:" /> {service.tokenSymbol}
                  </span>
                )}
                <span className={styles.metaPill}>
                  <Trans id="Access:" />{' '}
                  {formatServiceTimeout(service.duration)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

function normalizePreviewService(service: RawPreviewService): PreviewService {
  return {
    id: service.serviceId ?? service.id ?? '',
    name: service.serviceName ?? service.name ?? i18n._('Unnamed Service'),
    description: normalizeDescription(
      service.description ?? service.serviceDescription
    ),
    duration: Number(service.serviceDuration ?? service.duration ?? 0),
    tokenSymbol: service.tokenSymbol ?? service.symbol ?? '',
    userParameters: service.userParameters
  }
}

function buildAlgorithmPreview(
  algorithm: FormComputeData['algorithms']
): PreviewItem | null {
  if (!algorithm) return null

  const selectedService =
    algorithm.services?.find((service) => service.checked) ||
    algorithm.services?.[0]

  if (!selectedService) return null

  return {
    id: algorithm.id,
    name: algorithm.name,
    description: normalizeDescription(algorithm.description),
    services: [normalizePreviewService(selectedService)]
  }
}

function buildDatasetPreview(
  datasets: FormComputeData['datasets']
): PreviewItem[] {
  if (!datasets) return []

  return (datasets as RawPreviewItem[])
    .map((dataset) => {
      const services = dataset.services ?? []
      const hasExplicitSelection = services.some((service) => service.checked)
      const selectedServices = hasExplicitSelection
        ? services.filter((service) => service.checked)
        : services.length > 0
        ? [services[0]]
        : []

      if (!selectedServices.length) return null

      return {
        id: dataset.did || dataset.id || '',
        name: dataset.name || i18n._('Unnamed Dataset'),
        description: normalizeDescription(dataset.description),
        services: selectedServices.map((service) =>
          normalizePreviewService(service)
        )
      }
    })
    .filter(Boolean) as PreviewItem[]
}

export default function PreviewSelectionStep({
  flow
}: PreviewSelectionStepProps): ReactElement {
  useLingui()

  const isDatasetFlow = flow === 'dataset'
  const { values, setFieldValue } = useFormikContext<FormComputeData>()

  const algoPreview = useMemo(
    () => (isDatasetFlow ? buildAlgorithmPreview(values.algorithms) : null),
    [isDatasetFlow, values.algorithms]
  )

  const datasetPreview = useMemo(
    () => (isDatasetFlow ? [] : buildDatasetPreview(values.datasets)),
    [isDatasetFlow, values.datasets]
  )

  useEffect(() => {
    if (isDatasetFlow) {
      const selectedAlgoService = values.algorithms?.services?.find(
        (s) => s.checked
      )
      const hasUserParams =
        !!(
          selectedAlgoService?.userParameters &&
          selectedAlgoService.userParameters.length > 0
        ) ||
        !!(
          values.datasetServiceParams && values.datasetServiceParams.length > 0
        )
      if (values.isUserParameters !== hasUserParams) {
        setFieldValue('isUserParameters', hasUserParams)
      }
      return
    }

    const pairs = datasetPreview.flatMap((d) =>
      d.services.map((s) => `${d.id}|${s.id}`)
    )
    const anyUserParams = datasetPreview.some((d) =>
      d.services.some((s) => s.userParameters && s.userParameters.length > 0)
    )
    const hasAlgoParams =
      Array.isArray(values.algorithmServiceParams) &&
      values.algorithmServiceParams.length > 0
    const shouldSetUserParams = hasAlgoParams || anyUserParams

    if (values.isUserParameters !== shouldSetUserParams) {
      setFieldValue('isUserParameters', shouldSetUserParams)
    }
    if (JSON.stringify(values.dataset) !== JSON.stringify(pairs)) {
      setFieldValue('dataset', pairs)
    }
  }, [
    isDatasetFlow,
    values.algorithms,
    values.datasetServiceParams,
    values.algorithmServiceParams,
    values.isUserParameters,
    values.dataset,
    datasetPreview,
    setFieldValue
  ])

  if (isDatasetFlow) {
    if (!algoPreview) {
      return (
        <div className={styles.container}>
          <StepTitle title={i18n._('Preview Algorithm & Service')} />
          <p>
            <Trans id="Please select an algorithm first" />
          </p>
        </div>
      )
    }

    return (
      <div className={styles.container}>
        <StepTitle title={i18n._('Preview Algorithm & Service')} />
        <div className={styles.previewContainer}>
          <SelectionCard
            title={algoPreview.name}
            description={algoPreview.description}
            id={algoPreview.id}
            services={algoPreview.services}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <StepTitle title={i18n._('Preview Selected Datasets & Services')} />
      <div className={styles.previewContainer}>
        {datasetPreview.map((dataset) => (
          <SelectionCard
            key={dataset.id}
            title={dataset.name}
            description={dataset.description}
            id={dataset.id}
            services={dataset.services}
          />
        ))}
        {datasetPreview.length === 0 && (
          <p className={styles.noSelection}>
            <Trans id="No services selected." />
          </p>
        )}
      </div>
    </div>
  )
}
