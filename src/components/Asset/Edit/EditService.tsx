import { translate } from '../../../i18n/translate'
import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { persistDdo } from '@utils/metadataPersistence'
import { ReactElement, useState, useEffect } from 'react'
import { Formik } from 'formik'
import {
  LoggerInstance,
  FixedRateExchange,
  Datatoken
} from '@oceanprotocol/lib'
import Decimal from 'decimal.js'
import { getServiceInitialValues } from './_constants'
import { ServiceEditForm } from './_types'
import Web3Feedback from '@shared/Web3Feedback'
import { mapTimeoutStringToSeconds, normalizeFile } from '@utils/ddo'
import { contentPagesEditService as content } from '../../../i18n/content'
import { isAddress, Signer } from 'ethers'
import { getOceanConfig } from '@utils/ocean'
import EditFeedback from './EditFeedback'
import { useAsset } from '@context/Asset'
import { getEncryptedFiles, getFileDidInfo } from '@utils/provider'
import { useAccount, useChainId, usePublicClient } from 'wagmi'
import { convertLinks } from '@utils/links'
import { sanitizeUrl } from '@utils/url'
import {
  generateCredentials,
  transformConsumerParameters
} from '@components/Publish/_utils'
import FormEditService from './FormEditService'
import { transformComputeFormToServiceComputeOptions } from '@utils/compute'
import { useCancelToken } from '@hooks/useCancelToken'
import {
  newServiceValidationSchema,
  serviceValidationSchema
} from './_validation'
import { useUserPreferences } from '@context/UserPreferences'
import DebugEditService from './DebugEditService'
import styles from './index.module.css'
import { Service } from 'src/@types/ddo/Service'
import { AssetExtended } from 'src/@types/AssetExtended'
import appConfig, { customProviderUrl } from 'app.config.cjs'
import { mergeEditedCredentials } from '@utils/credentials'
import { useSsiWallet } from '@context/SsiWallet'
import { State } from 'src/@types/ddo/State'
import { assetStateToNumber } from '@utils/assetState'
import { useEthersSigner } from '@hooks/useEthersSigner'
import { getOpaServerUrl } from '@utils/wallet/policyServer'
import { useOpaServerChangeNotification } from './useOpaServerChangeNotification'

