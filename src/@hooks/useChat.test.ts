import { RESULTS_QUESTION, planContext, toRequestMessages } from './useChat'
import { CHAT_MAX_CONTEXT_CHARS, ChatMessage } from 'src/@types/Chat'
import {
  computeIntent,
  jobResultAttachment
} from '../../.jest/__fixtures__/chatIntents'

jest.mock('@oceanprotocol/lib', () => ({
  LoggerInstance: { error: jest.fn() }
}))

describe('toRequestMessages', () => {
  it('sends only role, content and the latest job results', () => {
    const older = jobResultAttachment({ jobId: 'job-old' })
    const latest = jobResultAttachment({ jobId: 'job-new' })
    const history: ChatMessage[] = [
      { role: 'user', content: RESULTS_QUESTION, attachment: older },
      {
        role: 'assistant',
        content: 'It has 1599 rows.',
        steps: [{ type: 'tool', name: 'search_assets' }],
        intents: [computeIntent()]
      },
      { role: 'user', content: RESULTS_QUESTION, attachment: latest },
      { role: 'assistant', content: 'No duplicates.' },
      { role: 'user', content: 'And the alerts?' }
    ]

    expect(toRequestMessages(history)).toEqual([
      { role: 'user', content: RESULTS_QUESTION },
      { role: 'assistant', content: 'It has 1599 rows.' },
      { role: 'user', content: RESULTS_QUESTION, attachment: latest },
      { role: 'assistant', content: 'No duplicates.' },
      { role: 'user', content: 'And the alerts?' }
    ])
  })

  it('drops empty messages and sends many short ones', () => {
    const history: ChatMessage[] = [
      { role: 'assistant', content: '  ' },
      ...Array.from(
        { length: 25 },
        (_, i): ChatMessage => ({ role: 'user', content: String(i) })
      )
    ]
    const context = planContext(history)
    expect(context.messages).toHaveLength(25)
    expect(context.firstSent).toBe(0)
  })
})

describe('planContext', () => {
  const long = (role: ChatMessage['role'], i: number): ChatMessage => ({
    role,
    content: `${i}`.padEnd(8000, '.')
  })

  it('sends the newest messages that fit in the budget', () => {
    const history = Array.from({ length: 10 }, (_, i) =>
      long(i % 2 ? 'assistant' : 'user', i)
    )
    const context = planContext(history)
    const fit = Math.floor(CHAT_MAX_CONTEXT_CHARS / 8000)

    expect(context.messages).toHaveLength(fit)
    expect(context.firstSent).toBe(10 - fit)
    expect(context.messages[0].content).toBe(history[10 - fit].content)
    expect(context.chars).toBe(fit * 8000)
  })

  it('counts only the latest job results', () => {
    const results = jobResultAttachment({ jobId: 'job-new' })
    const resultChars = results.files.reduce(
      (chars, file) => chars + file.name.length + (file.text?.length ?? 0),
      0
    )
    const history: ChatMessage[] = [
      {
        role: 'user',
        content: 'a',
        attachment: jobResultAttachment({ jobId: 'job-old' })
      },
      { role: 'user', content: 'b', attachment: results }
    ]
    expect(planContext(history).chars).toBe(2 + resultChars)
  })

  it('always sends the latest message', () => {
    const context = planContext([long('user', 1)])
    expect(context.messages).toHaveLength(1)
    expect(context.firstSent).toBe(0)
  })
})
