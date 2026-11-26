/**
 * Truncates a DID (Decentralized Identifier) to a readable format
 * Shows first 12 characters, "..." in the middle, and last 8 characters
 * Only truncates if the DID is longer than 25 characters
 */
export function truncateDid(did: string): string {
  if (!did) return did
  return did.length > 25 ? `${did.slice(0, 12)}...${did.slice(-8)}` : did
}

/** Keep the meaningful prefix and suffix visible without changing copied values. */
export function truncateIdentifier(value: string): string {
  if (value.length <= 24) return value
  return `${value.slice(0, value.startsWith('did:') ? 16 : 8)}…${value.slice(
    -6
  )}`
}
