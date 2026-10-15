const { getSentryExpoConfig } = require('@sentry/react-native/metro');

// Sentry's Metro config injects stable debug IDs into release bundles so
// uploaded source maps can be matched to the exact JavaScript bundle. Runtime
// Sentry.init() alone does not provide this build-time mapping.
const config = getSentryExpoConfig(__dirname);

// Protect against Windows file-lock race conditions during cache reset (ENOTEMPTY / EBUSY)
try {
  const FileStore = require('metro-cache/src/stores/FileStore').default;
  if (FileStore && FileStore.prototype && typeof FileStore.prototype.clear === 'function') {
    const origClear = FileStore.prototype.clear;
    FileStore.prototype.clear = function() {
      try {
        origClear.call(this);
      } catch (err) {
        if (err && (err.code === 'ENOTEMPTY' || err.code === 'EBUSY' || err.code === 'EPERM')) {
          return;
        }
        throw err;
      }
    };
  }
} catch (_) {}

if (config.cacheStores && Array.isArray(config.cacheStores)) {
  config.cacheStores.forEach(store => {
    if (store && typeof store.clear === 'function') {
      const origClear = store.clear.bind(store);
      store.clear = function() {
        try {
          origClear();
        } catch (err) {
          if (err && (err.code === 'ENOTEMPTY' || err.code === 'EBUSY' || err.code === 'EPERM')) {
            return;
          }
          throw err;
        }
      };
    }
  });
}

module.exports = config;
