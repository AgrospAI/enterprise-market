# Test asset publication

Sample algorithm and dataset specs for publishing test assets with
`pontus-x_cli` v2.0.5. These are independent of the marketplace's consent registry.

1. Install the CLI following its repository instructions.
2. Supply encrypted JSON keystores in the ignored `keys/` directory. Update
   `manifest.yaml` account addresses and paths, and each spec's owner and trusted
   publisher to match your test accounts. Never commit keys or passwords.
3. Export `UDL_KEY_PASSWORD` and the CLI's upload credentials (`PINATA_JWT` or
   `IPFS_UPLOAD_URL`). Use a funded OP Sepolia wallet and an Ocean Node supporting
   that network. Do not use production wallets.
4. Replace the local service endpoints in both specs with the target node.
   The debugger image must be accessible to that node; replace it with your own
   test algorithm image and checksum if necessary.
5. From this directory, validate, then publish:

```sh
pontus-x_cli publish assets --recursive --manifest manifest.yaml --dry-run
pontus-x_cli publish assets --recursive --manifest manifest.yaml
```

The dataset has download and compute services priced at 1 devEURAU; the algorithm
is free. Both use public sample wine data. Publication creates real on-chain
assets and costs gas. Specs omit deployment DIDs so a fresh checkout can publish
new assets; retain any resulting DIDs locally to manage your test publications.

Local `.env` and wallet files are ignored by Git and excluded from Docker builds.
