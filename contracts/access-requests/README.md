# Access requests registry

The frontend requires registry version 6 and creates new service requests with
immutable proposed terms. The contract also retains algorithm, publisher and
network permission request methods; the current frontend does not activate those
legacy request kinds. Optional request messages are public, immutable,
and limited to 2048 UTF-8 bytes. Never include credentials or personal data.

Only the recorded receiver who still owns the dataset NFT can approve or reject.
The requester can cancel a pending request. Requests expire after the contract's
request lifetime. Approval and the NFT metadata update occur atomically: either
both succeed or both revert. The owner first authorizes the registry with the
NFT's `addToMetadataList`; the marketplace exposes this setup action. Service
creation provisions a datatoken and pricing before final approval, so interrupted
flows can leave provisioned resources.

The contract cannot interpret encrypted metadata. The marketplace reviews and
signs the selected service policy patch, rechecks ownership and request state,
and submits the metadata update. Approval changes policy; actual download and
compute access still depend on provider validation and other asset credentials.

Service activation requires the original Ocean Node to implement
`cloneServiceFiles-v1` through `/directCommand`, plus the `status` and `nonce`
commands. The marketplace probes support before provisioning. A stock node
without this capability cannot activate new services; deploying the registry
alone is insufficient.

## Build and test

Use Node 22, Foundry 1.7.1, and Solidity 0.8.24:

```sh
cd contracts/access-requests
npm ci --ignore-scripts
forge test
forge build
node tools/export-abi.mjs
```

OpenZeppelin 5.0.2 is locked. Compiler settings in `foundry.toml` target Paris,
via IR, optimizer 200 runs, with no bytecode metadata hash.
`abi.json` is generated from this build and imported by the frontend.

For focused frontend tests, run from the repository root:

```sh
npm run jest -- --runInBand --coverage=false --testPathPattern='accessRequests|AccessRequests|useAccessRequests'
node scripts/test-access-requests-runtime.cjs
```

## Deploy and configure

From the repository root, set `ACCESS_REQUESTS_RPC_URL` to an OP Sepolia RPC,
`ACCESS_REQUESTS_KEYSTORE` to an encrypted JSON keystore outside version control,
and `UDL_KEY_PASSWORD` in the environment. Optionally use an ignored
`ACCESS_REQUESTS_PASSWORD_ENV` file containing that password variable.
Run `npm run deploy:access-requests -- --help` for defaults and options.

```sh
npm run deploy:access-requests
# After reviewing deployment verification, configure the local market:
npm run deploy:access-requests -- --resume --configure
```

The script runs contract tests, exports the ABI, deploys, checks runtime bytecode
and version, and attempts Sourcify verification. It records
`deployment.v6.op-sepolia.json`. Use `--resume` after an interrupted deployment
to inspect the saved transaction rather than broadcasting another deployment.
Generated receipts are ignored by Git. For a release, commit the source before
deploying, verify the resulting manifest against that source and runtime, and
explicitly add the reviewed receipt with `git add -f`. Local development receipts
do not establish release provenance.

Set `NEXT_PUBLIC_ACCESS_REQUESTS_CONTRACTS` to a JSON map of chain ID to
`{ "address": "<checksummed registry address>", "deploymentBlock": 123 }`.
Leave it `{}` to disable requests. Restart local development or regenerate
runtime configuration for the deployed application.

Registries are immutable and have no administrator or proxy. A new deployment
does not migrate requests or seen state; older requests stay in their registry.
Validate indexing and provider access with your own test assets before rollout.

## Notifications

Version 6 stores `seenActivity[wallet][requestId]` on-chain. Incoming requests
and cancellations, outgoing approvals/rejections, and expiry produce activity.
Each request contributes at most one unread notification for its latest activity;
actions by the connected wallet do not notify that wallet.

`notificationPage` scans received/sent inboxes.
`markSeen(id, expectedActivity)` is participant-only and rejects stale revisions.
Expiry requires no scheduler. Opening Details marks activity seen on-chain;
the UI clears its notification after confirmation and preserves it on failure.
