import { RESULTS_QUESTION, toRequestMessages } from './useChat'
import type { ChatMessage } from 'src/@types/Chat'
import {
  computeIntent,
  jobResultAttachment
} from '../../.jest/__fixtures__/chatIntents'

jest.mock('@oceanprotocol/lib', () => ({ LoggerInstance: { error: jest.fn() } }))

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

  it('drops empty messages and keeps the latest ones', () => {
    const history: ChatMessage[] = [
      { role: 'assistant', content: '  ' },
      ...Array.from(
        { length: 25 },
        (_, i): ChatMessage => ({ role: 'user', content: String(i) })
      )
    ]
    const sent = toRequestMessages(history)
    expect(sent).toHaveLength(20)
    expect(sent[0].content).toBe('5')
  })
})
