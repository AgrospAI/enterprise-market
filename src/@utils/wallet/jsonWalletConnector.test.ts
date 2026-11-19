import { jsonWalletConnector } from './jsonWalletConnector'

jest.mock('wagmi', () => ({ createConnector: (factory) => factory }))
jest.mock('@oceanprotocol/lib', () => ({
  LoggerInstance: { log: jest.fn() }
}))

// Each connector represents a tab: sessionStorage is cleared between creations,
// while BroadcastChannel messages are delivered only to other channel instances.
class TestBroadcastChannel {
  static channels: TestBroadcastChannel[] = []
  onmessage: ((event: { data: unknown }) => void) | null = null
  constructor(public name: string) {
    TestBroadcastChannel.channels.push(this)
  }

  postMessage(data: unknown) {
    for (const channel of TestBroadcastChannel.channels) {
      if (channel !== this && channel.name === this.name) {
        queueMicrotask(() => channel.onmessage?.({ data }))
      }
    }
  }

  close() {
    TestBroadcastChannel.channels = TestBroadcastChannel.channels.filter(
      (channel) => channel !== this
    )
  }
}

const key = `0x${'1'.repeat(64)}`
const chains = [
  { id: 1, name: 'Ethereum' },
  { id: 137, name: 'Polygon' }
]
function createTab(persistSession = true) {
  const connector = jsonWalletConnector({ persistSession })({
    chains,
    emitter: { emit: jest.fn() }
  } as never)
  connector.setup?.()
  return connector
}

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  TestBroadcastChannel.channels = []
  Object.assign(globalThis, { BroadcastChannel: TestBroadcastChannel })
})

afterEach(() => {
  jest.useRealTimers()
})

it('reconnects a new tab with empty session storage to the unlocked wallet and chain', async () => {
  const original = createTab()
  original.loadWallet(key, 137)
  const connected = await original.connect()
  sessionStorage.clear()

  const newTab = createTab()
  expect(await newTab.isAuthorized()).toBe(true)
  expect(await newTab.connect()).toEqual(connected)
  expect(await newTab.getChainId()).toBe(137)
  expect(localStorage.getItem('jsonWallet:pk')).toBeNull()
})

it('still restores a refresh from tab-local session storage', async () => {
  createTab().loadWallet(key, 137)
  const refreshed = createTab()
  expect(await refreshed.isAuthorized()).toBe(true)
  expect(await refreshed.getChainId()).toBe(137)
})

it('does not share sessions when persistence is disabled', async () => {
  createTab(false).loadWallet(key)
  sessionStorage.clear()
  expect(await createTab(false).isAuthorized()).toBe(false)
})

it('clears all open tabs on disconnect so another tab cannot restore a logged-out wallet', async () => {
  const original = createTab()
  original.loadWallet(key)
  sessionStorage.clear()
  const other = createTab()
  expect(await other.isAuthorized()).toBe(true)
  await original.disconnect()
  await Promise.resolve()
  expect(other.isWalletLoaded()).toBe(false)
  expect(sessionStorage.getItem('jsonWallet:pk')).toBeNull()
})

it('returns unauthorized when no unlocked tab responds', async () => {
  jest.useFakeTimers()
  const result = createTab().isAuthorized()
  jest.advanceTimersByTime(1000)
  expect(await result).toBe(false)
})

it('supports tab-local restore when BroadcastChannel is unavailable', async () => {
  Object.assign(globalThis, { BroadcastChannel: undefined })
  createTab().loadWallet(key)
  expect(await createTab().isAuthorized()).toBe(true)
  sessionStorage.clear()
  expect(await createTab().isAuthorized()).toBe(false)
})
