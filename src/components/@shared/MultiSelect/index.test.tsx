import { fireEvent, render, screen } from '@testing-library/react'
import MultiSelect from '.'

const option = { value: '0xAbC', label: 'Publisher' }

it('clears the search after choosing an option', () => {
  const onSearch = jest.fn()
  const onChange = jest.fn()
  render(
    <MultiSelect
      id="publishers"
      label="Publishers"
      options={[option]}
      value={[]}
      onChange={onChange}
      onSearch={onSearch}
    />
  )
  const input = screen.getByRole('combobox', { name: 'Publishers' })
  fireEvent.change(input, { target: { value: 'Publisher' } })
  fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' })
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
  expect(onChange).toHaveBeenCalledWith([option])
  expect(onSearch).toHaveBeenLastCalledWith('')
})

it('does not offer to create a duplicate address with different casing', () => {
  render(
    <MultiSelect
      id="publishers"
      label="Publishers"
      options={[option]}
      value={[option]}
      onChange={jest.fn()}
      isValidNewOption={() => true}
    />
  )
  const input = screen.getByRole('combobox', { name: 'Publishers' })
  fireEvent.change(input, { target: { value: '0xabc' } })
  fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' })
  expect(screen.queryByText('Add 0xabc')).not.toBeInTheDocument()
})
