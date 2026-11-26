# Pinata cleanup

Requires Node 22 and the repository's `.env` file. Existing shell environment variables take precedence over `.env`.

```sh
npm run pinata:cleanup                # preview
npm run pinata:cleanup -- --execute   # unpin eligible files
```

Configuration: `IPFS_JWT`, `NEXT_PUBLIC_IPFS_DELETE_URL`,
`NEXT_PUBLIC_IPFS_GATEWAY`, and `NEXT_PUBLIC_IPFS_UNPIN_FILES=true` (required
for execution). The JWT needs permission to list pins and unpin content.
Escaped URL colons (`https\://`) are supported.

Only pins strictly older than 30 days, measured from Pinata's `date_pinned`,
are eligible. The script identifies this application's uploaded files by their
exact `{ content: string, filename: string }` wrapper. Metadata, DDOs,
`encryptedData` wrappers, raw files and unknown formats are preserved.
This also includes uploaded license documents that use the same file wrapper.
Age is the only retention criterion; eligible files can still be referenced by assets.

The script first snapshots all pinned CIDs, then checks old content through the
configured gateway. If it denies access (401/403), it tries Pinata's public
gateway. API credentials are never sent to either gateway. Unreadable content
is skipped and produces a nonzero exit status. No additional dependencies are
required.

```sh
node --experimental-strip-types --test scripts/cleanup-pinata.test.mjs
```

API reference: https://github.com/PinataCloud/Pinata-SDK#pinlist
