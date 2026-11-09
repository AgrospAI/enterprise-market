import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/router'
import { useAccount, useSwitchChain } from 'wagmi'
import { useSiweSession } from '@hooks/useSiweSession'
import { ChatPanelProvider } from '@context/ChatPanel'
import Chat, { suggestionsFor } from '.'
import AssistantButton from './AssistantButton'

jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useSwitchChain: jest.fn()
}))
jest.mock('@hooks/useSiweSession', () => ({
  useSiweSession: jest.fn()
}))
jest.mock('@oceanprotocol/lib', () => ({
  LoggerInstance: { error: jest.fn() }
}))
jest.mock('@utils/markdown', () => ({
  markdownToChatHtml: (text: string) => `<p>${text}</p>`,
  markdownToHtml: (text: string) => `<p>${text}</p>`
}))

const ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const signIn = jest.fn()
const signOut = jest.fn()
const markSignedOut = jest.fn()
const switchChain = jest.fn()
const fetchMock = jest.fn()

function setSession(overrides = {}) {
  jest.mocked(useSiweSession).mockReturnValue({
    status: 'signedOut',
    sessionAddress: undefined,
    requiredChainId: 11155420,
    isOnRequiredChain: true,
    canSign: true,
    error: undefined,
    signIn,
    signOut,
    markSignedOut,
    ...overrides
  })
}

function streamResponse(lines: unknown[]) {
  const bytes = new TextEncoder().encode(
    lines.map((line) => `${JSON.stringify(line)}\n`).join('')
  )
  let sent = false
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () => {
          if (sent) return { done: true, value: undefined }
          sent = true
          return { done: false, value: bytes }
        }
      })
    }
  }
}

/** The panel and the header button that opens it, as the app renders them. */
function renderChat() {
  return render(
    <ChatPanelProvider>
      <AssistantButton />
      <Chat />
    </ChatPanelProvider>
  )
}

function setPath(pathname: string, query = {}) {
  jest.mocked(useRouter).mockImplementation(() => ({ pathname, query } as any))
}

function openPanel() {
  fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
}

function sendMessage(text: string) {
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: text }
  })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
}

