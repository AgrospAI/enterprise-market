import { useLingui } from '@lingui/react'
import { i18n } from '../../../../i18n/index'
import { FormEvent, ReactElement } from 'react'
import Button from '../../../@shared/atoms/Button'
import styles from './index.module.css'
import Loader from '../../../@shared/atoms/Loader'
import Download2SVG from '@images/download2.svg'

export interface ButtonBuyProps {
  action: 'download' | 'compute'
  disabled: boolean
  hasPreviousOrder: boolean
  hasDatatoken: boolean
  btSymbol: string
  dtSymbol: string
  dtBalance: string
  assetType: string
  assetTimeout: string
  isConsumable: boolean
  consumableFeedback: string
  hasPreviousOrderSelectedComputeAsset?: boolean
  hasDatatokenSelectedComputeAsset?: boolean
  dtSymbolSelectedComputeAsset?: string
  dtBalanceSelectedComputeAsset?: string
  selectedComputeAssetType?: string
  isBalanceSufficient: boolean
  isLoading?: boolean
  onClick?: (e: FormEvent<HTMLButtonElement>) => void
  stepText?: string
  type?: 'submit' | 'button'
  priceType?: string
  algorithmPriceType?: string
  isAlgorithmConsumable?: boolean
  isSupportedOceanNetwork?: boolean
  isAccountConnected?: boolean
  hasProviderFee?: boolean
  retry?: boolean
  computeWizard?: boolean
  insufficientSymbol?: string | null
}

function getConsumeHelpText(
  btSymbol: string,
  dtBalance: string,
  dtSymbol: string,
  hasDatatoken: boolean,
  hasPreviousOrder: boolean,
  assetType: string,
  isConsumable: boolean,
  isBalanceSufficient: boolean,
  consumableFeedback: string,
  isSupportedOceanNetwork: boolean,
  isAccountConnected: boolean,
  priceType: string,
  insufficientSymbol: string
) {
  const assetTypeName = assetType === 'saas' ? 'service' : assetType
  const text =
    isConsumable === false
      ? consumableFeedback
      : hasPreviousOrder && isAccountConnected && isSupportedOceanNetwork
      ? ''
      : hasDatatoken
      ? i18n._(
          'You own {dtBalance} {dtSymbol} allowing you to use this dataset by spending 1 {dtSymbol}, but without paying {btSymbol} again.',
          { dtBalance, dtSymbol, btSymbol }
        )
      : isBalanceSufficient === false
      ? i18n._(
          'You do not have enough {insufficientSymbol} token in your wallet to purchase this asset.',
          { insufficientSymbol }
        )
      : priceType === 'free'
      ? ''
      : i18n._(
          'To use this {assetTypeName}, you will buy 1 {dtSymbol} and immediately send it back to the publisher.',
          { assetTypeName, dtSymbol }
        )
  return text
}

function getAlgoHelpText(
  dtSymbolSelectedComputeAsset: string,
  dtBalanceSelectedComputeAsset: string,
  isConsumable: boolean,
  isAlgorithmConsumable: boolean,
  hasPreviousOrderSelectedComputeAsset: boolean,
  selectedComputeAssetType: string,
  hasDatatokenSelectedComputeAsset: boolean,
  isBalanceSufficient: boolean,
  isSupportedOceanNetwork: boolean,
  isAccountConnected: boolean,
  algorithmPriceType: string
) {
  const text =
    (!dtSymbolSelectedComputeAsset && !dtBalanceSelectedComputeAsset) ||
    isConsumable === false ||
    isAlgorithmConsumable === false
      ? ''
      : hasPreviousOrderSelectedComputeAsset &&
        isAccountConnected &&
        isSupportedOceanNetwork
      ? i18n._(
          'You already bought the selected {selectedComputeAssetType}, allowing you to use it without paying again.',
          { selectedComputeAssetType }
        )
      : hasDatatokenSelectedComputeAsset
      ? i18n._(
          'You own {dtBalanceSelectedComputeAsset} {dtSymbolSelectedComputeAsset} allowing you to use the selected {selectedComputeAssetType} by spending 1 {dtSymbolSelectedComputeAsset}, but without paying OCEAN again.',
          {
            dtBalanceSelectedComputeAsset,
            dtSymbolSelectedComputeAsset,
            selectedComputeAssetType
          }
        )
      : isAccountConnected && !isSupportedOceanNetwork
      ? i18n._('Connect to the correct network to interact with this asset.')
      : isBalanceSufficient === false
      ? ''
      : algorithmPriceType === 'free'
      ? i18n._(
          'Additionally, the selected {selectedComputeAssetType} is free to use.',
          { selectedComputeAssetType }
        )
      : i18n._(
          'Additionally, you will buy 1 {dtSymbolSelectedComputeAsset} for the {selectedComputeAssetType} and send it back to the publisher.',
          {
            dtSymbolSelectedComputeAsset,
            selectedComputeAssetType
          }
        )
  return text
}

