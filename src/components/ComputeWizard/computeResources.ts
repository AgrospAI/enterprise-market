import { ComputeEnvironment } from '@oceanprotocol/lib'
import { ResourceType } from 'src/@types/ResourceType'

/** The resources to request from the node for a job, free or paid. */
export function buildResourceRequests(
  selectedComputeEnv: ComputeEnvironment,
  selectedResources: ResourceType
) {
  const normalizeResourceKey = (
    res: ComputeEnvironment['resources'][number]
  ): string => {
    const resourceId = res.id?.toLowerCase() || ''
    if (res.type === 'gpu' || resourceId.includes('gpu')) return 'gpu'
    if (resourceId.includes('cpu')) return 'cpu'
    if (resourceId.includes('ram')) return 'ram'
    if (resourceId.includes('disk')) return 'disk'
    return res.id
  }

  const resolveSelectedAmount = (
    res: ComputeEnvironment['resources'][number]
  ): number => {
    const resourceKey = normalizeResourceKey(res)
    if (resourceKey === 'gpu') {
      return Number(selectedResources.gpu ?? 0)
    }
    if (resourceKey === 'cpu')
      return Number(selectedResources.cpu ?? res.min ?? 0)
    if (resourceKey === 'ram')
      return Number(selectedResources.ram ?? res.min ?? 0)
    if (resourceKey === 'disk')
      return Number(selectedResources.disk ?? res.min ?? 0)
    return Number((selectedResources as any)[res.id] ?? res.min ?? 0)
  }

  const uniqueResources = (
    resources: ComputeEnvironment['resources']
  ): ComputeEnvironment['resources'] => {
    const seen = new Set<string>()
    return resources.filter((res) => {
      const key = normalizeResourceKey(res)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  if (selectedResources.mode === 'free') {
    const freeResources = selectedComputeEnv.free?.resources?.length
      ? selectedComputeEnv.free.resources
      : selectedComputeEnv.resources

    return uniqueResources(freeResources).map((res) => ({
      id: res.id,
      amount: resolveSelectedAmount(res)
    }))
  }

  return uniqueResources(selectedComputeEnv.resources).map((res) => ({
    id: res.id,
    amount: resolveSelectedAmount(res)
  }))
}
