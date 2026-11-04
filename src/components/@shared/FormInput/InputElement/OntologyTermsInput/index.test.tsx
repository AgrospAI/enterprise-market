import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Field, Formik } from 'formik'
import OntologyTermsInput from './index'
import type { OntologyTerm } from 'src/@types/AgroPortal'

jest.mock('@oceanprotocol/lib', () => ({
  LoggerInstance: { error: jest.fn() }
}))

const name = 'metadata.ontologyTerms'

const searchResult = {
  page: 1,
  pageCount: 1,
  totalCount: 1,
  prevPage: null,
  nextPage: null,
  links: { nextPage: null, prevPage: null },
  collection: [
    {
      prefLabel: 'soil',
      obsolete: false,
      matchType: 'prefLabel',
      ontologyType: 'ONTOLOGY',
      '@id': 'https://lod.nal.usda.gov/nalt/63334',
      '@type': 'http://www.w3.org/2002/07/owl#Class',
      links: {
        ontology: 'https://data.agroportal.eu/ontologies/NALT',
        ui: 'https://agroportal.eu/ontologies/NALT?p=classes&conceptid=63334'
      }
    }
  ]
}

const soilTerm: OntologyTerm = {
  '@id': 'https://lod.nal.usda.gov/nalt/63334',
  '@type': 'skos:Concept',
  'skos:prefLabel': { '@value': 'soil', '@language': 'en' },
  'skos:inScheme': {
    '@id': 'https://data.agroportal.eu/ontologies/NALT',
    'rdfs:label': 'NALT'
  },
  'dct:source': {
    '@id': 'https://agroportal.eu/ontologies/NALT?p=classes&conceptid=63334'
  }
}

function renderForm(ontologyTerms: OntologyTerm[] = []) {
  return render(
    <Formik
      initialValues={{ metadata: { ontologyTerms } }}
      onSubmit={jest.fn()}
    >
      <>
        <OntologyTermsInput name={name} />
        <Field name={name}>
          {({ field }) => (
            <output data-testid="terms">{JSON.stringify(field.value)}</output>
          )}
        </Field>
      </>
    </Formik>
  )
}

describe('OntologyTermsInput', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            url.startsWith('/api/agroportal/ontologies')
              ? ['AGROVOC', 'NALT']
              : searchResult
          )
      })
    )
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => jest.clearAllMocks())

  it('searches AgroPortal and stores the selected term as SKOS JSON-LD', async () => {
    renderForm()

    fireEvent.change(screen.getByRole('combobox', { name: '' }), {
      target: { value: 'soil' }
    })

    const option = await screen.findByText('soil', {}, { timeout: 2000 })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/agroportal/search?q=soil&page=1&pagesize=10',
      expect.anything()
    )

    fireEvent.click(option)

    await waitFor(() =>
      expect(JSON.parse(screen.getByTestId('terms').textContent)).toEqual([
        soilTerm
      ])
    )
  })

  it('opens the source link without selecting the option', async () => {
    renderForm()

    fireEvent.change(screen.getByRole('combobox', { name: '' }), {
      target: { value: 'soil' }
    })

    const link = await screen.findByRole(
      'link',
      { name: 'Open soil in AgroPortal' },
      { timeout: 2000 }
    )
    expect(link).toHaveAttribute('href', soilTerm['dct:source']['@id'])
    expect(link).toHaveAttribute('target', '_blank')

    fireEvent.mouseDown(link)
    fireEvent.click(link)

    expect(JSON.parse(screen.getByTestId('terms').textContent)).toEqual([])
  })

  it('shows "Service unavailable" and no suggestions when AgroPortal fails', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve({ ok: false, status: 503, statusText: 'Unavailable' })
    )
    renderForm()

    fireEvent.change(screen.getByRole('combobox', { name: '' }), {
      target: { value: 'soil' }
    })

    expect(
      await screen.findByRole('alert', {}, { timeout: 2000 })
    ).toHaveTextContent('Service unavailable')
    expect(
      screen.queryByText('soil', { selector: 'span' })
    ).not.toBeInTheDocument()
  })

  it('renders the ontology filter below the terms input', () => {
    renderForm()

    const termsInput = screen.getByRole('combobox', { name: '' })
    const filterInput = screen.getByLabelText('Filter search by ontology')
    expect(
      termsInput.compareDocumentPosition(filterInput) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('renders existing terms from the form value', () => {
    renderForm([soilTerm])
    expect(screen.getByText('soil')).toBeInTheDocument()
    expect(screen.getByText('NALT')).toBeInTheDocument()
  })
})
