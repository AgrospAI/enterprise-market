import { useLingui } from '@lingui/react'
import type { SVGProps } from 'react'

export type SsoIconVariant = 'building_key' | 'user_plus'

interface SsoIconProps extends SVGProps<SVGSVGElement> {
  variant: SsoIconVariant
}

export function SsoIcon({ variant, ...props }: SsoIconProps) {
  useLingui()

  switch (variant) {
    case 'building_key':
      return (
        <svg viewBox="0 0 24 24" fill="none" {...props}>
          <path
            d="M4 20V5.5A1.5 1.5 0 015.5 4h7A1.5 1.5 0 0114 5.5V20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M7.5 8h.01M10.5 8h.01M7.5 11h.01M10.5 11h.01M9 20v-4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M15 14.5a2.5 2.5 0 115 0 2.5 2.5 0 01-5 0z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M20 14.5h1.5M21.5 14.5v1.5M18.5 14.5v3h-1.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'user_plus':
      return (
        <svg viewBox="0 0 24 24" fill="none" {...props}>
          <circle cx="10" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
          <path
            d="M4.5 19c1.4-3 3.7-4.5 5.5-4.5s4.1 1.5 5.5 4.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M18 8v6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M15 11h6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )
  }
}
