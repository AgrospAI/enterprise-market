import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest'
import { chromium, type Browser, type Page } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { signIn } from './wallet'

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:8008'
const fileUrl =
  'https://raw.githubusercontent.com/plotly/datasets/master/iris.csv'
const licenseUrl = 'https://creativecommons.org/licenses/by/4.0/legalcode.txt'
const run = `E2E asset ${Date.now()}`
let browser: Browser
let page: Page
let did: string
let owner: string
let caches: string[]
let published: any
let publishedBounds: string
let ontologyTerm: string | undefined
type Variant = 'algorithm' | 'compute' | 'saas'
const variants: { kind: Variant; ddo: any }[] = []
const collector = '0x0000000000000000000000000000000000000001'
const field = (name: string) =>
  page.locator(`form :is(input, textarea, select)[name="${name}"]`)
const fill = (name: string, value: string) => field(name).fill(value)

async function validateUrl(name: string) {
  await expect
    .poll(
      async () => {
        const input = field(name)
        if (await input.isDisabled()) return true
        const validate = input
          .locator('../..')
          .getByRole('button', { name: 'Validate', exact: true })
        if (await validate.isEnabled()) await validate.click()
        return input.isDisabled()
      },
      { interval: 3000 }
    )
    .toBe(true)
}

async function next(step: number) {
  console.log(`Advancing to publish step ${step}`)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.waitForURL(`**/publish/${step}`)
  const ready = {
    2: () => field('allowDropdown').waitFor(),
    3: () => field('services[0].name').waitFor(),
    4: () => field('pricing.price').waitFor(),
    5: () =>
      page
        .getByRole('button', { name: 'Create Additional Asset Description' })
        .waitFor(),
    6: () =>
      page.getByRole('heading', { name: 'Preview', exact: true }).waitFor(),
    7: () =>
      page.getByText('Create Tokens & Pricing', { exact: true }).waitFor()
  }
  await ready[step]()
}

async function readDdos() {
  const results: any[] = []
  for (const cache of caches) {
    try {
      const response = await page.request.get(
        `${cache.replace(/\/$/, '')}/api/aquarius/assets/ddo/${did}`,
        { timeout: 10_000 }
      )
      if (response.ok()) results.push(await response.json())
    } catch {
      // Other configured caches can still serve this chain during an outage.
    }
  }
  return results
}

async function saved(check: (ddo: any) => void) {
  let result: any
  await expect
    .poll(
      async () => {
        let failure = 'Asset has not been indexed'
        for (const candidate of await readDdos()) {
          try {
            check(candidate)
            result = candidate
            return 'ok'
          } catch (error) {
            failure = String(error)
          }
        }
        return failure
      },
      { timeout: 180_000, interval: 7000 }
    )
    .toBe('ok')
  return result
}

async function drawBounds() {
  const map = page.locator('form .leaflet-container')
  await map.scrollIntoViewIfNeeded()
  await page.getByTitle('Draw a rectangle', { exact: true }).click()
  const box = await map.boundingBox()
  if (!box) throw new Error('Geographic coverage map is unavailable')
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, {
    steps: 8
  })
  await page.mouse.up()
  const wkt = page.locator('form code').filter({ hasText: /^POLYGON/ })
  await wkt.waitFor()
  return wkt.innerText()
}

async function addAddress(list: 'allow' | 'deny', address: string) {
  await field(`${list}Dropdown`).selectOption(
    list === 'allow' ? 'Allow specific addresses' : 'Deny specific addresses'
  )
  const input = field(`${list}Address`)
  await input.fill(address)
  await input
    .locator('..')
    .getByRole('button', { name: 'Add new address' })
    .click()
}

async function serviceDescriptionVisible(description: string, editor = false) {
  await signIn(page, `/asset/${did}${editor ? '/edit' : ''}`)
  if (editor)
    await page.getByRole('tab', { name: 'Edit Services', exact: true }).click()
  const text = page.getByText(description, { exact: true }).first()
  const allow = page.getByRole('button', { name: 'Allow', exact: true })
  await text.or(allow).first().waitFor()
  if (await allow.isVisible()) await allow.click()
  await text.waitFor()
}

function addresses(credentials: any, list: 'allow' | 'deny') {
  return (credentials?.[list] || [])
    .filter((rule: any) => rule.type === 'address')
    .flatMap((rule: any) => rule.values.map((entry: any) => entry.address))
}

