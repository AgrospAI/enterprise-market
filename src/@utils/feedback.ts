import { i18n } from '../i18n/index'
// TODO: can be better
export function getOrderFeedback(
  baseTokenSymbol: string,
  datatokenSymbol: string
): { [key in number]: string } {
  return {
    0: i18n._('Approving and buying one {datatokenSymbol}', {
      datatokenSymbol
    }),
    1: i18n._('Ordering asset'),
    2: i18n._('Approving {baseTokenSymbol} and ordering asset', {
      baseTokenSymbol
    }),
    3: i18n._('Generating signature to access download url')
  }
}

export function getComputeFeedback(
  baseTokenSymbol?: string,
  datatokenSymbol?: string,
  assetType?: string
): { [key in number]: string } {
  return {
    0: i18n._('Setting price and fees for {assetType}', {
      assetType
    }),
    1: i18n._('Approving {datatokenSymbol} and ordering {assetType} ', {
      datatokenSymbol,
      assetType
    }),
    2: i18n._('Approving {baseTokenSymbol} and ordering {assetType}', {
      baseTokenSymbol,
      assetType
    }),
    3: i18n._('Ordering {assetType}', { assetType }),
    4: i18n._('Generating signature. Starting compute job ...')
  }
}
