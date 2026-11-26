import { Contract, parseEther, Signer } from 'ethers'
import { Datatoken, FixedRateExchange, Nft } from '@oceanprotocol/lib'
import { getOceanConfig } from '@utils/ocean'
import { getTokenInfo } from '@utils/wallet'
import {
  defaultDatatokenCap,
  defaultDatatokenTemplateIndex,
  marketFeeAddress,
  publisherMarketFixedSwapFee,
  publisherMarketOrderFee
} from 'app.config.cjs'
import { ServiceTerms } from './service'
import { sameAddress } from './client'

/** Recover confirmed provisioning steps from chain when approval is retried. */
export async function provisionRequestedService(
  nftAddress: string,
  serviceId: string,
  terms: ServiceTerms,
  signer: Signer,
  chainId: number,
  recheck: () => Promise<unknown>
): Promise<string> {
  const config = getOceanConfig(chainId)
  const wallet = await signer.getAddress()
  const nft = new Nft(signer, chainId)
  const dt = new Datatoken(signer, chainId)
  const marker = `Access request ${serviceId}`
  const tokens: string[] = await new Contract(
    nftAddress,
    ['function getTokensList() view returns (address[])'],
    signer
  ).getTokensList()
  const names = await Promise.all(tokens.map((address) => dt.getName(address)))
  let address = tokens.find((_, i) => names[i] === marker)
  if (!address) {
    await recheck()
    address = await nft.createDatatoken(
      nftAddress,
      wallet,
      wallet,
      wallet,
      marketFeeAddress,
      terms.baseToken,
      publisherMarketOrderFee,
      defaultDatatokenCap,
      marker,
      'OEAT',
      defaultDatatokenTemplateIndex
    )
  }
  const [rates, dispensers] = await Promise.all([
    dt.getFixedRates(address),
    dt.getDispensers(address)
  ])
  if (parseEther(terms.price) > 0n) {
    if (dispensers.length)
      throw new Error('The new datatoken has incompatible pricing.')
    if (!rates.length) {
      const token = await getTokenInfo(terms.baseToken, signer.provider)
      if (!token) throw new Error('Could not resolve the price token.')
      await recheck()
      const tx = await dt.createFixedRate(address, wallet, {
        fixedRateAddress: config.fixedRateExchangeAddress,
        baseTokenAddress: terms.baseToken,
        owner: wallet,
        marketFeeCollector: marketFeeAddress,
        baseTokenDecimals: token.decimals,
        datatokenDecimals: 18,
        fixedRate: parseEther(terms.price).toString(),
        marketFee: parseEther(publisherMarketFixedSwapFee).toString(),
        withMint: true
      })
      await tx.wait()
    } else {
      const rate = await new FixedRateExchange(
        rates[0].contractAddress,
        signer,
        chainId
      ).getExchange(rates[0].id)
      if (
        !sameAddress(rate.baseToken, terms.baseToken) ||
        parseEther(String(rate.fixedRate)) !== parseEther(terms.price) ||
        !rate.active
      )
        throw new Error(
          'The new datatoken price differs from the requested price.'
        )
    }
  } else {
    if (rates.length)
      throw new Error('The new datatoken has incompatible pricing.')
    if (!dispensers.length) {
      await recheck()
      const tx = await dt.createDispenser(
        address,
        wallet,
        config.dispenserAddress,
        {
          maxTokens: parseEther('1').toString(),
          maxBalance: parseEther('1').toString(),
          withMint: true
        }
      )
      await tx.wait()
    }
  }
  await recheck()
  return address
}
