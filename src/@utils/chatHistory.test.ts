import {
  CHAT_HISTORY_LIMIT,
  CHAT_HISTORY_TTL_MS,
  clearChatHistory,
  isChatStale,
  readChatHistory,
  readSavedChat,
  writeChatHistory
} from './chatHistory'
import type { ChatMessage } from 'src/@types/Chat'
import {
  computeIntent,
  jobResultAttachment
} from '../../.jest/__fixtures__/chatIntents'

const ADDRESS = '0xAbCdEf0000000000000000000000000000000001'
const OTHER = '0xAbCdEf0000000000000000000000000000000002'
const message: ChatMessage = { role: 'user', content: 'hi' }

describe('chat history', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => jest.restoreAllMocks())

  it('keeps one conversation per wallet', () => {
    writeChatHistory(ADDRESS, [message])

    expect(readChatHistory(ADDRESS)).toEqual([message])
    expect(readChatHistory(ADDRESS.toLowerCase())).toEqual([message])
    expect(readChatHistory(OTHER)).toEqual([])
  })

  it('keeps the job results sent with a message, so later questions have them', () => {
    const asked: ChatMessage = {
      role: 'user',
      content: 'What do the results of this job show?',
      attachment: jobResultAttachment()
    }
    writeChatHistory(ADDRESS, [asked])

    expect(readChatHistory(ADDRESS)).toEqual([asked])
  })

  it('drops job results that are not valid', () => {
    window.localStorage.setItem(
      `chat:${ADDRESS.toLowerCase()}`,
      JSON.stringify([
        { ...message, attachment: { kind: 'jobResult', jobId: 1 } },
        {
          role: 'assistant',
          content: 'ok',
          attachment: jobResultAttachment()
        }
      ])
    )

    expect(readChatHistory(ADDRESS)).toEqual([
      message,
      { role: 'assistant', content: 'ok' }
    ])
  })

  it('keeps only the latest messages', () => {
    const messages = Array.from(
      { length: CHAT_HISTORY_LIMIT + 5 },
      (_, i): ChatMessage => ({ role: 'user', content: String(i) })
    )
    writeChatHistory(ADDRESS, messages)

    const saved = readChatHistory(ADDRESS)
    expect(saved).toHaveLength(CHAT_HISTORY_LIMIT)
    expect(saved[0].content).toBe('5')
  })

  it('keeps when the conversation was last written', () => {
    writeChatHistory(ADDRESS, [message], 1_000)
    expect(readSavedChat(ADDRESS)).toEqual({
      messages: [message],
      updatedAt: 1_000
    })
  })

  it('reads conversations saved before the time was kept, as not stale', () => {
    window.localStorage.setItem(
      `chat:${ADDRESS.toLowerCase()}`,
      JSON.stringify([message])
    )
    const saved = readSavedChat(ADDRESS)
    expect(saved).toEqual({ messages: [message] })
    expect(isChatStale(saved)).toBe(false)
  })

  it('is stale only after the time limit', () => {
    const now = 10 * CHAT_HISTORY_TTL_MS
    const at = (age: number) => ({ messages: [message], updatedAt: now - age })
    expect(isChatStale(at(CHAT_HISTORY_TTL_MS), now)).toBe(false)
    expect(isChatStale(at(CHAT_HISTORY_TTL_MS + 1), now)).toBe(true)
  })

  it('deletes a conversation', () => {
    writeChatHistory(ADDRESS, [message])
    writeChatHistory(OTHER, [message])
    clearChatHistory(ADDRESS)

    expect(readChatHistory(ADDRESS)).toEqual([])
    expect(readChatHistory(OTHER)).toEqual([message])
  })

  it.each(['not json', '{"a":1}', 'null'])('ignores stored %s', (value) => {
    window.localStorage.setItem(`chat:${ADDRESS.toLowerCase()}`, value)
    expect(readChatHistory(ADDRESS)).toEqual([])
  })

  it('drops stored entries that are not messages', () => {
    window.localStorage.setItem(
      `chat:${ADDRESS.toLowerCase()}`,
      JSON.stringify([message, { role: 'system', content: 'x' }, 3])
    )
    expect(readChatHistory(ADDRESS)).toEqual([message])
  })

  it('keeps the steps of a message and drops invalid ones', () => {
    window.localStorage.setItem(
      `chat:${ADDRESS.toLowerCase()}`,
      JSON.stringify([
        {
          role: 'assistant',
          content: 'hi',
          steps: [
            { type: 'tool', name: 'search_assets' },
            { type: 'note', text: 'Looking' },
            { type: 'tool' },
            'nonsense'
          ]
        },
        { role: 'assistant', content: 'no steps', steps: 'nonsense' }
      ])
    )
    expect(readChatHistory(ADDRESS)).toEqual([
      {
        role: 'assistant',
        content: 'hi',
        steps: [
          { type: 'tool', name: 'search_assets' },
          { type: 'note', text: 'Looking' }
        ]
      },
      { role: 'assistant', content: 'no steps' }
    ])
  })

  it('keeps valid prepared actions and drops the rest', () => {
    window.localStorage.setItem(
      `chat:${ADDRESS.toLowerCase()}`,
      JSON.stringify([
        {
          role: 'assistant',
          content: 'Review the card.',
          intents: [computeIntent(), { ...computeIntent(), version: 9 }, 'x']
        }
      ])
    )
    expect(readChatHistory(ADDRESS)).toEqual([
      {
        role: 'assistant',
        content: 'Review the card.',
        intents: [computeIntent()]
      }
    ])
  })

  it('survives blocked storage', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(readChatHistory(ADDRESS)).toEqual([])
    expect(() => writeChatHistory(ADDRESS, [message])).not.toThrow()
    expect(() => clearChatHistory(ADDRESS)).not.toThrow()
  })
})
