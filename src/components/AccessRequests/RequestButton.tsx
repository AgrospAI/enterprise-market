import { translate } from '../../i18n/translate'
import { useLingui } from '@lingui/react'
import { i18n } from '../../i18n/index'
import { ReactElement, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount, useChainId } from 'wagmi'
import { ZeroAddress, isAddress } from 'ethers'
import axios from 'axios'
import Select from 'react-select'
import selectStyles from '@shared/MultiSelect/index.module.css'
import BoxSelection from '@shared/FormInput/InputElement/BoxSelection'
import IconDownload from '@images/download2.svg'
import IconCompute from '@images/compute.svg'
import Button from '@shared/atoms/Button'
import Modal from '@shared/atoms/Modal'
import Loader from '@shared/atoms/Loader'
import MultiSelect, { SelectOption } from '@shared/MultiSelect'
import ExplorerLink from '@shared/ExplorerLink'
import Web3Feedback from '@shared/Web3Feedback'
import { useUserPreferences } from '@context/UserPreferences'
import { usePublisherIdentities } from '@context/PontusXIdentity'
import { Asset } from 'src/@types/Asset'
import { Service } from 'src/@types/ddo/Service'
import {
  useAccessRequestConfig,
  useRegistryMutation,
  accessRequestKey
} from '@hooks/useAccessRequests'
import { nftOwner, sameAddress } from '@utils/accessRequests/client'
import {
  configuredEndpoint,
  resolveRequestAsset,
  validateRequestedAlgorithms
} from '@utils/accessRequests/activate'
import {
  ServiceTerms,
  validateServiceTerms
} from '@utils/accessRequests/service'
import { getAccessDetails } from '@utils/accessDetailsAndPricing'
import { getOceanConfig } from '@utils/ocean'
import { createTrustedAlgorithmList } from '@utils/compute'
import {
  getAsset,
  generateBaseQuery,
  getFilterTerm,
  queryMetadata
} from '@utils/aquarius'
import { RegistryConfig } from '@utils/accessRequests/config'
import { isNftActive } from '@utils/assetState'
import { JSON_WALLET_CONNECTOR_ID } from '@utils/wallet/jsonWalletConnector'
import styles from './index.module.css'
import { truncateIdentifier } from '@utils/string'
import WalletLabel from './WalletLabel'
import AccessTermsFields from './AccessTermsFields'

