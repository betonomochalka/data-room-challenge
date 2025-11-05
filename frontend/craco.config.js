const path = require('path');
const webpack = require('webpack');

module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {
      // Add support for PYTHON_API_URL environment variable
      // This allows using PYTHON_API_URL without REACT_APP_ prefix
      const plugins = webpackConfig.plugins || [];
      
      // Check if DefinePlugin already exists to avoid duplicates
      const existingDefinePlugin = plugins.find(
        plugin => plugin.constructor.name === 'DefinePlugin'
      );
      
      if (existingDefinePlugin) {
        // Merge with existing DefinePlugin
        const existingDefinitions = existingDefinePlugin.definitions || {};
        existingDefinePlugin.definitions = {
          ...existingDefinitions,
          'process.env.PYTHON_API_URL': JSON.stringify(process.env.PYTHON_API_URL),
        };
      } else {
        // Add new DefinePlugin
        plugins.push(
          new webpack.DefinePlugin({
            'process.env.PYTHON_API_URL': JSON.stringify(process.env.PYTHON_API_URL),
          })
        );
      }
      
      webpackConfig.plugins = plugins;
      return webpackConfig;
    },
  },
  jest: {
    configure: {
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
    },
  },
};
