import { gzipSync } from 'node:zlib'
import { DecompressionStream } from 'node:stream/web'
import { ProviderInstance } from '@oceanprotocol/lib'
import {
  demuxDockerLog,
  fitFiles,
  htmlToText,
  pickResult,
  readJobResults,
  readResultFiles,
  readTar,
  reportName,
  reportPage
} from './jobResults'

jest.mock('@oceanprotocol/lib', () => ({
  ProviderInstance: { getComputeResultUrl: jest.fn() }
}))

Object.assign(globalThis, {
  DecompressionStream: globalThis.DecompressionStream || DecompressionStream
})

const encoder = new TextEncoder()

function tarHeader(name: string, size: number, type = '0'): Uint8Array {
  const header = new Uint8Array(512)
  header.set(encoder.encode(name.slice(0, 100)), 0)
  header.set(encoder.encode(size.toString(8).padStart(11, '0')), 124)
  header.set(encoder.encode(type), 156)
  header.set(encoder.encode('ustar'), 257)
  return header
}

function pad(data: Uint8Array): Uint8Array {
  const padded = new Uint8Array(Math.ceil(data.length / 512) * 512)
  padded.set(data)
  return padded
}

/** A ustar archive of the files given, with a GNU long name when needed. */
function tar(files: Record<string, string | Uint8Array>): Uint8Array {
  const parts: Uint8Array[] = []
  for (const [name, content] of Object.entries(files)) {
    const data = typeof content === 'string' ? encoder.encode(content) : content
    if (name.length > 100) {
      const long = encoder.encode(`${name}\0`)
      parts.push(tarHeader('././@LongLink', long.length, 'L'), pad(long))
    }
    parts.push(tarHeader(name, data.length), pad(data))
  }
  parts.push(new Uint8Array(1024))
  const archive = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const part of parts) {
    archive.set(part, at)
    at += part.length
  }
  return archive
}

const REPORT = `<!doctype html><html><head><title>Profiling Report</title>
<style>.x{color:red}</style><script>alert('x')</script></head>
<body><nav>Overview</nav><h1>Overview</h1>
<table><tr><th>Number of variables</th><td>12</td></tr>
<tr><th>Number of observations</th><td>1599</td></tr></table>
<p>Alerts</p><ul><li>fixed acidity is highly correlated with citric acid</li></ul>
<img src="data:image/png;base64,AAAA"><svg><text>chart</text></svg>
<div hidden>secret</div></body></html>`

describe('readTar', () => {
  it('lists the files of an archive, with long names', () => {
    const long = `outputs/${'a'.repeat(120)}.json`
    const entries = readTar(tar({ 'outputs/a.txt': 'hello', [long]: '{}' }))
    expect(entries.map(({ name, size }) => ({ name, size }))).toEqual([
      { name: 'outputs/a.txt', size: 5 },
      { name: long, size: 2 }
    ])
    expect(new TextDecoder().decode(entries[0].data)).toBe('hello')
  })

  it('marks the last file of a cut archive', () => {
    const archive = tar({ 'a.txt': 'x'.repeat(1000) })
    const [entry] = readTar(archive.subarray(0, 700))
    expect(entry.truncated).toBe(true)
  })
})

describe('htmlToText', () => {
  it('keeps the text of a report, one block per line, without code or images', () => {
    expect(htmlToText(REPORT)).toBe(
      [
        'Profiling Report',
        'Overview',
        'Number of variables | 12',
        'Number of observations | 1599',
        'Alerts',
        'fixed acidity is highly correlated with citric acid'
      ].join('\n')
    )
  })
})

describe('readResultFiles', () => {
  it('unpacks a gzipped archive and reads its HTML as text', async () => {
    const archive = gzipSync(
      tar({ 'outputs/report.html': REPORT, 'outputs/plot.png': '\0PNG' })
    )
    const files = await readResultFiles('outputs.tar', 10, archive, false)
    expect(files).toEqual([
      {
        name: 'outputs/report.html',
        size: REPORT.length,
        cut: false,
        text: expect.stringContaining('Number of observations | 1599'),
        html: REPORT
      },
      { name: 'outputs/plot.png', size: 4, cut: false }
    ])
  })

  it('reads a single file that is not an archive', async () => {
    const files = await readResultFiles(
      'result.json',
      7,
      encoder.encode('{"a":1}'),
      false
    )
    expect(files).toEqual([
      { name: 'result.json', size: 7, cut: false, text: '{"a":1}' }
    ])
  })
})

describe('fitFiles', () => {
  const file = (name: string, text?: string) => ({
    name,
    size: text?.length ?? 100,
    cut: false,
    ...(text !== undefined ? { text } : {})
  })

  it('gives the budget to the smallest files first', () => {
    const files = fitFiles(
      [file('big.html', 'b'.repeat(30)), file('summary.json', 's'.repeat(5))],
      20
    )
    expect(files).toEqual([
      { name: 'big.html', size: 30, text: 'b'.repeat(15), truncated: true },
      { name: 'summary.json', size: 5, text: 's'.repeat(5), truncated: false }
    ])
  })

  it('leaves out what does not fit and lists binaries without text', () => {
    const files = fitFiles(
      [file('a.txt', 'aaaa'), file('b.txt', 'bbbbb'), file('c.png')],
      4
    )
    expect(files).toEqual([
      { name: 'a.txt', size: 4, text: 'aaaa', truncated: false },
      { name: 'b.txt', size: 5, truncated: true },
      { name: 'c.png', size: 100, truncated: false }
    ])
  })

  it('keeps the end of a log', () => {
    const [log] = fitFiles([file('algorithm.log', 'start…error')], 5, true)
    expect(log.text).toBe('error')
  })
})

