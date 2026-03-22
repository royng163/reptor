const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');
const path = require('path');

const reptorCorePath = path.resolve(__dirname, '../reptor-core');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('tflite');

config.watchFolders = [...(config.watchFolders ?? []), reptorCorePath];

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@royng163/reptor-core': reptorCorePath,
};

module.exports = withUniwindConfig(config, {
  // relative path to your global.css file (from previous step)
  cssEntryFile: './global.css',
  // (optional) path where we gonna auto-generate typings
  // defaults to project's root
  dtsFile: './uniwind-types.d.ts',
});
