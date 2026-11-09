import { ReactElement, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAccount, useSwitchChain } from 'wagmi'
import type { ComputeJob } from '@oceanprotocol/lib'
import Alert from '@shared/atoms/Alert'
import Button from '@shared/atoms/Button'
import Loader from '@shared/atoms/Loader'
import { useEthersSigner } from '@hooks/useEthersSigner'
import { useCancelToken } from '@hooks/useCancelToken'
import { useSsiWallet } from '@context/SsiWallet'
import { CredentialDialogProvider } from '@components/Asset/AssetActions/Compute/CredentialDialogProvider'
import { AssetActionCheckCredentials } from '@components/Asset/AssetActions/CheckCredentials'
import { openPolicySession } from '@utils/wallet/policySession'
import { getLicenseLink } from '@utils/chat/license'
import {
  Payment,
  VerifiedAsset,
  VerifiedCompute,
  VerifiedDownload,
  formatTokenAmount,
  verifyComputeIntent,
  verifyDownloadIntent
} from '@utils/chat/verifyIntent'
import {
  ComputeStep,
  getJobStatus,
  runDownload,
  startComputeJob
} from '@utils/chat/runIntent'
import type {
  ChatIntent,
  IntentAssetRef,
  IntentParameters
} from 'src/@types/ChatIntent'
import styles from './index.module.css'

type Plan = VerifiedCompute | VerifiedDownload
type Phase = 'checking' | 'blocked' | 'ready' | 'running' | 'done' | 'failed'

const JOB_FINISHED = 70
// The results are written; the node marks the job finished later, when its
// periodic payment check runs.
const JOB_SETTLING = 71
const JOB_POLL_MS = 10_000
const MAX_JOB_POLLS = 120

function isRejected(error: unknown): boolean {
  const { code, message } = (error ?? {}) as { code?: string; message?: string }
  return (
    code === 'ACTION_REJECTED' ||
    /user rejected|user denied|rejected the request/i.test(message ?? '')
  )
}

// Errors of the compute node that are not the user's to fix.
const NODE_ERRORS: [RegExp, string][] = [
  [
    /insufficient gas funds/i,
    'The compute node has no gas to start paid jobs right now. Nothing was charged for the job: your deposit stays in your escrow. Try again later, or tell the market operator.'
  ]
]

function errorText(error: unknown): string {
  if (isRejected(error)) return 'You cancelled it in your wallet.'
  const message = (error as Error)?.message ?? ''
  const known = NODE_ERRORS.find(([pattern]) => pattern.test(message))
  if (known) return known[1]
  return message.length > 0 && message.length < 200
    ? message
    : 'It could not be completed. Please try again.'
}

function assetsOf(plan: Plan): VerifiedAsset[] {
  return plan.kind === 'compute' ? [plan.dataset, plan.algorithm] : [plan.asset]
}

function refsOf(intent: ChatIntent): IntentAssetRef[] {
  return intent.kind === 'compute'
    ? [intent.dataset, intent.algorithm]
    : [intent.asset]
}

function isPaidIntent(intent: ChatIntent): boolean {
  return (
    (intent.kind === 'compute' && !intent.environment.free) ||
    refsOf(intent).some((ref) => ref.price?.type === 'fixed')
  )
}

function amountOf(wei: bigint, payment: Payment): string {
  return `${formatTokenAmount(wei, payment.token.decimals)} ${
    payment.token.symbol
  }`
}

function priceLabel({ accessDetails, order }: VerifiedAsset): string {
  if (accessDetails.type !== 'fixed') return 'Free'
  if (accessDetails.validOrderTx) return 'Already bought'
  const { decimals, symbol } = accessDetails.baseToken
  return `${formatTokenAmount(order?.costWei ?? BigInt(0), decimals)} ${symbol}`
}

function stepText(step: ComputeStep): string {
  switch (step.step) {
    case 'order':
      return step.amount
        ? `Confirm the purchase of ${step.asset} (${step.amount}) in your wallet: approve, then buy…`
        : `Confirm the free order of ${step.asset} in your wallet (you pay gas)…`
    case 'deposit':
      return 'Confirm the escrow deposit in your wallet: approve, then deposit…'
    case 'authorize':
      return 'Confirm the escrow authorization in your wallet…'
    default:
      return 'Sign the job in your wallet…'
  }
}

function Parameters({
  values
}: {
  values?: IntentParameters
}): ReactElement | null {
  const entries = Object.entries(values ?? {})
  if (entries.length === 0) return null
  return (
    <ul className={styles.parameters}>
      {entries.map(([name, value]) => (
        <li key={name}>
          <code>{name}</code>: {String(value)}
        </li>
      ))}
    </ul>
  )
}

