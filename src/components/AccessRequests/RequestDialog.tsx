import { translate } from '../../i18n/translate'
import { useLingui } from '@lingui/react'
import { i18n } from '../../i18n/index'
import { requestStatus } from '@utils/accessRequests/status'
import { useAsset } from '@context/Asset'
import RequestAssetCell from './RequestAssetCell'
import {
  rememberActivation,
  submittedActivation
} from '@utils/accessRequests/transactions'
import { ReactElement, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount, useChainId } from 'wagmi'
import { JSON_WALLET_CONNECTOR_ID } from '@utils/wallet/jsonWalletConnector'
import axios from 'axios'
import Modal from '@shared/atoms/Modal'
import Button from '@shared/atoms/Button'
import Loader from '@shared/atoms/Loader'
import ExplorerLink from '@shared/ExplorerLink'
import Web3Feedback from '@shared/Web3Feedback'
import { useEthersSigner } from '@hooks/useEthersSigner'
import { useSsiWallet } from '@context/SsiWallet'
import { useUserPreferences } from '@context/UserPreferences'
import WalletLabel from './WalletLabel'
import RequestServiceDetails from './RequestServiceDetails'
import {
  ServiceTerms,
  validateServiceTerms
} from '@utils/accessRequests/service'
import { Service } from 'src/@types/ddo/Service'
import { AccessRequest, AccessRequestStatus } from 'src/@types/AccessRequest'
import { RegistryConfig } from '@utils/accessRequests/config'
import {
  sameAddress,
  readRequest,
  nftOwner,
  authorizeMetadata
} from '@utils/accessRequests/client'
import {
  activateRequest,
  observePermission,
  reviewActivation,
  ReviewChangedError
} from '@utils/accessRequests/activate'
import {
  useRegistryMutation,
  accessRequestKey,
  useChainTime
} from '@hooks/useAccessRequests'
import styles from './index.module.css'
import reviewStyles from './RequestDialog.module.css'

// Stored terms remain viewable if current asset verification is temporarily unavailable.
// Approval always uses the fully verified review below.
function storedTerms(request: AccessRequest): ServiceTerms | undefined {
  try {
    const value = JSON.parse(request.serviceTerms || 'null')
    return validateServiceTerms(value, {
      type: value?.compute ? 'compute' : 'access',
      compute: value?.compute
    } as Service)
  } catch {
    return undefined
  }
}

