# Asset publication and editing E2E

Vitest runs exactly two sequential Playwright tests in `e2e/assets.e2e.ts`:
publication followed by editing of that run's newly published assets. Each test
contains dataset/download, algorithm, dataset/compute and SaaS scenarios. There is no
hard-coded DID, owner, chain, token, RPC endpoint or provider endpoint. Wallet
import uses the actual JSON-wallet dialog through `e2e/wallet.ts`.

## Run

```sh
npm ci --legacy-peer-deps
npx playwright install chromium
E2E_WALLET_FILE=/absolute/path/to/encrypted-wallet.json \
E2E_WALLET_PASSWORD='wallet-password' npm run test:e2e
```

Run against a production build so development reloads cannot reset a form during
a test. Put the deployment settings in an ignored `.env.e2e.local` file and use
them for both build and start:

```sh
node --env-file=.env.e2e.local --run build
node --env-file=.env.e2e.local --run start-docker
```

Set `NEXT_PUBLIC_SSI_ENABLED=false` in that file for the supported wallet-only
mode. Configure working provider/indexer endpoints and an IPFS upload account
with available quota. Keep the server running while the suite runs. Avoid
concurrent tests or file-generation commands against a development server.

Only the encrypted wallet file and password are required test credentials.
`E2E_BASE_URL` optionally selects another deployment; its default is
`http://localhost:8008`. `E2E_HEADED=true` shows the browser. The suite discovers
chain and provider settings from the portal and imports any compatible Ethereum
JSON keystore. The wallet must have the deployment's publishing permissions and
native gas currency. Tests create real assets and submit real transactions;
assets remain available for inspection. Do not run concurrently with another
process using the same wallet's nonce.

A deployment that requires OIDC or SSI authentication also requires that
identity session. A JSON wallet cannot satisfy those separate requirements. The
wallet-only suite fails explicitly on an SSI-required portal; it never disables
or mocks authentication. Configure the target application's supported wallet-only
mode (`NEXT_PUBLIC_SSI_ENABLED=false`) to run with only these two credentials.

Artifacts in ignored `.artifacts/e2e/` contain published/edited DDO JSON and
failure screenshots. The suite does not save browser storage or wallet traces.
DDO polling verifies the indexed result rather than treating a transaction or
success banner as proof of persistence. Indexing has a three-minute deadline.

## Field inventory

Paths below are relative to `credentialSubject` unless stated otherwise.
Fields that depend on an asset or service type are listed explicitly; a dataset
with a download service cannot simultaneously exercise every conditional field.

