const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('txt')) {
  config.resolver.assetExts.push('txt');
}

// Ignore problematic directories to prevent Metro from scanning them
config.resolver.blockList = [
  /node_modules\/lodash\/.*/,
  /node_modules\/\.lodash.*/,
  // Old damaged copy of node_modules left in the project folder.
  /node_modules_da.ado[\\/].*/,
];

// Prevent watchman from watching these directories
if (config.watchFolders) {
  config.watchFolders = config.watchFolders.filter(f => 
    !f.includes('lodash')
  );
}

// Windows' antivirus and search indexer keep touching files in node_modules, and each touch reached the
// app as a Fast Refresh (the screen flickered). Dependencies do not change while the server runs, so
// change events inside node_modules are dropped; changes to the app's own files still refresh it.
const path = require('path');
for (const file of [
  'node_modules/@expo/metro/node_modules/metro-file-map/src/watchers/AbstractWatcher.js',
  'node_modules/@expo/metro-file-map/build/watchers/AbstractWatcher.js',
  'node_modules/metro-file-map/src/watchers/AbstractWatcher.js',
]) {
  let AbstractWatcher;
  try { ({ AbstractWatcher } = require(path.join(__dirname, file))); } catch { continue; }
  const emit = AbstractWatcher && AbstractWatcher.prototype.emitFileEvent;
  if (!emit || emit.ignoresNodeModules) continue;
  const filtered = function (event) {
    if (/(^|[\\/])node_modules([\\/]|$)/.test(event.relativePath || '')) return;
    return emit.call(this, event);
  };
  filtered.ignoresNodeModules = true;
  AbstractWatcher.prototype.emitFileEvent = filtered;
}

module.exports = config;
