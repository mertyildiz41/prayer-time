const path = require('path');
const fs = require('fs');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const projectNodeModules = path.join(projectRoot, 'node_modules');

const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;

const resolveFromWorkspace = (moduleName) =>
  // Resolve to the real (non-symlinked) node_modules path so Metro keeps a single React instance alive.
  path.join(projectNodeModules, moduleName);

const config = {
  projectRoot,
  resetCache: true,
  transformer: {

    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  resolver: {
    nodeModulesPaths: [projectNodeModules],
    assetExts: assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...sourceExts, 'svg', 'cjs', 'json'],
    extraNodeModules: {
      react: resolveFromWorkspace('react'),
      'react/jsx-runtime': resolveFromWorkspace('react/jsx-runtime'),
      'react-dom': resolveFromWorkspace('react-dom'),
      'react-native': resolveFromWorkspace('react-native'),
    },
    unstable_enableSymlinks: true,
  },
};
module.exports = mergeConfig(getDefaultConfig(__dirname), config);