function getComputeAssetHelpText(
  hasPreviousOrder: boolean,
  hasDatatoken: boolean,
  btSymbol: string,
  dtSymbol: string,
  dtBalance: string,
  isConsumable: boolean,
  consumableFeedback: string,
  isBalanceSufficient: boolean,
  algorithmPriceType: string,
  priceType: string,
  hasPreviousOrderSelectedComputeAsset?: boolean,
  hasDatatokenSelectedComputeAsset?: boolean,
  assetType?: string,
  dtSymbolSelectedComputeAsset?: string,
  dtBalanceSelectedComputeAsset?: string,
  selectedComputeAssetType?: string,
  isAlgorithmConsumable?: boolean,
  isSupportedOceanNetwork?: boolean,
  isAccountConnected?: boolean,
  hasProviderFee?: boolean,
  insufficientSymbol?: string | null
) {
  const computeAssetHelpText = getConsumeHelpText(
    btSymbol,
    dtBalance,
    dtSymbol,
    hasDatatoken,
    hasPreviousOrder,
    assetType,
    isConsumable,
    isBalanceSufficient,
    consumableFeedback,
    isSupportedOceanNetwork,
    isAccountConnected,
    priceType,
    insufficientSymbol
  )

  const computeAlgoHelpText = getAlgoHelpText(
    dtSymbolSelectedComputeAsset,
    dtBalanceSelectedComputeAsset,
    isConsumable,
    isAlgorithmConsumable,
    hasPreviousOrderSelectedComputeAsset,
    selectedComputeAssetType,
    hasDatatokenSelectedComputeAsset,
    isBalanceSufficient,
    isSupportedOceanNetwork,
    isAccountConnected,
    algorithmPriceType
  )

  const providerFeeHelpText = hasProviderFee
    ? i18n._(
        'In order to start the job you also need to pay the fees for renting the c2d resources.'
      )
    : i18n._(
        'The C2D resources required to start the job are available, no payment is required for them.'
      )
  let computeHelpText = `${computeAssetHelpText} ${computeAlgoHelpText} ${providerFeeHelpText}`

  computeHelpText = computeHelpText.replace(/^\s+/, '')
  return computeHelpText
}

export default function ButtonBuy({
  action,
  disabled,
  hasPreviousOrder,
  hasDatatoken,
  btSymbol,
  dtSymbol,
  dtBalance,
  assetType,
  assetTimeout,
  isConsumable,
  consumableFeedback,
  isBalanceSufficient,
  hasPreviousOrderSelectedComputeAsset,
  hasDatatokenSelectedComputeAsset,
  dtSymbolSelectedComputeAsset,
  dtBalanceSelectedComputeAsset,
  selectedComputeAssetType,
  onClick,
  stepText,
  isLoading,
  type,
  priceType,
  algorithmPriceType,
  isAlgorithmConsumable,
  hasProviderFee,
  retry,
  isSupportedOceanNetwork,
  isAccountConnected,
  computeWizard,
  insufficientSymbol
}: ButtonBuyProps): ReactElement {
  useLingui()

  // assetTimeout is the formatted access duration (formatServiceTimeout)
  const timeoutSuffix =
    !assetTimeout || assetTimeout === i18n._('Forever')
      ? ''
      : i18n._(' for {assetTimeout}', { assetTimeout })
  const buttonText = retry
    ? i18n._('Retry')
    : action === 'download'
    ? hasPreviousOrder
      ? assetType === 'saas'
        ? i18n._('Go to service')
        : i18n._('Download')
      : assetType === 'saas'
      ? i18n._('Subscribe{timeoutSuffix}', { timeoutSuffix })
      : priceType === 'free'
      ? i18n._('Get')
      : i18n._('Buy{timeoutSuffix}', { timeoutSuffix })
    : hasPreviousOrder &&
      hasPreviousOrderSelectedComputeAsset &&
      !hasProviderFee
    ? i18n._('Start Compute Job')
    : priceType === 'free' && algorithmPriceType === 'free'
    ? i18n._('Order Compute Job')
    : i18n._('Buy Compute Job')

  function message(): string {
    let message = ''
    if (action === 'download') {
      message = getConsumeHelpText(
        btSymbol,
        dtBalance,
        dtSymbol,
        hasDatatoken,
        hasPreviousOrder,
        assetType,
        isConsumable,
        isBalanceSufficient,
        consumableFeedback,
        isSupportedOceanNetwork,
        isAccountConnected,
        priceType,
        insufficientSymbol || ''
      )
    } else {
      message = getComputeAssetHelpText(
        hasPreviousOrder,
        hasDatatoken,
        btSymbol,
        dtSymbol,
        dtBalance,
        isConsumable,
        consumableFeedback,
        isBalanceSufficient,
        algorithmPriceType,
        priceType,
        hasPreviousOrderSelectedComputeAsset,
        hasDatatokenSelectedComputeAsset,
        assetType,
        dtSymbolSelectedComputeAsset,
        dtBalanceSelectedComputeAsset,
        selectedComputeAssetType,
        isAlgorithmConsumable,
        isSupportedOceanNetwork,
        isAccountConnected,
        hasProviderFee,
        insufficientSymbol || ''
      )
    }

    return message
  }
  return (
    <div
      className={`${styles.actions} ${
        action === 'download' && priceType === 'free' ? styles.noMargin : ''
      }`}
    >
      {isLoading ? (
        <div className={styles.loaderWrap}>
          <Loader
            message={stepText}
            noMargin={true}
            className={
              action === 'download' &&
              priceType === 'free' &&
              stepText === 'Ordering asset'
                ? styles.orderingAsset
                : ''
            }
          />
        </div>
      ) : (
        <>
          <Button
            style="accent"
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`${action === 'compute' ? styles.actionsCenter : ''} ${
              action === 'download' && priceType === 'free'
                ? styles.freeAssetButton
                : ''
            }`}
          >
            {action === 'download' && priceType === 'free' && <Download2SVG />}
            {buttonText}
          </Button>
          {!computeWizard && message() && (
            <div className={styles.help}>{message()}</div>
          )}
        </>
      )}
    </div>
  )
}
