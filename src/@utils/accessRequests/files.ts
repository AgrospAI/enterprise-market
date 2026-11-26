import { AbiCoder, getBytes, keccak256, Signer, toUtf8Bytes } from 'ethers'
import { Asset } from 'src/@types/Asset'
import { Service } from 'src/@types/ddo/Service'

export async function nodeCommand(
  endpoint: string,
  command: object
): Promise<string> {
  const url = new URL(endpoint)
  if (!['https:', 'http:'].includes(url.protocol))
    throw new Error(
      'Automatic service cloning requires an HTTP Ocean Node endpoint.'
    )
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120000)
  try {
    const response = await fetch(
      `${endpoint.replace(/\/+$/, '')}/directCommand`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
        signal: controller.signal
      }
    )
    if (!response.ok)
      throw new Error(
        `Ocean Node file cloning failed (${response.status}). Check ownership and retry verification.`
      )
    return await response.text()
  } finally {
    clearTimeout(timer)
  }
}

export async function prepareFileClone(source: Service): Promise<string> {
  const capability = JSON.parse(
    await nodeCommand(source.serviceEndpoint, {
      command: 'cloneServiceFiles',
      probe: true
    })
  )
  if (capability.protocol !== 'cloneServiceFiles-v1' || !capability.supported)
    throw new Error(
      'The original Ocean Node does not support automatic service cloning.'
    )
  const status = JSON.parse(
    await nodeCommand(source.serviceEndpoint, { command: 'status' })
  )
  if (!status.id) throw new Error('Could not identify the original Ocean Node.')
  return status.id
}

/** The node changes only the file envelope's datatoken binding; plaintext never leaves it. */
export async function cloneServiceFiles(
  asset: Asset,
  source: Service,
  datatokenAddress: string,
  signer: Signer,
  peerId: string
): Promise<string> {
  const consumerAddress = await signer.getAddress()
  const nonce = String(
    Number(
      await nodeCommand(source.serviceEndpoint, {
        command: 'nonce',
        address: consumerAddress
      })
    ) + 1
  )
  const task = {
    command: 'cloneServiceFiles',
    documentId: asset.id,
    serviceId: source.id,
    chainId: asset.credentialSubject.chainId,
    datatokenAddress,
    sourceFilesHash: keccak256(
      source.files.startsWith('0x') ? source.files : `0x${source.files}`
    ),
    consumerAddress,
    validUntil: Math.floor(Date.now() / 1000) + 240,
    nonce
  }
  const domain = `cloneServiceFiles:${keccak256(
    AbiCoder.defaultAbiCoder().encode(
      [
        'string',
        'uint256',
        'string',
        'string',
        'address',
        'bytes32',
        'uint256'
      ],
      [
        peerId,
        task.chainId,
        task.documentId,
        task.serviceId,
        task.datatokenAddress,
        task.sourceFilesHash,
        task.validUntil
      ]
    )
  )}`
  const signature = await signer.signMessage(
    getBytes(keccak256(toUtf8Bytes(consumerAddress + nonce + domain)))
  )
  const encrypted = await nodeCommand(source.serviceEndpoint, {
    ...task,
    signature
  })
  if (!/^0x[0-9a-f]+$/i.test(encrypted))
    throw new Error('The node did not return encrypted service files.')
  return encrypted
}
