import { ComputeJob, ComputeResult, ProviderInstance } from '@oceanprotocol/lib'
import type { Signer } from 'ethers'
import {
  CHAT_MAX_ATTACHMENT_CHARS,
  CHAT_MAX_ATTACHMENT_FILES,
  JobResultAttachment,
  JobResultFile
} from 'src/@types/Chat'

/**
 * Reads the results of one of the user's jobs in the browser, so the assistant
 * can talk about them. The node gives a job's results only to its owner, with a
 * fresh signature, so neither the chat server nor the MCP can read them.
 */

/** Largest result file downloaded: an outputs archive must be read whole. */
export const MAX_RESULT_BYTES = 32 * 1024 * 1024
/** Largest decompressed archive: a small gzip can expand to gigabytes. */
export const MAX_GUNZIP_BYTES = 64 * 1024 * 1024

export interface TarEntry {
  name: string
  size: number
  data: Uint8Array
  truncated: boolean
}

const BLOCK = 512
const decoder = new TextDecoder('utf-8')

function field(header: Uint8Array, offset: number, length: number): string {
  const raw = header.subarray(offset, offset + length)
  const end = raw.indexOf(0)
  return decoder.decode(raw.subarray(0, end === -1 ? length : end))
}

export function isGzip(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b
}

/** Whether the bytes look like a tar archive (ustar magic at offset 257). */
export function isTar(bytes: Uint8Array): boolean {
  return bytes.length >= BLOCK && field(bytes, 257, 5) === 'ustar'
}

/** The `path` record of a PAX extended header (`<length> path=<name>\n`). */
function paxPath(data: Uint8Array): string | undefined {
  let offset = 0
  while (offset < data.length) {
    const space = data.indexOf(0x20, offset)
    const length = parseInt(decoder.decode(data.subarray(offset, space)), 10)
    if (space === -1 || !(length > 0)) return undefined
    const record = decoder.decode(data.subarray(space + 1, offset + length - 1))
    if (record.startsWith('path=')) return record.slice('path='.length)
    offset += length
  }
  return undefined
}

/**
 * Lists the regular files of a tar archive (ustar, GNU long names, PAX paths).
 * A cut archive yields the entries that fit, the last one marked `truncated`.
 */
export function readTar(archive: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = []
  let longName: string | undefined
  let offset = 0
  while (offset + BLOCK <= archive.length) {
    const header = archive.subarray(offset, offset + BLOCK)
    if (header.every((byte) => byte === 0)) break
    const size = parseInt(field(header, 124, 12).trim() || '0', 8) || 0
    const type = field(header, 156, 1) || '0'
    const prefix = field(header, 345, 155)
    const name =
      longName ??
      (prefix ? `${prefix}/${field(header, 0, 100)}` : field(header, 0, 100))
    longName = undefined
    const start = offset + BLOCK
    const data = archive.subarray(start, Math.min(start + size, archive.length))
    if (type === 'L') longName = decoder.decode(data).replace(/\0+$/, '')
    else if (type === 'x') longName = paxPath(data) ?? longName
    else if (type === '0' || type === '7') {
      entries.push({ name, size, data, truncated: data.length < size })
    }
    offset = start + Math.ceil(size / BLOCK) * BLOCK
  }
  return entries
}

/** Reads a stream up to `max` bytes; `truncated` if there was more. */
async function readStream(
  stream: ReadableStream<Uint8Array>,
  max: number
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  let truncated = false
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (length + value.length > max) {
      chunks.push(value.subarray(0, max - length))
      length = max
      truncated = true
      await reader.cancel().catch(() => undefined)
      break
    }
    chunks.push(value)
    length += value.length
  }
  const bytes = new Uint8Array(length)
  let at = 0
  for (const chunk of chunks) {
    bytes.set(chunk, at)
    at += chunk.length
  }
  return { bytes, truncated }
}

/** Decompresses a gzip archive, up to `max` bytes. Returns undefined if it is not valid. */
export async function gunzip(
  bytes: Uint8Array,
  max = MAX_GUNZIP_BYTES
): Promise<Uint8Array | undefined> {
  try {
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes)
        controller.close()
      }
    })
    const { bytes: output } = await readStream(
      source.pipeThrough(
        new DecompressionStream('gzip') as unknown as ReadableWritablePair<
          Uint8Array,
          Uint8Array
        >
      ),
      max
    )
    return output
  } catch {
    return undefined
  }
}

/**
 * Removes the stream framing of a raw Docker log (8-byte headers), which the
 * node writes to the algorithm log. Other content is returned as is.
 */
