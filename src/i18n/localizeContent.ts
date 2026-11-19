import { i18n } from './index'

/** Lazy getters keep imported form definitions in the active language. */
export function localizeContent<T extends object>(
  source: T,
  translatedPaths: string[]
): T {
  const paths = new Set(translatedPaths)
  const cache = new WeakMap<object, object>()
  function wrap(value: object, prefix = ''): object {
    if (cache.has(value)) return cache.get(value)
    const proxy = new Proxy(value, {
      get(target, key, receiver) {
        const result = Reflect.get(target, key, receiver)
        const path = prefix ? `${prefix}.${String(key)}` : String(key)
        if (typeof result === 'string' && paths.has(path))
          return i18n.locale ? i18n._(result) : result
        return result && typeof result === 'object'
          ? wrap(result, path)
          : result
      }
    })
    cache.set(value, proxy)
    return proxy
  }
  return wrap(source) as T
}
