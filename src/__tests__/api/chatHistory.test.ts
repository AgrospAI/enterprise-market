import { checkHistory, didsInHistory } from '../../pages/api/chat/_history'

const REAL = `did:ope:${'a'.repeat(64)}`
const GONE = `did:ope:${'c'.repeat(64)}`
const FAKE = 'did:ope:20250612-porcine-health-welfare'
const link = (did: string) =>
  `[X](https://market.agrospai.udl.cat/asset/${did})`

describe('didsInHistory', () => {
  it('reads only assistant answers, most recent first, without repeats', () => {
    expect(
      didsInHistory([
        { role: 'user', content: `what is ${GONE}?` },
        { role: 'assistant', content: `${link(FAKE)} and ${link(REAL)}` },
        { role: 'assistant', content: link(REAL) }
      ])
    ).toEqual([REAL, FAKE])
  })
})

describe('checkHistory', () => {
  const mcp = {
    callTool: jest.fn(async (_name: string, args: Record<string, unknown>) =>
      args.did === REAL
        ? {
            text: '',
            isError: false,
            structured: {
              asset: {
                did: REAL,
                name: 'Real',
                services: [
                  { type: 'access', price: { type: 'free', amount: '0' } }
                ]
              }
            }
          }
        : { text: 'Asset not found', isError: true, structured: undefined }
    )
  }

  it('says which earlier assets exist, with their facts, and which do not', async () => {
    const result = await checkHistory(
      [
        { role: 'user', content: 'pigs' },
        {
          role: 'assistant',
          content: `${link(REAL)} ${link(FAKE)} ${link(GONE)}`
        }
      ],
      mcp
    )
    const { checkedNow } = JSON.parse(result as string)
    expect(checkedNow).toEqual([
      expect.objectContaining({
        did: REAL,
        exists: true,
        name: 'Real',
        services: [{ access: 'download', price: 'free' }]
      }),
      { did: FAKE, exists: false },
      { did: GONE, exists: false }
    ])
    // A DID that is not well formed is never looked up.
    expect(mcp.callTool).not.toHaveBeenCalledWith('get_asset', { did: FAKE })
  })

  it('says nothing without earlier assets', async () => {
    expect(
      await checkHistory([{ role: 'user', content: 'hola' }], mcp)
    ).toBeUndefined()
  })
})

describe('rewriteHistory', () => {
  const { rewriteHistory } = jest.requireActual('../../pages/api/chat/_history')
  it('removes lines with assets that do not exist and annotates real ones', () => {
    const result = JSON.stringify({
      checkedNow: [
        {
          did: REAL,
          exists: true,
          name: 'Real',
          services: [{ access: 'download', price: 'free' }]
        },
        { did: FAKE, exists: false }
      ]
    })
    const [user, answer] = rewriteHistory(
      [
        { role: 'user', content: 'pigs' },
        {
          role: 'assistant',
          content: `Hay 2:\n- ${link(REAL)} cuesta 25\n- ${link(
            FAKE
          )} inventado`
        }
      ],
      result
    )
    expect(user.content).toBe('pigs')
    expect(answer.content).toContain('[checked now: "Real" — free, download]')
    expect(answer.content).not.toContain(FAKE)
    expect(answer.content).toContain('removed by the server')
  })
})

describe('mustLookUp', () => {
  const { mustLookUp } = jest.requireActual('../../pages/api/chat/_loop')
  it('is required on follow-ups and on messages naming an asset or a DID', () => {
    expect(mustLookUp([{ role: 'user', content: 'datasets de vino' }])).toBe(
      false
    )
    expect(
      mustLookUp([{ role: 'user', content: 'detalles de "Red Wine Dataset"' }])
    ).toBe(true)
    expect(mustLookUp([{ role: 'user', content: `qué es ${FAKE}` }])).toBe(true)
    expect(
      mustLookUp([
        { role: 'user', content: 'hola' },
        { role: 'assistant', content: 'hola' },
        { role: 'user', content: 'y de cerdos?' }
      ])
    ).toBe(true)
  })
  it('is not required for a message carrying job results', () => {
    expect(
      mustLookUp([
        { role: 'user', content: 'a' },
        { role: 'assistant', content: 'b' },
        { role: 'user', content: 'results', attachment: { jobId: 'x' } }
      ])
    ).toBe(false)
  })
})
