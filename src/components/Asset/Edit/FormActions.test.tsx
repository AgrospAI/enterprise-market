import { render, screen } from '@testing-library/react'
import { useFormikContext } from 'formik'
import { useAsset } from '@context/Asset'
import FormActions from './FormActions'

jest.mock('formik')
jest.mock('@context/Asset', () => ({ useAsset: jest.fn() }))

beforeEach(() => {
  ;(useAsset as jest.Mock).mockReturnValue({
    isAssetNetwork: true,
    asset: { id: 'test' }
  })
  ;(useFormikContext as jest.Mock).mockReturnValue({
    errors: {},
    isValid: true,
    isSubmitting: false,
    isValidating: false
  })
})

it('enables Submit for a valid form', () => {
  render(<FormActions />)
  expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled()
})

it('shows nested validation errors even for untouched fields', () => {
  ;(useFormikContext as jest.Mock).mockReturnValue({
    errors: {
      providedBy: 'Invalid URL',
      credentials: { vpPolicies: [{ args: 'Required' }] }
    },
    isValid: false
  })
  render(<FormActions />)
  expect(screen.getByRole('alert')).toHaveTextContent('providedBy: Invalid URL')
  expect(screen.getByRole('alert')).toHaveTextContent(
    'credentials.vpPolicies.0.args: Required'
  )
  expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
})

it('explains when the asset network is not connected', () => {
  ;(useAsset as jest.Mock).mockReturnValue({ isAssetNetwork: false })
  render(<FormActions />)
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Connect to the asset network'
  )
  expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled()
})
