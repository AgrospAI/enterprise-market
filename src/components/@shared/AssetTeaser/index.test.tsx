import { render, screen } from '@testing-library/react'
import testRender from '../../../../.jest/testRender'
import AssetTeaser from './index'
import { asset } from '../../../../.jest/__fixtures__/datasetWithAccessDetails'

describe('@shared/AssetTeaser', () => {
  testRender(<AssetTeaser asset={asset} />)

  it('renders asset metadata without pricing', () => {
    const withoutPricing = { ...asset, accessDetails: [] }
    render(<AssetTeaser asset={withoutPricing} />)
    expect(
      screen.getByRole('heading', {
        name: asset.credentialSubject.metadata.name
      })
    ).toBeInTheDocument()
    expect(screen.getByText('This is a test.')).toBeInTheDocument()
  })
  it('renders asset teaser with no description', () => {
    const withoutDescription = {
      ...asset,
      credentialSubject: {
        ...asset.credentialSubject,
        metadata: { ...asset.credentialSubject.metadata, description: null }
      }
    }
    render(<AssetTeaser asset={withoutDescription} />)
    expect(
      screen.queryByText('This is a test description')
    ).not.toBeInTheDocument()
  })
})
