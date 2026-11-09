const WINDOW_MS = 60_000

/**
 * Fixed-window limit per key. State is per process, so with several replicas the
 * effective limit is multiplied by their number.
 */
export function createRateLimiter(
  limit: number,
  now: () => number = Date.now
): (key: string) => { allowed: boolean; retryAfterSeconds: number } {
  const windows = new Map<string, { count: number; resetsAt: number }>()

  return (key) => {
    const time = now()
    windows.forEach((window, windowKey) => {
      if (window.resetsAt <= time) windows.delete(windowKey)
    })

    const window = windows.get(key) ?? { count: 0, resetsAt: time + WINDOW_MS }
    window.count++
    windows.set(key, window)

    return {
      allowed: window.count <= limit,
      retryAfterSeconds: Math.ceil((window.resetsAt - time) / 1000)
    }
  }
}