describe('Chat', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    global.fetch = fetchMock
    window.HTMLElement.prototype.scrollIntoView = jest.fn()
    jest.mocked(useAccount).mockReturnValue({ isConnected: true } as any)
    jest
      .mocked(useSwitchChain)
      .mockReturnValue({ switchChain, isPending: false } as any)
    setSession()
    setPath('/')
  })

  it('renders nothing without a connected wallet', () => {
    jest.mocked(useAccount).mockReturnValue({ isConnected: false } as any)
    const { container } = renderChat()
    expect(container).toBeEmptyDOMElement()
  })

  it.each(['loading', 'disabled'])('renders nothing when %s', (status) => {
    setSession({ status })
    const { container } = renderChat()
    expect(container).toBeEmptyDOMElement()
  })

  it('asks to sign in before offering the conversation', () => {
    renderChat()
    openPanel()

    expect(screen.queryByLabelText('Message')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(signIn).toHaveBeenCalled()
  })

  it('asks to switch to the required network first', () => {
    setSession({ isOnRequiredChain: false })
    renderChat()
    openPanel()

    expect(
      screen.queryByRole('button', { name: 'Sign in' })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Switch network' }))
    expect(switchChain).toHaveBeenCalledWith({ chainId: 11155420 })
  })

  describe('signed in', () => {
    beforeEach(() => {
      setSession({ status: 'signedIn', sessionAddress: ADDRESS })
    })

    it('sends only role and content, and shows the answer', async () => {
      fetchMock.mockResolvedValue(
        streamResponse([
          { type: 'tool', name: 'search_assets', status: 'running' },
          { type: 'text', delta: 'Hello ' },
          { type: 'text', delta: 'there' },
          { type: 'done' }
        ])
      )
      renderChat()
      openPanel()
      sendMessage('find wine data')

      expect(await screen.findByText('Hello there')).toBeInTheDocument()
      expect(screen.getByText('find wine data')).toBeInTheDocument()
      const [path, init] = fetchMock.mock.calls[0]
      expect(path).toBe('/api/chat')
      expect(JSON.parse(init.body)).toEqual({
        messages: [{ role: 'user', content: 'find wine data' }]
      })
    })

    it('shows narration and tools as steps, apart from the answer', async () => {
      fetchMock.mockResolvedValue(
        streamResponse([
          { type: 'text', delta: 'Let me look.' },
          { type: 'narration' },
          { type: 'tool', name: 'search_assets', status: 'running' },
          { type: 'tool', name: 'search_assets', status: 'done' },
          { type: 'tool', name: 'get_asset', status: 'running' },
          { type: 'tool', name: 'get_asset', status: 'done' },
          { type: 'text', delta: 'One dataset.' },
          { type: 'done' }
        ])
      )
      renderChat()
      openPanel()
      sendMessage('wine?')

      const answer = await screen.findByText('One dataset.')
      expect(answer).not.toHaveTextContent(/Let me look/)
      expect(screen.getByText('Checked the market (2)')).toBeInTheDocument()
      const steps = screen.getByRole('group')
      expect(steps).toHaveTextContent('Let me look.')
      expect(steps).toHaveTextContent('Searched the catalogue')
      expect(steps).toHaveTextContent('Read the details of an asset')
    })

    it('never sends steps back to the server', async () => {
      window.localStorage.setItem(
        `chat:${ADDRESS.toLowerCase()}`,
        JSON.stringify([
          { role: 'user', content: 'first' },
          {
            role: 'assistant',
            content: 'answer',
            steps: [{ type: 'note', text: 'private note' }]
          }
        ])
      )
      fetchMock.mockResolvedValue(
        streamResponse([{ type: 'text', delta: 'ok' }, { type: 'done' }])
      )
      renderChat()
      openPanel()
      sendMessage('second')
      await screen.findByText('ok')

      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
        messages: [
          { role: 'user', content: 'first' },
          { role: 'assistant', content: 'answer' },
          { role: 'user', content: 'second' }
        ]
      })
    })

    it('leaves no empty answer behind when the stream fails', async () => {
      fetchMock.mockResolvedValueOnce(
        streamResponse([
          { type: 'tool', name: 'search_assets', status: 'running' },
          { type: 'error', message: 'The assistant is unavailable.' },
          { type: 'done' }
        ])
      )
      fetchMock.mockResolvedValueOnce(
        streamResponse([{ type: 'text', delta: 'ok' }, { type: 'done' }])
      )
      renderChat()
      openPanel()
      sendMessage('first')
      await screen.findByText('The assistant is unavailable.')
      await screen.findByRole('button', { name: 'Send' })
      sendMessage('second')
      await screen.findByText('ok')

      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
        messages: [
          { role: 'user', content: 'first' },
          { role: 'user', content: 'second' }
        ]
      })
    })

    it('saves the conversation per wallet and restores it', async () => {
      fetchMock.mockResolvedValue(
        streamResponse([{ type: 'text', delta: 'Saved' }, { type: 'done' }])
      )
      const { unmount } = renderChat()
      openPanel()
      sendMessage('hi')
      await screen.findByText('Saved')
      await waitFor(() =>
        expect(
          window.localStorage.getItem(`chat:${ADDRESS.toLowerCase()}`)
        ).toContain('Saved')
      )
      unmount()

      renderChat()
      openPanel()
      expect(screen.getByText('Saved')).toBeInTheDocument()
    })

    it('deletes the conversation', async () => {
      fetchMock.mockResolvedValue(
        streamResponse([{ type: 'text', delta: 'Gone' }, { type: 'done' }])
      )
      renderChat()
      openPanel()
      sendMessage('hi')
      await screen.findByText('Gone')
      await screen.findByRole('button', { name: 'Send' })

      fireEvent.click(screen.getByRole('button', { name: 'New conversation' }))

      expect(screen.queryByText('Gone')).not.toBeInTheDocument()
      expect(
        window.localStorage.getItem(`chat:${ADDRESS.toLowerCase()}`)
      ).toBeNull()
    })

    it('leaves the conversation when the server says the session ended', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 401, body: null })
      renderChat()
      openPanel()
      sendMessage('hi')

      await waitFor(() => expect(markSignedOut).toHaveBeenCalled())
    })

    it('explains the rate limit', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 429, body: null })
      renderChat()
      openPanel()
      sendMessage('hi')

      expect(
        await screen.findByText('Too many messages. Please wait a moment.')
      ).toBeInTheDocument()
    })

    it('shows errors from the stream', async () => {
      fetchMock.mockResolvedValue(
        streamResponse([
          { type: 'error', message: 'The assistant is unavailable.' },
          { type: 'done' }
        ])
      )
      renderChat()
      openPanel()
      sendMessage('hi')

      expect(
        await screen.findByText('The assistant is unavailable.')
      ).toBeInTheDocument()
    })

    it('signs out on request', () => {
      renderChat()
      openPanel()
      fireEvent.click(screen.getByRole('button', { name: 'More options' }))
      fireEvent.click(
        screen.getByRole('menuitem', { name: 'Sign out of chat' })
      )
      expect(signOut).toHaveBeenCalled()
    })

    it('starts with suggestions for the page, and sends the one picked', async () => {
      fetchMock.mockResolvedValue(
        streamResponse([{ type: 'text', delta: 'Soil data' }, { type: 'done' }])
      )
      renderChat()
      openPanel()
      expect(
        screen.getByRole('button', { name: 'New conversation' })
      ).toBeDisabled()

      fireEvent.click(
        screen.getByRole('button', {
          name: 'Find datasets about soil or crops'
        })
      )

      expect(await screen.findByText('Soil data')).toBeInTheDocument()
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
        messages: [
          { role: 'user', content: 'Find datasets about soil or crops' }
        ]
      })
    })
  })

  describe('panel', () => {
    it('shows the header button only while the chat can be used', () => {
      jest.mocked(useAccount).mockReturnValue({ isConnected: false } as any)
      const { rerender } = renderChat()
      expect(
        screen.queryByRole('button', { name: 'Ask AI' })
      ).not.toBeInTheDocument()

      jest.mocked(useAccount).mockReturnValue({ isConnected: true } as any)
      rerender(
        <ChatPanelProvider>
          <AssistantButton />
          <Chat />
        </ChatPanelProvider>
      )
      expect(screen.getByRole('button', { name: 'Ask AI' })).toHaveAttribute(
        'aria-expanded',
        'false'
      )
    })

    it('stays out of the publish steps', () => {
      setPath('/publish/[step]')
      renderChat()
      expect(
        screen.queryByRole('button', { name: 'Ask AI' })
      ).not.toBeInTheDocument()
    })

    it('opens from the header, takes the focus, and gives it back on Escape', () => {
      setSession({ status: 'signedIn', sessionAddress: ADDRESS })
      renderChat()
      const button = screen.getByRole('button', { name: 'Ask AI' })
      button.focus()
      fireEvent.click(button)

      expect(button).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByLabelText('Message')).toHaveFocus()

      fireEvent.keyDown(screen.getByLabelText('Message'), { key: 'Escape' })
      expect(button).toHaveAttribute('aria-expanded', 'false')
      expect(button).toHaveFocus()
    })

    it('after a mouse click, lets the focus go on close instead of ringing the button', () => {
      setSession({ status: 'signedIn', sessionAddress: ADDRESS })
      renderChat()
      const button = screen.getByRole('button', { name: 'Ask AI' })
      fireEvent.pointerDown(button)
      button.focus()
      fireEvent.click(button)
      expect(screen.getByLabelText('Message')).toHaveFocus()

      fireEvent.keyDown(screen.getByLabelText('Message'), { key: 'Escape' })
      expect(button).toHaveAttribute('aria-expanded', 'false')
      expect(button).not.toHaveFocus()
      expect(screen.getByLabelText('Message')).not.toHaveFocus()
    })

    it('closes from its own close button', () => {
      renderChat()
      openPanel()
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      expect(screen.getByRole('button', { name: 'Ask AI' })).toHaveAttribute(
        'aria-expanded',
        'false'
      )
    })

    it('opens and closes with the keyboard shortcut', () => {
      renderChat()
      const button = screen.getByRole('button', { name: 'Ask AI' })
      fireEvent.keyDown(window, { key: '/', ctrlKey: true, metaKey: true })
      expect(button).toHaveAttribute('aria-expanded', 'true')
      fireEvent.keyDown(window, { key: '/', ctrlKey: true, metaKey: true })
      expect(button).toHaveAttribute('aria-expanded', 'false')
    })

    it('can be made wider and narrower', () => {
      renderChat()
      openPanel()
      fireEvent.click(screen.getByRole('button', { name: 'Make wider' }))
      fireEvent.click(screen.getByRole('button', { name: 'Make narrower' }))
      expect(
        screen.getByRole('button', { name: 'Make wider' })
      ).toBeInTheDocument()
    })
  })
})

describe('suggestionsFor', () => {
  const DID = 'did:ope:abc'

  it('asks about the asset on its page, naming it in the prompt only', () => {
    const [first] = suggestionsFor('/asset/[did]', DID)
    expect(first.label).not.toContain(DID)
    expect(first.prompt).toContain(DID)
  })

  it('has catalogue questions on the search page and general ones elsewhere', () => {
    expect(suggestionsFor('/search').map((s) => s.label)).toContain(
      'Find free datasets I can download'
    )
    expect(suggestionsFor('/profile').map((s) => s.label)).toContain(
      'Find datasets about soil or crops'
    )
  })
})
