import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount, useChainId } from 'wagmi'
import { registry } from '@utils/accessRequests/client'
import { useAccessRequestConfig } from './useAccessRequests'

/** Unread latest activity per request, persisted by the registry for this wallet. */
export function useRequestNotifications(direction?: 'received' | 'sent') {
  const { address: wallet } = useAccount()
  const chainId = useChainId()
  const queryClient = useQueryClient()
  const { config } = useAccessRequestConfig(chainId)
  return useQuery({
    queryKey: [
      'accessRequests',
      chainId,
      config?.address,
      wallet?.toLowerCase(),
      'notifications'
    ],
    enabled: !!wallet && !!config,
    queryFn: async ({ signal }) => {
      const contract = await registry(config)
      const blockTag = await contract.runner.provider.getBlockNumber()
      const incoming = BigInt(
        await contract.receiverCount(wallet, { blockTag })
      )
      const unread: Record<string, number> = {}
      const received: Record<string, number> = {}
      const sent: Record<string, number> = {}
      let offset = 0n
      let total: bigint
      do {
        const [ids, revisions, count] = await contract.notificationPage(
          wallet,
          offset,
          50,
          { blockTag }
        )
        total = BigInt(count)
        ids.forEach((id: bigint, index: number) => {
          const revision = Number(revisions[index])
          if (revision) {
            unread[id.toString()] = revision
            const inbox = offset + BigInt(index) < incoming ? received : sent
            inbox[id.toString()] = revision
          }
        })
        offset += 50n
      } while (offset < total)
      // Polling must not restore activity while its acknowledgement is pending.
      for (const mutation of queryClient.getMutationCache().findAll({
        mutationKey: [
          'accessRequests',
          chainId,
          config.address,
          wallet?.toLowerCase()
        ],
        status: 'pending'
      })) {
        const variables = mutation.state.variables as {
          action?: string
          args?: unknown[]
        }
        if (variables?.action !== 'markSeen') continue
        const id = String(variables.args?.[0])
        const revision = Number(variables.args?.[1])
        for (const inbox of [unread, received, sent]) {
          if (inbox[id] === revision) delete inbox[id]
        }
      }
      signal.throwIfAborted()
      return { unread, received, sent }
    },
    select: (data) => (direction ? data[direction] : data.unread),
    refetchInterval: 15_000,
    retry: 1
  })
}