export function demuxDockerLog(bytes: Uint8Array): Uint8Array {
  const framed = (at: number) =>
    at + 8 <= bytes.length &&
    bytes[at] <= 2 &&
    bytes[at + 1] === 0 &&
    bytes[at + 2] === 0 &&
    bytes[at + 3] === 0
  if (!framed(0)) return bytes
  const parts: Uint8Array[] = []
  let offset = 0
  while (framed(offset)) {
    const length = new DataView(
      bytes.buffer,
      bytes.byteOffset + offset + 4,
      4
    ).getUint32(0)
    parts.push(bytes.subarray(offset + 8, offset + 8 + length))
    offset += 8 + length
  }
  if (offset < bytes.length) parts.push(bytes.subarray(offset))
  const output = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0))
  let at = 0
  for (const part of parts) {
    output.set(part, at)
    at += part.length
  }
  return output
}

/** Heuristic for text: no NUL byte at the start. */
export function looksLikeText(bytes: Uint8Array): boolean {
  return !bytes.subarray(0, 8000).includes(0)
}

export const isHtml = (name: string) => /\.html?$/i.test(name)

const SKIPPED = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'SVG',
  'IMG',
  'CANVAS',
  'IFRAME',
  'OBJECT',
  'BUTTON',
  'HEAD'
])
const BLOCKS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'BR',
  'CAPTION',
  'DD',
  'DIV',
  'DL',
  'DT',
  'FIGCAPTION',
  'FOOTER',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TR',
  'UL'
])
const CELLS = new Set(['TD', 'TH'])

/**
 * The readable text of an HTML report, one block per line: scripts, styles,
 * images and charts are dropped. A table row reads as `cell | cell`.
 */
export function htmlToText(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const parts: string[] = []
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? '')
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const tag = (node as Element).tagName.toUpperCase()
    if (SKIPPED.has(tag)) return
    if ((node as Element).getAttribute('hidden') !== null) return
    if (CELLS.has(tag)) parts.push(' | ')
    node.childNodes.forEach(walk)
    if (BLOCKS.has(tag)) parts.push('\n')
  }
  const title = document.title.trim()
  if (title) parts.push(title, '\n')
  if (document.body) walk(document.body)
  const lines: string[] = []
  for (const raw of parts.join('').split('\n')) {
    const line = raw
      .replace(/\s+/g, ' ')
      .replace(/^ ?\| ?/, '')
      .trim()
    // Repeated lines are mostly navigation and toggles.
    if (line && line !== lines[lines.length - 1]) lines.push(line)
  }
  return lines.join('\n')
}

interface ReadableFile {
  name: string
  size: number
  /** Undefined for binary content. */
  text?: string
  /** The page itself, for an HTML file. */
  html?: string
  /** Only part of the file was downloaded or unpacked. */
  cut: boolean
}

function toReadable(
  name: string,
  size: number,
  data: Uint8Array,
  cut: boolean
): ReadableFile {
  if (!looksLikeText(data)) return { name, size, cut }
  const text = decoder.decode(data)
  return isHtml(name)
    ? { name, size, cut, text: htmlToText(text), html: text }
    : { name, size, cut, text }
}

/** An HTML file of the results that the user can open, such as a map. */
export interface JobReport {
  name: string
  /** A blob: URL of this page, valid until the market page is reloaded. */
  url: string
}

export interface JobResults {
  /** What the assistant reads. */
  attachment: JobResultAttachment
  /** What the user opens. */
  reports: JobReport[]
}

export const MAX_REPORTS = 10

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * The page that shows a report. The algorithm wrote the report, so it runs in
 * a sandboxed frame with an opaque origin, as the MCP serves it
 * (`sandbox allow-scripts allow-popups`): its scripts work (Leaflet maps), but
 * it cannot reach the market, its storage or the wallet. The page around it
 * has no script of its own.
 */
export function reportPage(name: string, html: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(name)}</title>
<style>html,body{margin:0;height:100%}iframe{display:block;width:100%;height:100%;border:0}</style>
</head>
<body><iframe title="${escapeHtml(
    name
  )}" sandbox="allow-scripts allow-popups" referrerpolicy="no-referrer" srcdoc="${escapeHtml(
    html
  )}"></iframe></body>
