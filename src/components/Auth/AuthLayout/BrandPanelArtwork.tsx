import { useLingui } from '@lingui/react'
import type { SVGProps } from 'react'

export type BrandPanelIconVariant =
  | 'marketplace'
  | 'access'
  | 'interop'
  | 'compute'

interface BrandPanelIconProps extends SVGProps<SVGSVGElement> {
  variant: BrandPanelIconVariant
}

export function BrandPanelIcon({ variant, ...props }: BrandPanelIconProps) {
  useLingui()

  switch (variant) {
    case 'marketplace':
      return (
        <svg viewBox="0 0 24 24" fill="none" {...props}>
          <path
            d="M4 7h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6 4h12l2 3v11a2 2 0 01-2 2H6a2 2 0 01-2-2V7l2-3z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 11h6M9 15h3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'access':
      return (
        <svg viewBox="0 0 24 24" fill="none" {...props}>
          <rect
            x="4"
            y="11"
            width="16"
            height="9"
            rx="2"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M8 11V8a4 4 0 018 0v3M12 14v3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'interop':
      return (
        <svg viewBox="0 0 24 24" fill="none" {...props}>
          <rect
            x="3"
            y="5"
            width="7"
            height="6"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="2"
          />
          <rect
            x="14"
            y="5"
            width="7"
            height="6"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="2"
          />
          <rect
            x="8.5"
            y="14"
            width="7"
            height="5"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M10 8h4M12 11v3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'compute':
      return (
        <svg viewBox="0 0 24 24" fill="none" {...props}>
          <rect
            x="4"
            y="5"
            width="16"
            height="10"
            rx="2"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M8 19h8M12 15v4M10 9h4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
  }
}

export function BrandPanelWaves(props: SVGProps<SVGSVGElement>) {
  useLingui()

  return (
    <svg viewBox="0 0 500 200" preserveAspectRatio="none" {...props}>
      <path
        d="M0 80 Q125 40 250 80 T500 80 V200 H0Z"
        fill="rgba(97,165,194,0.12)"
      />
      <path
        d="M0 110 Q125 70 250 110 T500 110 V200 H0Z"
        fill="rgba(97,165,194,0.08)"
      />
      <path
        d="M0 140 Q125 100 250 140 T500 140 V200 H0Z"
        fill="rgba(97,165,194,0.05)"
      />
    </svg>
  )
}
