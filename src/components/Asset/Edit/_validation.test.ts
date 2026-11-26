import { validateYupSchema } from 'formik'
import { getInitialValues } from './_constants'
import { getMetadataValidationSchema } from './_validation'
import { Metadata } from 'src/@types/ddo/Metadata'

jest.mock('@oceanprotocol/lib', () => ({
  LoggerInstance: { error: jest.fn() }
}))

const metadata = {
  type: 'algorithm',
  name: 'Ocean Algo Debugger',
  providedBy: 'Universitat de Lleida (UdL)',
  description: { '@value': 'Debugger for Ocean Algorithm Services' },
  license: { name: 'MIT' },
  algorithm: {
    container: {
      image: 'registry.agrospai.udl.cat/library/ocean-algo-debugger',
      tag: '0.2.0-enterprise-v5',
      checksum:
        'sha256:acd934ca483256b0a256ffdba2f99e7f7efa625f11da6d7eb6319e3957f61cd5',
      entrypoint: 'python /algorithm/src/main.py'
    }
  }
} as Metadata

const initialValues = () =>
  getInitialValues(metadata, { match_deny: 'any' }, [], 'Active')
const schema = getMetadataValidationSchema(metadata.providedBy)

it('allows a title-only edit of an existing asset with a provider name', async () => {
  const values = { ...initialValues(), name: 'Updated Ocean Algo Debugger' }
  await expect(validateYupSchema(values, schema)).resolves.toBeDefined()
})

it('validates a changed provider as a URL', async () => {
  const values = { ...initialValues(), providedBy: 'invalid provider' }
  await expect(validateYupSchema(values, schema)).rejects.toMatchObject({
    inner: expect.arrayContaining([
      expect.objectContaining({ path: 'providedBy' })
    ])
  })
  await expect(
    validateYupSchema({ ...values, providedBy: 'https://udl.cat' }, schema)
  ).resolves.toBeDefined()
})

it('still rejects an invalid title', async () => {
  await expect(
    validateYupSchema({ ...initialValues(), name: 'abc' }, schema)
  ).rejects.toMatchObject({
    inner: expect.arrayContaining([expect.objectContaining({ path: 'name' })])
  })
})
