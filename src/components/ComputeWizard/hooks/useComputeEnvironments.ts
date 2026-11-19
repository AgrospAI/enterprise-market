import { i18n } from '../../../i18n/index'
import { useCallback, useEffect, useState } from 'react'
import { ComputeEnvironment } from '@oceanprotocol/lib'
import { getComputeEnvironments } from '@utils/provider'

interface UseComputeEnvironmentsParams {
  serviceEndpoint?: string
  chainId?: number
  enabled?: boolean
}

export function useComputeEnvironments({
  serviceEndpoint,
  chainId,
  enabled = true
}: UseComputeEnvironmentsParams) {
  const [computeEnvs, setComputeEnvs] = useState<ComputeEnvironment[]>([])
  const [isLoadingComputeEnvs, setIsLoadingComputeEnvs] = useState(false)
  const [computeEnvsError, setComputeEnvsError] = useState<string>()

  const fetchComputeEnvs = useCallback(async () => {
    if (!serviceEndpoint) return

    try {
      setIsLoadingComputeEnvs(true)
      setComputeEnvsError(undefined)
      const envs =
        (await getComputeEnvironments(serviceEndpoint, chainId)) || []
      setComputeEnvs(envs)
    } catch (error) {
      const message =
        (error as Error)?.message ||
        i18n._('Failed to load compute environments')
      setComputeEnvsError(message)
    } finally {
      setIsLoadingComputeEnvs(false)
    }
  }, [serviceEndpoint, chainId, i18n.locale])

  useEffect(() => {
    if (!enabled) return
    fetchComputeEnvs()
  }, [enabled, fetchComputeEnvs])

  return {
    computeEnvs,
    isLoadingComputeEnvs,
    computeEnvsError,
    refetchComputeEnvs: fetchComputeEnvs
  }
}
