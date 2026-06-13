const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Workaround for Expo SDK 56 / RN 0.81 generated android/app/build.gradle
 * setting `hermesCommand` via require.resolve('hermes-compiler/package.json', ...),
 * which throws "Cannot invoke method getAbsolutePath() on null object" in
 * monorepo setups where that package can't be resolved from the android/ dir.
 *
 * We strip that line so the React Native Gradle Plugin falls back to its
 * built-in hermesc detection (node_modules/react-native/sdks/hermesc/%OS-BIN%/hermesc),
 * which is bundled with react-native and always resolvable.
 */
module.exports = function withFixHermesCommand(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      const lines = config.modResults.contents.split('\n');
      const filtered = lines.filter((line) => !line.includes("hermesCommand = new File"));
      config.modResults.contents = filtered.join('\n');
    }
    return config;
  });
};
