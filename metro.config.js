const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('txt')) {
  config.resolver.assetExts.push('txt');
}

// Ignore problematic directories to prevent Metro from scanning them
config.resolver.blockList = [
  /node_modules\/lodash\/.*/,
  /node_modules\/\.lodash.*/,
];

// Prevent watchman from watching these directories
if (config.watchFolders) {
  config.watchFolders = config.watchFolders.filter(f => 
    !f.includes('lodash')
  );
}

module.exports = config;
