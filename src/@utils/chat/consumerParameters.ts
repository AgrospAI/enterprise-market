import type { IntentParameters } from 'src/@types/ChatIntent'

/**
 * The checks the MCP server runs on consumer parameters (agrospai-on-mcp
 * `resolveParameters`), run again in the browser against the DDO it loaded
 * itself: the values in an intent are only a proposal.
 */

interface DeclaredParameter {
  name: string
  type?: string
  label?: string
  required: boolean
  default?: string | number | boolean
  choices: string[]
}

export interface ResolvedParameters {
  values?: IntentParameters
  error?: string
}

/** Reads the parameter definitions of a DDO, whatever their exact shape. */
export function declaredParameters(raw: unknown): DeclaredParameter[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== 'object') return []
    const param = entry as Record<string, unknown>
    if (typeof param.name !== 'string') return []
    const value = param.default
    return [
      {
        name: param.name,
        type: typeof param.type === 'string' ? param.type : undefined,
        label: typeof param.label === 'string' ? param.label : undefined,
        required: param.required === true || param.required === 'true',
        default: ['string', 'number', 'boolean'].includes(typeof value)
          ? (value as string | number | boolean)
          : undefined,
        choices: Array.isArray(param.options)
          ? param.options.flatMap((option: unknown) =>
              option && typeof option === 'object' ? Object.keys(option) : []
            )
          : []
      }
    ]
  })
}

function coerce(
  param: DeclaredParameter,
  raw: string | number | boolean
): string | number | boolean | undefined {
  switch (param.type) {
    case 'number': {
      const value = typeof raw === 'number' ? raw : Number(raw)
      return typeof raw === 'boolean' || raw === '' || !Number.isFinite(value)
        ? undefined
        : value
    }
    case 'boolean':
      if (raw === true || raw === 'true') return true
      if (raw === false || raw === 'false') return false
      return undefined
    case 'select':
      return param.choices.includes(String(raw)) ? String(raw) : undefined
    default:
      return String(raw)
  }
}

/** Validates the values for the declared parameters and fills in defaults. */
export function resolveConsumerParameters(
  declared: DeclaredParameter[],
  given: IntentParameters | undefined,
  owner: string
): ResolvedParameters {
  const names = new Set(declared.map((param) => param.name))
  const unknown = Object.keys(given ?? {}).filter((name) => !names.has(name))
  if (unknown.length > 0) {
    return { error: `${owner} does not accept: ${unknown.join(', ')}` }
  }
  if (declared.length === 0) return {}

  const values: IntentParameters = {}
  for (const param of declared) {
    const raw = given?.[param.name] ?? param.default
    if (raw === undefined || raw === '') {
      if (param.required) {
        return { error: `${owner} needs a value for "${param.name}"` }
      }
      continue
    }
    const value = coerce(param, raw)
    if (value === undefined) {
      return {
        error: `${owner} has an invalid value for "${param.name}"`
      }
    }
    values[param.name] = value
  }
  return { values }
}
