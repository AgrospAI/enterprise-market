import { fireEvent, render, screen } from '@testing-library/react'
import MetaSecondary from './MetaSecondary'
import { datasetAquarius } from '../../../../.jest/__fixtures__/datasetAquarius'
import { algorithmAquarius } from '../../../../.jest/__fixtures__/algorithmAquarius'

describe('src/components/Asset/AssetContent/MetaSecondary.tsx', () => {
  it('renders tags', () => {
    render(<MetaSecondary ddo={datasetAquarius} />)
    expect(
      screen.getByText(datasetAquarius.credentialSubject.metadata.tags[0])
    ).toBeInTheDocument()
  })
  it('renders download sample button', () => {
    const sampleUrl = 'https://example.com/sample.csv'
    const ddo = {
      ...algorithmAquarius,
      credentialSubject: {
        ...algorithmAquarius.credentialSubject,
        services: algorithmAquarius.credentialSubject.services.map(
          (service) => ({
            ...service,
            links: { sample: sampleUrl }
          })
        )
      }
    }
    render(<MetaSecondary ddo={ddo} />)
    expect(screen.getByText('Sample Data')).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Show sample files (1)' })
    )
    expect(screen.getByRole('link', { name: 'sample.csv' })).toHaveAttribute(
      'href',
      sampleUrl
    )
  })
})
