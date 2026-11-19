import { i18n } from './index'

let catalog: object
let patterns: Array<{ id: string; expression: RegExp; names: string[] }> = []
const escape = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Translate known server errors without changing the errors used by API logic. */
export function translate(message: string): string {
  if (!message) return message
  if (Object.prototype.hasOwnProperty.call(i18n.messages, message))
    return i18n._(message)
  if (catalog !== i18n.messages) {
    catalog = i18n.messages
    patterns = Object.keys(i18n.messages)
      .flatMap((id) => {
        const names: string[] = []
        if (/\b(plural|select|selectordinal)\s*,|<\d/.test(id)) return []
        let expression = ''
        let offset = 0
        let literalLength = 0
        for (const match of id.matchAll(/\{(\w+)\}/g)) {
          const literal = id.slice(offset, match.index)
          expression += escape(literal) + '(.*?)'
          literalLength += literal.length
          names.push(match[1])
          offset = match.index + match[0].length
        }
        const suffix = id.slice(offset)
        literalLength += suffix.length
        if (!names.length || literalLength < 12) return []
        return [
          {
            id,
            names,
            expression: new RegExp('^' + expression + escape(suffix) + '$', 's')
          }
        ]
      })
      .sort((a, b) => b.id.length - a.id.length)
  }
  for (const pattern of patterns) {
    const match = pattern.expression.exec(message)
    if (match)
      return i18n._(
        pattern.id,
        Object.fromEntries(
          pattern.names.map((name, index) => [name, match[index + 1]])
        )
      )
  }
  return message
}
