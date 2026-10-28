type NamedParameter = { name?: unknown }

/**
 * Merge parameter definitions from more than one place (for example an
 * algorithm's service and its metadata) without repeating parameters that
 * share a name.
 */
export function mergeConsumerParameters<T extends NamedParameter>(
  ...groups: Array<T[] | undefined | null>
): T[] {
  const merged: T[] = []
  const seen = new Set<string>()

  for (const group of groups) {
    for (const parameter of group ?? []) {
      if (!parameter) continue

      const key =
        parameter.name === undefined
          ? JSON.stringify(parameter)
          : String(parameter.name)

      if (seen.has(key)) continue

      seen.add(key)
      merged.push(parameter)
    }
  }

  return merged
}