function AssetRow({
  label,
  asset
}: {
  label: string
  asset: VerifiedAsset
}): ReactElement {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <div>
        <Link href={`/asset/${asset.asset.id}`} target="_blank">
          {asset.name}
        </Link>{' '}
        <span className={styles.free}>{priceLabel(asset)}</span>
        <Parameters values={asset.parameters} />
      </div>
    </div>
  )
}

function PaymentRows({
  plan,
  payment
}: {
  plan: Plan
  payment: Payment
}): ReactElement {
  const { escrow } = payment
  return (
    <>
      {escrow && (
        <div className={styles.row}>
          <span className={styles.label}>Escrow</span>
          <span>
            {escrow.depositWei > BigInt(0)
              ? `The job costs ${amountOf(
                  escrow.jobCostWei,
                  payment
                )}: you deposit ${amountOf(escrow.depositWei, payment)}${
                  escrow.availableWei > BigInt(0)
                    ? ` and use ${amountOf(
                        escrow.availableWei,
                        payment
                      )} you already have in escrow`
                    : ''
                }`
              : `The job costs ${amountOf(
                  escrow.jobCostWei,
                  payment
                )}, paid from your escrow funds`}
            . The node takes what the job uses; the rest stays in your escrow
            and can be withdrawn in your profile.
          </span>
        </div>
      )}
      <div className={styles.row}>
        <span className={styles.label}>Total</span>
        <strong>
          {amountOf(payment.totalWei, payment)}
          {plan.kind === 'compute' && escrow ? ' now' : ''}
        </strong>
      </div>
    </>
  )
}

/**
 * A confirmation card for an action prepared by the assistant. It shows what
 * the browser checked itself, not what the model or the intent said, and runs
 * nothing until the user clicks and signs in their wallet.
 */
