import { useCallback, useEffect, useState } from 'react'
import { getAddress } from 'viem'
import { createSiweMessage } from 'viem/siwe'
import { useAccount } from 'wagmi'
import { LoggerInstance } from '@oceanprotocol/lib'
import { useEthersSigner } from '@hooks/useEthersSigner'
import type { SiweSessionResponse } from 'src/@types/Chat'

export type SiweStatus =
  | 'loading'
  | 'disabled'
  | 'signedOut'
  | 'signingIn'
  | 'signedIn'

const SIWE_STATEMENT =
  'Sign in to the AgrospAI market chat. This signature costs no gas and authorizes no transaction.'

function postJson(path: string, body?: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {})
  })
}

export function useSiweSession() {
  const {
    address,
    chainId: walletChainId,
    status: accountStatus
  } = useAccount()
  const signer = useEthersSigner()
  const [status, setStatus] = useState<SiweStatus>('loading')
  const [sessionAddress, setSessionAddress] = useState<string>()
  const [requiredChainId, setRequiredChainId] = useState<number>()
  const [error, setError] = useState<string>()

  const isWalletConnected = accountStatus === 'connected'

  useEffect(() => {
    if (!isWalletConnected) return
    let cancelled = false

    async function loadSession() {
      try {
        const response = await fetch('/api/siwe/session')
        if (cancelled) return
        if (!response.ok) {
          setStatus('disabled')
          return
        }
        const session: SiweSessionResponse = await response.json()
        if (cancelled) return
        setRequiredChainId(session.chainId)
        setSessionAddress(session.address ?? undefined)
        setStatus(session.address ? 'signedIn' : 'signedOut')
      } catch (err) {
        LoggerInstance.error('[siwe] Could not read the session', err)
        if (!cancelled) setStatus('disabled')
      }
    }

    loadSession()
    return () => {
      cancelled = true
    }
  }, [isWalletConnected])

  const signOut = useCallback(async () => {
    setSessionAddress(undefined)
    setStatus('signedOut')
    try {
      await postJson('/api/siwe/logout')
    } catch (err) {
      LoggerInstance.error('[siwe] Could not close the session', err)
    }
  }, [])

  /** The server said the session is gone: only the local state is left to clear. */
  const markSignedOut = useCallback(() => {
    setSessionAddress(undefined)
    setStatus('signedOut')
  }, [])

  // The session belongs to one wallet. While the wallet is (re)connecting its
  // address is unknown, so nothing is decided until it has settled.
  useEffect(() => {
    if (!sessionAddress) return
    const isDifferentWallet =
      accountStatus === 'connected' &&
      address?.toLowerCase() !== sessionAddress.toLowerCase()
    if (isDifferentWallet || accountStatus === 'disconnected') signOut()
  }, [accountStatus, address, sessionAddress, signOut])

  const signIn = useCallback(async () => {
    if (!address || !signer || !requiredChainId) return
    setError(undefined)
    setStatus('signingIn')
    try {
      const nonceResponse = await fetch('/api/siwe/nonce')
      if (!nonceResponse.ok) throw new Error('Could not start the sign-in.')
      const { nonce } = await nonceResponse.json()

      const { host, origin, protocol } = window.location
      const message = createSiweMessage({
        address: getAddress(address),
        chainId: requiredChainId,
        domain: host,
        nonce,
        scheme: protocol.replace(':', ''),
        statement: SIWE_STATEMENT,
        uri: origin,
        version: '1'
      })
      const signature = await signer.signMessage(message)

      const response = await postJson('/api/siwe/verify', {
        message,
        signature
      })
      if (!response.ok) throw new Error('The sign-in could not be verified.')

      const session: SiweSessionResponse = await response.json()
      setSessionAddress(session.address ?? undefined)
      setStatus(session.address ? 'signedIn' : 'signedOut')
    } catch (err) {
      LoggerInstance.error('[siwe] Sign-in failed', err)
      setStatus('signedOut')
      setError(
        (err as { code?: string })?.code === 'ACTION_REJECTED'
          ? 'The signature was cancelled.'
          : 'The sign-in failed. Please try again.'
      )
    }
  }, [address, requiredChainId, signer])

  return {
    status,
    sessionAddress,
    requiredChainId,
    isOnRequiredChain: walletChainId === requiredChainId,
    canSign: Boolean(signer),
    error,
    signIn,
    signOut,
    markSignedOut
  }
}
