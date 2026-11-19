import { useLingui } from '@lingui/react'
import { ReactElement } from 'react'
import Menu from './Menu'

export default function Header(): ReactElement {
  useLingui()

  return (
    <header>
      <Menu />
    </header>
  )
}
