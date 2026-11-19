import type { IntentParameters } from 'src/@types/ChatIntent'

/**
 * The checks the MCP server runs on consumer parameters (agrospai-on-mcp
 * `resolveParameters`), run again in the browser against the DDO it loaded
 * itself: the values in an intent are only a proposal.
 */

export interface DeclaredParameter {
  name: string
  type?: string
  label?: string
  description?: string
  required: boolean
  default?: string | number | boolean
  /** The values a select accepts. */
  choices: string[]
  /** The label of each choice, by value. */
  choiceLabels: Record<string, string>
}

export type ParameterValue = string | number | boolean

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
    // Options are `{ value: label }` objects.
    const choiceLabels: Record<string, string> = {}
    if (Array.isArray(param.options)) {
      for (const option of param.options) {
        if (!option || typeof option !== 'object') continue
        for (const [choice, label] of Object.entries(option)) {
          choiceLabels[choice] = typeof label === 'string' ? label : choice
        }
      }
    }
    return [
      {
        name: param.name,
        type: typeof param.type === 'string' ? param.type : undefined,
        label: typeof param.label === 'string' ? param.label : undefined,
        description:
          typeof param.description === 'string' ? param.description : undefined,
        required: param.required === true || param.required === 'true',
        default: ['string', 'number', 'boolean'].includes(typeof value)
          ? (value as ParameterValue)
          : undefined,
        choices: Object.keys(choiceLabels),
        choiceLabels
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

/** Names given that the asset does not declare. */
export function unknownParameters(
  declared: DeclaredParameter[],
  given: IntentParameters | undefined
): string[] {
  const names = new Set(declared.map((param) => param.name))
  return Object.keys(given ?? {}).filter((name) => !names.has(name))
}

/**
 * Checks one value. Empty means "not sent", which only a required parameter
 * refuses.
 */
export function checkParameter(
  param: DeclaredParameter,
  raw: ParameterValue | undefined
): { value?: ParameterValue; problem?: 'missing' | 'invalid' } {
  if (raw === undefined || raw === '') {
    return param.required ? { problem: 'missing' } : {}
  }
  const value = coerce(param, raw)
  return value === undefined ? { problem: 'invalid' } : { value }
}

/** The values a form starts with: the ones given, or else the defaults. */
export function initialParameterValues(
  declared: DeclaredParameter[],
  given: IntentParameters | undefined
): Record<string, ParameterValue> {
  const values: Record<string, ParameterValue> = {}
  for (const param of declared) {
    const raw = given?.[param.name] ?? param.default
    if (raw !== undefined) values[param.name] = raw
  }
  return values
}

/** Validates the values for the declared parameters and fills in defaults. */
export function resolveConsumerParameters(
  declared: DeclaredParameter[],
  given: IntentParameters | undefined,
  owner: string
): ResolvedParameters {
  const unknown = unknownParameters(declared, given)
  if (unknown.length > 0) {
    return { error: `${owner} does not accept: ${unknown.join(', ')}` }
  }
  if (declared.length === 0) return {}

  const raw = initialParameterValues(declared, given)
  const values: IntentParameters = {}
  for (const param of declared) {
    const { value, problem } = checkParameter(param, raw[param.name])
    if (problem === 'missing') {
      return { error: `${owner} needs a value for "${param.name}"` }
    }
    if (problem === 'invalid') {
      return {
        error: `${owner} has an invalid value for "${param.name}"`
      }
    }
    if (value !== undefined) values[param.name] = value
  }
  return { values }
}

export type ParameterProblem = 'missing' | 'invalid'

/**
 * Checks every value of a form: the values to send, and the problem of each
 * field that has one.
 */
export function checkParameterValues(
  declared: DeclaredParameter[],
  raw: Record<string, ParameterValue>
): {
  values: IntentParameters
  problems: Record<string, ParameterProblem>
} {
  const values: IntentParameters = {}
  const problems: Record<string, ParameterProblem> = {}
  for (const param of declared) {
    const { value, problem } = checkParameter(param, raw[param.name])
    if (problem) problems[param.name] = problem
    else if (value !== undefined) values[param.name] = value
  }
  return { values, problems }
}
