import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Formik, getIn, useFormikContext } from 'formik'
import AccessRulesSection from '.'

// Isolate the access-rule state machine from unrelated file/storage input widgets.
jest.mock('@components/@shared/FormInput', () => ({
  __esModule: true,
  default: ({ name, value, options, onChange, disabled }) => (
    <select
      aria-label={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
    >
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  )
}))
jest.mock('@components/@shared/FormInput/InputElement', () => ({
  __esModule: true,
  default: ({ name, ...props }) => <input aria-label={name} {...props} />
}))
jest.mock('@shared/atoms/Tooltip', () => ({
  __esModule: true,
  default: () => null
}))

function Snapshot({ prefix }: { prefix: string }) {
  const { values } = useFormikContext()
  return (
    <output data-testid="credentials">
      {JSON.stringify(getIn(values, prefix))}
    </output>
  )
}

describe.each([
  'credentials',
  'services[0].credentials',
  'services[1].credentials'
])('%s', (prefix) => {
  it.each(['allow', 'deny'] as const)(
    'removes the %s wildcard without reinserting it',
    async (list) => {
      const credentials = { allow: [], deny: [], [list]: ['*'] }
      render(
        <Formik
          initialValues={{
            credentials,
            services: [{ credentials }, { credentials }]
          }}
          onSubmit={jest.fn()}
        >
          <>
            <AccessRulesSection fieldPrefix={prefix} />
            <Snapshot prefix={prefix} />
          </>
        </Formik>
      )
      const dropdown = screen.getByRole('combobox', { name: `${list}Dropdown` })
      await waitFor(() => expect(dropdown).toBeDisabled())
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
      await waitFor(() => {
        expect(
          screen.queryByRole('textbox', { name: `${list}Address-0` })
        ).not.toBeInTheDocument()
      })
      expect(
        JSON.parse(screen.getByTestId('credentials').textContent)[list]
      ).toEqual([])
      expect(dropdown).toHaveValue('Please select an option')
      fireEvent.change(dropdown, {
        target: {
          value: list === 'allow' ? 'Allow all addresses' : 'Deny all addresses'
        }
      })
      await waitFor(() =>
        expect(
          JSON.parse(screen.getByTestId('credentials').textContent)[list]
        ).toEqual(['*'])
      )
    }
  )

  it('stores pending and added addresses at the requested credential path', async () => {
    const address = '0x0000000000000000000000000000000000000001'
    render(
      <Formik
        initialValues={{
          credentials: {},
          services: [{ credentials: {} }, { credentials: {} }]
        }}
        onSubmit={jest.fn()}
      >
        <>
          <AccessRulesSection fieldPrefix={prefix} />
          <Snapshot prefix={prefix} />
        </>
      </Formik>
    )
    fireEvent.change(screen.getByRole('combobox', { name: 'allowDropdown' }), {
      target: { value: 'Allow specific addresses' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'allowAddress' }), {
      target: { value: address }
    })
    await waitFor(() =>
      expect(
        JSON.parse(screen.getByTestId('credentials').textContent)
          .allowInputValue
      ).toBe(address)
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add new address' }))
    await waitFor(() =>
      expect(
        JSON.parse(screen.getByTestId('credentials').textContent)
      ).toMatchObject({ allow: [address], allowInputValue: '' })
    )
  })
})