function ServiceRequestFields({
  config,
  asset,
  source,
  defaults,
  onLock,
  onSubmitted,
  onClose
}: {
  config: RegistryConfig
  asset: Asset
  source: Service
  defaults: ServiceTerms
  onSubmitted: () => void
  onLock: (locked: boolean) => void
  onClose: () => void
}): ReactElement {
  useLingui()
  const { address: wallet, connector } = useAccount()
  const chainId = useChainId()
  const { debug } = useUserPreferences()
  const mutation = useRegistryMutation(config)
  const identities = usePublisherIdentities()
  const [terms, setTerms] = useState(defaults)
  const [requestMessage, setRequestMessage] = useState('')
  const publisherOption = (address: string): SelectOption =>
    address === '*'
      ? { value: address, label: i18n._('All publishers') }
      : {
          value: address,
          label:
            identities.find(
              (p) => p.address.toLowerCase() === address.toLowerCase()
            )?.name || i18n._('Wallet'),
          description: truncateIdentifier(address),
          href: `/profile/${address}`
        }
  const [algorithms, setAlgorithms] = useState<SelectOption[]>(() =>
    (source.compute?.publisherTrustedAlgorithms || []).map((a) => ({
      value: JSON.stringify({ algoDid: a.did, serviceId: a.serviceId }),
      label:
        a.did === '*'
          ? i18n._('Any published algorithm')
          : i18n._('Algorithm service {serviceId}', {
              serviceId: truncateIdentifier(a.serviceId)
            }),
      ...(a.did !== '*' && {
        description: truncateIdentifier(a.did),
        href: `/asset/${a.did}`
      })
    }))
  )
  const [publishers, setPublishers] = useState(
    source.compute?.publisherTrustedAlgorithmPublishers || []
  )
  const [search, setSearch] = useState('')
  const [term, setTerm] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  useEffect(() => onLock(busy || sent), [busy, sent, onLock])
  const [message, setMessage] = useState('')
  const [hash, setHash] = useState<string>()
  const controller = useRef<AbortController>()
  useEffect(() => {
    const currentController = new AbortController()
    controller.current = currentController
    return () => currentController.abort()
  }, [wallet, chainId])
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search), 300)
    return () => clearTimeout(timer)
  }, [search])
  const matches = useQuery({
    queryKey: [...accessRequestKey(config, wallet), 'algorithms', term],
    enabled: (terms.type ?? source.type) === 'compute',
    queryFn: async ({ signal }) => {
      const cancel = axios.CancelToken.source()
      const abort = () => cancel.cancel('Cancelled')
      signal.addEventListener('abort', abort)
      try {
        return await queryMetadata(
          generateBaseQuery({
            chainIds: [config.chainId],
            filters: [
              getFilterTerm('credentialSubject.metadata.type', 'algorithm'),
              getFilterTerm('credentialSubject.services.type', 'compute'),
              ...(term
                ? [
                    getFilterTerm(
                      'credentialSubject.metadata.name',
                      term,
                      'match'
                    )
                  ]
                : [])
            ],
            esPaginationOptions: { from: 0, size: 25 }
          } as BaseQueryParams),
          cancel.token
        )
      } finally {
        signal.removeEventListener('abort', abort)
      }
    }
  })
  const selectedAssets = useQuery({
    queryKey: [
      ...accessRequestKey(config, wallet),
      'selected-algorithms',
      algorithms.map((a) => a.value)
    ],
    enabled: algorithms.length > 0,
    queryFn: async ({ signal }) => {
      const cancel = axios.CancelToken.source()
      const abort = () => cancel.cancel('Cancelled')
      signal.addEventListener('abort', abort)
      try {
        return await Promise.all(
          [
            ...new Set(
              algorithms
                .map((a) => JSON.parse(a.value).algoDid as string)
                .filter((did) => did !== '*')
            )
          ].map((did) => getAsset(did, cancel.token))
        )
      } finally {
        signal.removeEventListener('abort', abort)
      }
    }
  })
  async function submit() {
    if (busy || sent || !wallet || chainId !== config.chainId) return
    setBusy(true)
    setMessage('Checking the source service and requested settings.')
    const cancel = axios.CancelToken.source()
    const { signal } = controller.current
    const abort = () => cancel.cancel('Cancelled')
    signal.addEventListener('abort', abort)
    try {
      if (signal.aborted) throw new Error('Cancelled')
      const fresh = await resolveRequestAsset(
        config.chainId,
        asset.credentialSubject.nftAddress,
        cancel.token
      )
      const service = fresh.credentialSubject.services.find(
        (s) => s.id === source.id
      )
      if (
        !service ||
        !isNftActive(service.state) ||
        JSON.stringify(service) !== JSON.stringify(source)
      )
        throw new Error(
          'The original service changed. Close this form and review a new request.'
        )
      const receiver = await nftOwner(
        config.chainId,
        asset.credentialSubject.nftAddress
      )
      if (sameAddress(receiver, wallet))
        throw new Error('Asset owners can add services directly.')
      let { compute } = terms
      if (compute) {
        // Existing descriptors keep their defaults; only newly selected algorithms need checksums.
        const existing = source.compute?.publisherTrustedAlgorithms || []
        const selected = await Promise.all(
          algorithms.map(async (option) => {
            const selection = JSON.parse(option.value)
            const original = existing.find(
              (a) =>
                a.did === selection.algoDid &&
                a.serviceId === selection.serviceId
            )
            if (original) return original
            const cached = await getAsset(selection.algoDid, cancel.token)
            const selectedService = cached?.credentialSubject.services.find(
              (s) => s.id === selection.serviceId
            )
            if (
              cached?.credentialSubject.chainId !== config.chainId ||
              cached.credentialSubject.metadata.type !== 'algorithm' ||
              selectedService?.type !== 'compute' ||
              !isNftActive(selectedService.state) ||
              !configuredEndpoint(selectedService.serviceEndpoint)
            )
              throw new Error(
                'The selected algorithm service is unavailable or uses an unconfigured node.'
              )
            const [descriptor] = await createTrustedAlgorithmList(
              [option.value],
              config.chainId,
              cancel.token
            )
            return descriptor
          })
        )
        compute = {
          ...compute,
          allowAllPublishedAlgorithms: false,
          publisherTrustedAlgorithms: selected,
          publisherTrustedAlgorithmPublishers: publishers
        }
      }
      const proposal = validateServiceTerms(
        {
          ...terms,
          ...(compute && { compute })
        },
        service
      )
      await validateRequestedAlgorithms(
        proposal,
        service,
        config.chainId,
        cancel.token
      )
      if (new TextEncoder().encode(requestMessage).length > 2048)
        throw new Error('Message must be 2048 bytes or fewer.')
      const json = JSON.stringify(proposal)
      if (new TextEncoder().encode(json).length > 16384)
        throw new Error('Too many selected algorithms or publishers.')
      if (signal.aborted) throw new Error('Cancelled')
      setMessage(
        connector?.id === JSON_WALLET_CONNECTOR_ID
          ? 'Signing and submitting your request automatically.'
          : 'Confirm the new service request in your wallet.'
      )
      await mutation.mutateAsync({
        action: 'createServiceRequest',
        args: [
          asset.credentialSubject.nftAddress,
          source.id,
          json,
          receiver,
          requestMessage
        ],
        onSubmitted: (transactionHash) => {
          setHash(transactionHash)
          setMessage('Your request is being confirmed. No action is needed.')
        }
      })
      if (signal.aborted) return
      setSent(true)
      onSubmitted()
      setMessage(
        'Your request has been submitted. You will be notified when the request is approved or rejected.'
      )
    } catch (error) {
      if (!signal.aborted)
        setMessage(
          error instanceof Error
            ? error.message
            : 'Could not submit the service request.'
        )
    } finally {
      signal.removeEventListener('abort', abort)
      if (!signal.aborted) setBusy(false)
    }
  }
  if (sent)
    return (
      <div>
        <p role="status" aria-live="polite">
          {translate(message)}
        </p>
        {debug && hash && (
          <ExplorerLink networkId={config.chainId} path={`tx/${hash}`}>
            {i18n._('View transaction')}
          </ExplorerLink>
        )}
      </div>
    )

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className={styles.walletCard}>
        <h3 className={styles.walletCardTitle}>{i18n._('Allowed wallet')}</h3>
        {wallet && <WalletLabel address={wallet} isSelf />}
      </div>
      <fieldset disabled={busy || sent} className={styles.requestFields}>
        <label>
          {i18n._('Message (optional)')}{' '}
          <textarea
            aria-label={i18n._('Message (optional)')}
            className={styles.field}
            value={requestMessage}
            maxLength={2048}
            rows={4}
            aria-describedby="request-message-help"
            onChange={(event) =>
              setRequestMessage(event.target.value.slice(0, 2048))
            }
          />
          <span id="request-message-help" className={styles.characterCount}>
            {i18n._(
              '{count, plural, one {# character remaining} other {# characters remaining}}',
              { count: 2048 - requestMessage.length }
            )}
          </span>
        </label>
        <h3>{i18n._('Service settings')}</h3>
        <div
          className={styles.accessType}
          role="group"
          aria-labelledby="request-access-type"
        >
          <span id="request-access-type" className={styles.fieldLabel}>
            {i18n._('Access type')}
          </span>
          <BoxSelection
            name="request-access-type"
            disabled={busy || sent}
            options={[
              {
                name: 'request-download',
                value: 'access',
                title: i18n._('Download'),
                icon: <IconDownload fill="var(--brand-white)" />,
                checked: (terms.type ?? source.type) === 'access'
              },
              {
                name: 'request-compute',
                value: 'compute',
                title: i18n._('Compute'),
                icon: <IconCompute />,
                checked: (terms.type ?? source.type) === 'compute'
              }
            ]}
            handleChange={(event) => {
              const type = event.target.value as 'access' | 'compute'
              setTerms({
                ...terms,
                type,
                compute:
                  type === 'compute'
                    ? {
                        ...source.compute,
                        allowRawAlgorithm:
                          source.compute?.allowRawAlgorithm ?? false,
                        allowNetworkAccess:
                          source.compute?.allowNetworkAccess ?? false,
                        publisherTrustedAlgorithms:
                          source.compute?.publisherTrustedAlgorithms || [],
                        publisherTrustedAlgorithmPublishers:
                          source.compute?.publisherTrustedAlgorithmPublishers ||
                          []
                      }
                    : undefined
              })
            }}
          />
        </div>
        <label>
          {i18n._('Service name')}{' '}
          <input
            className={styles.field}
            value={terms.name}
            required
            maxLength={128}
            onChange={(e) => setTerms({ ...terms, name: e.target.value })}
          />
        </label>
        <label>
          {i18n._('Service description')}{' '}
          <textarea
            className={styles.field}
            value={terms.description ?? ''}
            rows={4}
            onChange={(e) =>
              setTerms({ ...terms, description: e.target.value })
            }
          />
        </label>
        {terms.compute && (
          <>
            <h3>{i18n._('Compute permissions')}</h3>
            <MultiSelect
              id="service-algorithms"
              label={i18n._('Allowed algorithms')}
              value={algorithms.map((option) => {
                const selection = JSON.parse(option.value)
                const selected = selectedAssets.data?.find(
                  (a) => a?.id === selection.algoDid
                )
                const service = selected?.credentialSubject.services.find(
                  (s) => s.id === selection.serviceId
                )
                return selected
                  ? {
                      ...option,
                      label: `${selected.credentialSubject.metadata.name} / ${
                        service?.name || selection.serviceId
                      }`
                    }
                  : {
                      ...option,
                      label:
                        selection.algoDid === '*'
                          ? i18n._('Any published algorithm')
                          : i18n._('Algorithm service {serviceId}', {
                              serviceId: truncateIdentifier(selection.serviceId)
                            })
                    }
              })}
              onChange={setAlgorithms}
              onSearch={setSearch}
              loading={matches.isPending}
              disabled={busy || sent}
              options={(matches.data?.results || [])
                .filter((a) => isNftActive(a.indexedMetadata?.nft.state))
                .flatMap((a) =>
                  a.credentialSubject.services
                    .filter((s) => s.type === 'compute' && isNftActive(s.state))
                    .map((s) => ({
                      value: JSON.stringify({
                        algoDid: a.id,
                        serviceId: s.id
                      }),
                      label: `${a.credentialSubject.metadata.name} / ${
                        s.name || s.id
                      }`,
                      description: truncateIdentifier(a.id),
                      href: `/asset/${a.id}`
                    }))
                )}
            />
            {matches.isError && (
              <p role="status">
                {i18n._('Could not load algorithms. Try searching again.')}
              </p>
            )}
            <MultiSelect
              id="service-publishers"
              label={i18n._('Allowed trusted publishers')}
              value={publishers.map(publisherOption)}
              onChange={(options) =>
                setPublishers(options.map((option) => option.value))
              }
              disabled={busy || sent}
              options={identities.map((p) => publisherOption(p.address))}
              isValidNewOption={(input) =>
                isAddress(input.trim()) &&
                input.trim().toLowerCase() !== ZeroAddress
              }
            />
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={terms.compute.allowNetworkAccess}
                onChange={(e) =>
                  setTerms({
                    ...terms,
                    compute: {
                      ...terms.compute,
                      allowNetworkAccess: e.target.checked
                    }
                  })
                }
              />{' '}
              {i18n._('Allow network access')}
            </label>
          </>
        )}
        <AccessTermsFields terms={terms} onChange={setTerms} />
      </fieldset>
      <div className={styles.controls}>
        <Button
          type="submit"
          disabled={busy || sent || !wallet || chainId !== config.chainId}
        >
          {i18n._('Request new service')}
        </Button>
        <Button type="button" style="text" disabled={busy} onClick={onClose}>
          {i18n._('Close')}
        </Button>
      </div>
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
      {hash && (
        <ExplorerLink networkId={config.chainId} path={`tx/${hash}`}>
          {i18n._('View transaction')}
        </ExplorerLink>
      )}
      <Web3Feedback
        accountId={wallet}
        isAssetNetwork={chainId === config.chainId}
      />
    </form>
  )
}

