export enum AccessRequestStatus {
  Pending,
  Approved,
  Rejected,
  Cancelled
}
export interface AccessRequest {
  id: bigint
  requester: string
  receiver: string
  datasetNft: string
  datasetServiceId: string
  createdAt: bigint
  expiresAt: bigint
  decidedAt: bigint
  status: AccessRequestStatus
  message?: string
  serviceTerms?: string
  decidedBy: string
}
export type PermissionState = 'active' | 'absent' | 'unverified'
