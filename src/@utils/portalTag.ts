import queryFilterConfig from '../../queryFilter.config.cjs'

/**
 * Tag that scopes this portal's catalogue. It is read from
 * queryFilter.config.cjs so the catalogue filter and the tag forced on
 * publish/edit can never drift apart.
 */
export const PORTAL_TAG: string | undefined =
  queryFilterConfig?.credentialSubject?.metadata?.tags?.keyword

/**
 * Returns the given tags with the portal tag appended when missing, so every
 * asset published or edited from this portal stays visible in its catalogue.
 */
export function withPortalTag(tags?: string[]): string[] {
  const list = (tags ?? []).filter(Boolean)
  if (!PORTAL_TAG) return list
  const hasTag = list.some(
    (tag) => tag.toLowerCase() === PORTAL_TAG.toLowerCase()
  )
  return hasTag ? list : [...list, PORTAL_TAG]
}

/** Tags without the portal tag, e.g. to look for genuinely related assets. */
export function withoutPortalTag(tags?: string[]): string[] {
  return (tags ?? []).filter(
    (tag) => !PORTAL_TAG || tag?.toLowerCase() !== PORTAL_TAG.toLowerCase()
  )
}
