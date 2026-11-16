import '../src/i18n'
import '@testing-library/jest-dom/extend-expect'
import { jest } from '@jest/globals'
import { ReadableStream } from 'node:stream/web'
import { TextDecoder, TextEncoder } from 'node:util'
import './__mocks__/matchMedia'
import './__mocks__/hooksMocks'
import './__mocks__/connectkit'

Object.assign(globalThis, {
  ReadableStream: globalThis.ReadableStream || ReadableStream,
  TextDecoder: globalThis.TextDecoder || TextDecoder,
  TextEncoder: globalThis.TextEncoder || TextEncoder
})

jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    route: '/',
    pathname: '/'
  }))
}))

// jest.mock('next/head', () => {
//   return {
//     __esModule: true,
//     default: ({ children }: { children: Array<React.ReactElement> }) => {
//       return <>{children}</>
//     }
//   }
// })

// Production components share the active Lingui context in tests as in the app.
jest.mock('@testing-library/react', () => {
  const actual = jest.requireActual<typeof import('@testing-library/react')>(
    '@testing-library/react'
  )
  const React = jest.requireActual<typeof import('react')>('react')
  const { I18nProvider } =
    jest.requireActual<typeof import('@lingui/react')>('@lingui/react')
  const { i18n } =
    jest.requireActual<typeof import('../src/i18n')>('../src/i18n')
  return {
    ...actual,
    render: (ui, options = {}) => {
      const { wrapper: Wrapper, ...rest } =
        options as import('@testing-library/react').RenderOptions
      const WithI18n = ({ children }) =>
        React.createElement(
          I18nProvider,
          { i18n },
          Wrapper ? React.createElement(Wrapper, null, children) : children
        )
      return actual.render(ui, { ...rest, wrapper: WithI18n })
    }
  }
})