| Form field                                                              | Persisted location                                                                       | Editable after publication                                      |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Title                                                                   | `metadata.name`                                                                          | Yes                                                             |
| Description, language, direction                                        | `metadata.description` (`@value`, `@language`, `@direction`)                             | Yes; direction follows language                                 |
| Author, copyright holder, provided by                                   | `metadata.author`, `copyrightHolder`, `providedBy`                                       | Yes                                                             |
| Tags                                                                    | `metadata.tags`                                                                          | Yes                                                             |
| Ontology terms                                                          | `metadata.additionalInformation['dcat:theme']`                                           | Yes                                                             |
| Links (title/URL pairs)                                                 | `metadata.links`                                                                         | Yes                                                             |
| Geographic rectangle, location name                                     | `metadata.additionalInformation['dct:spatial']`                                          | Yes                                                             |
| Temporal coverage start/end                                             | `metadata.additionalInformation['dct:temporal']`                                         | Yes                                                             |
| Main license URL or uploaded file                                       | `metadata.license.licenseDocuments[0]`                                                   | Yes                                                             |
| Additional license names, URLs/uploads                                  | `metadata.license.licenseDocuments[1…]`                                                  | Yes                                                             |
| Consent of data subjects                                                | Publication validation                                                                   | Publication only; no DDO field                                  |
| Terms agreement                                                         | `metadata.additionalInformation.termsAndConditions`                                      | Publication only                                                |
| Dataset/algorithm/SaaS                                                  | `metadata.type`; SaaS also `additionalInformation.saas`                                  | Type locked in edit UI                                          |
| Algorithm image, tag, entrypoint, checksum                              | `metadata.algorithm.container`                                                           | Algorithms only                                                 |
| Algorithm consumer parameters                                           | `metadata.algorithm.consumerParameters`                                                  | Algorithms only                                                 |
| SaaS redirect URL/payment mode                                          | `metadata.additionalInformation.saas`                                                    | Redirect editable; payment mode fixed                           |
| Asset allowed/denied addresses and wildcards                            | `credentials.allow` / `.deny`                                                            | Yes                                                             |
| SSI credential requests, VC/VP policies and arguments                   | `credentials` SSIpolicy rules                                                            | SSI-enabled deployments only                                    |
| Asset state                                                             | Top-level `indexedMetadata.nft.state` (on-chain NFT state)                               | Yes                                                             |
| Additional asset description type/content                               | Top-level `additionalDdos`                                                               | Yes                                                             |
| NFT image regeneration (name/symbol/description generated)              | NFT contract/token URI and indexed NFT metadata                                          | Publication only; individual NFT attributes are not text inputs |
| Service name, description, language, direction                          | `services[i].name`, `.description`                                                       | Yes                                                             |
| Download/compute access                                                 | `services[i].type`                                                                       | Locked after creation                                           |
| Provider URL                                                            | `services[i].serviceEndpoint`                                                            | Locked after creation                                           |
| File type, URL, HTTP method/headers; storage-specific fields            | Encrypted `services[i].files`                                                            | Replaceable; existing secrets not displayed                     |
| Sample file                                                             | `services[i].links`                                                                      | Yes                                                             |
| Access duration (including custom seconds)                              | `services[i].timeout`                                                                    | Yes                                                             |
| Service state                                                           | `services[i].state`                                                                      | Yes                                                             |
| Service allowed/denied addresses and policies                           | `services[i].credentials`                                                                | Yes; SSI needs identity setup                                   |
| Consumer parameter name/label/type/description/required/default/options | `services[i].consumerParameters`                                                         | Yes; disabling removes parameters                               |
| Raw algorithm/network access (not exposed as edit controls)             | `services[i].compute.allowRawAlgorithm`, `.allowNetworkAccess`                           | Preserved from existing compute settings                        |
| Trusted algorithms (DID/service/checksums), trusted publishers          | `services[i].compute.publisherTrustedAlgorithms`, `.publisherTrustedAlgorithmPublishers` | Dataset compute services only                                   |
| Fixed/free pricing, price/base token                                    | On-chain exchange/dispenser; indexed pricing                                             | Fixed price editable; pricing type/currency locked              |
| Payment collector                                                       | Datatoken contract; derived access details                                               | Editable for an existing service                                |
| Datatoken name/symbol (generated; control hidden)                       | Datatoken contract/indexed metadata                                                      | Publication only                                                |

The dataset/download scenario covers text metadata, language/direction, tags,
links, ontology selection/removal when enabled, geographic drawing and labels,
temporal dates, uploaded primary and
supplemental licenses, switching the primary license to a validated URL,
supplemental document renaming, additional DDOs, fixed
pricing and price edits, payment collector edits, asset/service state, encrypted
URL files, sample links, select consumer parameters, removal of parameters,
asset/service wildcard removal, explicit allow/deny addresses and preservation
of unrelated metadata. Service descriptions are checked in the visible UI after
indexing and again in the editor after the asset is unlisted.

The same two tests include algorithm Docker image/tag/checksum/entrypoint and
algorithm consumer parameters, free pricing, compute wildcard-to-selected
algorithm and publisher transitions, and SaaS redirect editing. They reuse their
own newly published algorithm in the compute trust list.

SSI policy variants need an identity session; S3/FTP/EDC/REA and private container
registries need their respective services/credentials. These cannot be validated
universally with only a JSON wallet. The inventory lists these fields, but the wallet-only E2E
suite does not claim to exercise every storage backend or SSI policy type. If ontology inputs are enabled, their
server-side AgroPortal integration must be reachable.
Encrypted file contents require an authorized decrypt/download check; comparing
public DDO ciphertext alone does not prove each plaintext field.

## Coverage limits

The suite publishes four assets and edits those same assets. It requires a current
indexer and working upload, file validation and Docker checksum endpoints.
SSI policies, private registries and storage integrations require their own
credentials and services. Public ciphertext comparisons do not verify plaintext
file contents; use an authorized download/decrypt check for those.

Run the deterministic regression suite with `npm test`. These lifecycle tests
submit real transactions and require explicit test wallet configuration.
