import { useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import shared from './shared.module.css'

interface SectionHeaderProps {
  id: string
  title: string
  titleMuted?: string
  intro?: string
  centered?: boolean
}

// two-tone headline and an optional intro set beside it
export default function SectionHeader({
  id,
  title,
  titleMuted,
  intro,
  centered
}: SectionHeaderProps): ReactElement {
  useLingui()

  return (
    <header
      className={`${shared.header} ${shared.reveal}`}
      data-has-intro={Boolean(intro) || undefined}
      data-align={centered ? 'center' : undefined}
    >
      <h2 id={id} className={shared.title}>
        {title}
        {titleMuted && (
          <>
            {' '}
            <span className={shared.titleMuted}>{titleMuted}</span>
          </>
        )}
      </h2>
      {intro && <p className={shared.intro}>{intro}</p>}
    </header>
  )
}
