import { act, renderHook, waitFor } from '@testing-library/react'
import { useAccount } from 'wagmi'
import { useEthersSigner } from '@hooks/useEthersSigner'
import { useSiweSession } from './useSiweSession'

jest.mock('wagmi', () => ({
  useAccount: jest.fn()
}))
jest.mock('@hooks/useEthersSigner', () => ({
  useEthersSigner: jest.fn()
}))
jest.mock('@oceanprotocol/lib', () => ({
  LoggerInstance: { error: jest.fn() }
}))

const WALLET_A = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const WALLET_B = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
const CHAIN_ID = 11155420

const signMessage = jest.fn(async (_message: string) => '0xsignature')
const fetchMock = jest.fn()

function json(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body }
}

function setWallet(
  address: string | undefined,
  status: 'connected' | 'reconnecting' | 'disconnected' = 'connected',
  chainId = CHAIN_ID
) {
  jest.mocked(useAccount).mockReturnValue({ address, status, chainId } as any)
}

function sessionResponse(address: string | null) {
  fetchMock.mockImplementation(async (path: string) => {
    if (path === '/api/siwe/session') {
      return json({ address, chainId: CHAIN_ID })
    }
    if (path === '/api/siwe/nonce') return json({ nonce: 'abcd1234efgh' })
    if (path === '/api/siwe/verify') {
      return json({ address: WALLET_A, chainId: CHAIN_ID })
    }
    return json({ address: null, chainId: CHAIN_ID })
  })
}

function logoutCalls() {
  return fetchMock.mock.calls.filter(([path]) => path === '/api/siwe/logout')
}

describe('useSiweSession', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = fetchMock
    setWallet(WALLET_A)
    jest.mocked(useEthersSigner).mockReturnValue({ signMessage } as any)
  })

  it('is disabled when the chat is not configured', async () => {
    fetchMock.mockResolvedValue(json({ error: 'Not found' }, 404))
    const { result } = renderHook(() => useSiweSession())
    await waitFor(() => expect(result.current.status).toBe('disabled'))
  })

  it('does not ask for the session without a connected wallet', async () => {
    setWallet(undefined, 'disconnected')
    sessionResponse(null)
    renderHook(() => useSiweSession())
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('restores an existing session of the same wallet', async () => {
    sessionResponse(WALLET_A)
    const { result } = renderHook(() => useSiweSession())

    await waitFor(() => expect(result.current.status).toBe('signedIn'))
    expect(result.current.sessionAddress).toBe(WALLET_A)
    expect(logoutCalls()).toHaveLength(0)
  })

  it('closes a stored session of another wallet', async () => {
    setWallet(WALLET_B)
    sessionResponse(WALLET_A)
    const { result } = renderHook(() => useSiweSession())

    await waitFor(() => expect(logoutCalls()).toHaveLength(1))
    expect(result.current.status).toBe('signedOut')
    expect(result.current.sessionAddress).toBeUndefined()
  })

  it('closes the session when the wallet changes account', async () => {
    sessionResponse(WALLET_A)
    const { result, rerender } = renderHook(() => useSiweSession())
    await waitFor(() => expect(result.current.status).toBe('signedIn'))

    setWallet(WALLET_B)
    rerender()

    await waitFor(() => expect(logoutCalls()).toHaveLength(1))
    expect(result.current.status).toBe('signedOut')
  })

  it('closes the session when the wallet disconnects', async () => {
    sessionResponse(WALLET_A)
    const { result, rerender } = renderHook(() => useSiweSession())
    await waitFor(() => expect(result.current.status).toBe('signedIn'))

    setWallet(undefined, 'disconnected')
    rerender()

    await waitFor(() => expect(logoutCalls()).toHaveLength(1))
  })

  it('keeps the session while the wallet reconnects', async () => {
    sessionResponse(WALLET_A)
    const { result, rerender } = renderHook(() => useSiweSession())
    await waitFor(() => expect(result.current.status).toBe('signedIn'))

    setWallet(undefined, 'reconnecting')
    rerender()
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(logoutCalls()).toHaveLength(0)
    expect(result.current.status).toBe('signedIn')
  })

  it('keeps the session when the network changes', async () => {
    sessionResponse(WALLET_A)
    const { result, rerender } = renderHook(() => useSiweSession())
    await waitFor(() => expect(result.current.status).toBe('signedIn'))

    setWallet(WALLET_A, 'connected', 1)
    rerender()
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(logoutCalls()).toHaveLength(0)
    expect(result.current.isOnRequiredChain).toBe(false)
  })

  it('signs in with a message for this market, chain and nonce', async () => {
    sessionResponse(null)
    const { result } = renderHook(() => useSiweSession())
    await waitFor(() => expect(result.current.status).toBe('signedOut'))

    await act(() => result.current.signIn())

    const [message] = signMessage.mock.calls[0]
    expect(message).toContain(`${window.location.host} wants you to sign in`)
    expect(message).toContain(WALLET_A)
    expect(message).toContain(`Chain ID: ${CHAIN_ID}`)
    expect(message).toContain('Nonce: abcd1234efgh')
    expect(result.current.status).toBe('signedIn')
  })

  it('explains a cancelled signature', async () => {
    sessionResponse(null)
    signMessage.mockRejectedValueOnce({ code: 'ACTION_REJECTED' })
    const { result } = renderHook(() => useSiweSession())
    await waitFor(() => expect(result.current.status).toBe('signedOut'))

    await act(() => result.current.signIn())

    expect(result.current.status).toBe('signedOut')
    expect(result.current.error).toBe('The signature was cancelled.')
  })

  it('does not sign in when verification fails', async () => {
    sessionResponse(null)
    const { result } = renderHook(() => useSiweSession())
    await waitFor(() => expect(result.current.status).toBe('signedOut'))
    fetchMock.mockImplementation(async (path: string) =>
      path === '/api/siwe/nonce'
        ? json({ nonce: 'abcd1234efgh' })
        : json({ error: 'Invalid signature' }, 401)
    )

    await act(() => result.current.signIn())

    expect(result.current.status).toBe('signedOut')
    expect(result.current.sessionAddress).toBeUndefined()
  })
})
