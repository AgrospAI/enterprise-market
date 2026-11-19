import { Asset } from 'src/@types/Asset'

export interface AquariusQueryResult {
  results?: Asset[]
  totalResults?: number
  aggregations?: unknown
}

export function getQueryResult(
  responseData: unknown
): AquariusQueryResult | undefined {
  // Older nodes return [AquariusQueryResult], while newer Elasticsearch
  // nodes return arrays of DDOs grouped by schema (including [] when empty).
  if (Array.isArray(responseData)) {
    const [first] = responseData
    if (
      first &&
      typeof first === 'object' &&
      !Array.isArray(first) &&
      'results' in first
    ) {
      return first as AquariusQueryResult
    }
    const results = responseData.flat().filter((asset) => asset?.id) as Asset[]
    return { results, totalResults: results.length }
  }

  return responseData && typeof responseData === 'object'
    ? (responseData as AquariusQueryResult)
    : undefined
}
