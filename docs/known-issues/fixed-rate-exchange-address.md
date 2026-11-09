# Fixed-price assets bought through the wrong exchange contract

**Status:** fixed on `agrospai` by 4bcab178 (use the asset's exchange) and 4fa88e51 (pay the full quote). A real purchase on 2026-11-09 confirmed it: "Información operativa de rutas de transporte de mercancías de Europillow" was bought from its asset page on the local market. Found while building the chat's payments.
**Affects:** every purchase of a fixed-price asset on OP Sepolia (11155420): the asset page's buy button, the compute wizard and the market chat.

## Symptom

Opening a paid asset in the dev server shows this runtime error:

```
could not decode result data (value="0x", info={ "method": "decimals", "signature": "decimals()" }, code=BAD_DATA, version=6.17.0)
src/@utils/ocean/fixedRateExchange.ts (39:28) @ async getFixedBuyPrice
```

The market catches the error and goes on with a zero exchange fee (`opcFee: '0'`, `baseTokenAmount: '0'`). The purchase then fails:
- `order()` asks the datatoken to buy from an exchange that does not hold the asset's offer, so `buyFromFreAndOrder` reverts.
- The wallet asks for the base-token `approve` first, so that transaction (gas only) is sent for nothing.

## Cause

The market assumes that every fixed-rate offer lives in **one** exchange contract, the one in its configuration. It never uses the exchange the asset was actually created on.

**1. Which exchange the configuration picks.** `getOceanConfig()` (`src/@utils/ocean/index.ts`) takes the exchange from the ocean.js artifacts and prefers the enterprise one:

```ts
config.fixedRateExchangeAddress =
  enterpriseContracts.FixedPriceEnterprise ||
  enterpriseContracts.FixedPrice ||
  config.fixedRateExchangeAddress
```

On OP Sepolia, ocean.js 9.2.1 lists two exchanges, and the router approves both (`Router.isFixedRateContract` returns `true` for each):

| Artifact | Address |
| --- | --- |
| `FixedPrice` | `0x69B6E54Ad2b3c2801d11d8Ad56ea1d892555b776` |
| `FixedPriceEnterprise` | `0x6976320eC365202118B4B0B0906E13DDf21633A5` |

**2. Where the paid assets actually are.** The paid assets checked are on `FixedPrice` (`0x69B6…`), including assets published between 2026-11-05 and 2026-11-09. Examples:

| Asset | Service |
| --- | --- |
| "Fertilización, Producción y Condiciones Meteorológicas" | access |
| "Información operativa de rutas de transporte de mercancías de Europillow" | access |
| "Soil Quality Mapping" | compute |
| "Binary Segmentation Model Validator" | compute |
| "Calcular mediana y moda de un dataset (ITI)" | compute |
| "Estructura Digital de la Organización" | compute |

**How they were published.** They were created through the market's own `ERC721Factory` (`0xDEfD…`), with `0x69B6…` passed as the exchange. An example is tx `0x46c65cfc…3989`, sent by the publisher `0xcd081BA1…1DB9c`. In the same block range, `0x6976…` had no events.

**Production.** Its bundle (`/_next/static/chunks/pages/_app-df72d92c676934db.js`, checked on 2026-11-09) has the same artifacts for `optimism_sepolia`, so it should resolve `0x6976…` too. This has not been confirmed with a purchase.

**3. Where the configured address is used instead of the asset's own exchange:**

| File | Use |
| --- | --- |
| `src/@utils/ocean/fixedRateExchange.ts:34` | `getFixedBuyPrice` quotes through `config.fixedRateExchangeAddress` |
| `src/@utils/order.ts:150` | template 2: `freParams.exchangeContract` |
| `src/@utils/order.ts:167` and `:174` | template 1: the `approve` spender and `new FixedRateExchange(...)` |

**4. The real exchange is already read, then thrown away.** `getAccessDetails` (`src/@utils/accessDetailsAndPricing.ts:309-312`) reads it with `datatoken.getFixedRates()` (`fixedRates[0].contractAddress`). It uses it to read the price, but does not keep it in `AccessDetails`.

**Still unknown:** why these assets were published on `FixedPrice` when this code resolves `FixedPriceEnterprise`. Whoever published them (`0xcd081BA1…`) may have used another build or tool. **It does not change the fix:** the market must buy each offer from the exchange that holds it.

## Second bug, hidden behind the first: `order()` did not pay the swap fees

With the right exchange, the quote for a 1 devEURAU dataset is **1.052**: 1 of price, 0.002 of Ocean's fee (`opcFee`) and 0.05 of the publishing market's swap fee (`marketFeeAmount`).

`order()` approved and capped the purchase at `price + opcFee` (1.002), so the exchange would still refuse it: the allowance is too low and `maxBaseTokenAmount` is below the cost. `getOrderPriceAndFees` already returned the full quote as `baseTokenAmount`, but `order()` did not use it.

## Fix

Commits 4bcab178 and 4fa88e51:

1. **`src/@types/Price.d.ts`:** an optional `fixedRateExchangeAddress?: string` in `AccessDetails`, the exchange contract that holds `addressOrId`.
2. **`getAccessDetails`** (`src/@utils/accessDetailsAndPricing.ts`): sets `fixedRateExchangeAddress: freAddress` in the fixed-price branch.
3. **`getFixedBuyPrice`** (`src/@utils/ocean/fixedRateExchange.ts`) and **`EditService`**: build `FixedRateExchange` with `accessDetails.fixedRateExchangeAddress || config.fixedRateExchangeAddress`.
4. **`order()`** (`src/@utils/order.ts`): uses the same address for `freParams.exchangeContract`, the template 1 `approve` spender and `new FixedRateExchange(...)`. The configuration is only a fallback.
5. **`order()`:** pays the exchange's quote, `orderPriceAndFees.baseTokenAmount`, which holds the price and every swap fee, in the template 2 `approve` (plus the consume market and provider fees), `freParams.maxBaseTokenAmount`, and the template 1 `approve` and `buyDatatokens`. Without a quote it falls back to `price + opcFee + publisherMarketFixedSwapFee + consumeMarketFixedSwapFee`.

### Tests

| Test file | What it checks |
| --- | --- |
| `src/@utils/accessDetailsAndPricing.test.ts` | `getAccessDetails` keeps the exchange from `getFixedRates` |
| `src/@utils/ocean/fixedRateExchange.test.ts` | the quote uses the asset's exchange, with the configured one as fallback |
| `src/@utils/order.test.ts` | templates 1 and 2 buy on the asset's exchange and approve and cap the full quote (1.052); the fallback without a quote is 1.002 |

**Read-only check on the live chain:** after the fix, "Fertilización…" quotes `baseTokenAmount: 1.052` from `0x69B6…`. Before, it failed with `decimals` `BAD_DATA`.

### How to check it

Buy a 1 devEURAU dataset (for example "Fertilización, Producción y Condiciones Meteorológicas") from its page with a wallet that has devEURAU and OP Sepolia ETH. Then check two things:
- the runtime error is gone;
- the wallet shows the purchase without a failure warning.

## Market chat

The chat (`src/@utils/chat/verifyIntent.ts`) buys through `order()` and `handleComputeOrder`, so it gets both fixes. Two more things:
- Its card shows the same total `order()` approves: the exchange's quote plus the consume market and provider fees.
- It still refuses a paid order when the exchange gives no quote (`baseTokenAmount` is 0), instead of asking the wallet for transactions that revert.
