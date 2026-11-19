import { i18n } from '../../i18n/index'
interface Language {
  code: string
  name: string
  direction: 'ltr' | 'rtl'
}

export const supportedLanguages: Language[] = [
  {
    code: 'en',
    get name() {
      return i18n._('English')
    },
    direction: 'ltr'
  },
  {
    code: 'es',
    get name() {
      return i18n._('Spanish')
    },
    direction: 'ltr'
  },
  {
    code: 'fr',
    get name() {
      return i18n._('French')
    },
    direction: 'ltr'
  },
  {
    code: 'de',
    get name() {
      return i18n._('German')
    },
    direction: 'ltr'
  },
  {
    code: 'zh',
    get name() {
      return i18n._('Chinese')
    },
    direction: 'ltr'
  },
  {
    code: 'ja',
    get name() {
      return i18n._('Japanese')
    },
    direction: 'ltr'
  },
  {
    code: 'ru',
    get name() {
      return i18n._('Russian')
    },
    direction: 'ltr'
  },
  {
    code: 'pt',
    get name() {
      return i18n._('Portuguese')
    },
    direction: 'ltr'
  },
  {
    code: 'ar',
    get name() {
      return i18n._('Arabic')
    },
    direction: 'rtl'
  },
  {
    code: 'he',
    get name() {
      return i18n._('Hebrew')
    },
    direction: 'rtl'
  },
  {
    code: 'fa',
    get name() {
      return i18n._('Persian')
    },
    direction: 'rtl'
  },
  {
    code: 'ur',
    get name() {
      return i18n._('Urdu')
    },
    direction: 'rtl'
  },
  {
    code: 'hi',
    get name() {
      return i18n._('Hindi')
    },
    direction: 'ltr'
  },
  {
    code: 'ro',
    get name() {
      return i18n._('Romanian')
    },
    direction: 'ltr'
  },
  {
    code: 'it',
    get name() {
      return i18n._('Italian')
    },
    direction: 'ltr'
  },
  {
    code: 'nl',
    get name() {
      return i18n._('Dutch')
    },
    direction: 'ltr'
  },
  {
    code: 'tr',
    get name() {
      return i18n._('Turkish')
    },
    direction: 'ltr'
  },
  {
    code: 'ko',
    get name() {
      return i18n._('Korean')
    },
    direction: 'ltr'
  },
  {
    code: 'pl',
    get name() {
      return i18n._('Polish')
    },
    direction: 'ltr'
  }
]
