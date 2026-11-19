import axios from 'axios'
import type { NextApiRequest, NextApiResponse } from 'next'
import handler from './link-title'

jest.mock('axios')
const get = axios.get as jest.Mock

async function request(url: string) {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
    end: jest.fn()
  }
  await handler(
    { method: 'GET', query: { url } } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  )
  return res
}

beforeEach(() => jest.clearAllMocks())

it('uses the specific page title after a default site title', async () => {
  get.mockResolvedValue({
    data: '<title>UCI Machine Learning Repository</title><title>Wine Quality - UCI Machine Learning Repository</title>'
  })
  const res = await request(
    'https://archive.ics.uci.edu/dataset/186/wine+quality'
  )
  expect(res.json).toHaveBeenCalledWith({
    title: 'Wine Quality - UCI Machine Learning Repository'
  })
})

it('returns no title when the page has no title', async () => {
  get.mockResolvedValue({ data: '<html></html>' })
  expect((await request('https://example.com')).json).toHaveBeenCalledWith({
    title: null
  })
})

it('returns no title when fetching fails', async () => {
  get.mockRejectedValue(new Error('Unavailable'))
  expect((await request('https://example.com')).json).toHaveBeenCalledWith({
    title: null
  })
})

it.each([
  'http://127.0.0.1',
  'file:///etc/passwd',
  'https://user:pass@example.com'
])('rejects unsafe URL %s', async (url) => {
  expect((await request(url)).json).toHaveBeenCalledWith({ title: null })
  expect(get).not.toHaveBeenCalled()
})
