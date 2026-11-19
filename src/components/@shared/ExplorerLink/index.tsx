import { useLingui } from '@lingui/react'
import { i18n } from '../../../i18n/index'
import { ReactElement, ReactNode, useEffect, useState } from 'react'
import External from '@images/external.svg'
import { Config } from '@oceanprotocol/lib'
import styles from './index.module.css'
import { getOceanConfig } from '@utils/ocean'

export default function ExplorerLink({
  networkId,
  path,
  children,
  className
}: {
  networkId: number
  path: string
  children: ReactNode
  className?: string
}): ReactElement {
  useLingui()

  const [url, setUrl] = useState<string>()
  const [oceanConfig, setOceanConfig] = useState<Config>()

  useEffect(() => {
    if (!networkId) return

    const oceanConfig = getOceanConfig(networkId)
    setOceanConfig(oceanConfig)
    setUrl(oceanConfig?.explorerUri)
  }, [networkId])

  return (
    <a
      href={`${url}/${path}`}
      title={i18n._('View on {value0}', { value0: oceanConfig?.explorerUri })}
      target="_blank"
      rel="noreferrer"
      className={`${styles.link} ${className || ''}`}
    >
      {children} <External />
    </a>
  )
}
