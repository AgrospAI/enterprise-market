import { i18n } from '../../../i18n/index'
import { useCallback, useEffect, useState } from 'react'
import { getComputeJobs } from '@utils/compute'
import { Asset } from 'src/@types/Asset'
import { Service } from 'src/@types/ddo/Service'
import { AssetExtended } from 'src/@types/AssetExtended'
import { CancelToken } from 'axios'
import type { Signer } from 'ethers'

interface UseComputeJobsParams {
  asset: AssetExtended
  service: Service
  ownerAddress?: string
  signer?: Signer
  chainIds?: number[]
  refreshIntervalMs?: number
  cancelTokenFactory: () => CancelToken
}

export function useComputeJobs({
  asset,
  service,
  ownerAddress,
  signer,
  chainIds,
  refreshIntervalMs = 10000,
  cancelTokenFactory
}: UseComputeJobsParams) {
  const [jobs, setJobs] = useState<any[]>([])
  const [isLoadingJobs, setIsLoadingJobs] = useState(false)
  const [computeJobsError, setComputeJobsError] = useState<string>()

  const fetchJobs = useCallback(
    async (type: 'init' | 'poll' = 'poll') => {
      if (!chainIds || chainIds.length === 0 || !ownerAddress || !signer) return
      try {
        if (type === 'init') {
          setIsLoadingJobs(true)
        }
        const result = await getComputeJobs(
          asset.credentialSubject?.chainId !== undefined
            ? [asset.credentialSubject.chainId]
            : chainIds,
          ownerAddress,
          signer,
          asset as unknown as Asset,
          service,
          cancelTokenFactory()
        )

        setJobs(result.computeJobs)
        setIsLoadingJobs(!result.isLoaded)
      } catch (error) {
        const message =
          (error as Error)?.message || i18n._('Failed to fetch compute jobs')
        setComputeJobsError(message)
        if (type === 'init') {
          setIsLoadingJobs(false)
        }
      }
    },
    [
      asset,
      service,
      chainIds,
      ownerAddress,
      cancelTokenFactory,
      signer,
      i18n.locale
    ]
  )

  useEffect(() => {
    fetchJobs('init')

    const interval = setInterval(() => {
      fetchJobs('poll')
    }, refreshIntervalMs)

    return () => clearInterval(interval)
  }, [fetchJobs, refreshIntervalMs])

  return {
    jobs,
    isLoadingJobs,
    computeJobsError,
    refetchJobs: fetchJobs
  }
}
