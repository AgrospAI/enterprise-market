import { act, render, screen } from '@testing-library/react'
import { I18nProvider } from '@lingui/react'
import AssetType from '../components/@shared/AssetType'
import TabsFile from '../components/@shared/atoms/TabsFile'
import { Formik } from 'formik'
import { Feedback } from '../components/Publish/Submission/Feedback'

import { i18n } from './index'
import { contentPublishForm, contentPublishFeedback } from './content'

jest.mock('../components/Publish/Submission/TransactionCount', () => () => null)

afterEach(() => i18n.activate('en'))

test.each([
  ['Catalogue', 'Catálogo'],
  ['Unlock', 'Desbloquear'],
  ['Privacy Policy', 'Política de privacidad'],
  ['Links', 'Enlaces'],
  ['Download', 'Descarga'],
  ['Compute', 'Cómputo'],
  ['TemporaryDisabled', 'Temporalmente desactivado'],
  ['Unlisted', 'No enlistado'],
  ['Paid', 'De pago'],
  ['I agree to the', 'Acepto los'],
  ['This NFT represents an asset.', 'Este NFT representa un activo.']
])('uses the Spanish marketplace wording for %s', (id, expected) => {
  i18n.activate('es')
  expect(i18n._(id)).toBe(expected)
})

test('updates publish content and agreement prefixes without translating protocol names', () => {
  i18n.activate('es')
  expect(contentPublishForm.metadata.title).toBe('Metadatos del activo')
  expect(contentPublishForm.submission.title).toBe('Enviar')
  const agreement = contentPublishForm.metadata.fields.find(
    (field) => field.name === 'termsAndConditions'
  )
  expect(agreement.prefixes).toEqual(['Acepto los'])
  expect(contentPublishFeedback['1'].name).toBe('Crear Tokens y Precios')
  expect(contentPublishFeedback['1'].description).toContain('Datatokens')
  for (const name of [
    'URL',
    'S3',
    'IPFS',
    'Arweave',
    'FTP/FTPS',
    'EDC',
    'REA'
  ]) {
    expect(i18n._(name)).toBe(name)
  }
  i18n.activate('de')
  expect(contentPublishForm.submission.title).not.toBe('Enviar')
})

test('updates asset card labels when the language changes', () => {
  render(
    <I18nProvider i18n={i18n}>
      <AssetType type="dataset" accessType="access" />
      <AssetType type="algorithm" variant="metadata" />
    </I18nProvider>
  )
  expect(screen.getByText('Dataset')).toBeInTheDocument()
  act(() => i18n.activate('es'))
  expect(screen.getByText('Conjunto de datos')).toBeInTheDocument()
  expect(screen.getByText('Algoritmo')).toBeInTheDocument()
  expect(screen.getByText('Descarga')).toBeInTheDocument()
})

test('keeps storage protocol labels and their icons in Spanish', () => {
  i18n.activate('es')
  const protocols = [
    ['url', 'URL'],
    ['s3', 'S3'],
    ['ipfs', 'IPFS'],
    ['arweave', 'Arweave'],
    ['ftp', 'FTP/FTPS'],
    ['edc', 'EDC'],
    ['rea', 'REA']
  ]
  render(
    <I18nProvider i18n={i18n}>
      <Formik
        initialValues={{ files: [{ type: 's3', url: '' }] }}
        onSubmit={() => undefined}
      >
        <TabsFile
          items={protocols.map(([value, label]) => ({
            title: value === 's3' ? 'T3' : label,
            field: { value, label },
            props: { name: 'files' },
            content: <span />
          }))}
        />
      </Formik>
    </I18nProvider>
  )
  for (const [, label] of protocols) {
    const tab = screen.getByRole('tab', { name: label })
    expect(tab.querySelector('svg')).not.toBeNull()
  }
  expect(screen.queryByText('T3')).not.toBeInTheDocument()
})

test('updates publish feedback even when form state contains a previous translation', () => {
  i18n.activate('es')
  const feedback = JSON.parse(JSON.stringify(contentPublishFeedback))
  render(
    <I18nProvider i18n={i18n}>
      <Formik
        initialValues={{ feedback, user: { chainId: 1 } }}
        onSubmit={() => undefined}
      >
        <Feedback />
      </Formik>
    </I18nProvider>
  )
  expect(screen.getByText('Crear Tokens y Precios')).toBeInTheDocument()
  act(() => i18n.activate('en'))
  expect(screen.getByText('Create Tokens & Pricing')).toBeInTheDocument()
  expect(screen.queryByText('Crear Tokens y Precios')).not.toBeInTheDocument()
})