</html>`
}

/** Short name for a link: the file name without its folders. */
export function reportName(path: string): string {
  return path.split('/').filter(Boolean).pop() || path
}

function toReports(files: ReadableFile[]): JobReport[] {
  return files
    .filter((file) => file.html !== undefined && !file.cut)
    .slice(0, MAX_REPORTS)
    .map((file) => ({
      name: reportName(file.name),
      url: URL.createObjectURL(
        new Blob([reportPage(reportName(file.name), file.html)], {
          type: 'text/html'
        })
      )
    }))
}

/**
 * Gives the text budget to the smallest files first, as the MCP does: one large
 * file (such as a report) cannot hide the small ones (such as a summary).
 */
export function fitFiles(
  files: ReadableFile[],
  budget = CHAT_MAX_ATTACHMENT_CHARS,
  fromEnd = false
): JobResultFile[] {
  const listed = files.slice(0, CHAT_MAX_ATTACHMENT_FILES)
  const shown = new Map<ReadableFile, string>()
  let remaining = budget
  for (const file of [...listed]
    .filter((file) => file.text)
    .sort((a, b) => a.text.length - b.text.length)) {
    if (remaining <= 0) break
    const text = fromEnd
      ? file.text.slice(-remaining)
      : file.text.slice(0, remaining)
    shown.set(file, text)
    remaining -= text.length
  }
  return listed.map((file) => {
    const text = shown.get(file)
    return {
      // Names are checked again on the server, which refuses very long ones.
      name: file.name.slice(-200) || 'file',
      size: file.size,
      ...(text !== undefined ? { text } : {}),
      truncated:
        file.cut ||
        (file.text !== undefined && (text?.length ?? 0) < file.text.length)
    }
  })
}

/** Unpacks the outputs archive, or reads a single result file. */
export async function readResultFiles(
  name: string,
  size: number,
  bytes: Uint8Array,
  cut: boolean
): Promise<ReadableFile[]> {
  let archive = bytes
  if (isGzip(bytes)) {
    const unpacked = await gunzip(bytes)
    if (unpacked && isTar(unpacked)) archive = unpacked
  }
  if (isTar(archive)) {
    return readTar(archive).map((entry) =>
      toReadable(entry.name, entry.size, entry.data, entry.truncated)
    )
  }
  return [toReadable(name, size, bytes, cut)]
}

/** The result to read: the outputs, or the algorithm log if there are none. */
export function pickResult(
  job: Pick<ComputeJob, 'results'>
): { result: ComputeResult; index: number; succeeded: boolean } | undefined {
  const results = Array.isArray(job.results) ? job.results : []
  const indexed = results.map((result, position) => ({
    result,
    index: result.index ?? position
  }))
  const output = indexed.find(
    ({ result }) => result.type === 'output' && result.filesize > 0
  )
  if (output) return { ...output, succeeded: true }
  const log = indexed.find(({ result }) => result.type === 'algorithmLog')
  return log ? { ...log, succeeded: false } : undefined
}

async function download(
  url: string
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`The node did not give the results (${response.status}).`)
  }
  if (response.body) return readStream(response.body, MAX_RESULT_BYTES)
  const bytes = new Uint8Array(await response.arrayBuffer())
  return {
    bytes: bytes.subarray(0, MAX_RESULT_BYTES),
    truncated: bytes.length > MAX_RESULT_BYTES
  }
}

/**
 * Downloads the results of a finished job with the user's signature (one, in
 * their wallet), turns them into text for the assistant and gives a link to
 * each HTML report.
 */
export async function readJobResults({
  providerUrl,
  signer,
  job,
  dataset,
  algorithm
}: {
  providerUrl: string
  signer: Signer
  /** The job as the card knows it: `jobId` is the id the node gave at start. */
  job: Pick<ComputeJob, 'jobId' | 'results'>
  dataset: string
  algorithm: string
}): Promise<JobResults> {
  const picked = pickResult(job)
  if (!picked) throw new Error('The job has no results to read yet.')
  const { result, index, succeeded } = picked

  const url = await ProviderInstance.getComputeResultUrl(
    providerUrl,
    signer,
    job.jobId,
    index
  )
  const { bytes, truncated } = await download(url)
  const name = result.filename || `result_${index}`
  const files = succeeded
    ? await readResultFiles(
        name,
        result.filesize ?? bytes.length,
        bytes,
        truncated
      )
    : [
        toReadable(
          name,
          result.filesize ?? bytes.length,
          demuxDockerLog(bytes),
          truncated
        )
      ]

  return {
    attachment: {
      kind: 'jobResult',
      jobId: job.jobId,
      dataset,
      algorithm,
      succeeded,
      // A log is read from its end, where the errors are.
      files: fitFiles(files, CHAT_MAX_ATTACHMENT_CHARS, !succeeded)
    },
    // Only the outputs of a job that worked are offered to open, never its log.
    reports: succeeded ? toReports(files) : []
  }
}
