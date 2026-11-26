import { createRequire } from 'module'
import { withPostHogConfig } from '@posthog/nextjs-config'

const require = createRequire(import.meta.url)

// Search engines may only index the NEXT_PUBLIC_SITE_URL host (see
// src/@utils/seo.ts). Statically optimized pages are rendered at build time and
// assume that host, so every other host (e.g. Vercel preview URLs) gets a
// noindex header. Both values are read at build time.
function getNoindexHeaders() {
  if (String(process.env.NEXT_PUBLIC_ALLOW_INDEXING).toLowerCase() === 'true') {
    return []
  }

  let hostname
  try {
    hostname = new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname
  } catch {
    return []
  }
  const pattern = hostname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  return [
    {
      source: '/:path*',
      // Not the site host, directly or behind a proxy that only sets
      // X-Forwarded-Host
      missing: [
        { type: 'host', value: pattern },
        { type: 'header', key: 'x-forwarded-host', value: `${pattern}(:\\d+)?` }
      ],
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]
    }
  ]
}

const nextConfig = {
  output: 'standalone',
  // the markdown pages are read at request time, so they must survive tracing
  outputFileTracingIncludes: {
    '/*': ['./content/pages/**/*']
  },
  serverExternalPackages: ['wagmi', 'viem', 'connectkit'],
  experimental: {
    esmExternals: 'loose'
  },
  webpack: (config, options) => {
    const { isServer } = options

    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'rdf-canonize-native': false
    }

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        http: require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        'react-native-async-storage': false,
        '@react-native-async-storage/async-storage': false,
        fs: false,
        crypto: false,
        os: false,
        stream: false,
        assert: false,
        tls: false,
        net: false
      }

      config.plugins = (config.plugins || []).concat([
        new options.webpack.ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer']
        })
      ])
    }

    config.module.rules.push(
      {
        test: /\.svg$/,
        issuer: /\.(tsx|ts)$/,
        use: [{ loader: '@svgr/webpack', options: { icon: true } }]
      },
      {
        test: /\.gif$/,
        type: 'asset/resource'
      }
    )

    config.plugins.push(
      new options.webpack.IgnorePlugin({
        resourceRegExp: /^electron$/
      })
    )

    return config
  },
  async headers() {
    return getNoindexHeaders()
  },
  async redirects() {
    return [
      {
        source: '/publish',
        destination: '/publish/1',
        permanent: true
      }
    ]
  },
  async rewrites() {
    const walletApiBase =
      process.env.NEXT_PUBLIC_SSI_WALLET_API || 'https://wallet.demo.walt.id'

    const providerUrl =
      process.env.NEXT_PUBLIC_PROVIDER_URL ||
      'https://provider.oceanprotocol.com'

    const routes = [
      {
        source: '/ssi/:path*',
        destination: `${walletApiBase}/:path*`
      },
      {
        source: '/provider/:path*',
        destination: `${providerUrl}/:path*`
      }
    ]

    return routes
  }
}

export default withPostHogConfig(nextConfig, {
  personalApiKey: process.env.POSTHOG_API_KEY ?? '',
  projectId: process.env.POSTHOG_PROJECT_ID,
  host: process.env.POSTHOG_HOST,
  sourcemaps: {
    enabled: Boolean(
      process.env.POSTHOG_API_KEY && process.env.POSTHOG_PROJECT_ID
    ),
    // Docker excludes .git, so use the commit supplied by Argo explicitly.
    releaseName: 'enterprise-market',
    releaseVersion: process.env.COMMIT_REF,
    deleteAfterUpload: true
  }
})
