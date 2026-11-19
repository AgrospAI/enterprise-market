import { translate } from './translate'
import { fireEvent, render, screen } from '@testing-library/react'
import { Trans, useLingui } from '@lingui/react'
import { useState } from 'react'
import { i18n } from './index'
import { LocaleProvider } from './Provider'
import LanguageSwitcher from './LanguageSwitcher'
import { localizeContent } from './localizeContent'

function Example() {
  useLingui()
  const [value, setValue] = useState('')
  return (
    <>
      <input
        aria-label="draft"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <span>
        <Trans id="Publish" />
      </span>
      <span>
        <Trans
          id="{count, plural, one {# transaction} other {# transactions}}"
          values={{ count: 2 }}
        />
      </span>
    </>
  )
}

afterEach(() => {
  i18n.activate('en')
  document.cookie = 'market-locale=; Path=/; Max-Age=0'
})

test('switches languages and plurals without losing an in-progress form', () => {
  render(
    <LocaleProvider>
      <LanguageSwitcher />
      <Example />
    </LocaleProvider>
  )
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Unfinished draft' }
  })
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'es' } })
  expect(screen.getByText('Publicar')).toBeInTheDocument()
  expect(screen.getByText('2 transacciones')).toBeInTheDocument()
  expect(document.documentElement.lang).toBe('es')
  expect(document.cookie).toContain('market-locale=es')
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'de' } })
  expect(screen.getByText('Veröffentlichen')).toBeInTheDocument()
  expect(screen.getByText('2 Transaktionen')).toBeInTheDocument()
  expect(screen.getByRole('textbox')).toHaveValue('Unfinished draft')
})

test('localizes lazy content while preserving form and protocol values', () => {
  const content = localizeContent(
    { label: 'Publish', name: 'publish', options: ['Active'] },
    ['label']
  )
  expect(content.label).toBe('Publish')
  i18n.activate('es')
  expect(content.label).toBe('Publicar')
  expect(content.name).toBe('publish')
  expect(content.options).toEqual(['Active'])
})

test('localizes interpolated server errors and preserves unknown upstream details', () => {
  i18n.activate('es')
  const source = 'Could not resolve the checksum for alpine:3.18.'
  const result = translate(source)
  expect(result).not.toBe(source)
  expect(result).toContain('alpine:3.18')
  expect(translate('Unrecognized upstream detail')).toBe(
    'Unrecognized upstream detail'
  )
})