export default function EditService({
  asset,
  service,
  accessDetails
}: {
  asset: AssetExtended
  service: Service
  accessDetails: AccessDetails | undefined
}): ReactElement {
  useLingui()

  const { debug } = useUserPreferences()
  const { fetchAsset, isAssetNetwork } = useAsset()
  const { address: accountId } = useAccount()
  const chainId = useChainId()
  const walletClient = useEthersSigner()
  const _publicClient = usePublicClient()
  const newCancelToken = useCancelToken()
  const ssiWalletContext = useSsiWallet()

  const signer = walletClient as unknown as Signer

  const [success, setSuccess] = useState<string>()
  const [error, setError] = useState<string>()
  const [detectedFileType, setDetectedFileType] = useState<string | undefined>()
  const hasFeedback = error || success

  useOpaServerChangeNotification(
    `${asset.id}-${service.id}`,
    service.serviceEndpoint,
    service.credentials,
    i18n._(
      'The OPA server URL has changed. Save this service to update it in the asset.'
    )
  )

  useEffect(() => {
    async function fetchFileType() {
      if (!service.files || service.files.length === 0) {
        setDetectedFileType(undefined)
        return
      }

      try {
        const fileInfo = await getFileDidInfo(
          asset.id,
          service.id,
          service?.serviceEndpoint || customProviderUrl
        )
        if (fileInfo && fileInfo.length > 0 && fileInfo[0]?.type) {
          setDetectedFileType(fileInfo[0].type)
        } else {
          setDetectedFileType('url')
        }
      } catch (error) {
        LoggerInstance.log(
          '[EditService] Could not fetch file info, defaulting to url:',
          error.message
        )
        setDetectedFileType('url')
      }
    }

    fetchFileType()
  }, [asset.id, service.id, service.serviceEndpoint, service.files])

  async function updateFixedPrice(newPrice: string | number) {
    const config = getOceanConfig(asset.credentialSubject?.chainId)

    const fixedRateInstance = new FixedRateExchange(
      accessDetails.fixedRateExchangeAddress || config.fixedRateExchangeAddress,
      signer
    )

    const setPriceResp = await fixedRateInstance.setRate(
      accessDetails.addressOrId,
      String(newPrice)
    )
    LoggerInstance.log('[edit] setFixedRate result', setPriceResp)
    if (!setPriceResp) {
      throw new Error(content.form.error)
    }
  }

  // edit 1 service
  async function handleSubmit(values: ServiceEditForm, resetForm: () => void) {
    try {
      const updatedAt = new Date().toISOString()

      const processAddress = (
        inputValue: string,
        fieldName: 'allow' | 'deny'
      ) => {
        const trimmedValue = inputValue?.trim()
        if (
          !trimmedValue ||
          trimmedValue.length < 40 ||
          !trimmedValue.startsWith('0x')
        ) {
          return
        }

        try {
          if (isAddress(trimmedValue)) {
            const lowerCaseAddress = trimmedValue.toLowerCase()
            const currentList = values.credentials[fieldName] || []

            if (!currentList.includes(lowerCaseAddress)) {
              const newList = [...currentList, lowerCaseAddress]
              values.credentials[fieldName] = newList
            }
          }
        } catch (error) {}
      }

      if (values.credentials.allowInputValue) {
        processAddress(values.credentials.allowInputValue, 'allow')
      }
      if (values.credentials.denyInputValue) {
        processAddress(values.credentials.denyInputValue, 'deny')
      }

      if (accessDetails.type === 'fixed' && values.price !== undefined) {
        const nextPrice = String(values.price || '0')
        const currentPrice = String(accessDetails.price || '0')
        let priceChanged = true
        try {
          priceChanged = !new Decimal(nextPrice).eq(new Decimal(currentPrice))
        } catch {
          priceChanged = true
        }
        if (priceChanged) {
          await updateFixedPrice(nextPrice)
        }
      }

      if (values.paymentCollector !== accessDetails.paymentCollector) {
        const datatoken = new Datatoken(signer)
        await datatoken.setPaymentCollector(
          service.datatokenAddress,
          accountId,
          values.paymentCollector
        )
      }

      let updatedFiles = service.files
      if (values.files[0]?.url) {
        const file = {
          nftAddress: asset.credentialSubject.nftAddress,
          datatokenAddress: service.datatokenAddress,
          files: [normalizeFile(values.files[0].type, values.files[0], chainId)]
        }

        const filesEncrypted = await getEncryptedFiles(
          file,
          asset.credentialSubject?.chainId,
          service.serviceEndpoint,
          signer
        )
        updatedFiles = filesEncrypted
      }

      const linksTransformed =
        values.links?.length && values.links[0].valid && values.links[0].url
          ? convertLinks([sanitizeUrl(values.links[0].url)])
          : undefined

      const serviceCredentials = {
        ...(values.credentials || {})
      }
      const opaServerUrl = await getOpaServerUrl(service.serviceEndpoint)
      const updatedCredentials = generateCredentials(
        serviceCredentials,
        opaServerUrl
      )
      const updatedService: Service = {
        ...service,
        name: values.name,
        description: {
          '@value': values.description,
          '@language': values.language,
          '@direction': values.direction
        },
        timeout: mapTimeoutStringToSeconds(values.timeout),
        state:
          values.state === undefined
            ? State.Active
            : assetStateToNumber(values.state),
        files: updatedFiles,
        links: linksTransformed,
        credentials: mergeEditedCredentials(
          service.credentials,
          updatedCredentials,
          appConfig.ssiEnabled
        ),
        ...(values.access === 'compute' &&
          asset.credentialSubject?.metadata?.type === 'dataset' && {
            compute: await transformComputeFormToServiceComputeOptions(
              values,
              service.compute,
              asset.credentialSubject?.chainId,
              newCancelToken()
            )
          })
      }
      updatedService.consumerParameters = values.usesConsumerParameters
        ? transformConsumerParameters(values.consumerParameters)
        : undefined

      const serviceIndex = asset.credentialSubject?.services.findIndex(
        (s) => s.id === service.id
      )
      const updatedAsset: AssetExtended = JSON.parse(JSON.stringify(asset))
      if (updatedAsset.credentialSubject) {
        updatedAsset.credentialSubject.services[serviceIndex] = updatedService
        updatedAsset.credentialSubject.metadata = {
          ...updatedAsset.credentialSubject.metadata,
          updated: updatedAt
        }
      }

      await persistDdo({
        asset: updatedAsset,
        signer,
        ssiWalletContext,
        serviceId: service.id
      })

      // Edit succeeded
      setSuccess(content.form.success)
      resetForm()
    } catch (error) {
      LoggerInstance.error(error.message)
      setError(error.message)
    }
  }

  if (!accessDetails) return null

  return (
    <Formik
      enableReinitialize
      initialValues={getServiceInitialValues(
        service,
        accessDetails,
        detectedFileType
      )}
      validationSchema={
        accessDetails.type === 'free'
          ? newServiceValidationSchema
          : serviceValidationSchema
      }
      onSubmit={async (values, { resetForm }) => {
        // move user's focus to top of screen
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
        // kick off editing
        await handleSubmit(values, resetForm)
      }}
    >
      {({ isSubmitting, values }) =>
        isSubmitting || hasFeedback ? (
          <EditFeedback
            loading="Updating service..."
            error={translate(error)}
            success={success}
            setError={setError}
            successAction={{
              name: i18n._('Back to Asset'),
              onClick: async () => {
                await fetchAsset()
              },
              to: `/asset/${asset.id}`
            }}
          />
        ) : (
          <>
            <FormEditService
              data={content.form.data}
              chainId={asset.credentialSubject?.chainId}
              service={service}
              accessDetails={accessDetails}
              assetType={asset.credentialSubject?.metadata?.type}
              existingFileType={detectedFileType}
            />

            <Web3Feedback
              accountId={accountId}
              isAssetNetwork={isAssetNetwork}
            />

            {debug === true && (
              <div className={styles.grid}>
                <DebugEditService
                  values={values}
                  asset={asset}
                  service={{
                    ...service,
                    name: values.name,
                    description: {
                      '@value': values.description,
                      '@language': values.language,
                      '@direction': values.direction
                    },
                    timeout: mapTimeoutStringToSeconds(values.timeout),
                    state:
                      values.state === undefined
                        ? State.Active
                        : assetStateToNumber(values.state),
                    files: values.files[0]?.url
                      ? values.files[0].url
                      : service.files,
                    links:
                      values.links?.length &&
                      values.links[0].valid &&
                      values.links[0].url
                        ? convertLinks([sanitizeUrl(values.links[0].url)])
                        : service.links,
                    credentials: generateCredentials({
                      ...(values.credentials || {}),
                      vcPolicies: []
                    }),
                    ...(values.access === 'compute' && {
                      compute: service.compute
                    }),
                    consumerParameters: values.usesConsumerParameters
                      ? transformConsumerParameters(values.consumerParameters)
                      : undefined
                  }}
                />
              </div>
            )}
          </>
        )
      }
    </Formik>
  )
}
