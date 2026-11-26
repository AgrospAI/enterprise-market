import { render } from '@testing-library/react'
import { PolicyEditor } from '.'

jest.mock('../FormInput', () => ({ __esModule: true, default: () => null }))

it('keeps existing VC policies when their controls are hidden in a service editor', () => {
  const setCredentials = jest.fn()
  render(
    <PolicyEditor
      name="credentials"
      credentials={{
        enabled: true,
        vcPolicies: ['signature'],
        vpPolicies: [],
        requestCredentials: []
      }}
      defaultPolicies={[]}
      enabledView
      hideDefaultPolicies
      setCredentials={setCredentials}
    />
  )
  expect(setCredentials).not.toHaveBeenCalledWith(
    expect.objectContaining({ vcPolicies: [] })
  )
})
