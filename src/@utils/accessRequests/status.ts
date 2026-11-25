import { AccessRequest, AccessRequestStatus } from 'src/@types/AccessRequest'

export function requestStatus(request: AccessRequest, now?: bigint): string {
  if (request.status === AccessRequestStatus.Pending)
    return now === undefined
      ? 'Could not verify expiry'
      : now >= request.expiresAt
      ? 'Expired'
      : 'Pending'
  return (
    ['Pending', 'Approved', 'Rejected', 'Cancelled'][request.status] ||
    'Could not verify'
  )
}
