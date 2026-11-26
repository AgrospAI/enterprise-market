import testRender from '../../../../.jest/testRender'
import AssetListTitle from '.'
import { render, screen } from '@testing-library/react'

jest.mock('../../../@utils/aquarius', () => ({
  getAsset: jest.fn().mockResolvedValue({
    credentialSubject: { metadata: { name: 'Resolved asset' } }
  })
}))

describe('AssetListTitle', () => {
  testRender(
    <AssetListTitle
      asset={
        { credentialSubject: { metadata: { name: 'Hello world' } } } as any
      }
    />
  )

  it('renders with passed title', () => {
    render(<AssetListTitle title="Hello Title" />)
  })

  it('resolves a passed DID', async () => {
    render(
      <AssetListTitle did="did:ope:764b81877039fa2651b919fc91c399799acb837f270e6d17bfb7973fbe6e9408" />
    )
    expect(await screen.findByTitle('Resolved asset')).toBeInTheDocument()
  })

  it('truncates and updates an explicit title', () => {
    const { rerender } = render(<AssetListTitle title="A long asset title" />)
    expect(screen.getByText('A long asset ...')).toBeInTheDocument()
    rerender(<AssetListTitle title="Short title" />)
    expect(screen.getByText('Short title')).toBeInTheDocument()
  })
})
