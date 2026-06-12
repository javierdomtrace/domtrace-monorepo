/**
 * pnpm hook — forces react-native-screens to 3.x for all packages.
 *
 * react-native-screens 4.x ships TypeScript Fabric source files with prop types
 * of `undefined` that @react-native/babel-plugin-codegen (RN 0.76) cannot parse.
 * Version 3.x only has Paper (old-arch) components and avoids this entirely.
 *
 * .pnpmfile.cjs is the correct override mechanism for pnpm 9.0.x.
 */
function readPackage(pkg) {
  const screens3 = '>=3.27.0 <4.0.0'
  if (pkg.dependencies?.['react-native-screens']) {
    pkg.dependencies['react-native-screens'] = screens3
  }
  if (pkg.peerDependencies?.['react-native-screens']) {
    pkg.peerDependencies['react-native-screens'] = screens3
  }
  return pkg
}

module.exports = {
  hooks: {
    readPackage,
  },
}
