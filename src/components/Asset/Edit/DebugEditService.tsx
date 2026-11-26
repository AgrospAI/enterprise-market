import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement, useEffect, useState } from 'react'
import DebugOutput from '@shared/DebugOutput'
import { useCancelToken } from '@hooks/useCancelToken'
import { transformComputeFormToServiceComputeOptions } from '@utils/compute'
import { ServiceEditForm } from './_types'
import {
  mapTimeoutStringToSeconds,
  normalizeFile,
  previewDebugPatch
} from '@utils/ddo'
import {
  generateCredentials,
  transformConsumerParameters
} from '@components/Publish/_utils'
import { Service } from 'src/@types/ddo/Service'
import { Asset } from 'src/@types/Asset'
import { Credential } from 'src/@types/ddo/Credentials'
import { State } from 'src/@types/ddo/State'
import { assetStateToNumber } from '@utils/assetState'
import { mergeEditedCredentials } from '@utils/credentials'
import appConfig from 'app.config.cjs'

export default function DebugEditService({
  values,
  asset,
  service
}: {
  values: ServiceEditForm
  asset: Asset
  service: Service
}): ReactElement {
  useLingui()

  const [valuePreview, setValuePreview] = useState({})
  const [updatedService, setUpdatedService] = useState<Service>()
  const newCancelToken = useCancelToken()

  useEffect(() => {
    async function transformValues() {
      let updatedFiles = service.files
      if (values.files[0]?.url) {
        updatedFiles = JSON.stringify([
          normalizeFile(
            values.files[0].type,
            values.files[0],
            asset.credentialSubject?.chainId
          )
        ])
      }

      const credentials: Credential = generateCredentials(values.credentials)
      const updatedService: Service = {
        ...service,
        name: values.name,
        description: {
          '@value': values.description,
          '@language': values.language,
          '@direction': values.direction
        },
        type: values.access,
        timeout: mapTimeoutStringToSeconds(values.timeout),
        state:
          values.state === undefined
            ? State.Active
            : assetStateToNumber(values.state),
        files: updatedFiles,
        credentials: mergeEditedCredentials(
          service.credentials,
          credentials,
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
      setUpdatedService(updatedService)
    }

    transformValues()
    setValuePreview(previewDebugPatch(values))
  }, [values, asset, newCancelToken, service])

  return (
    <>
      <DebugOutput
        title={i18n._('Collected Form Values')}
        output={valuePreview}
        large
      />
      <DebugOutput
        title={i18n._('Transformed Service Values')}
        output={updatedService}
        large
      />
    </>
  )
}
