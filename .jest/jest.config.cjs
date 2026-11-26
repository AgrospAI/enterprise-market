const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './'
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  rootDir: '../',
  // Add more setup options before each test is run
  setupFilesAfterEnv: ['<rootDir>/.jest/jest.setup.tsx'],
  // if using TypeScript with a baseUrl set to the root directory then you need the below for alias' to work
  moduleDirectories: ['node_modules', '<rootDir>/src'],
  testEnvironment: 'jsdom',
  resolver: '<rootDir>/.jest/resolver.cjs',
  moduleNameMapper: {
    '^.+\\.(svg)$': '<rootDir>/.jest/__mocks__/svgrMock.tsx',
    '@components/(.*)$': '<rootDir>/src/components/$1',
    '@shared(.*)$': '<rootDir>/src/components/@shared/$1',
    '@hooks/(.*)$': '<rootDir>/src/@hooks/$1',
    '@context/(.*)$': '<rootDir>/src/@context/$1',
    '@images/(.*)$': '<rootDir>/src/@images/$1',
    '@utils/(.*)$': '<rootDir>/src/@utils/$1',
    '@content/(.*)$': '<rootDir>/@content/$1'
  },
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/@types/**/*.{ts,tsx}'],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/coverage',
    '<rootDir>/e2e/'
  ]
}

async function jestConfig() {
  const nextJestConfig = await createJestConfig(customJestConfig)()

  // Ocean's ESM dependencies need the same SWC transform as application code.
  nextJestConfig.transformIgnorePatterns = []
  for (const [, options] of Object.values(nextJestConfig.transform)) {
    // Dependencies use native class fields, including static Error.name.
    options.jsConfig.compilerOptions.useDefineForClassFields = true
  }
  return nextJestConfig
}

module.exports = jestConfig
