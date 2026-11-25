import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Formik } from 'formik'
import FilesInput from './index'
import { getFileInfo, checkValidProvider } from '@utils/provider'

jest.mock('@utils/provider', () => ({
  getFileInfo: jest.fn(),
  checkValidProvider: jest.fn()
}))

const fileUrl = 'https://example.com/data.csv'
const providerUrl = 'https://provider.example.com'

function renderFile(file: Record<string, unknown>) {
  return render(
    <Formik
      initialValues={{
        files: [file],
        services: [{ providerUrl: { url: providerUrl } }]
      }}
      onSubmit={jest.fn()}
    >
      {(form) => <FilesInput name="files" form={form} />}
    </Formik>
  )
}

describe('@shared/FormInput/InputElement/FilesInput', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(checkValidProvider as jest.Mock).mockResolvedValue(true)
    ;(getFileInfo as jest.Mock).mockResolvedValue([
      { valid: true, contentType: 'text/csv', contentLength: 100 }
    ])
  })

  it('validates a URL and persists the confirmed file in Formik', async () => {
    renderFile({ url: fileUrl, type: 'url' })
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }))
    expect(await screen.findByText('File confirmed')).toBeInTheDocument()
    expect(checkValidProvider).toHaveBeenCalledWith(providerUrl)
    expect(getFileInfo).toHaveBeenCalledWith(
      fileUrl,
      providerUrl,
      'url',
      undefined,
      undefined,
      1,
      'get'
    )
    expect(screen.getByDisplayValue(fileUrl)).toBeDisabled()
  })

  it.each([
    ['url', fileUrl],
    ['ipfs', 'bafkreicxccbk4blsx5qtovqfgsuutxjxom47dvyzyz3asi2ggjg5ipwlc4'],
    ['arweave', 'T6NL8Zc0LCbT3bF9HacAGQC4W0_hW7b3tXbm8OtWtlA']
  ])('renders a confirmed %s file', (type, url) => {
    renderFile({
      valid: true,
      type,
      url,
      contentType: 'text/csv',
      contentLength: 100
    })
    expect(screen.getByText('File confirmed')).toBeInTheDocument()
    expect(screen.getByDisplayValue(url)).toBeDisabled()
  })

  it('identifies encrypted files without displaying a fake URL', () => {
    renderFile({ valid: true, type: 'hidden', url: '[Encrypted file]' })
    expect(
      screen.getByText('Encrypted file (URL not editable)')
    ).toBeInTheDocument()
    expect(screen.queryByText('File confirmed')).not.toBeInTheDocument()
  })

  it('keeps invalid provider results unconfirmed', async () => {
    ;(checkValidProvider as jest.Mock).mockResolvedValue(false)
    renderFile({ url: fileUrl, type: 'url' })
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }))
    await waitFor(() => expect(checkValidProvider).toHaveBeenCalled())
    expect(getFileInfo).not.toHaveBeenCalled()
    expect(screen.queryByText('File confirmed')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue(fileUrl)).toBeEnabled()
  })

  it('renders a confirmed smart contract file', () => {
    renderFile({
      valid: true,
      type: 'smartcontract',
      url: '0x564955E9d25B49afE5Abd66966Ab4Bc9Ad55Fedb',
      abi: '[]'
    })
    expect(screen.getByText('File confirmed')).toBeInTheDocument()
  })
})
