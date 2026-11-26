import { renderHook } from '@testing-library/react'
import { useAccount } from 'wagmi'
import { useAccountDisplayName } from './useAccountDisplayName'

jest.mock('wagmi', () => ({ useAccount: jest.fn() }))
jest.mock('@lingui/react', () => ({
  useLingui: () => ({ i18n: { _: () => '(tú)' } })
}))

const mockUseAccount = useAccount as jest.Mock

describe('useAccountDisplayName', () => {
  it('matches addresses without case sensitivity and updates when the wallet changes', () => {
    mockUseAccount.mockReturnValue({ address: '0xAbC' })
    const { result, rerender } = renderHook(() =>
      useAccountDisplayName('0xabc', 'Universitat de Lleida')
    )
    expect(result.current).toBe('Universitat de Lleida (tú)')

    mockUseAccount.mockReturnValue({ address: '0xdef' })
    rerender()
    expect(result.current).toBe('Universitat de Lleida')

    mockUseAccount.mockReturnValue({})
    rerender()
    expect(result.current).toBe('Universitat de Lleida')
  })

  it('does not mark an unresolved owner as the connected user', () => {
    mockUseAccount.mockReturnValue({})
    const { result } = renderHook(() => useAccountDisplayName(undefined, ''))
    expect(result.current).toBe('')
  })
})
