import { Datatoken, FixedRateExchange, PriceAndFees } from '@oceanprotocol/lib'
import { Signer } from 'ethers'
import { consumeMarketFixedSwapFee } from '../../../app.config.cjs'
import { getDummySigner } from '@utils/wallet'

export async function resolveFixedRateExchangeAddress(
  accessDetails: AccessDetails,
  signer: Signer,
  chainId?: number
): Promise<string> {
  const retainedContract =
    accessDetails.exchangeContract || accessDetails.fixedRateExchangeAddress
  if (retainedContract) return retainedContract

  // Older cached access details may lack the contract. An exchange ID is
  // scoped to its registered contract, which can differ from chain defaults.
  const datatoken = new Datatoken(signer, chainId)
  const exchanges = await datatoken.getFixedRates(
    accessDetails.datatoken.address
  )
  const exchange = exchanges.find(
    (entry) =>
      entry.id.toLowerCase() === accessDetails.addressOrId.toLowerCase()
  )
  if (!exchange)
    throw new Error('Fixed rate exchange is not registered for this datatoken.')
  return exchange.contractAddress
}

/**
 * This is used to calculate the price to buy one datatoken from a fixed rate exchange. You need to pass either a web3 object or a chainId. If you pass a chainId a dummy web3 object will be created
 */
export async function getFixedBuyPrice(
  accessDetails: AccessDetails,
  chainId?: number,
  signer?: Signer
): Promise<PriceAndFees> {
  const zeroPriceAndFees: PriceAndFees = {
    baseTokenAmount: '0',
    oceanFeeAmount: '0',
    marketFeeAmount: '0',
    consumeMarketFeeAmount: '0'
  }

  if (!signer && !chainId)
    throw new Error("web3 and chainId can't be undefined at the same time!")

  if (!signer) {
    signer = await getDummySigner(chainId)
  }
  if (accessDetails.type === 'free') {
    return zeroPriceAndFees
  }
  const fixed = new FixedRateExchange(
    await resolveFixedRateExchangeAddress(accessDetails, signer, chainId),
    signer,
    chainId
  )
  return await fixed.calcBaseInGivenDatatokensOut(
    accessDetails.addressOrId,
    '1',
    consumeMarketFixedSwapFee
  )
}