async function removeWildcard(list: 'allow' | 'deny') {
  const input = field(`${list}Address-0`)
  await input
    .locator('..')
    .getByRole('button', { name: 'Delete', exact: true })
    .click()
  await expect.poll(() => input.count()).toBe(0)
  await expect
    .poll(() => field(`${list}Dropdown`).inputValue())
    .toBe('Please select an option')
}

async function submitEdit() {
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  await Promise.race([
    page
      .getByRole('link', { name: 'Back to Asset', exact: true })
      .waitFor({ timeout: 240_000 }),
    page
      .getByRole('button', { name: 'Try Again', exact: true })
      .waitFor({ timeout: 240_000 })
      .then(async () => {
        await page.getByText('More Info', { exact: true }).click()
        throw new Error(
          `Edit failed: ${await page.locator('body').innerText()}`
        )
      })
  ])
}

async function submitPublication() {
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  await page.screenshot({
    path: '.artifacts/e2e/submitting.png',
    fullPage: true
  })
  const view = page.getByRole('link', { name: 'View Asset', exact: true })
  await Promise.race([
    view.waitFor({ timeout: 300_000 }),
    page
      .getByRole('button', { name: 'Retry', exact: true })
      .waitFor({ timeout: 300_000 })
      .then(async () => {
        throw new Error(
          `Publication failed: ${await page.locator('form').innerText()}`
        )
      })
  ])
  const href = await view.getAttribute('href')
  expect(href).toMatch(/^\/asset\/did:ope:[a-f0-9]{64}$/)
  did = href!.split('/').pop()!
  await writeFile(
    '.artifacts/e2e/publication.json',
    JSON.stringify(
      {
        did,
        baseURL,
        transactions: await page
          .getByRole('link', { name: /View Transaction/ })
          .evaluateAll((links) =>
            links.map((link) => (link as HTMLAnchorElement).href)
          )
      },
      null,
      2
    )
  )
}

// Conditional asset/service fields are exercised inside the same two lifecycle tests.
async function publishVariant(kind: Variant) {
  console.log(`Publishing ${kind} scenario`)
  await signIn(page, '/publish/1')
  await fill('metadata.name', `${run} ${kind}`)
  await fill('metadata.description', `Publication audit for ${kind} fields.`)
  await fill('metadata.author', 'E2E variant author')
  if (kind === 'algorithm' || kind === 'saas') {
    await page
      .locator(`input[name="metadata.type"][value="${kind}"]`)
      .locator('..')
      .locator('label')
      .click()
  }
  if (kind === 'algorithm') {
    await page
      .locator('input[name="metadata.dockerImage"][value="custom"]')
      .locator('..')
      .locator('label')
      .click()
    await fill('metadata.dockerImageCustom', 'python:3.10-slim')
    await page.getByRole('button', { name: 'Use', exact: true }).click()
    await expect
      .poll(() => field('metadata.dockerImageCustomChecksum').inputValue())
      .toMatch(/^sha256:/)
    await fill(
      'metadata.dockerImageCustomEntrypoint',
      'python /data/algorithm.py'
    )
  }
  if (await field('metadata.dataSubjectConsent').isVisible())
    await field('metadata.dataSubjectConsent').check()
  await field('metadata.termsAndConditions').check()
  await field('metadata.licenseTypeSelection').selectOption('URL')
  await fill('metadata.licenseUrl[0].url', licenseUrl)
  await validateUrl('metadata.licenseUrl[0].url')
  await next(2)
  await addAddress('allow', owner)
  await next(3)
  await fill('services[0].name', `${kind} service`)
  await fill(
    'services[0].description.value',
    `${kind} service publication audit`
  )
  if (kind === 'saas') {
    await fill('services[0].files[0].url', 'https://example.com/application')
  } else {
    if (kind === 'compute') {
      await page
        .locator('input[name="services[0].access"][value="compute"]')
        .locator('..')
        .locator('label')
        .click()
      await field('allowAllPublishedAlgorithms').selectOption(
        'Allow any published algorithms'
      )
    }
    if (kind === 'algorithm')
      await field('services[0].algorithmPrivacy').check()
    await fill('services[0].files[0].url', fileUrl)
    await page.getByRole('button', { name: 'Submit URL', exact: true }).click()
  }
  await field('services[0].timeout').selectOption('1 hour')
  await addAddress('allow', owner)
  await next(4)
  // Cover the free/dispenser variant as well as the primary fixed-price asset.
  await page.getByRole('tab', { name: 'Free', exact: true }).click()
  await field('pricing.freeAgreement').check()
  await next(5)
  await next(6)
  await next(7)
  await submitPublication()
  const ddo = await saved((asset) => {
    const { metadata, services } = asset.credentialSubject
    expect(metadata.name).toBe(`${run} ${kind}`)
    expect(metadata.license.licenseDocuments[0].mirrors[0].url).toBe(licenseUrl)
    expect(services[0].description['@value']).toBe(
      `${kind} service publication audit`
    )
    expect(services[0].timeout).toBe(3600)
    expect(asset.indexedMetadata.stats[0].prices).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'dispenser' })])
    )
    if (kind === 'algorithm')
      expect(metadata.algorithm.container).toMatchObject({
        image: 'python',
        tag: '3.10-slim',
        entrypoint: 'python /data/algorithm.py',
        checksum: expect.stringMatching(/^sha256:/)
      })
    if (kind === 'compute') {
      expect(services[0].type).toBe('compute')
      expect(services[0].compute.publisherTrustedAlgorithms[0].did).toBe('*')
      expect(services[0].compute.publisherTrustedAlgorithmPublishers).toEqual([
        '*'
      ])
    }
    if (kind === 'saas')
      expect(metadata.additionalInformation.saas).toMatchObject({
        redirectUrl: 'https://example.com/application',
        paymentMode: 'Subscription'
      })
  })
  variants.push({ kind, ddo })
  await writeFile(
    `.artifacts/e2e/published-${kind}.json`,
    JSON.stringify(ddo, null, 2)
  )
  await serviceDescriptionVisible(`${kind} service publication audit`)
}

