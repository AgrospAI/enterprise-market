import { translate } from '../../../i18n/translate'
import { Trans, useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import {
  ReactElement,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef
} from 'react'
import { Field, useFormikContext } from 'formik'
import { ComputeEnvironment, Datatoken } from '@oceanprotocol/lib'
import { ResourceType } from 'src/@types/ResourceType'
import { useChainId } from 'wagmi'
import StepTitle from '@shared/StepTitle'
import Input from '@components/@shared/FormInput'
import Tooltip from '@shared/atoms/Tooltip'
import { FormComputeData, QueueWaitTimeUnit } from '../_types'
import { useProfile } from '@context/Profile'
import styles from './index.module.css'
import { useEthersSigner } from '@hooks/useEthersSigner'
import Decimal from 'decimal.js'
import { MAX_DECIMALS } from '@utils/constants'
import { truncateDid } from '@utils/string'
import { LAST_TRACKED_COMPLETION_STEP } from '../_steps'
import {
  getComputeResourceLimits,
  getDefaultComputeResourceValue
} from '../computeEnvironmentDefaults'
import OutputStorageSection from './OutputStorageSection'

interface ResourceValues {
  cpu: number
  ram: number
  disk: number
  gpu: number
  jobDuration: number
}

function hasStoredResourceValue(
  value: number | undefined | null
): value is number {
  return typeof value === 'number'
}

type ComputeEnvResource = NonNullable<ComputeEnvironment['resources']>[number]
type ComputeEnvFee = NonNullable<ComputeEnvironment['fees']>[string][number]
type ComputeEnvPrice = ComputeEnvFee['prices'][number]
type ResourceValueKey = keyof ResourceValues
type ResourceValueMap = Record<string, ResourceType>

interface ResourceRowProps {
  resourceId: string
  label: string
  unit: string
  isFree: boolean
  isActive: boolean
  freeValues: ResourceValues
  paidValues: ResourceValues
  getLimits: (
    id: string,
    isFree: boolean
  ) => { minValue: number; maxValue: number; step?: number }
  updateResource: (
    type: ResourceValueKey,
    value: number | string,
    isFree: boolean
  ) => void
  fee?: ComputeEnvFee
  tooltip?: string
}

function SectionRadioOption({
  id,
  checked,
  label,
  onChange
}: {
  id: string
  checked: boolean
  label: string
  onChange: () => void
}): ReactElement {
  useLingui()

  return (
    <div className={styles.sectionHeader}>
      <input
        type="radio"
        id={id}
        checked={checked}
        onChange={onChange}
        className={styles.radioButton}
      />
      <label htmlFor={id} className={styles.sectionTitle}>
        {label}
      </label>
    </div>
  )
}

function QueueWaitSection({
  enabled,
  queueMaxWaitTime,
  queueMaxWaitTimeUnit,
  error,
  onToggle,
  onChange,
  onUnitChange
}: {
  enabled: boolean
  queueMaxWaitTime: number | null | undefined
  queueMaxWaitTimeUnit: QueueWaitTimeUnit
  error?: string
  onToggle: (checked: boolean) => void
  onChange: (value: string) => void
  onUnitChange: (value: QueueWaitTimeUnit) => void
}): ReactElement {
  useLingui()

  return (
    <div className={styles.queueSection}>
      <div className={styles.queueToggleRow}>
        <label
          htmlFor="queue-waiting-enabled"
          className={styles.queueToggleLabel}
        >
          <input
            id="queue-waiting-enabled"
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className={styles.queueCheckbox}
          />
          <span>
            <Trans id="Allow job to be queued" />
          </span>
        </label>
        <Tooltip
          placement="top"
          content={
            <div className={styles.queueTooltipContent}>
              <Trans id="If not enough compute resources are currently available, the job will wait in queue until resources become available." />{' '}
            </div>
          }
        />
      </div>

      {enabled && (
        <div className={styles.queueSettings}>
          <label
            htmlFor="queue-max-wait-time"
            className={styles.queueInputLabel}
          >
            <Trans id="Maximum waiting time in queue" />{' '}
          </label>
          <div className={styles.queueInputRow}>
            <input
              id="queue-max-wait-time"
              type="number"
              min={1}
              step={1}
              value={queueMaxWaitTime ?? ''}
              onChange={(e) => onChange(e.target.value)}
              className={`${styles.input} ${styles.inputSmall} ${
                error ? styles.inputError : ''
              }`}
              aria-invalid={Boolean(error)}
              aria-describedby={
                error ? 'queue-max-wait-time-error' : 'queue-max-wait-time-help'
              }
            />
            <select
              value={queueMaxWaitTimeUnit}
              onChange={(e) =>
                onUnitChange(e.target.value as QueueWaitTimeUnit)
              }
              className={`${styles.input} ${styles.inputSmall} ${styles.queueUnitSelect}`}
              aria-label={i18n._('Maximum waiting time unit')}
            >
              <option value="seconds">
                <Trans id="Seconds" />
              </option>
              <option value="minutes">
                <Trans id="Minutes" />
              </option>
              <option value="hours">
                <Trans id="Hours" />
              </option>
            </select>
          </div>
          <p id="queue-max-wait-time-help" className={styles.queueInputHint}>
            <Trans
              id="Enter at least {duration}."
              values={{
                duration: i18n.number(1, {
                  style: 'unit',
                  unit: queueMaxWaitTimeUnit.slice(0, -1),
                  unitDisplay: 'long'
                })
              }}
            />
          </p>
          {error && (
            <p id="queue-max-wait-time-error" className={styles.queueError}>
              {translate(error)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

const isGpuResourceId = (resourceId?: string): boolean =>
  resourceId?.toLowerCase().includes('gpu') === true

const isGpuResource = (resource?: ComputeEnvResource): boolean =>
  resource?.type === 'gpu' || isGpuResourceId(resource?.id)

const isGpuPrice = (price?: ComputeEnvPrice): boolean =>
  isGpuResourceId(price?.id)

const hasGPUResource = (env?: ComputeEnvironment | null): boolean => {
  if (!env) return false

  if (env.resources?.some(isGpuResource)) {
    return true
  }

  if (env.free?.resources?.some(isGpuResource)) {
    return true
  }

  if (env.fees) {
    for (const chainId in env.fees) {
      const feeConfigs = env.fees[chainId]
      for (const feeConfig of feeConfigs) {
        if (feeConfig.prices?.some(isGpuPrice)) {
          return true
        }
      }
    }
  }

  return false
}

function ResourceRow({
  resourceId,
  label,
  unit,
  isFree,
  isActive,
  freeValues,
  paidValues,
  getLimits,
  updateResource,
  fee,
  tooltip
}: ResourceRowProps): ReactElement {
  useLingui()

  const { minValue, maxValue, step = 1 } = getLimits(resourceId, isFree)
  const currentValue = isFree
    ? freeValues[resourceId as keyof ResourceValues]
    : paidValues[resourceId as keyof ResourceValues]
  const [inputValue, setInputValue] = useState<string | number>(currentValue)
  const [error, setError] = useState<string | null>(null)
  const [showTooltip, setShowTooltip] = useState(false)
  const labelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setInputValue(currentValue)
    setError(null)
  }, [currentValue])

  const handleBlur = () => {
    if (inputValue === '') {
      setError(
        i18n._(
          'Value cannot be empty. Please enter a number between {minValue} and {maxValue}.',
          { minValue, maxValue }
        )
      )
      setInputValue(currentValue)
      return
    }

    const numValue = Number(inputValue)
    if (isNaN(numValue)) {
      setError(
        i18n._(
          'Please enter a valid number between {minValue} and {maxValue}.',
          { minValue, maxValue }
        )
      )
      setInputValue(currentValue)
      return
    }

    if (numValue < minValue || numValue > maxValue) {
      setError(
        i18n._('Please enter a value between {minValue} and {maxValue}.', {
          minValue,
          maxValue
        })
      )
      setInputValue(currentValue)
      return
    }

    updateResource(
      resourceId as 'cpu' | 'ram' | 'disk' | 'gpu' | 'jobDuration',
      numValue,
      isFree
    )
    setError(null)
  }

  const handleCloseError = () => {
    setError(null)
    setInputValue(currentValue)
  }

  return (
    <div
      key={`${resourceId}-${isFree ? 'free' : 'paid'}`}
      className={`${styles.resourceRow} ${
        !isActive ? styles.resourceRowInactive : ''
      }`}
    >
      <div
        className={styles.labelContainer}
        ref={labelRef}
        onMouseEnter={() => tooltip && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className={styles.labelText}>{label}</span>
        {tooltip && <span className={styles.infoIcon}>ⓘ</span>}
        {showTooltip && tooltip && (
          <div className={styles.resourceTooltip}>
            <div className={styles.resourceTooltipContent}>{tooltip}</div>
            <div className={styles.resourceTooltipArrow} />
          </div>
        )}
      </div>
      <div className={styles.sliderSection}>
        <span className={styles.minLabel}>
          <Trans id="min" />
        </span>
        <div className={styles.sliderContainer}>
          <input
            type="range"
            min={minValue}
            max={maxValue}
            step={step}
            value={currentValue}
            onChange={(e) =>
              updateResource(
                resourceId as 'cpu' | 'ram' | 'disk' | 'gpu' | 'jobDuration',
                Number(e.target.value),
                isFree
              )
            }
            className={styles.customSlider}
            disabled={!isActive}
          />
          <div className={styles.sliderLine}></div>
        </div>
        <span className={styles.maxLabel}>
          <Trans id="max" />
        </span>
      </div>
      <div className={styles.inputSection}>
        <input
          type="number"
          min={minValue}
          max={maxValue}
          step={step}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setError(null)
          }}
          onBlur={handleBlur}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleBlur()
            }
          }}
          className={`${styles.input} ${styles.inputSmall} ${
            error ? styles.inputError : ''
          }`}
          placeholder={i18n._('value...')}
          disabled={!isActive}
        />
        <span className={styles.unit}>{unit}</span>
      </div>
      {error && (
        <div className={styles.errorOverlay}>
          <div className={styles.errorPopup}>
            <span className={styles.errorMessage}>{translate(error)}</span>
            <button className={styles.closeButton} onClick={handleCloseError}>
              <Trans id="&times;" />{' '}
            </button>
          </div>
        </div>
      )}
      {!isFree && resourceId !== 'jobDuration' && (
        <div className={styles.resourcePriceSection}>
          <span className={styles.priceLabel}>
            <Trans id="price per time unit" />
          </span>
          <input
            type="text"
            className={`${styles.input} ${styles.inputSmall}`}
            placeholder={i18n._('value...')}
            readOnly
            disabled={!isActive}
            value={fee?.prices?.find((p) => p.id === resourceId)?.price ?? 0}
          />
        </div>
      )}
    </div>
  )
}

export default function ConfigureEnvironment({
  allResourceValues,
  setAllResourceValues,
  baseTokenAddress,
  setBaseTokenAddress,
  showEnvironmentSummary = false,
  stepMode = 'resources'
}: {
  allResourceValues?: ResourceValueMap
  setAllResourceValues?: React.Dispatch<React.SetStateAction<ResourceValueMap>>
  baseTokenAddress: string
  setBaseTokenAddress: React.Dispatch<React.SetStateAction<string>>
  showEnvironmentSummary?: boolean
  stepMode?: 'resources' | 'storage'
}): ReactElement {
  useLingui()

  const { values, setFieldValue } = useFormikContext<FormComputeData>()
  const chainId = useChainId()
  const { escrowFundsByToken } = useProfile()
  const walletClient = useEthersSigner()
  const [symbolMap, setSymbolMap] = useState<Record<string, string>>({})
  const { queueMaxWaitTime } = values
  const queueMaxWaitTimeUnit = values.queueMaxWaitTimeUnit || 'minutes'
  const queueWaitingEnabled = Boolean(values.queueWaitingEnabled)

  const gpuAvailable = useMemo(
    () => hasGPUResource(values.computeEnv),
    [values.computeEnv]
  )

  const fetchSymbol = useCallback(
    async (address: string) => {
      if (symbolMap[address]) return symbolMap[address]
      if (!walletClient || !chainId) return address

      try {
        const datatoken = new Datatoken(walletClient, chainId)
        const sym = await datatoken.getSymbol(address)
        setSymbolMap((prev) => ({ ...prev, [address]: sym }))
        return sym
      } catch (e) {
        return address
      }
    },
    [walletClient, chainId, symbolMap]
  )

  const supportedTokensFromEnv = useMemo(() => {
    const currentChainId =
      chainId?.toString() || values.user?.chainId?.toString()
    if (!values.computeEnv || !currentChainId) return []
    const fees = values.computeEnv.fees?.[currentChainId] || []
    return fees.map((f) => f.feeToken)
  }, [values.computeEnv, chainId, values.user?.chainId])

  useEffect(() => {
    supportedTokensFromEnv.forEach((tokenAddr) => {
      if (!symbolMap[tokenAddr]) fetchSymbol(tokenAddr)
    })
  }, [supportedTokensFromEnv, fetchSymbol, symbolMap])

  const isTokenListLoading = useMemo(
    () =>
      supportedTokensFromEnv.length > 0 &&
      supportedTokensFromEnv.some((addr) => !symbolMap[addr]),
    [supportedTokensFromEnv, symbolMap]
  )

  const baseTokenOptions = useMemo(
    () =>
      isTokenListLoading
        ? [i18n._('Loading tokens...')]
        : supportedTokensFromEnv.map((addr) => symbolMap[addr] || addr),
    [supportedTokensFromEnv, symbolMap, isTokenListLoading, i18n.locale]
  )

  const displaySymbol = symbolMap[values.baseToken] ?? ''

  const escrowAvailableFunds = useMemo(() => {
    if (!displaySymbol) return 0
    const funds = escrowFundsByToken[displaySymbol]
    if (!funds?.available) return 0
    // Avoid floating rounding up (e.g. 2.9999999999 -> 3)
    return new Decimal(funds.available)
      .toDecimalPlaces(MAX_DECIMALS, Decimal.ROUND_DOWN)
      .toNumber()
  }, [escrowFundsByToken, displaySymbol])

  const escrowAvailableFundsDisplay = useMemo(() => {
    if (!displaySymbol) return '0'
    const funds = escrowFundsByToken[displaySymbol]
    if (!funds?.available) return '0'
    return new Decimal(funds.available)
      .toDecimalPlaces(MAX_DECIMALS, Decimal.ROUND_DOWN)
      .toFixed(3)
  }, [escrowFundsByToken, displaySymbol])

  const [mode, setMode] = useState<'free' | 'paid'>(
    () =>
      (values.mode as 'free' | 'paid') ||
      (values.computeEnv?.free ? 'free' : 'paid')
  )

  useEffect(() => {
    if (!values.computeEnv?.free && mode !== 'paid') {
      setMode('paid')
    }
  }, [mode, values.computeEnv])

  useEffect(() => {
    setFieldValue('mode', mode)
  }, [mode, setFieldValue])

  useEffect(() => {
    if (values.baseToken || supportedTokensFromEnv.length === 0) return
    const defaultToken = supportedTokensFromEnv[0]
    setFieldValue('baseToken', defaultToken)
    setBaseTokenAddress(defaultToken)
  }, [
    supportedTokensFromEnv,
    values.baseToken,
    setFieldValue,
    setBaseTokenAddress
  ])

  useEffect(() => {
    if (!values.baseToken || values.baseToken === baseTokenAddress) return
    setBaseTokenAddress(values.baseToken)
  }, [values.baseToken, baseTokenAddress, setBaseTokenAddress])

  const getEnvResourceValues = useCallback(
    (isFree = true): ResourceValues => {
      const env = values.computeEnv
      if (!env) return { cpu: 0, ram: 0, disk: 0, gpu: 0, jobDuration: 0 }

      const envId = typeof env === 'string' ? env : env.id
      const modeKey = isFree ? 'free' : 'paid'
      const envResourceValues = allResourceValues?.[`${envId}_${modeKey}`]

      return {
        cpu: hasStoredResourceValue(envResourceValues?.cpu)
          ? envResourceValues.cpu
          : getDefaultComputeResourceValue(
              env,
              'cpu',
              isFree,
              queueWaitingEnabled
            ),
        ram: hasStoredResourceValue(envResourceValues?.ram)
          ? envResourceValues.ram
          : getDefaultComputeResourceValue(
              env,
              'ram',
              isFree,
              queueWaitingEnabled
            ),
        disk: hasStoredResourceValue(envResourceValues?.disk)
          ? envResourceValues.disk
          : getDefaultComputeResourceValue(
              env,
              'disk',
              isFree,
              queueWaitingEnabled
            ),
        gpu: hasStoredResourceValue(envResourceValues?.gpu)
          ? envResourceValues.gpu
          : getDefaultComputeResourceValue(
              env,
              'gpu',
              isFree,
              queueWaitingEnabled
            ),
        jobDuration: hasStoredResourceValue(envResourceValues?.jobDuration)
          ? envResourceValues.jobDuration
          : getDefaultComputeResourceValue(
              env,
              'jobDuration',
              isFree,
              queueWaitingEnabled
            )
      }
    },
    [values.computeEnv, allResourceValues, queueWaitingEnabled]
  )

  const [freeValues, setFreeValues] = useState<ResourceValues>(() =>
    getEnvResourceValues(true)
  )
  const [paidValues, setPaidValues] = useState<ResourceValues>(() =>
    getEnvResourceValues(false)
  )

  const isGpuSelected = useMemo(() => {
    const currentValues = mode === 'free' ? freeValues : paidValues
    return currentValues.gpu > 0
  }, [mode, freeValues.gpu, paidValues.gpu])

  const round3 = (v: number) => Math.round((v + Number.EPSILON) * 1000) / 1000
  const roundUp3 = (v: number) =>
    new Decimal(v).toDecimalPlaces(3, Decimal.ROUND_UP).toNumber()

  const getLimits = (id: string, isFree: boolean) => {
    return getComputeResourceLimits(
      values.computeEnv,
      id as ResourceValueKey,
      isFree,
      queueWaitingEnabled
    )
  }

  const calculatePrice = useCallback(() => {
    if (mode === 'free') return 0
    if (!values.computeEnv) return 0

    const env = values.computeEnv
    const currentChainId = chainId?.toString() ?? '11155111'
    const fee =
      env.fees?.[currentChainId]?.find(
        (f) => f.feeToken.toLowerCase() === values.baseToken?.toLowerCase()
      ) || env.fees?.[currentChainId]?.[0]

    if (!fee?.prices) return 0

    let totalPrice = 0
    for (const p of fee.prices) {
      const units =
        p.id === 'cpu'
          ? paidValues.cpu
          : p.id === 'ram'
          ? paidValues.ram
          : p.id === 'disk'
          ? paidValues.disk
          : p.id === 'gpu' || p.id?.toLowerCase().includes('gpu')
          ? paidValues.gpu
          : 0
      totalPrice += units * p.price
    }

    const rawPrice = totalPrice * paidValues.jobDuration
    return Math.round(rawPrice * 100) / 100
  }, [mode, values.computeEnv, chainId, paidValues, values.baseToken])

  const clamp = (val: number, min: number, max: number) =>
    Math.max(min, Math.min(max, val))

  useEffect(() => {
    const currentValues = mode === 'free' ? freeValues : paidValues
    if (!currentValues) return
    setFieldValue('cpu', currentValues.cpu)
    setFieldValue('ram', currentValues.ram)
    setFieldValue('disk', currentValues.disk)
    if (gpuAvailable) {
      setFieldValue('gpu', currentValues.gpu)
    }
    setFieldValue('jobDuration', currentValues.jobDuration)
  }, [
    mode,
    freeValues.cpu,
    freeValues.ram,
    freeValues.disk,
    freeValues.gpu,
    freeValues.jobDuration,
    paidValues.cpu,
    paidValues.ram,
    paidValues.disk,
    paidValues.gpu,
    paidValues.jobDuration,
    setFieldValue,
    gpuAvailable
  ])

  useEffect(() => {
    if (mode === 'paid') {
      const jobPrice = calculatePrice()
      const availableEscrow = escrowAvailableFunds
      const actualPaymentAmount = Math.max(0, jobPrice - availableEscrow)
      setFieldValue('jobPrice', jobPrice)
      setFieldValue('escrowFunds', escrowAvailableFunds)
      setFieldValue('actualPaymentAmount', actualPaymentAmount)
      setFieldValue('escrowCoveredAmount', Math.min(availableEscrow, jobPrice))
    } else {
      setFieldValue('jobPrice', 0)
      setFieldValue('escrowFunds', 0)
      setFieldValue('actualPaymentAmount', 0)
      setFieldValue('escrowCoveredAmount', 0)
    }
  }, [mode, calculatePrice, escrowAvailableFunds, setFieldValue])

  useEffect(() => {
    if (!setAllResourceValues || !values.computeEnv) return

    const env = values.computeEnv
    const envId = typeof env === 'string' ? env : env.id
    const modeKey = mode === 'free' ? 'free' : 'paid'
    const currentValues = mode === 'free' ? freeValues : paidValues

    let currentPrice = 0
    let actualPaymentAmount = 0
    let escrowCoveredAmount = 0

    if (mode === 'paid') {
      const currentChainId = chainId?.toString() ?? '11155111'
      const fee =
        env.fees?.[currentChainId]?.find(
          (f) => f.feeToken.toLowerCase() === values.baseToken?.toLowerCase()
        ) || env.fees?.[currentChainId]?.[0]
      if (fee?.prices) {
        let totalPrice = 0
        for (const p of fee.prices) {
          const units =
            p.id === 'cpu'
              ? currentValues.cpu
              : p.id === 'ram'
              ? currentValues.ram
              : p.id === 'disk'
              ? currentValues.disk
              : p.id === 'gpu' || p.id?.toLowerCase().includes('gpu')
              ? currentValues.gpu
              : 0
          totalPrice += units * p.price
        }
        currentPrice = round3(totalPrice * currentValues.jobDuration)
        const availableEscrow = escrowAvailableFunds
        actualPaymentAmount = roundUp3(
          Math.max(0, currentPrice - availableEscrow)
        )
        escrowCoveredAmount = round3(Math.min(availableEscrow, currentPrice))
      }
    }

    const resourceValues: ResourceType = {
      cpu: currentValues.cpu,
      ram: currentValues.ram,
      disk: currentValues.disk,
      jobDuration: currentValues.jobDuration,
      mode,
      price: actualPaymentAmount.toString(),
      fullJobPrice: currentPrice.toString(),
      actualPaymentAmount: actualPaymentAmount.toString(),
      escrowCoveredAmount: escrowCoveredAmount.toString()
    }

    if (gpuAvailable) {
      resourceValues.gpu = currentValues.gpu
    }

    setAllResourceValues((prev) => ({
      ...prev,
      [`${envId}_${modeKey}`]: resourceValues
    }))
  }, [
    mode,
    values.computeEnv,
    chainId,
    freeValues.cpu,
    freeValues.ram,
    freeValues.disk,
    freeValues.gpu,
    freeValues.jobDuration,
    paidValues.cpu,
    paidValues.ram,
    paidValues.disk,
    paidValues.gpu,
    paidValues.jobDuration,
    setAllResourceValues,
    escrowAvailableFunds,
    values.baseToken,
    gpuAvailable
  ])

  useEffect(() => {
    const env = values.computeEnv
    if (!env) return

    const envId = typeof env === 'string' ? env : env.id
    const freeExistingValues = allResourceValues?.[`${envId}_free`]
    const paidExistingValues = allResourceValues?.[`${envId}_paid`]

    const freeEnvValues = getEnvResourceValues(true)
    const paidEnvValues = getEnvResourceValues(false)

    const freeRaw = {
      cpu: hasStoredResourceValue(freeExistingValues?.cpu)
        ? freeExistingValues.cpu
        : freeEnvValues.cpu,
      ram: hasStoredResourceValue(freeExistingValues?.ram)
        ? freeExistingValues.ram
        : freeEnvValues.ram,
      disk: hasStoredResourceValue(freeExistingValues?.disk)
        ? freeExistingValues.disk
        : freeEnvValues.disk,
      gpu: hasStoredResourceValue(freeExistingValues?.gpu)
        ? freeExistingValues.gpu
        : freeEnvValues.gpu,
      jobDuration: hasStoredResourceValue(freeExistingValues?.jobDuration)
        ? freeExistingValues.jobDuration
        : freeEnvValues.jobDuration
    }

    const paidRaw = {
      cpu: hasStoredResourceValue(paidExistingValues?.cpu)
        ? paidExistingValues.cpu
        : paidEnvValues.cpu,
      ram: hasStoredResourceValue(paidExistingValues?.ram)
        ? paidExistingValues.ram
        : paidEnvValues.ram,
      disk: hasStoredResourceValue(paidExistingValues?.disk)
        ? paidExistingValues.disk
        : paidEnvValues.disk,
      gpu: hasStoredResourceValue(paidExistingValues?.gpu)
        ? paidExistingValues.gpu
        : paidEnvValues.gpu,
      jobDuration: hasStoredResourceValue(paidExistingValues?.jobDuration)
        ? paidExistingValues.jobDuration
        : paidEnvValues.jobDuration
    }

    const freeLimits = {
      cpu: getLimits('cpu', true),
      ram: getLimits('ram', true),
      disk: getLimits('disk', true),
      gpu: getLimits('gpu', true),
      jobDuration: getLimits('jobDuration', true)
    }

    const paidLimits = {
      cpu: getLimits('cpu', false),
      ram: getLimits('ram', false),
      disk: getLimits('disk', false),
      gpu: getLimits('gpu', false),
      jobDuration: getLimits('jobDuration', false)
    }

    setFreeValues({
      cpu: clamp(freeRaw.cpu, freeLimits.cpu.minValue, freeLimits.cpu.maxValue),
      ram: clamp(freeRaw.ram, freeLimits.ram.minValue, freeLimits.ram.maxValue),
      disk: clamp(
        freeRaw.disk,
        freeLimits.disk.minValue,
        freeLimits.disk.maxValue
      ),
      gpu: clamp(freeRaw.gpu, freeLimits.gpu.minValue, freeLimits.gpu.maxValue),
      jobDuration: clamp(
        freeRaw.jobDuration,
        freeLimits.jobDuration.minValue,
        freeLimits.jobDuration.maxValue
      )
    })

    setPaidValues({
      cpu: clamp(paidRaw.cpu, paidLimits.cpu.minValue, paidLimits.cpu.maxValue),
      ram: clamp(paidRaw.ram, paidLimits.ram.minValue, paidLimits.ram.maxValue),
      disk: clamp(
        paidRaw.disk,
        paidLimits.disk.minValue,
        paidLimits.disk.maxValue
      ),
      gpu: clamp(paidRaw.gpu, paidLimits.gpu.minValue, paidLimits.gpu.maxValue),
      jobDuration: clamp(
        paidRaw.jobDuration,
        paidLimits.jobDuration.minValue,
        paidLimits.jobDuration.maxValue
      )
    })
  }, [values.computeEnv, allResourceValues, getEnvResourceValues])

  const resetCurrentStorageStepCompletion = useCallback(() => {
    const currentStep = values.user.stepCurrent
    if (currentStep <= LAST_TRACKED_COMPLETION_STEP) {
      setFieldValue(`step${currentStep}Completed`, false)
    }
  }, [setFieldValue, values.user.stepCurrent])

  if (stepMode === 'storage') {
    return (
      <div className={`${styles.container} ${styles.storageContainer}`}>
        <StepTitle title={i18n._('Job Results Storage')} />
        <div className={styles.resourceSection}>
          <SectionRadioOption
            id="store-on-node"
            checked={!values.outputStorageEnabled}
            onChange={() => {
              resetCurrentStorageStepCompletion()
              setFieldValue('outputStorageEnabled', false)
            }}
            label={i18n._('Store the job results on the node')}
          />

          <SectionRadioOption
            id="store-on-remote"
            checked={Boolean(values.outputStorageEnabled)}
            onChange={() => {
              resetCurrentStorageStepCompletion()
              setFieldValue('outputStorageEnabled', true)
            }}
            label={i18n._(
              'Store the job results on node and on a remote storage'
            )}
          />
        </div>

        {values.outputStorageEnabled ? (
          <OutputStorageSection values={values} setFieldValue={setFieldValue} />
        ) : (
          <div className={styles.outputStorageCard}>
            <p className={styles.outputStorageHint}>
              <Trans id="The compute job results will remain on the node storage for 30 days." />{' '}
              <br />
              <Trans id="Select the remote storage option if you want to export encrypted results also to your own destination." />{' '}
            </p>
          </div>
        )}
      </div>
    )
  }

  if (!values.computeEnv) {
    return (
      <div className={styles.container}>
        <StepTitle title={i18n._('C2D Environment Configuration')} />
        <p>
          <Trans id="Please select an environment first" />
        </p>
      </div>
    )
  }

  const env = values.computeEnv
  const currentChainId = chainId?.toString() ?? '11155111'
  const fee =
    env.fees?.[currentChainId]?.find(
      (f) => f.feeToken.toLowerCase() === values.baseToken?.toLowerCase()
    ) || env.fees?.[currentChainId]?.[0]
  const freeAvailable = !!env.free

  const updateResource = (
    type: 'cpu' | 'ram' | 'disk' | 'gpu' | 'jobDuration',
    value: number | string,
    isFree: boolean
  ) => {
    const { minValue, maxValue, step } = getLimits(type, isFree)

    if (value === '' || isNaN(Number(value))) return

    const validatedValue = clamp(Number(value), minValue, maxValue)

    const adjustedValue =
      step && type === 'disk'
        ? Number(validatedValue.toFixed(1))
        : Math.floor(validatedValue)

    if (isFree) {
      setFreeValues((prev) => ({ ...prev, [type]: adjustedValue }))
    } else {
      setPaidValues((prev) => ({ ...prev, [type]: adjustedValue }))
    }
  }

  const getResourceDescription = (resourceId: string): string | undefined => {
    const env = values.computeEnv
    if (!env) return undefined

    const resource = env.resources?.find((r) =>
      resourceId === 'gpu'
        ? r.type === 'gpu' || r.id?.toLowerCase().includes('gpu')
        : r.id === resourceId
    )
    if (resource?.description) {
      return resource.description
    }
    const freeResource = env.free?.resources?.find((r) =>
      resourceId === 'gpu'
        ? r.type === 'gpu' || r.id?.toLowerCase().includes('gpu')
        : r.id === resourceId
    )

    return freeResource?.description
  }

  const formatLimitValue = (value: number): string =>
    Number.isInteger(value) ? value.toString() : value.toFixed(1)

  const formatLimitRange = (
    id: ResourceValueKey,
    unit: string,
    isFree: boolean
  ): string => {
    const { minValue, maxValue } = getLimits(id, isFree)
    return `${formatLimitValue(minValue)} - ${formatLimitValue(
      maxValue
    )} ${unit}`
  }

  const environmentTechnicalRows = [
    {
      label: 'CPU',
      freeValue: freeAvailable ? formatLimitRange('cpu', 'units', true) : null,
      paidValue: formatLimitRange('cpu', 'units', false)
    },
    ...(gpuAvailable
      ? [
          {
            label: 'GPU',
            freeValue: freeAvailable
              ? formatLimitRange('gpu', 'units', true)
              : null,
            paidValue: formatLimitRange('gpu', 'units', false)
          }
        ]
      : []),
    {
      label: 'RAM',
      freeValue: freeAvailable ? formatLimitRange('ram', 'GB', true) : null,
      paidValue: formatLimitRange('ram', 'GB', false)
    },
    {
      label: 'DISK',
      freeValue: freeAvailable ? formatLimitRange('disk', 'GB', true) : null,
      paidValue: formatLimitRange('disk', 'GB', false)
    },
    {
      label: i18n._('JOB DURATION'),
      freeValue: freeAvailable
        ? formatLimitRange('jobDuration', 'min', true)
        : null,
      paidValue: formatLimitRange('jobDuration', 'min', false)
    }
  ]

  const queueWaitTimeError = !queueWaitingEnabled
    ? undefined
    : queueMaxWaitTime === null || queueMaxWaitTime === undefined
    ? i18n._('Enter a maximum waiting time.')
    : !Number.isFinite(Number(queueMaxWaitTime))
    ? i18n._('Enter a valid waiting time.')
    : Number(queueMaxWaitTime) < 1
    ? i18n._('Maximum waiting time must be at least 1.')
    : undefined

  const queueWaitTimeLabel =
    queueWaitingEnabled && !queueWaitTimeError && queueMaxWaitTime
      ? i18n.number(Number(queueMaxWaitTime), {
          style: 'unit',
          unit: queueMaxWaitTimeUnit.slice(0, -1),
          unitDisplay: 'long'
        })
      : i18n._('the configured queue max wait time')

  return (
    <div className={styles.container}>
      <StepTitle title={i18n._('C2D Environment Configuration')} />

      {showEnvironmentSummary && (
        <details className={styles.environmentSummaryCard}>
          <summary className={styles.environmentSummaryToggle}>
            <div className={styles.environmentSummaryHeading}>
              <span className={styles.environmentSummaryEyebrow}>
                <Trans id="Selected environment" />{' '}
              </span>
              <div className={styles.environmentSummaryContent}>
                <h3 className={styles.environmentSummaryTitle} title={env.id}>
                  {truncateDid(env.id)}
                </h3>
                {env.description && (
                  <p
                    className={styles.environmentSummaryDescription}
                    title={env.description}
                  >
                    {env.description}
                  </p>
                )}
              </div>
            </div>
            <span className={styles.environmentSummaryAction}>
              <Trans id="More details" />{' '}
            </span>
          </summary>

          <div className={styles.environmentSummaryDetails}>
            <div className={styles.environmentDetailsTable}>
              <div className={styles.environmentDetailsTableHeader}>
                <span className={styles.environmentDetailsTableLabel}>
                  <Trans id="Resource" />{' '}
                </span>
                {freeAvailable && (
                  <span className={styles.environmentDetailsTableLabel}>
                    <Trans id="Free" />{' '}
                  </span>
                )}
                <span className={styles.environmentDetailsTableLabel}>
                  <Trans id="Paid" />{' '}
                </span>
              </div>

              {environmentTechnicalRows.map((row) => (
                <div
                  key={row.label}
                  className={styles.environmentDetailsTableRow}
                >
                  <span className={styles.environmentDetailLabel}>
                    {row.label}
                  </span>
                  {freeAvailable && (
                    <span className={styles.environmentDetailValue}>
                      {row.freeValue}
                    </span>
                  )}
                  <span className={styles.environmentDetailValue}>
                    {row.paidValue}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}

      <Field
        label={i18n._('Price Token')}
        component={Input}
        name="baseToken"
        type="select"
        options={baseTokenOptions}
        value={
          isTokenListLoading
            ? i18n._('Loading tokens...')
            : symbolMap[values.baseToken] || values.baseToken || ''
        }
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
          const selectedAddr = supportedTokensFromEnv.find(
            (addr) => (symbolMap[addr] || addr) === e.target.value
          )
          if (selectedAddr) {
            setFieldValue('baseToken', selectedAddr)
            setBaseTokenAddress(selectedAddr)
          }
        }}
        disabled={isTokenListLoading}
      />

      <QueueWaitSection
        enabled={queueWaitingEnabled}
        queueMaxWaitTime={queueMaxWaitTime}
        queueMaxWaitTimeUnit={queueMaxWaitTimeUnit}
        error={queueWaitTimeError}
        onToggle={(checked) => {
          setFieldValue('queueWaitingEnabled', checked)
          if (checked && (!queueMaxWaitTime || Number(queueMaxWaitTime) < 1)) {
            setFieldValue('queueMaxWaitTime', 1)
            setFieldValue('queueMaxWaitTimeUnit', 'minutes')
          }
        }}
        onChange={(value) => {
          const parsedValue = value === '' ? null : Number(value)
          const normalizedValue =
            parsedValue === null || Number.isFinite(parsedValue)
              ? parsedValue
              : null
          setFieldValue('queueMaxWaitTime', normalizedValue)
        }}
        onUnitChange={(value) => {
          setFieldValue('queueMaxWaitTimeUnit', value)
        }}
      />

      {freeAvailable && (
        <div className={styles.resourceSection}>
          <SectionRadioOption
            id="free-resources"
            checked={mode === 'free'}
            onChange={() => setMode('free')}
            label={i18n._('Free compute resources')}
          />

          <div className={styles.resourceContent}>
            <ResourceRow
              resourceId="cpu"
              label={i18n._('CPU')}
              unit="Units"
              isFree={true}
              isActive={mode === 'free'}
              freeValues={freeValues}
              paidValues={paidValues}
              getLimits={getLimits}
              updateResource={updateResource}
              fee={fee}
              tooltip={getResourceDescription('cpu')}
            />
            {gpuAvailable && (
              <ResourceRow
                resourceId="gpu"
                label={i18n._('GPU')}
                unit="Units"
                isFree={true}
                isActive={mode === 'free'}
                freeValues={freeValues}
                paidValues={paidValues}
                getLimits={getLimits}
                updateResource={updateResource}
                fee={fee}
                tooltip={getResourceDescription('gpu')}
              />
            )}
            <ResourceRow
              resourceId="ram"
              label={i18n._('RAM')}
              unit="GB"
              isFree={true}
              isActive={mode === 'free'}
              freeValues={freeValues}
              paidValues={paidValues}
              getLimits={getLimits}
              updateResource={updateResource}
              fee={fee}
            />
            <ResourceRow
              resourceId="disk"
              label={i18n._('DISK')}
              unit="GB"
              isFree={true}
              isActive={mode === 'free'}
              freeValues={freeValues}
              paidValues={paidValues}
              getLimits={getLimits}
              updateResource={updateResource}
              fee={fee}
            />
            <ResourceRow
              resourceId="jobDuration"
              label={i18n._('JOB DURATION')}
              unit="Minutes"
              isFree={true}
              isActive={mode === 'free'}
              freeValues={freeValues}
              paidValues={paidValues}
              getLimits={getLimits}
              updateResource={updateResource}
              fee={fee}
            />
          </div>
        </div>
      )}

      <div className={styles.resourceSection}>
        <SectionRadioOption
          id="paid-resources"
          checked={mode === 'paid'}
          onChange={() => setMode('paid')}
          label={i18n._('Paid compute resources')}
        />

        <div className={styles.resourceContent}>
          <ResourceRow
            resourceId="cpu"
            label={i18n._('CPU')}
            unit="Units"
            isFree={false}
            isActive={mode === 'paid'}
            freeValues={freeValues}
            paidValues={paidValues}
            getLimits={getLimits}
            updateResource={updateResource}
            fee={fee}
            tooltip={getResourceDescription('cpu')}
          />
          {gpuAvailable && (
            <ResourceRow
              resourceId="gpu"
              label={i18n._('GPU')}
              unit="Units"
              isFree={false}
              isActive={mode === 'paid'}
              freeValues={freeValues}
              paidValues={paidValues}
              getLimits={getLimits}
              updateResource={updateResource}
              fee={fee}
              tooltip={getResourceDescription('gpu')}
            />
          )}
          <ResourceRow
            resourceId="ram"
            label={i18n._('RAM')}
            unit="GB"
            isFree={false}
            isActive={mode === 'paid'}
            freeValues={freeValues}
            paidValues={paidValues}
            getLimits={getLimits}
            updateResource={updateResource}
            fee={fee}
          />
          <ResourceRow
            resourceId="disk"
            label={i18n._('DISK')}
            unit="GB"
            isFree={false}
            isActive={mode === 'paid'}
            freeValues={freeValues}
            paidValues={paidValues}
            getLimits={getLimits}
            updateResource={updateResource}
            fee={fee}
          />
          <ResourceRow
            resourceId="jobDuration"
            label={i18n._('JOB DURATION')}
            unit="Minutes"
            isFree={false}
            isActive={mode === 'paid'}
            freeValues={freeValues}
            paidValues={paidValues}
            getLimits={getLimits}
            updateResource={updateResource}
            fee={fee}
          />
        </div>
      </div>

      <div className={styles.priceSection}>
        <h3 className={styles.priceTitle}>
          <Trans id="C2D Environment Price" />
        </h3>
        <div className={styles.priceDisplay}>
          <input
            type="text"
            value={calculatePrice().toFixed(3)}
            readOnly
            className={`${styles.input} ${styles.inputLarge}`}
            placeholder="0"
          />
          {mode === 'paid' && (
            <div className={styles.priceInfo}>
              <span>
                <Trans id="Calculated based on the unit price for each resource and the Job duration selected" />{' '}
              </span>
            </div>
          )}
        </div>
      </div>

      {(queueWaitingEnabled || isGpuSelected || mode === 'paid') && (
        <div className={styles.messagesContainer}>
          {queueWaitingEnabled && (
            <div className={styles.queueNotice}>
              <Trans
                id="The C2D job is placed in a waiting queue until adequate processing resources are allocated, with a maximum wait duration of {waitTime}. Ensure that, upon expiration of this interval, your access entitlements for all job-related assets remain valid."
                values={{ waitTime: queueWaitTimeLabel }}
              />
            </div>
          )}

          {isGpuSelected && (
            <div className={styles.gpuWarning}>
              <div className={styles.gpuWarningIcon}>⚠️</div>
              <div className={styles.gpuWarningContent}>
                <strong>
                  <Trans id="Please Attention!" />
                </strong>{' '}
                <Trans id="You selected an environment with allocated GPU units. Ensure the GPU type is compatible with the GPU libraries used in the algorithm`s Docker image." />{' '}
              </div>
            </div>
          )}

          {mode === 'paid' && (
            <div className={styles.escrowValidation}>
              {(() => {
                const jobPrice = new Decimal(calculatePrice())
                const availableEscrow = new Decimal(escrowAvailableFunds)
                if (jobPrice.gt(availableEscrow)) {
                  const deltaAmount = jobPrice.minus(availableEscrow)
                  const deltaDisplay = deltaAmount.lt(0.001)
                    ? '<0.001'
                    : deltaAmount
                        .toDecimalPlaces(3, Decimal.ROUND_UP)
                        .toFixed(3)
                  return (
                    <div
                      className={`${styles.queueNotice} ${styles.insufficientEscrow}`}
                    >
                      <p>
                        <Trans
                          id="Insufficient escrow balance. An additional <0>{amount} {symbol}</0> will be added to your escrow account to cover this job."
                          values={{
                            amount: deltaDisplay,
                            symbol: displaySymbol
                          }}
                          components={{ 0: <strong /> }}
                        />{' '}
                      </p>
                      <p className={styles.escrowBreakdown}>
                        <Trans id="Job cost:" /> {jobPrice.toFixed(3)}{' '}
                        {displaySymbol} <Trans id="| Available escrow:" />{' '}
                        {escrowAvailableFundsDisplay} {displaySymbol}{' '}
                        <Trans id="| Additional needed:" /> {deltaDisplay}{' '}
                        {displaySymbol}
                      </p>
                    </div>
                  )
                }

                return (
                  <div className={styles.sufficientEscrow}>
                    <p>
                      <Trans id="Sufficient escrow balance available for this job." />
                    </p>
                    <p className={styles.escrowBreakdown}>
                      <Trans id="Job cost:" /> {jobPrice.toFixed(3)}{' '}
                      {displaySymbol} <Trans id="| Available escrow:" />{' '}
                      {escrowAvailableFundsDisplay} {displaySymbol}
                    </p>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
