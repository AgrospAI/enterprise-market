import { fireEvent, render, screen } from '@testing-library/react'
import { useAsset } from '@context/Asset'
import { decodeTokenURI } from '@utils/nft'
import Nft from './index'

jest.mock('@context/Asset', () => ({ useAsset: jest.fn() }))
jest.mock('@utils/nft', () => ({ decodeTokenURI: jest.fn() }))
jest.mock(
  '@shared/atoms/Tooltip',
  () =>
    ({ content }) =>
      content
)
jest.mock(
  './NftTooltip',
  () =>
    function NftTooltip({ nftImage }) {
      return <span data-testid="tooltip-image">{nftImage}</span>
    }
)

const brokenImage =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Red_and_white_wine_12-2015.jpg/240px-Red_and_white_wine_12-2015.jpg'

describe('NFT image fallback', () => {
  beforeEach(() => {
    ;(useAsset as jest.Mock).mockReturnValue({
      asset: { indexedMetadata: { nft: { name: 'Red Wine' } } }
    })
    ;(decodeTokenURI as jest.Mock).mockReturnValue({ image: brokenImage })
  })

  it('replaces a failed image with the default placeholder and clears the tooltip image', () => {
    const { rerender } = render(<Nft isBlockscoutExplorer={false} />)
    fireEvent.error(screen.getByRole('img', { name: 'Red Wine' }))

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByTestId('tooltip-image')).toBeEmptyDOMElement()
    ;(decodeTokenURI as jest.Mock).mockReturnValue({
      image: '/valid-image.png'
    })
    rerender(<Nft isBlockscoutExplorer={false} />)
    expect(screen.getByRole('img')).toHaveAttribute('src', '/valid-image.png')
  })

  it('uses the default placeholder when no image is set', () => {
    ;(decodeTokenURI as jest.Mock).mockReturnValue({})
    render(<Nft isBlockscoutExplorer={false} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