async function editVariant(kind: Variant, original: any) {
  console.log(`Editing ${kind} scenario`)
  did = original.id
  await signIn(page, `/asset/${did}/edit`)
  await fill('description', `Edited ${kind} metadata field audit.`)
  let container: Record<string, string> | undefined
  if (kind === 'algorithm') {
    await fill('containerImage', 'python')
    await fill('containerTag', '3.11-slim')
    await expect
      .poll(() => field('containerChecksum').inputValue())
      .toMatch(/^sha256:/)
    await fill('containerEntrypoint', 'python /data/edited-algorithm.py')
    container = {
      image: 'python',
      tag: '3.11-slim',
      entrypoint: 'python /data/edited-algorithm.py',
      checksum: await field('containerChecksum').inputValue()
    }
    await field('usesConsumerParameters').check()
    await fill('consumerParameters[0].name', 'iterations')
    await fill('consumerParameters[0].label', 'Iterations')
    await fill(
      'consumerParameters[0].description',
      'Number of algorithm iterations'
    )
    await field('consumerParameters[0].type').selectOption('number')
    await fill('consumerParameters[0].default', '3')
  }
  if (kind === 'saas')
    await fill('saas.redirectUrl', 'https://example.com/edited-application')
  await submitEdit()
  await saved((asset) => {
    const { metadata } = asset.credentialSubject
    expect(metadata.description['@value']).toBe(
      `Edited ${kind} metadata field audit.`
    )
    if (container) {
      expect(metadata.algorithm.container).toEqual(container)
      expect(metadata.algorithm.consumerParameters[0]).toMatchObject({
        name: 'iterations',
        type: 'number',
        default: '3'
      })
    }
    if (kind === 'saas')
      expect(metadata.additionalInformation.saas.redirectUrl).toBe(
        'https://example.com/edited-application'
      )
    expect(asset.credentialSubject.services).toEqual(
      original.credentialSubject.services
    )
  })
  await signIn(page, `/asset/${did}/edit`)
  await page.getByRole('tab', { name: 'Edit Services', exact: true }).click()
  await page
    .getByRole('button', { name: 'Select', exact: true })
    .first()
    .click()
  await fill('description', `Edited ${kind} service field audit.`)
  if (kind === 'compute') {
    await field('allowAllPublishedAlgorithms').selectOption(
      'Allow selected algorithms'
    )
    // Trust only the wallet used in this run; no wallet address is hard-coded.
    const input = page.locator('input[placeholder^="e.g. 0x"]:not([name])')
    await input.fill(owner)
    await input
      .locator('../..')
      .getByRole('button', { name: 'Add', exact: true })
      .click()
    const algorithm = variants.find(
      (variant) => variant.kind === 'algorithm'
    )!.ddo
    const value = JSON.stringify({
      algoDid: algorithm.id,
      serviceId: algorithm.credentialSubject.services[0].id
    })
    await page
      .locator('form')
      .getByRole('searchbox', { name: 'Search assets', exact: true })
      .fill(algorithm.id)
    await page
      .locator('input[name="publisherTrustedAlgorithms"]')
      .and(page.locator(`input[value='${value}']`))
      .check()
  }
  await submitEdit()
  const edited = await saved((asset) => {
    const service = asset.credentialSubject.services[0]
    expect(service.description['@value']).toBe(
      `Edited ${kind} service field audit.`
    )
    if (kind === 'compute') {
      expect(service.compute.publisherTrustedAlgorithmPublishers).toEqual([
        owner
      ])
      expect(service.compute.publisherTrustedAlgorithms).toHaveLength(1)
      expect(service.compute.publisherTrustedAlgorithms[0]).toMatchObject({
        did: variants.find((variant) => variant.kind === 'algorithm')!.ddo.id,
        filesChecksum: expect.any(String),
        containerSectionChecksum: expect.any(String)
      })
    }
  })
  await writeFile(
    `.artifacts/e2e/edited-${kind}.json`,
    JSON.stringify(edited, null, 2)
  )
  await serviceDescriptionVisible(`Edited ${kind} service field audit.`)
}

