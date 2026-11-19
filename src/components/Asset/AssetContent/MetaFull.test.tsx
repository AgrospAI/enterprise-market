import { render, screen } from '@testing-library/react'
import MetaFull from './MetaFull'
import { datasetAquarius } from '../../../../.jest/__fixtures__/datasetAquarius'
import { algorithmAquarius } from '../../../../.jest/__fixtures__/algorithmAquarius'

jest.mock(
  '@shared/Publisher',
  () =>
    function Publisher() {
      return <span>Publisher</span>
    }
)

describe('src/components/Asset/AssetContent/MetaFull.tsx', () => {
  it('renders a localhost OE Node endpoint as a link', () => {
    const serviceEndpoint = 'http://localhost:8000'
    render(
      <MetaFull
        ddo={{
          ...datasetAquarius,
          credentialSubject: {
            ...datasetAquarius.credentialSubject,
            services: [
              {
                ...datasetAquarius.credentialSubject.services[0],
                serviceEndpoint
              }
            ]
          }
        }}
      />
    )

    expect(screen.getByRole('link', { name: serviceEndpoint })).toHaveAttribute(
      'href',
      serviceEndpoint
    )
  })

  it.each([
    ['Cortez et al., 2009', undefined],
    ['not-a-url', undefined],
    ['javascript:alert(1)', undefined],
    ['https://', undefined],
    ['https://example.org/provider', 'https://example.org/provider'],
    ['example.org/provider', 'https://example.org/provider']
  ])(
    'renders provided by %s with the appropriate link behavior',
    (providedBy, href) => {
      render(
        <MetaFull
          ddo={{
            ...datasetAquarius,
            credentialSubject: {
              ...datasetAquarius.credentialSubject,
              metadata: {
                ...datasetAquarius.credentialSubject.metadata,
                providedBy
              }
            }
          }}
        />
      )

      const value = screen.getByText(providedBy)
      if (href) {
        expect(value.closest('a')).toHaveAttribute('href', href)
      } else {
        expect(value.closest('a')).toBeNull()
      }
    }
  )

  it('renders metadata', () => {
    render(<MetaFull ddo={datasetAquarius} />)
    expect(screen.getByText('Owner')).toBeInTheDocument()
  })

  it('renders metadata for an algorithm', () => {
    render(<MetaFull ddo={algorithmAquarius} />)
    expect(screen.getByText('Docker Image')).toBeInTheDocument()
    expect(screen.getByText('DID')).toBeInTheDocument()
  })

  it('renders the publisher DID when the issuer is available', () => {
    const issuer = 'did:ope:1234567890abcdef1234567890abcdef1234567890abcdef'

    render(<MetaFull ddo={{ ...datasetAquarius, issuer }} />)

    expect(screen.getByText('Publisher DID')).toBeInTheDocument()
    expect(screen.getByLabelText(issuer)).toBeInTheDocument()
  })

  it('does not render a docker image when an algorithm has no container', () => {
    const algorithmWithoutContainer = {
      ...algorithmAquarius,
      credentialSubject: {
        ...algorithmAquarius.credentialSubject,
        metadata: {
          ...algorithmAquarius.credentialSubject.metadata,
          algorithm: {
            ...algorithmAquarius.credentialSubject.metadata.algorithm,
            container: undefined
          }
        }
      }
    }

    render(<MetaFull ddo={algorithmWithoutContainer} />)

    expect(screen.queryByText('Docker Image')).not.toBeInTheDocument()
  })
})
