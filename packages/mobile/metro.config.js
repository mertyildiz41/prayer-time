const path = require('path');
const fs = require('fs');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const projectNodeModules = path.join(projectRoot, 'node_modules');
const workspaceNodeModules = fs.realpathSync(path.join(workspaceRoot, 'node_modules'));

const resolveFromWorkspace = (moduleName) =>
  // Resolve to the real (non-symlinked) node_modules path so Metro keeps a single React instance alive.
  path.join(workspaceNodeModules, moduleName);

const config = {
  projectRoot,
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [projectNodeModules, workspaceNodeModules],
    extraNodeModules: {
      react: resolveFromWorkspace('react'),
      'react/jsx-runtime': resolveFromWorkspace('react/jsx-runtime'),
      'react-dom': resolveFromWorkspace('react-dom'),
      'react-native': resolveFromWorkspace('react-native'),
    },
    unstable_enableSymlinks: true,
  },
};

console.log('Metro config:', JSON.stringify(config, null, 2));

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);