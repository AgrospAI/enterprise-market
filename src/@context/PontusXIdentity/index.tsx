import { useLingui } from '@lingui/react'
import {
  createContext,
  ReactElement,
  ReactNode,
  useCallback,
  useContext,
  useMemo
} from 'react'
import { usePontusXRegistry } from '@deltadao/pontusx-registry-hooks'
import { pontusXRegistryUrl } from '../../../app.config.cjs'

type LegalNameResolver = (address: string) => string | undefined

export interface PublisherIdentity {
  address: string
  name: string
}
const PublisherIdentitiesContext = createContext<PublisherIdentity[]>([])

const PontusXIdentityContext = createContext<LegalNameResolver>(() => undefined)

function PontusXIdentityResolver({
  children
}: {
  children: ReactNode
}): ReactElement {
  useLingui()

  const { data } = usePontusXRegistry({ apiBaseUrl: pontusXRegistryUrl })

  const byAddress = useMemo(() => {
    const map = new Map<string, string>()
    data?.forEach((identity) => {
      if (identity.legalName) {
        map.set(identity.walletAddress.toLowerCase(), identity.legalName)
      }
    })
    return map
  }, [data])

  const getLegalName = useCallback<LegalNameResolver>(
    (address) => byAddress.get(address?.toLowerCase()),
    [byAddress]
  )

  return (
    <PontusXIdentityContext.Provider value={getLegalName}>
      <PublisherIdentitiesContext.Provider
        value={Array.from(byAddress, ([address, name]) => ({ address, name }))}
      >
        {children}
      </PublisherIdentitiesContext.Provider>
    </PontusXIdentityContext.Provider>
  )
}

/**
 * Resolves wallet addresses to legal names via the Pontus-X registry.
 * Without `NEXT_PUBLIC_PONTUSX_REGISTRY_URL` the registry is never queried.
 */
export function PontusXIdentityProvider({
  children
}: {
  children: ReactNode
}): ReactElement {
  useLingui()

  if (!pontusXRegistryUrl) return <>{children}</>

  return <PontusXIdentityResolver>{children}</PontusXIdentityResolver>
}

export function usePontusXLegalName(address?: string): string | undefined {
  const getLegalName = useContext(PontusXIdentityContext)
  return address ? getLegalName(address) : undefined
}

export function usePublisherIdentities(): PublisherIdentity[] {
  return useContext(PublisherIdentitiesContext)
}
