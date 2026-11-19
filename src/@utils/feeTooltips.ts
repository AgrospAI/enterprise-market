import { i18n } from '../i18n/index'
const feeTooltipText = {
  get marketplace() {
    return i18n._('For marketplace operation & maintenance')
  },
  get provider() {
    return i18n._('For Ocean Node operator(s)')
  },
  get oec() {
    return i18n._(
      'For Ocean Enterprise Collective e.V. maintaining and developing the OE basecode'
    )
  }
}

export function getFeeTooltip(label?: string): string | undefined {
  if (!label) return undefined

  const normalized = label.toLowerCase()

  if (normalized.includes('oec fee')) return feeTooltipText.oec
  if (normalized.includes('provider fee')) return feeTooltipText.provider
  if (normalized.includes('market') && normalized.includes('fee'))
    return feeTooltipText.marketplace

  return undefined
}
