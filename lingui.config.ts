import { formatter } from '@lingui/format-po'
import type { LinguiConfig } from '@lingui/conf'

const config: LinguiConfig = {
  locales: ['en', 'es', 'de'],
  sourceLocale: 'en',
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['<rootDir>/src'],
      exclude: ['**/*.test.*', '**/*.spec.*', '**/locales/**']
    }
  ],
  format: formatter({ lineNumbers: false }),
  compileNamespace: 'es'
}
export default config