describe('pickResult', () => {
  const output = { type: 'output', filename: 'outputs.tar', filesize: 10 }
  const log = { type: 'algorithmLog', filename: 'algorithm.log', filesize: 5 }

  it('reads the outputs of a job that worked', () => {
    expect(pickResult({ results: [log, output] as never })).toEqual({
      result: output,
      index: 1,
      succeeded: true
    })
  })

  it('reads the log when the job wrote no output', () => {
    expect(
      pickResult({
        results: [
          { ...output, filesize: 0, index: 3 },
          { ...log, index: 4 }
        ] as never
      })
    ).toEqual({ result: { ...log, index: 4 }, index: 4, succeeded: false })
  })

  it('finds nothing in a job without results', () => {
    expect(pickResult({ results: undefined })).toBeUndefined()
  })
})

describe('reportPage', () => {
  const html = `<p class="x">a & b</p><script>window.top.location = "x"</script>`

  it('shows the report in a sandbox that keeps it away from the market', () => {
    const page = new DOMParser().parseFromString(
      reportPage('map".html', html),
      'text/html'
    )
    const frames = page.querySelectorAll('iframe')
    expect(frames).toHaveLength(1)
    // Brought into this document, where jest-dom can read it.
    const frame = document.importNode(frames[0])
    expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-popups')
    expect(frame).toHaveAttribute('srcdoc', html)
    expect(page.title).toBe('map".html')
    // The page around the report runs nothing.
    expect(page.querySelectorAll('script')).toHaveLength(0)
  })

  it('names a report by its file, without folders', () => {
    expect(reportName('outputs/maps/report.html')).toBe('report.html')
  })
})

describe('demuxDockerLog', () => {
  it('removes the Docker stream headers', () => {
    const frame = (stream: number, text: string) => {
      const data = encoder.encode(text)
      const header = new Uint8Array(8)
      header[0] = stream
      new DataView(header.buffer).setUint32(4, data.length)
      return [...header, ...data]
    }
    const bytes = new Uint8Array([...frame(1, 'out '), ...frame(2, 'err')])
    expect(new TextDecoder().decode(demuxDockerLog(bytes))).toBe('out err')
  })
})

describe('readJobResults', () => {
  const signer = { getAddress: async () => '0xUser' } as never

  const createObjectURL = jest.fn((blob: Blob) => `blob:${blob.type}`)

  beforeEach(() => {
    jest.clearAllMocks()
    URL.createObjectURL = createObjectURL
    jest
      .mocked(ProviderInstance.getComputeResultUrl)
      .mockResolvedValue('https://node.example/result?signature=s')
  })

  it('signs for the outputs of the job and reads them as text', async () => {
    const archive = tar({ 'outputs/report.html': REPORT })
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      body: null,
      arrayBuffer: async () => archive.buffer
    })) as never

    const { attachment, reports } = await readJobResults({
      providerUrl: 'https://node.example',
      signer,
      job: {
        jobId: 'env-job-1',
        results: [
          { type: 'algorithmLog', filename: 'algorithm.log', filesize: 5 },
          { type: 'output', filename: 'outputs.tar', filesize: 2048 }
        ]
      } as never,
      dataset: 'Red Wine Dataset',
      algorithm: 'Enhanced EDA'
    })

    expect(ProviderInstance.getComputeResultUrl).toHaveBeenCalledWith(
      'https://node.example',
      signer,
      'env-job-1',
      1
    )
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://node.example/result?signature=s'
    )
    expect(attachment).toEqual({
      kind: 'jobResult',
      jobId: 'env-job-1',
      dataset: 'Red Wine Dataset',
      algorithm: 'Enhanced EDA',
      succeeded: true,
      files: [
        {
          name: 'outputs/report.html',
          size: REPORT.length,
          text: expect.stringContaining('fixed acidity is highly correlated'),
          truncated: false
        }
      ]
    })
    expect(reports).toEqual([{ name: 'report.html', url: 'blob:text/html' }])
    expect(createObjectURL).toHaveBeenCalledTimes(1)
  })

  it('gives no report link for the log of a failed job', async () => {
    const log = encoder.encode('<html>Traceback</html>')
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      body: null,
      arrayBuffer: async () => log.buffer
    })) as never

    const { attachment, reports } = await readJobResults({
      providerUrl: 'https://node.example',
      signer,
      job: {
        jobId: 'job-1',
        results: [
          { type: 'algorithmLog', filename: 'algorithm.html', filesize: 22 }
        ]
      } as never,
      dataset: 'd',
      algorithm: 'a'
    })
    expect(attachment.succeeded).toBe(false)
    expect(reports).toEqual([])
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('says when the node refuses the results', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: false,
      status: 403
    })) as never
    await expect(
      readJobResults({
        providerUrl: 'https://node.example',
        signer,
        job: {
          jobId: 'job-1',
          results: [{ type: 'output', filename: 'o.tar', filesize: 1 }]
        } as never,
        dataset: 'd',
        algorithm: 'a'
      })
    ).rejects.toThrow('The node did not give the results (403).')
  })

  it('refuses a job without results before asking for a signature', async () => {
    await expect(
      readJobResults({
        providerUrl: 'https://node.example',
        signer,
        job: { jobId: 'job-1', results: [] } as never,
        dataset: 'd',
        algorithm: 'a'
      })
    ).rejects.toThrow('The job has no results to read yet.')
    expect(ProviderInstance.getComputeResultUrl).not.toHaveBeenCalled()
  })
})
