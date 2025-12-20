module.exports = {
  project: {
    android: {
      sourceDir: './android',
    },
    ios: {
      sourceDir: './ios',
    },
  },
  // Specify the node binary path for builds (useful when using nvm)
  // Use the hoisted react-native from the monorepo root
  reactNativePath: '../../node_modules/react-native',
};