describe.sequential('asset lifecycle', () => {
  beforeAll(async () => {
    browser = await chromium.launch({
      headless: process.env.E2E_HEADED !== 'true'
    })
    page = await browser.newPage({ baseURL, locale: 'en-US' })
    page.setDefaultTimeout(60_000)
    const discoveredCaches = new Set<string>()
    page.on('request', (request) => {
      const marker = '/api/aquarius/assets/'
      if (request.url().includes(marker))
        discoveredCaches.add(request.url().split(marker)[0])
    })
    owner = await signIn(page)
    const raw = await page.evaluate(
      () => window.__RUNTIME_CONFIG__?.NEXT_PUBLIC_METADATACACHE_URI
    )
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        caches = Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        caches = [raw]
      }
    }
    // Discover build-time settings from the portal's own DDO link if runtime config is absent.
    if (!caches?.length) caches = [...discoveredCaches]
    if (!caches.length)
      throw new Error('No metadata cache discovered from the portal.')
    await mkdir('.artifacts/e2e', { recursive: true })
  })
  afterEach(async (context) => {
    if (context.task.result?.state === 'fail' && page) {
      await page.screenshot({
        path: `.artifacts/e2e/${context.task.name.split(' ')[0]}.png`,
        fullPage: true
      })
      // Never save browser storage, traces or wallet/password input values.
      await writeFile(
        `.artifacts/e2e/${context.task.name.split(' ')[0]}-failure.txt`,
        await page.locator('body').innerText()
      )
    }
  })
  afterAll(async () => {
    await browser?.close()
  })

  test('publishes an asset and verifies persisted fields', async () => {
    await signIn(page, '/publish/1')
    await fill('metadata.name', run)
    await fill('metadata.description', 'Publication field persistence audit.')
    await field('metadata.descriptionLanguage').selectOption('Spanish')
    await fill('metadata.author', 'E2E author')
    await fill('metadata.providedBy', 'https://example.com/provider')
    await fill('metadata.copyrightHolder', 'E2E copyright')
    await page.getByTitle('Generate new image', { exact: true }).click()
    const tags = page.locator('input[id^="react-select-"]').first()
    await tags.fill('e2e-audit')
    await tags.press('Enter')
    const ontology = page.locator('input[id="metadata.ontologyTerms"]')
    if (await ontology.count()) {
      const response = page.waitForResponse(
        (response) =>
          response.url().includes('/api/agroportal/search?') &&
          response.status() === 200
      )
      await ontology.fill('soil')
      const result = await (await response).json()
      ontologyTerm = result.collection[0]['@id']
      await page.getByRole('listbox').getByRole('option').first().click()
    }
    await fill('metadata.links.key', 'documentation')
    await fill('metadata.links.value', 'https://example.com/docs')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await fill('metadata.geoMetadata.temporalCoverage.startDate', '2024-01-01')
    await fill('metadata.geoMetadata.temporalCoverage.endDate', '2025-01-01')
    publishedBounds = await drawBounds()
    await fill('metadata.geoMetadata.boundingBox.label', 'E2E coverage')
    await field('metadata.dataSubjectConsent').check()
    await field('metadata.termsAndConditions').check()
    await field('metadata.licenseTypeSelection').selectOption(
      'Upload license file'
    )
    await page.locator('input[type=file]').setInputFiles({
      name: 'license.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('CC-BY-4.0\nE2E license')
    })
    await page.getByText('File confirmed', { exact: true }).waitFor()
    await page
      .getByRole('button', { name: 'Add Additional File', exact: true })
      .click()
    await field('metadata.additionalLicenseFiles[0].sourceType').selectOption(
      'Upload file'
    )
    await page
      .locator('input[type=file]')
      .last()
      .setInputFiles({
        name: 'supplement.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Supplemental E2E license terms')
      })
    await expect
      .poll(() => page.getByText('File confirmed', { exact: true }).count())
      .toBe(2)
    await fill('metadata.additionalLicenseFiles[0].name', 'Supplementary terms')
    await next(2)
    await field('allowDropdown').selectOption('Allow all addresses')
    // Check both transitions without making extra blockchain transactions.
    await removeWildcard('allow')
    await field('allowDropdown').selectOption('Allow all addresses')
    await field('denyDropdown').selectOption('Deny all addresses')
    await removeWildcard('deny')
    await addAddress('deny', collector)
    await next(3)
    await fill('services[0].name', 'E2E download')
    await fill('services[0].description.value', 'Download service field audit')
    await field('services[0].description.language').selectOption('French')
    await fill('services[0].files[0].url', fileUrl)
    await page.getByRole('button', { name: 'Submit URL', exact: true }).click()
    await fill('services[0].links[0].url', fileUrl)
    await field('services[0].links[0].url')
      .locator('../..')
      .getByRole('button', { name: 'Validate', exact: true })
      .click()
    await field('services[0].timeout').selectOption('1 day')
    await field('allowDropdown').selectOption('Allow all addresses')
    await field('services[0].usesConsumerParameters').check()
    for (const [key, value] of Object.entries({
      name: 'region',
      label: 'Region',
      description: 'Region selection',
      default: 'Europe'
    })) {
      await fill(`services[0].consumerParameters[0].${key}`, value)
    }
    await field('services[0].consumerParameters[0].required').selectOption(
      'required'
    )
    await field('services[0].consumerParameters[0].type').selectOption('select')
    await fill('services[0].consumerParameters[0].options.key', 'Europe')
    await fill(
      'services[0].consumerParameters[0].options.value',
      'European region'
    )
    await field('services[0].consumerParameters[0].options.value')
      .locator('..')
      .getByRole('button', { name: 'Add', exact: true })
      .click()
    await fill('services[0].consumerParameters[0].options.key', 'Asia')
    await fill(
      'services[0].consumerParameters[0].options.value',
      'Asian region'
    )
    await field('services[0].consumerParameters[0].options.value')
      .locator('..')
      .getByRole('button', { name: 'Add', exact: true })
      .click()
    await field('services[0].consumerParameters[0].default').selectOption(
      'Europe'
    )
    await next(4)
    await fill('pricing.price', '1')
    await next(5)
    await page
      .getByRole('button', { name: 'Create Additional Asset Description' })
      .click()
    await fill('additionalDdos[0].type', 'e2e')
    await fill(
      'additionalDdos[0].data',
      JSON.stringify({ audit: 'publication' })
    )
    await next(6)
    await next(7)
    await submitPublication()
    published = await saved((ddo) => {
      const { metadata, services, credentials } = ddo.credentialSubject
      expect(ddo.indexedMetadata.nft.owner.toLowerCase()).toBe(owner)
      expect(metadata).toMatchObject({
        name: run,
        type: 'dataset',
        author: 'E2E author',
        providedBy: 'https://example.com/provider',
        copyrightHolder: 'E2E copyright',
        description: {
          '@value': 'Publication field persistence audit.',
          '@language': 'es',
          '@direction': 'ltr'
        },
        links: { documentation: 'https://example.com/docs' }
      })
      expect(metadata.additionalInformation).toMatchObject({
        termsAndConditions: true,
        'dct:temporal': {
          'dcat:startDate': { '@value': '2024-01-01' },
          'dcat:endDate': { '@value': '2025-01-01' }
        },
        'dct:spatial': {
          'dcat:bbox': { '@value': publishedBounds },
          'skos:prefLabel': 'E2E coverage'
        }
      })
      expect(Number(ddo.indexedMetadata.stats[0].prices[0].price)).toBe(1)
      expect(metadata.tags).toContain('e2e-audit')
      if (ontologyTerm)
        expect(metadata.additionalInformation['dcat:theme'][0]['@id']).toBe(
          ontologyTerm
        )
      expect(metadata.license.licenseDocuments[0].name).toBe('license.txt')
      expect(metadata.license.licenseDocuments[0].sha256).toBeTruthy()
      expect(metadata.license.licenseDocuments[1]).toMatchObject({
        name: 'Supplementary terms',
        sha256: expect.any(String)
      })
      expect(addresses(credentials, 'allow')).toEqual(['*'])
      expect(addresses(credentials, 'deny')).toEqual([collector])
      expect(services[0]).toMatchObject({
        name: 'E2E download',
        type: 'access',
        timeout: 86400,
        description: {
          '@value': 'Download service field audit',
          '@language': 'fr'
        },
        consumerParameters: [
          {
            name: 'region',
            label: 'Region',
            description: 'Region selection',
            type: 'select',
            required: true,
            default: 'Europe',
            options: [{ Europe: 'European region' }, { Asia: 'Asian region' }]
          }
        ]
      })
      expect(services[0].files).toMatch(/^0x/)
      expect(services[0].links).toEqual({ link_1: fileUrl })
      expect(addresses(services[0].credentials, 'allow')).toEqual(['*'])
      expect(ddo.additionalDdos).toEqual([
        { type: 'e2e', data: JSON.stringify({ audit: 'publication' }) }
      ])
    })
    await writeFile(
      '.artifacts/e2e/published.json',
      JSON.stringify(published, null, 2)
    )
    await serviceDescriptionVisible('Download service field audit')
    for (const kind of ['algorithm', 'compute', 'saas'] as const)
      await publishVariant(kind)
    did = published.id
  })

  test('edits the published asset and service, including removing Allow all addresses', async (context) => {
    if (!published) context.skip()
    did = published.id
    expect(
      did,
      'Publication must succeed before editing; run the complete suite.'
    ).toMatch(/^did:ope:/)
    expect(
      published,
      'Publication must be verified before editing.'
    ).toBeDefined()
    await signIn(page, `/asset/${did}/edit`)
    await fill('name', `${run} edited`)
    await fill('description', 'Edited metadata persistence audit.')
    await field('descriptionLanguage').selectOption('German')
    await fill('author', 'Edited author')
    await fill('providedBy', 'https://example.com/edited-provider')
    await fill('copyrightHolder', 'Edited copyright')
    const editedTags = page.locator('input[id^="react-select-"]').first()
    await editedTags.fill('edited-audit')
    await editedTags.press('Enter')
    await fill('links.key', 'edited-docs')
    await fill('links.value', 'https://example.com/edited-docs')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await fill('geoMetadata.temporalCoverage.startDate', '')
    await fill('geoMetadata.temporalCoverage.endDate', '')
    await fill('geoMetadata.boundingBox.label', 'Edited coverage')
    await fill('additionalLicenseFiles[0].name', 'Edited supplementary terms')
    if (ontologyTerm) {
      await page.locator('input[id="ontologyTerms"]').focus()
      await page.locator('input[id="ontologyTerms"]').press('Backspace')
    }
    await field('useRemoteLicense').uncheck()
    await fill('licenseUrl[0].url', licenseUrl)
    await validateUrl('licenseUrl[0].url')
    await fill('additionalDdos[0].type', 'edited-e2e')
    await fill('additionalDdos[0].data', JSON.stringify({ audit: 'editing' }))
    await field('assetState').selectOption('Unlisted')
    await removeWildcard('allow')
    await field('denyAddress-0')
      .locator('..')
      .getByRole('button', { name: 'Delete', exact: true })
      .click()
    await submitEdit()
    await saved((ddo) => {
      expect(ddo.credentialSubject.metadata).toMatchObject({
        name: `${run} edited`,
        author: 'Edited author',
        providedBy: 'https://example.com/edited-provider',
        copyrightHolder: 'Edited copyright',
        description: {
          '@value': 'Edited metadata persistence audit.',
          '@language': 'de'
        }
      })
      expect(ddo.indexedMetadata.nft.state).toBe(5)
      expect(ddo.credentialSubject.metadata.tags).toContain('edited-audit')
      expect(ddo.credentialSubject.metadata.links['edited-docs']).toBe(
        'https://example.com/edited-docs'
      )
      expect(
        ddo.credentialSubject.metadata.additionalInformation['dct:temporal']
      ).toBeUndefined()
      expect(ddo.additionalDdos).toEqual([
        { type: 'edited-e2e', data: JSON.stringify({ audit: 'editing' }) }
      ])
      expect(addresses(ddo.credentialSubject.credentials, 'allow')).toEqual([])
      expect(addresses(ddo.credentialSubject.credentials, 'deny')).toEqual([])
      expect(
        ddo.credentialSubject.metadata.additionalInformation['dct:spatial']
      ).toMatchObject({
        'skos:prefLabel': 'Edited coverage',
        'dcat:bbox': { '@value': publishedBounds }
      })
      expect(
        ddo.credentialSubject.metadata.license.licenseDocuments[1].name
      ).toBe('Edited supplementary terms')
      expect(
        ddo.credentialSubject.metadata.license.licenseDocuments[0].mirrors[0]
          .url
      ).toBe(licenseUrl)
      if (ontologyTerm)
        expect(
          ddo.credentialSubject.metadata.additionalInformation['dcat:theme']
        ).toBeUndefined()
      expect(ddo.credentialSubject.services).toEqual(
        published.credentialSubject.services
      )
    })
    await signIn(page, `/asset/${did}/edit`)
    await page.getByRole('tab', { name: 'Edit Services', exact: true }).click()
    await page
      .getByRole('button', { name: 'Select', exact: true })
      .first()
      .click()
    await fill('name', 'Edited download')
    await fill('description', 'Edited service persistence audit.')
    await field('timeout').selectOption('1 week')
    await field('language').selectOption('Italian')
    await fill('price', '2')
    await fill('paymentCollector', collector)
    await removeWildcard('allow')
    await field('state').selectOption('OrderingIsTemporaryDisabled')
    await field('usesConsumerParameters').uncheck()
    await submitEdit()
    const edited = await saved((ddo) => {
      expect(ddo.credentialSubject.services[0]).toMatchObject({
        name: 'Edited download',
        description: { '@value': 'Edited service persistence audit.' },
        timeout: 604800,
        state: 4
      })
      expect(
        addresses(ddo.credentialSubject.services[0].credentials, 'allow')
      ).toEqual([])
      expect(
        ddo.credentialSubject.services[0].consumerParameters || []
      ).toEqual([])
      expect(Number(ddo.indexedMetadata.stats[0].prices[0].price)).toBe(2)
      expect(ddo.credentialSubject.services[0].description['@language']).toBe(
        'it'
      )
      expect(ddo.credentialSubject.services[0].files).toEqual(
        published.credentialSubject.services[0].files
      )
      expect(ddo.credentialSubject.metadata.name).toBe(`${run} edited`)
    })
    await writeFile(
      '.artifacts/e2e/edited.json',
      JSON.stringify(edited, null, 2)
    )
    await serviceDescriptionVisible('Edited service persistence audit.', true)
    await signIn(page, `/asset/${did}/edit`)
    await field('name').waitFor()
    expect(await field('allowAddress-0').count()).toBe(0)
    await page.getByRole('tab', { name: 'Edit Services', exact: true }).click()
    await page
      .getByRole('button', { name: 'Select', exact: true })
      .first()
      .click()
    await expect
      .poll(() => field('paymentCollector').inputValue())
      .toBe(collector)
    expect(await field('description').inputValue()).toBe(
      'Edited service persistence audit.'
    )
    await expect.poll(() => field('files[0].url').isDisabled()).toBe(true)
    for (const variant of variants) await editVariant(variant.kind, variant.ddo)
  })
})
