import { render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/router'
import { useAccount } from 'wagmi'
import PageProfile from '../../pages/profile'

jest.mock('next/router', () => ({ useRouter: jest.fn() }))
jest.mock('wagmi', () => ({ useAccount: jest.fn() }))
jest.mock('@shared/Page', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))
jest.mock('@context/Profile', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))
jest.mock('@components/Profile', () => ({
  __esModule: true,
  default: ({ accountId }: { accountId: string }) => (
    <div>Profile {accountId}</div>
  )
}))

const address = '0x1234567890123456789012345678901234567890'
const replace = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  ;(useAccount as jest.Mock).mockReturnValue({
    address: undefined,
    isConnecting: false,
    isReconnecting: false
  })
})

it('opens an addressed requester profile without redirecting an unconnected wallet', async () => {
  ;(useRouter as jest.Mock).mockReturnValue({
    isReady: true,
    route: '/profile/[account]',
    query: { account: address },
    asPath: `/profile/${address}`,
    replace
  })
  render(<PageProfile />)
  expect(await screen.findByText(`Profile ${address}`)).toBeInTheDocument()
  expect(replace).not.toHaveBeenCalled()
})

it('still requires a wallet for the personal profile', async () => {
  ;(useRouter as jest.Mock).mockReturnValue({
    isReady: true,
    route: '/profile',
    query: {},
    asPath: '/profile',
    replace
  })
  render(<PageProfile />)
  await waitFor(() =>
    expect(replace).toHaveBeenCalledWith('/auth/login?callbackUrl=%2Fprofile')
  )
})
