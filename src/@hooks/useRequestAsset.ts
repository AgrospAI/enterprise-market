import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import { generateBaseQuery, getAsset, queryMetadata } from '@utils/aquarius'
import { Asset } from 'src/@types/Asset'

/** Shared metadata cache for request identities, searching and sorting. */
export function requestAssetQuery(chainId: number, nft?: string, did?: string) {
  return {
    queryKey: ['requestAssetLabel', chainId, did || nft?.toLowerCase()],
    enabled: !!did || (!!nft && !/^0x0+$/.test(nft)),
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async ({ signal }: { signal: AbortSignal }): Promise<Asset> => {
      const source = axios.CancelToken.source()
      const abort = () => source.cancel('Asset lookup cancelled')
      signal.addEventListener('abort', abort)
      try {
        if (signal.aborted) throw new Error('Asset lookup cancelled')
        if (did) return await getAsset(did, source.token)
        const result = await queryMetadata(
          generateBaseQuery({
            chainIds: [chainId],
            filters: [
              {
                term: {
                  'credentialSubject.nftAddress': {
                    value: nft.toLowerCase(),
                    case_insensitive: true
                  }
                }
              }
            ],
            ignoreState: true,
            esPaginationOptions: { from: 0, size: 2 }
          } as BaseQueryParams),
          source.token
        )
        if (result?.partial || result?.results?.length !== 1)
          throw new Error('Asset metadata unavailable')
        return result.results[0]
      } finally {
        signal.removeEventListener('abort', abort)
      }
    }
  }
}

export default function useRequestAsset(
  chainId: number,
  nft?: string,
  did?: string,
  knownAsset?: Asset
) {
  const options = requestAssetQuery(chainId, nft, did)
  return useQuery({ ...options, enabled: !knownAsset && options.enabled })
}