export default function RequestDialog({
  config,
  request,
  direction,
  onClose
}: {
  config: RegistryConfig
  request: AccessRequest
  direction?: 'received' | 'sent'
  onClose: () => void
}): ReactElement {
  useLingui()
  const { address: wallet, connector } = useAccount()
  const isJsonWallet = connector?.id === JSON_WALLET_CONNECTOR_ID
  const { debug } = useUserPreferences()
  const chainId = useChainId()
  const signer = useEthersSigner()
  const ssi = useSsiWallet()
  const queryClient = useQueryClient()
  const assetContext = useAsset()
  const mutation = useRegistryMutation(config)
  const time = useChainTime(config)
  const [message, setMessage] = useState('')
  const [hash, setHash] = useState<string>(() =>
    submittedActivation(config, request.id.toString())
  )
  const [busy, setBusy] = useState(false)
  const [confirmedFingerprint, setConfirmedFingerprint] = useState<string>()
  const [cancelConfirmation, setCancelConfirmation] = useState(false)
  const controller = useRef<AbortController>()
  useEffect(() => {
    const currentController = new AbortController()
    controller.current = currentController
    return () => currentController.abort()
  }, [wallet, chainId])
  const review = useQuery({
    queryKey: [
      ...accessRequestKey(
        config,
        wallet,
        request.datasetNft,
        request.datasetServiceId
      ),
      'review',
      request.id.toString()
    ],
    queryFn: async ({ signal }) => {
      const source = axios.CancelToken.source()
      const abort = () => source.cancel('Cancelled')
      signal.addEventListener('abort', abort)
      try {
        return await reviewActivation(
          config,
          request.id.toString(),
          source.token
        )
      } finally {
        signal.removeEventListener('abort', abort)
      }
    },
    retry: 1
  })
  // Read status independently: senders can still cancel when asset metadata is offline.
  const record = useQuery({
    queryKey: [
      ...accessRequestKey(config, wallet),
      'record',
      request.id.toString()
    ],
    queryFn: () => readRequest(config, request.id.toString()),
    refetchInterval: 15_000,
    retry: 1
  })
  const current = record.data || review.data?.request || request
  const ownership = useQuery({
    queryKey: [
      'accessRequests',
      config.chainId,
      'datasetOwner',
      current.datasetNft
    ],
    queryFn: () => nftOwner(config.chainId, current.datasetNft),
    refetchInterval: 30_000,
    retry: 1
  })
  const isOwner =
    sameAddress(wallet, current.receiver) && sameAddress(wallet, ownership.data)
  const isRequester = sameAddress(wallet, current.requester)
  const status = requestStatus(current, time.data)
  const disabled =
    busy || mutation.isPending || chainId !== config.chainId || !signer
  const active = review.data?.patch.active
  const isSent = direction ? direction === 'sent' : isRequester
  const requestedTerms = review.data?.terms || storedTerms(current)
  const confirmed =
    !!confirmedFingerprint && confirmedFingerprint === review.data?.fingerprint

  async function decide(action: 'reject' | 'cancel') {
    if (disabled) return
    const { signal } = controller.current
    setBusy(true)
    setMessage(
      isJsonWallet
        ? 'Signing and submitting your decision automatically.'
        : 'Confirm the decision in your wallet.'
    )
    setHash(undefined)
    try {
      // Rejection and cancellation do not depend on off-chain asset metadata.
      const fresh = await readRequest(config, request.id.toString())
      if (
        action === 'reject' &&
        (!sameAddress(wallet, fresh.receiver) ||
          !sameAddress(
            wallet,
            await nftOwner(config.chainId, fresh.datasetNft)
          ))
      )
        throw new Error(
          'Only the receiver who still owns the dataset can reject this request.'
        )
      if (signal.aborted) return
      await mutation.mutateAsync({
        action,
        args: [fresh.id],
        onSubmitted: (tx) => {
          setHash(tx)
          setMessage('Transaction submitted. Waiting for confirmation.')
        }
      })
      if (signal.aborted) return
      setCancelConfirmation(false)
      setMessage('Decision confirmed.')
      await record.refetch()
      await review.refetch()
    } catch {
      if (signal.aborted) return
      setMessage(
        'The decision could not be confirmed. Check the transaction, then retry.'
      )
    } finally {
      if (!signal.aborted) setBusy(false)
    }
  }

  async function approve() {
    if (disabled || !review.data || !confirmed) return
    setBusy(true)
    setMessage('Rechecking the requested service before signing.')
    const source = axios.CancelToken.source()
    const { signal } = controller.current
    const abort = () => source.cancel('Cancelled')
    signal.addEventListener('abort', abort)
    try {
      if (signal.aborted) return
      if (!review.data.metadataAuthorized) {
        const fresh = await reviewActivation(
          config,
          request.id.toString(),
          source.token
        )
        if (fresh.fingerprint !== review.data.fingerprint)
          throw new ReviewChangedError(
            'The asset changed. Review the updated settings before accepting.'
          )
        if (
          fresh.request.status !== AccessRequestStatus.Pending ||
          !sameAddress(fresh.owner, wallet) ||
          !sameAddress(fresh.request.receiver, wallet)
        )
          throw new Error(
            'This request can no longer be accepted by this wallet.'
          )
        if (signal.aborted) return
        if (!fresh.metadataAuthorized) {
          setMessage(
            isJsonWallet
              ? 'Authorizing the asset automatically. Approval will continue afterwards.'
              : 'Confirm the one-time asset authorization in your wallet. Approval will continue afterwards.'
          )
          await authorizeMetadata(
            config,
            current.datasetNft,
            signer,
            wallet,
            setHash
          )
          if (signal.aborted) return
          setHash(undefined)
          setMessage(
            isJsonWallet
              ? 'Authorization confirmed. Approving the request automatically.'
              : 'Authorization confirmed. Continue approving the request in your wallet.'
          )
        }
      }
      await activateRequest(
        config,
        review.data,
        signer,
        wallet,
        ssi,
        (tx) => {
          rememberActivation(config, request.id.toString(), tx)
          setHash(tx)
          setMessage(
            'Approval and metadata update submitted. Waiting for confirmation.'
          )
        },
        source.token
      )
      if (signal.aborted) return
      setMessage('Waiting for the metadata cache to index the new service.')
      const observed = await observePermission(
        config,
        request.id.toString(),
        signal
      ).catch((error) => {
        if (signal.aborted) throw error
        return false
      })
      if (signal.aborted) return
      setMessage(
        observed
          ? 'New service created.'
          : 'Could not verify the metadata cache yet. Retry verification before trying again.'
      )
      await queryClient.invalidateQueries({ queryKey: ['accessRequests'] })
      if (assetContext?.asset?.id === review.data.dataset.id) {
        await assetContext.fetchAsset(axios.CancelToken.source().token)
      }
      await record.refetch()
      await review.refetch()
    } catch (error) {
      if (signal.aborted) return
      if (error instanceof ReviewChangedError) {
        setConfirmedFingerprint(undefined)
        await review.refetch()
        setMessage(error.message)
      } else
        setMessage(
          error instanceof Error
            ? error.message
            : 'Approval could not be confirmed. Check the transaction and retry verification.'
        )
    } finally {
      signal.removeEventListener('abort', abort)
      if (!signal.aborted) setBusy(false)
    }
  }

  return (
    <Modal
      isOpen
      title={
        isSent ? i18n._('Request details') : i18n._('Review access request')
      }
      className={styles.requestModal}
      onToggleModal={onClose}
      onRequestClose={onClose}
    >
      <div className={reviewStyles.summary}>
        <div>
          <span className={styles.eyebrow}>
            {isSent ? i18n._('Sent request') : i18n._('Received request')} #
            {current.id.toString()}
          </span>
          <h3>{requestedTerms?.name || i18n._('Create service')}</h3>
        </div>
        <span className={styles.status} data-status={status}>
          {i18n._(status)}
        </span>
      </div>
      <dl className={reviewStyles.assets}>
        <div>
          <dt>{i18n._('Asset')}</dt>
          <dd>
            <RequestAssetCell
              chainId={config.chainId}
              nft={current.datasetNft}
              type="Asset"
              knownAsset={review.data?.dataset}
            />
          </dd>
        </div>
        <div>
          <dt>{isSent ? i18n._('Receiver') : i18n._('Requester')}</dt>
          <dd>
            <WalletLabel
              address={isSent ? current.receiver : current.requester}
            />
          </dd>
        </div>
      </dl>
      <dl className={reviewStyles.metadata}>
        <div>
          <dt>{i18n._('Created')}</dt>
          <dd>
            {new Date(Number(current.createdAt) * 1000).toLocaleString(
              i18n.locale
            )}
          </dd>
        </div>
        {current.decidedAt > 0n && (
          <div>
            <dt>{i18n._(status)}</dt>
            <dd>
              {new Date(Number(current.decidedAt) * 1000).toLocaleString(
                i18n.locale
              )}
            </dd>
          </div>
        )}
        {(status === 'Pending' || status === 'Expired') && (
          <div>
            <dt>
              {status === 'Expired' ? i18n._('Expired') : i18n._('Expires')}
            </dt>
            <dd>
              {new Date(Number(current.expiresAt) * 1000).toLocaleString(
                i18n.locale
              )}
            </dd>
          </div>
        )}
      </dl>
      <label className={reviewStyles.requestMessage}>
        {i18n._('Message')}{' '}
        <textarea
          className={styles.field}
          value={current.message || ''}
          placeholder={i18n._('No message provided.')}
          readOnly
          rows={4}
        />
      </label>
      {requestedTerms && (
        <RequestServiceDetails
          terms={requestedTerms}
          allowedAddress={current.requester}
          chainId={config.chainId}
        />
      )}
      {ownership.data &&
        status === 'Pending' &&
        !sameAddress(current.receiver, ownership.data) && (
          <p role="status">
            {i18n._(
              'Dataset ownership changed. This request remains in the original receiver’s history. Cancel it and create a request to the new owner.'
            )}
          </p>
        )}
      {review.isPending && <Loader />}
      {debug && review.data && !active && (
        <details>
          <summary>{i18n._('View new service details')}</summary>
          <div className={`${styles.diff} ${reviewStyles.diff}`}>
            <div>
              <strong>{i18n._('Original service')}</strong>
              <pre>{JSON.stringify(review.data.patch.before, null, 2)}</pre>
            </div>
            <div>
              <strong>{i18n._('After approval')}</strong>
              <pre>{JSON.stringify(review.data.patch.after, null, 2)}</pre>
            </div>
          </div>
        </details>
      )}
      {!isSent && isOwner && status === 'Pending' && !active && (
        <>
          <label className={styles.confirmation}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) =>
                setConfirmedFingerprint(
                  e.target.checked ? review.data?.fingerprint : undefined
                )
              }
            />{' '}
            {i18n._('I reviewed the requested service settings.')}
          </label>
        </>
      )}
      <footer className={reviewStyles.actions}>
        {!isSent && isOwner && status === 'Pending' && (
          <p className={reviewStyles.actionHint}>
            {i18n._('Accepting creates a service with these settings.')}
          </p>
        )}
        {isSent &&
          isRequester &&
          current.status === AccessRequestStatus.Pending && (
            <Button
              disabled={disabled}
              onClick={() => setCancelConfirmation(true)}
            >
              {i18n._('Cancel request')}
            </Button>
          )}
        {!isSent && isOwner && !isRequester && status === 'Pending' && (
          <>
            <Button
              disabled={
                disabled ||
                !review.data ||
                review.isError ||
                active ||
                !confirmed
              }
              onClick={approve}
            >
              {i18n._('Accept request')}
            </Button>
            <Button
              style="outlined"
              disabled={disabled}
              onClick={() => decide('reject')}
            >
              {i18n._('Reject request')}
            </Button>
          </>
        )}
        {!isSent && (review.isError || (hash && !active)) && (
          <Button
            style="text"
            disabled={busy}
            onClick={() => {
              setConfirmedFingerprint(undefined)
              review.refetch()
              time.refetch()
            }}
          >
            {i18n._('Retry verification')}
          </Button>
        )}
      </footer>
      {cancelConfirmation && (
        <Modal
          isOpen
          title={i18n._('Cancel this request?')}
          onToggleModal={() => !busy && setCancelConfirmation(false)}
          onRequestClose={() => !busy && setCancelConfirmation(false)}
        >
          <p>
            {i18n._(
              'The receiver will no longer be able to accept this request. You can send a new request later.'
            )}
          </p>
          <div role="status" aria-live="polite" aria-busy={busy}>
            {busy ? (
              <Loader
                message={translate(message)}
                noMargin
                className={styles.statusLoader}
              />
            ) : (
              translate(message)
            )}
          </div>
          <div className={styles.controls}>
            <Button disabled={disabled} onClick={() => decide('cancel')}>
              {i18n._('Confirm cancellation')}
            </Button>
            <Button
              style="text"
              disabled={busy}
              onClick={() => setCancelConfirmation(false)}
            >
              {i18n._('Keep request')}
            </Button>
          </div>
        </Modal>
      )}
      <div
        role="status"
        aria-live="polite"
        aria-busy={busy && !cancelConfirmation}
      >
        {!cancelConfirmation &&
          (busy ? (
            <Loader
              message={translate(message)}
              noMargin
              className={styles.statusLoader}
            />
          ) : (
            translate(message)
          ))}
        {!isSent && review.isError && (
          <p>
            {i18n._(
              'Could not verify asset permissions. Retry when the node is available.'
            )}
          </p>
        )}
      </div>
      {hash && (
        <ExplorerLink networkId={config.chainId} path={`tx/${hash}`}>
          {i18n._('View transaction')}
        </ExplorerLink>
      )}
      <Web3Feedback
        accountId={wallet}
        isAssetNetwork={chainId === config.chainId}
      />
    </Modal>
  )
}
