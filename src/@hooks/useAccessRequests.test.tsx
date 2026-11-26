import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { registryWrite } from '@utils/accessRequests/client'
import { useRegistryMutation } from './useAccessRequests'

jest.mock('wagmi', () => ({
  useAccount: () => ({ address: 'wallet' }),
  useChainId: () => 11155420
}))
jest.mock('./useEthersSigner', () => ({ useEthersSigner: () => ({}) }))
jest.mock('@utils/accessRequests/client', () => ({ registryWrite: jest.fn() }))

const config = { chainId: 11155420, address: 'registry', deploymentBlock: 1 }
const key = [
  'accessRequests',
  config.chainId,
  config.address,
  'wallet',
  'notifications'
]

it.each([false, true])(
  'optimistically clears all badges and rolls back on failure: %s',
  async (fails) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    })
    client.setQueryData(key, {
      unread: { '1': 2, '2': 1 },
      received: { '1': 2 },
      sent: { '2': 1 }
    })
    let resolve: () => void
    let reject: (error: Error) => void
    ;(registryWrite as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((_resolve, _reject) => {
          resolve = _resolve
          reject = _reject
        })
    )
    const onError = jest.fn()
    const { result } = renderHook(() => useRegistryMutation(config), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      )
    })
    act(() =>
      result.current.mutate({ action: 'markSeen', args: [1n, 2] }, { onError })
    )
    await waitFor(() => expect(registryWrite).toHaveBeenCalled())
    await waitFor(() =>
      expect(client.getQueryData(key)).toEqual({
        unread: { '2': 1 },
        received: {},
        sent: { '2': 1 }
      })
    )
    act(() => {
      if (fails) reject(new Error('Failed'))
      else resolve()
    })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(client.getQueryData(key)).toEqual({
      unread: fails ? { '1': 2, '2': 1 } : { '2': 1 },
      received: fails ? { '1': 2 } : {},
      sent: { '2': 1 }
    })
    expect(onError).toHaveBeenCalledTimes(fails ? 1 : 0)
    client.clear()
  }
)
