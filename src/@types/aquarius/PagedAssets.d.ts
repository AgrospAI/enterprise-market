interface PagedAssets {
  partial?: boolean
  results: Asset[]
  page: number
  totalPages: number
  totalResults: number
  aggregations: any
}