function RequestForm({
  config,
  asset,
  service: initialService,
  onClose
}: {
  config: RegistryConfig
  asset: Asset
  service: Service
  onClose: () => void
}): ReactElement {
  useLingui()
  const { address: wallet } = useAccount()
  const [service, setService] = useState(initialService)
  const [locked, setLocked] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const defaults = useQuery({
    queryKey: [
      ...accessRequestKey(
        config,
        wallet,
        asset.credentialSubject.nftAddress,
        service.id
      ),
      'service-defaults'
    ],
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const cancel = axios.CancelToken.source()
      const abort = () => cancel.cancel('Cancelled')
      signal.addEventListener('abort', abort)
      try {
        const fresh = await resolveRequestAsset(
          config.chainId,
          asset.credentialSubject.nftAddress,
          cancel.token
        )
        const source = fresh.credentialSubject.services.find(
          (s) => s.id === service.id
        )
        if (!source || !isNftActive(source.state))
          throw new Error('The original service is unavailable.')
        const details = await getAccessDetails(
          config.chainId,
          source,
          wallet || ZeroAddress,
          cancel.token
        )
        if (!['fixed', 'free'].includes(details.type))
          throw new Error('Could not load the original service price.')
        const baseToken =
          details.baseToken?.address ||
          getOceanConfig(config.chainId)?.oceanTokenAddress
        const terms = validateServiceTerms(
          {
            name: source.name,
            description: source.description?.['@value'] ?? '',
            type: source.type,
            price: details.price,
            baseToken,
            timeout: source.timeout,
            ...(source.type === 'compute' && {
              compute: {
                ...source.compute,
                allowRawAlgorithm: source.compute?.allowRawAlgorithm ?? false,
                allowNetworkAccess: source.compute?.allowNetworkAccess ?? false,
                publisherTrustedAlgorithms:
                  source.compute?.publisherTrustedAlgorithms || [],
                publisherTrustedAlgorithmPublishers:
                  source.compute?.publisherTrustedAlgorithmPublishers || []
              }
            })
          },
          source
        )
        return { source, terms }
      } finally {
        signal.removeEventListener('abort', abort)
      }
    }
  })
  return (
    <Modal
      isOpen
      title={i18n._('Request a new service')}
      className={styles.requestModal}
      onToggleModal={onClose}
      onRequestClose={onClose}
    >
      {!submitted && (
        <div className={styles.baseServiceField}>
          <label htmlFor="base-service-to-clone">
            {i18n._('Base service to clone')}
          </label>
          <Select
            inputId="base-service-to-clone"
            instanceId="base-service-to-clone"
            className={selectStyles.select}
            styles={{
              valueContainer: (base) => ({
                ...base,
                paddingTop: '0.75rem',
                paddingBottom: '0.75rem'
              }),
              option: (base, state) => ({
                ...base,
                backgroundColor: state.isSelected
                  ? 'var(--deck-blue-12)'
                  : state.isFocused
                  ? 'var(--deck-blue-8)'
                  : 'transparent',
                color: 'var(--foreground)',
                ':active': { backgroundColor: 'var(--deck-blue-12)' }
              }),
              singleValue: (base) => ({ ...base, color: 'var(--foreground)' })
            }}
            isDisabled={locked}
            isSearchable={false}
            options={asset.credentialSubject.services.filter(
              (s) =>
                ['access', 'compute'].includes(s.type) && isNftActive(s.state)
            )}
            value={service}
            getOptionValue={(s) => s.id}
            getOptionLabel={(s) => s.name || s.id}
            formatOptionLabel={(s) => (
              <span className={styles.baseServiceOption}>
                <span>
                  {s.name || s.id} (
                  {s.type === 'compute'
                    ? i18n._('Compute')
                    : i18n._('Download')}
                  )
                </span>
                {s.description?.['@value'] && (
                  <small>{s.description['@value']}</small>
                )}
              </span>
            )}
            onChange={(selected) => {
              if (selected) setService(selected)
            }}
            theme={(theme) => ({
              ...theme,
              colors: {
                ...theme.colors,
                primary: 'var(--deck-blue)',
                primary25: 'var(--deck-blue-8)',
                primary50: 'var(--deck-blue-12)'
              }
            })}
          />
        </div>
      )}
      {!submitted && defaults.isPending && (
        <div role="status">
          <Loader
            message={i18n._('Loading original service settings…')}
            noMargin
          />
        </div>
      )}
      {!submitted && defaults.isError && (
        <p role="alert">
          {translate(defaults.error.message)}
          <Button style="text" onClick={() => defaults.refetch()}>
            {i18n._('Retry')}
          </Button>
        </p>
      )}
      {defaults.data && (
        <ServiceRequestFields
          key={service.id}
          config={config}
          asset={asset}
          source={defaults.data.source}
          defaults={defaults.data.terms}
          onSubmitted={() => setSubmitted(true)}
          onLock={setLocked}
          onClose={onClose}
        />
      )}
    </Modal>
  )
}

export default function RequestButton({
  asset,
  service
}: {
  asset: Asset
  service?: Service
}): ReactElement {
  useLingui()
  const { address: wallet } = useAccount()
  const chainId = useChainId()
  const { config, error } = useAccessRequestConfig(
    asset.credentialSubject.chainId
  )
  const [open, setOpen] = useState(false)
  const available = Boolean(
    service &&
      ['access', 'compute'].includes(service.type) &&
      isNftActive(asset.indexedMetadata?.nft.state) &&
      isNftActive(service.state) &&
      config &&
      !error
  )
  return (
    <div className={styles.serviceRequestCard}>
      <p className={styles.serviceRequestTitle}>
        {i18n._(
          'Need access to a service or want it with different conditions?'
        )}
      </p>
      <Button
        style="outlined"
        size="small"
        disabled={!available}
        onClick={() => setOpen(true)}
      >
        {i18n._('Request access')}
      </Button>
      {error && <p role="status">{translate(error)}</p>}
      {open && available && (
        <RequestForm
          key={`${wallet}:${chainId}:${service.id}`}
          config={config}
          asset={asset}
          service={service}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