export default function IntentCard({
  intent,
  live,
  onRunningChange
}: {
  intent: ChatIntent
  live: boolean
  /** Told while the card sends orders, payments or the job, so the conversation is kept. */
  onRunningChange?: (running: boolean) => void
}): ReactElement {
  const { address, chainId } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const signer = useEthersSigner()
  const newCancelToken = useCancelToken()
  const { lookupVerifierSessionId } = useSsiWallet()
  const [phase, setPhase] = useState<Phase>('checking')
  const [plan, setPlan] = useState<Plan>()
  const [problems, setProblems] = useState<string[]>([])
  const [progress, setProgress] = useState<string>()
  const [error, setError] = useState<string>()
  const [job, setJob] = useState<ComputeJob>()
  // Re-renders the card when CheckCredentials stores a new session.
  const [, setCredentialsChecked] = useState(0)
  const [acceptsTerms, setAcceptsTerms] = useState(false)
  const [acceptsLicenses, setAcceptsLicenses] = useState(false)
  const [acceptsPayment, setAcceptsPayment] = useState(false)
  // Checking again, after a failure, gives fresh prices and orders.
  const [checks, setChecks] = useState(0)

  const isPaid = isPaidIntent(intent)
  const title =
    intent.kind === 'compute'
      ? isPaid
        ? 'Compute-to-Data job'
        : 'Free Compute-to-Data job'
      : isPaid
      ? 'Dataset purchase'
      : 'Free dataset download'
  const isOwnWallet =
    address?.toLowerCase() === intent.consumerAddress.toLowerCase()
  const isRightChain = chainId === intent.chainId
  const canCheck = live && isOwnWallet && isRightChain
  const isRunning = phase === 'running'

  useEffect(() => {
    if (!isRunning || !onRunningChange) return
    onRunningChange(true)
    return () => onRunningChange(false)
  }, [isRunning, onRunningChange])

  useEffect(() => {
    if (!canCheck) return
    let cancelled = false
    setPhase('checking')
    setAcceptsPayment(false)

    async function check() {
      try {
        const verification =
          intent.kind === 'compute'
            ? await verifyComputeIntent(intent, address, newCancelToken())
            : await verifyDownloadIntent(intent, address, newCancelToken())
        if (cancelled) return
        if ('plan' in verification) {
          setPlan(verification.plan)
          setPhase('ready')
        } else {
          setProblems(verification.problems)
          setPhase('blocked')
        }
      } catch (err) {
        if (cancelled) return
        setProblems([errorText(err)])
        setPhase('blocked')
      }
    }

    check()
    return () => {
      cancelled = true
    }
  }, [address, canCheck, checks, intent, newCancelToken])

  const resultsReady =
    job?.status === JOB_FINISHED ||
    (job?.status === JOB_SETTLING && job.results?.length > 0)

  // The status of a running job; reading it asks for no signature.
  useEffect(() => {
    if (plan?.kind !== 'compute' || !job?.jobId || !signer) return
    if (resultsReady) return
    let polls = 0
    const timer = setInterval(async () => {
      polls++
      try {
        const status = await getJobStatus(
          plan.dataset.service.serviceEndpoint,
          signer,
          job.jobId
        )
        if (status) setJob({ ...status, jobId: job.jobId })
      } catch {}
      if (polls >= MAX_JOB_POLLS) clearInterval(timer)
    }, JOB_POLL_MS)
    return () => clearInterval(timer)
  }, [job?.jobId, job?.status, plan, resultsReady, signer])

  const pendingCredentials = plan
    ? assetsOf(plan).filter(
        (asset) =>
          asset.requiresSsi &&
          !lookupVerifierSessionId(asset.asset.id, asset.service.id)
      )
    : []

  const sessionFor = useCallback(
    async (asset: VerifiedAsset): Promise<string> => {
      if (!asset.needsSession) return ''
      if (asset.requiresSsi) {
        const sessionId = lookupVerifierSessionId(
          asset.asset.id,
          asset.service.id
        )
        if (!sessionId)
          throw new Error(`Check the credentials of ${asset.name}`)
        return sessionId
      }
      setProgress(`Sign the access check for ${asset.name} in your wallet…`)
      return openPolicySession(asset.asset, asset.service.id, address, signer)
    },
    [address, lookupVerifierSessionId, signer]
  )

  async function run() {
    if (!plan || !signer || !address) return
    setPhase('running')
    setError(undefined)
    try {
      if (plan.kind === 'compute') {
        const sessions = {
          dataset: await sessionFor(plan.dataset),
          algorithm: await sessionFor(plan.algorithm)
        }
        setJob(
          await startComputeJob(plan, signer, address, sessions, (step) =>
            setProgress(stepText(step))
          )
        )
      } else {
        const sessionId = await sessionFor(plan.asset)
        await runDownload(plan, signer, address, sessionId, () =>
          setProgress(
            plan.payment
              ? `Confirm the purchase (${amountOf(
                  plan.payment.totalWei,
                  plan.payment
                )}) in your wallet: approve, then buy…`
              : 'Confirm the free order in your wallet (you pay gas)…'
          )
        )
      }
      setPhase('done')
    } catch (err) {
      setError(errorText(err))
      setPhase('failed')
    } finally {
      setProgress(undefined)
    }
  }

  if (!live) {
    return (
      <section className={styles.card} aria-label={title}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.muted}>
          {refsOf(intent)
            .map((ref) => ref.name ?? ref.did)
            .join(' + ')}
          . Prepared earlier: ask again to run it.
        </p>
      </section>
    )
  }

  const signatures = plan
    ? assetsOf(plan).filter((a) => a.needsSession && !a.requiresSsi).length + 1
    : 0
  const payment = plan?.payment
  const plural = (n: number, word: string) =>
    `${n} ${word}${n === 1 ? '' : 's'}`
  const consent = payment
    ? payment.totalWei > BigInt(0)
      ? `I agree to pay ${amountOf(payment.totalWei, payment)}`
      : `I agree that ${amountOf(
          payment.escrow?.jobCostWei ?? BigInt(0),
          payment
        )} of my escrow funds pay for the job`
    : undefined
  const pay =
    payment && payment.totalWei > BigInt(0)
      ? `Pay ${amountOf(payment.totalWei, payment)} and `
      : ''

  return (
    <section className={styles.card} aria-label={title}>
      <h3 className={styles.title}>{title}</h3>

      {!isOwnWallet ? (
        <Alert
          state="error"
          text="This was prepared for another wallet. Ask again with the connected one."
        />
      ) : !isRightChain ? (
        <Button
          type="button"
          style="primary"
          size="small"
          disabled={isSwitching}
          onClick={() => switchChain({ chainId: intent.chainId })}
        >
          Switch network
        </Button>
      ) : phase === 'checking' ? (
        <div className={styles.status}>
          <Loader />
          <span>Checking it with the market…</span>
        </div>
      ) : phase === 'blocked' ? (
        <Alert
          state="error"
          text={`It cannot run from the chat: ${problems.join('; ')}.`}
        />
      ) : (
        plan && (
          <>
            {plan.kind === 'compute' ? (
              <>
                <AssetRow label="Dataset" asset={plan.dataset} />
                <AssetRow label="Algorithm" asset={plan.algorithm} />
                <div className={styles.row}>
                  <span className={styles.label}>Runs</span>
                  <span>
                    {plan.mode === 'paid'
                      ? `In the paid environment with ${plan.resources.cpu} CPU, ${plan.resources.ram} GB RAM and ${plan.resources.disk} GB disk`
                      : 'In the free environment'}
                    , for up to {Math.round(plan.maxJobDurationSeconds / 60)}{' '}
                    minutes
                  </span>
                </div>
              </>
            ) : (
              <>
                <AssetRow label="Dataset" asset={plan.asset} />
                {!payment && (
                  <div className={styles.row}>
                    <span className={styles.label}>Order</span>
                    <span>
                      {plan.asset.accessDetails.validOrderTx
                        ? 'Already ordered: no transaction'
                        : 'A free order on the network: you pay a little gas'}
                    </span>
                  </div>
                )}
              </>
            )}

            {payment && <PaymentRows plan={plan} payment={payment} />}

            {pendingCredentials.length > 0 && phase === 'ready' && (
              <div className={styles.credentials}>
                <p>These assets ask for credentials from your SSI wallet:</p>
                {pendingCredentials.map((asset) => (
                  <CredentialDialogProvider key={asset.asset.id}>
                    <AssetActionCheckCredentials
                      asset={asset.asset}
                      service={asset.service}
                      onVerified={() => setCredentialsChecked((n) => n + 1)}
                    />
                  </CredentialDialogProvider>
                ))}
              </div>
            )}

            {phase === 'ready' && (
              <>
                <label className={styles.consent}>
                  <input
                    type="checkbox"
                    checked={acceptsTerms}
                    onChange={(event) => setAcceptsTerms(event.target.checked)}
                  />
                  <span>
                    I agree to the{' '}
                    <Link href="/privacy/terms" target="_blank">
                      Terms and Conditions
                    </Link>
                  </span>
                </label>
                <label className={styles.consent}>
                  <input
                    type="checkbox"
                    checked={acceptsLicenses}
                    onChange={(event) =>
                      setAcceptsLicenses(event.target.checked)
                    }
                  />
                  <span>
                    I agree to the license terms under which{' '}
                    {assetsOf(plan).map((asset, index) => {
                      const license = getLicenseLink(asset.asset)
                      return (
                        <span key={asset.asset.id}>
                          {index > 0 && ' and '}
                          {license ? (
                            <a
                              href={license}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {asset.name}
                            </a>
                          ) : (
                            asset.name
                          )}
                        </span>
                      )
                    })}{' '}
                    {assetsOf(plan).length > 1 ? 'were' : 'was'} made available
                  </span>
                </label>
                {consent && (
                  <label className={styles.consent}>
                    <input
                      type="checkbox"
                      checked={acceptsPayment}
                      onChange={(event) =>
                        setAcceptsPayment(event.target.checked)
                      }
                    />
                    <strong>{consent}</strong>
                  </label>
                )}
                <p className={styles.muted}>
                  {payment
                    ? `Your wallet asks for up to ${plural(
                        payment.transactions,
                        'transaction'
                      )} and ${plural(signatures, 'signature')}.`
                    : plan.kind === 'compute'
                    ? `Free: nothing is paid and no transaction is sent. You sign ${plural(
                        signatures,
                        'message'
                      )} in your wallet.`
                    : 'Nothing is paid to the publisher. You sign in your wallet to download.'}
                </p>
                <Button
                  type="button"
                  style="primary"
                  size="small"
                  disabled={
                    !signer ||
                    pendingCredentials.length > 0 ||
                    !acceptsTerms ||
                    !acceptsLicenses ||
                    (consent && !acceptsPayment)
                  }
                  onClick={run}
                >
                  {plan.kind === 'compute'
                    ? `${pay}${pay ? 'run' : 'Run'} the job`
                    : `${pay}${pay ? 'download' : 'Download'}`}
                </Button>
              </>
            )}

            {phase === 'running' && (
              <div className={styles.status}>
                <Loader />
                <span>{progress ?? 'Working…'}</span>
              </div>
            )}

            {phase === 'failed' && (
              <>
                <Alert state="error" text={error} />
                {payment && (
                  <p className={styles.muted}>
                    What was already bought stays yours: trying again checks it
                    and does not buy it twice. Escrow funds can be withdrawn in{' '}
                    <Link href="/profile">your profile</Link>.
                  </p>
                )}
                <Button
                  type="button"
                  style="ghost"
                  size="small"
                  onClick={payment ? () => setChecks((n) => n + 1) : run}
                >
                  Try again
                </Button>
              </>
            )}

            {phase === 'done' && plan.kind === 'compute' && job && (
              <div className={styles.result}>
                <p>
                  {resultsReady
                    ? 'The job is done and its results are ready.'
                    : `Job started. ${
                        job.statusText
                          ? `Status: ${job.statusText.trim()}.`
                          : 'Waiting for its status…'
                      }`}
                </p>
                <Link href="/profile?defaultTab=computeJobs">
                  See it and its results in your compute jobs
                </Link>
              </div>
            )}

            {phase === 'done' && plan.kind === 'download' && (
              <p className={styles.result}>
                The download has started in your browser.
              </p>
            )}
          </>
        )
      )}
    </section>
  )
}
