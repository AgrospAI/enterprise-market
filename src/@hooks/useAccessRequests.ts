import { useEffect, useRef } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import { useAccount, useChainId } from 'wagmi'
import { useEthersSigner } from './useEthersSigner'
import {
  registryConfiguration,
  RegistryConfig
} from '@utils/accessRequests/config'
import { readRequestPage, registryWrite } from '@utils/accessRequests/client'

export function accessRequestKey(
  config?: RegistryConfig,
  wallet?: string,
  nft?: string,
  serviceId?: string
) {
  return [
    'accessRequests',
    config?.chainId,
    config?.address,
    wallet?.toLowerCase(),
    nft?.toLowerCase(),
    serviceId
  ]
}

export function useAccessRequestConfig(chainId: number) {
  return registryConfiguration(chainId)
}

export function useRequestPages(
  config: RegistryConfig | undefined,
  scope: 'requester' | 'receiver' | 'dataset',
  address?: string,
  serviceId?: string
) {
  const { address: wallet } = useAccount()
  return useInfiniteQuery({
    queryKey: [
      ...accessRequestKey(
        config,
        wallet,
        scope === 'dataset' ? address : undefined,
        serviceId
      ),
      scope,
      address?.toLowerCase()
    ],
    enabled: !!config && !!address,
    initialPageParam: '0',
    queryFn: ({ pageParam, signal }) =>
      readRequestPage(config, scope, address, pageParam, signal),
    getNextPageParam: (page) => page.next,
    refetchInterval: 30_000,
    retry: 1
  })
}

export function useRegistryMutation(config: RegistryConfig) {
  const { address: wallet } = useAccount()
  const chainId = useChainId()
  const signer = useEthersSigner()
  const queryClient = useQueryClient()
  const current = useRef({ wallet, chainId, alive: true })
  current.current = { wallet, chainId, alive: true }
  useEffect(() => {
    current.current.alive = true
    return () => {
      current.current.alive = false
    }
  }, [])
  return useMutation({
    mutationKey: accessRequestKey(config, wallet),
    mutationFn: async ({
      action,
      args,
      onSubmitted
    }: {
      action: 'createServiceRequest' | 'reject' | 'cancel' | 'markSeen'
      args: unknown[]
      onSubmitted?: (hash: string) => void
    }) => {
      if (!wallet || chainId !== config.chainId)
        throw new Error('Connect your wallet on OP Sepolia.')
      return registryWrite(
        config,
        signer,
        wallet,
        action,
        args,
        onSubmitted,
        () => {
          if (
            !current.current.alive ||
            current.current.wallet !== wallet ||
            current.current.chainId !== chainId
          )
            throw new Error('Wallet or network changed. Review again.')
        }
      )
    },
    onMutate: async ({ action, args }) => {
      if (action !== 'markSeen') return
      const queryKey = [
        'accessRequests',
        config.chainId,
        config.address,
        wallet?.toLowerCase(),
        'notifications'
      ]
      await queryClient.cancelQueries({ queryKey, exact: true })
      const id = String(args[0])
      const previous =
        queryClient.getQueryData<
          Record<'unread' | 'received' | 'sent', Record<string, number>>
        >(queryKey)
      queryClient.setQueryData<typeof previous>(queryKey, (data) => {
        if (!data) return data
        const next = { ...data }
        for (const direction of ['unread', 'received', 'sent'] as const) {
          next[direction] = { ...data[direction] }
          delete next[direction][id]
        }
        return next
      })
      return { queryKey, id, previous }
    },
    onError: (_error, _variables, context) => {
      if (!context?.previous) return
      queryClient.setQueryData<typeof context.previous>(
        context.queryKey,
        (data) => {
          const next = { ...(data || context.previous) }
          for (const direction of ['unread', 'received', 'sent'] as const) {
            const revision = context.previous[direction][context.id]
            if (revision) {
              next[direction] = {
                ...next[direction],
                [context.id]: next[direction][context.id] || revision
              }
            }
          }
          return next
        }
      )
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['accessRequests', config.chainId, config.address]
      })
    }
  })
}

export function useChainTime(config?: RegistryConfig) {
  return useQuery({
    queryKey: ['accessRequests', config?.chainId, config?.address, 'chainTime'],
    enabled: !!config,
    queryFn: async () => {
      const { getOrCreateProvider } = await import('@utils/wallet')
      return BigInt(
        (await getOrCreateProvider(config.chainId).getBlock('latest')).timestamp
      )
    },
    refetchInterval: 15_000
  })
}
