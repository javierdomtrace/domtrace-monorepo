const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Ensure Metro watches the entire monorepo root so the pnpm virtual store
// at node_modules/.pnpm is reachable.
const monorepoRoot = path.resolve(__dirname, '../..')
config.watchFolders = [...(config.watchFolders ?? []), monorepoRoot]


module.exports = config
