import { displayAssetState } from '@utils/assetState'
import { useLingui } from '@lingui/react'
import styles from './Option.module.css'
import { ipfsGateway } from 'app.config.cjs'
import { IpfsRemoteSource } from '@components/@shared/IpfsRemoteSource'

export default function Option({
  option,
  prefix,
  postfix,
  action
}: {
  option: string
  prefix?: string
  postfix?: string
  action?: string
}) {
  const { i18n } = useLingui()

  let ipfsMirror = null
  if (action && action.startsWith(ipfsGateway)) {
    const ipfsCid = action.slice(ipfsGateway.length + 1) // +1 for the slash
    ipfsMirror = { type: 'ipfs', ipfsCid }
  }

  return (
    <>
      {prefix && `${prefix} `}
      {ipfsMirror ? (
        <IpfsRemoteSource
          noDocumentLabel={i18n._('No license document available')}
          remoteSource={ipfsMirror}
          name={i18n._('License Terms')}
          className={styles.inlineAction}
        />
      ) : action ? (
        <a
          href={action}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.actionButton}
        >
          {option === 'OrderingIsTemporaryDisabled'
            ? displayAssetState(option)
            : i18n._(option)}
        </a>
      ) : (
        <>
          {option === 'OrderingIsTemporaryDisabled'
            ? displayAssetState(option)
            : i18n._(option)}
        </>
      )}
      {postfix && ` ${postfix}`}
    </>
  )
}
