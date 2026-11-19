import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement, useState, useEffect, useCallback } from 'react'
import { useFormikContext } from 'formik'
import { ComputeEnvironment, ProviderInstance } from '@oceanprotocol/lib'
import StepTitle from '@shared/StepTitle'
import EnvironmentSelection from '@shared/FormInput/InputElement/EnvironmentSelection'
import { FormComputeData } from '../_types'
import {
  getComputeWizardStepNumbers,
  LAST_TRACKED_COMPLETION_STEP
} from '../_steps'
import { ResourceType } from 'src/@types/ResourceType'
import { createDefaultComputeResourceValues } from '../computeEnvironmentDefaults'
import styles from './index.module.css'
import appConfig from 'app.config.cjs'

interface SelectEnvironmentProps {
  computeEnvs: ComputeEnvironment[]
  providerUrl?: string
  setAllResourceValues?: React.Dispatch<
    React.SetStateAction<Record<string, ResourceType>>
  >
}

const { customProviderUrl } = appConfig
const downstreamStepOffsets = [1, 2, 3] as const
const resetEnvironmentSelectionValues = (
  selectedEnv: ComputeEnvironment,
  mode: 'free' | 'paid'
) => {
  const defaultResources = createDefaultComputeResourceValues(selectedEnv, mode)

  return {
    cpu: defaultResources.cpu,
    ram: defaultResources.ram,
    disk: defaultResources.disk,
    gpu: defaultResources.gpu ?? 0,
    jobDuration: defaultResources.jobDuration,
    jobPrice: '0',
    escrowFunds: '0',
    actualPaymentAmount: '0',
    escrowCoveredAmount: '0',
    baseToken: null
  } as const
}

export default function SelectEnvironment({
  computeEnvs,
  providerUrl,
  setAllResourceValues
}: SelectEnvironmentProps): ReactElement {
  useLingui()

  const { values, setFieldValue } = useFormikContext<FormComputeData>()
  const [selectedEnvId, setSelectedEnvId] = useState<string>()
  const providerUrlForNodeInfo = providerUrl || customProviderUrl
  const stepNumbers = getComputeWizardStepNumbers(
    Boolean(values.isUserParameters),
    Boolean(values.withoutDataset)
  )

  useEffect(() => {
    if (values.computeEnv?.id) {
      setSelectedEnvId(values.computeEnv.id)
    }
  }, [values.computeEnv])

  const handleEnvironmentSelect = useCallback(
    async (envId: string) => {
      setSelectedEnvId(envId)
      const availableEnvs =
        computeEnvs?.length > 0
          ? computeEnvs
          : await ProviderInstance.getComputeEnvironments(
              providerUrlForNodeInfo
            )
      const selectedEnv = availableEnvs.find((env) => env.id === envId)
      if (selectedEnv) {
        const previousEnvId = values.computeEnv?.id
        const hasEnvironmentChanged = previousEnvId && previousEnvId !== envId

        if (hasEnvironmentChanged) {
          const nextMode = selectedEnv.free ? 'free' : 'paid'
          setFieldValue('mode', nextMode)
          Object.entries(
            resetEnvironmentSelectionValues(selectedEnv, nextMode)
          ).forEach(([field, value]) => {
            setFieldValue(field, value)
          })
          downstreamStepOffsets.forEach((offset) => {
            const dependentStep = values.user.stepCurrent + offset
            if (
              dependentStep <= LAST_TRACKED_COMPLETION_STEP &&
              dependentStep !== stepNumbers.jobResultsStorage
            ) {
              setFieldValue(`step${dependentStep}Completed`, false)
            }
          })

          setAllResourceValues?.((prev) => ({
            ...prev,
            [`${selectedEnv.id}_free`]: createDefaultComputeResourceValues(
              selectedEnv,
              'free'
            ),
            [`${selectedEnv.id}_paid`]: createDefaultComputeResourceValues(
              selectedEnv,
              'paid'
            )
          }))
        }

        setFieldValue('computeEnv', selectedEnv)
      }
    },
    [
      computeEnvs,
      providerUrlForNodeInfo,
      setAllResourceValues,
      setFieldValue,
      values.computeEnv?.id,
      values.isUserParameters,
      values.withoutDataset,
      values.user.stepCurrent
    ]
  )

  return (
    <>
      <StepTitle title={i18n._('Select C2D Environment')} />

      <div className={styles.environmentSelection}>
        <EnvironmentSelection
          environments={computeEnvs}
          selected={selectedEnvId}
          nodeUrl={providerUrlForNodeInfo}
          onChange={handleEnvironmentSelect}
        />
      </div>
    </>
  )
}
