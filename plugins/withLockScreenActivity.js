// Lets MainActivity appear over the lock screen and wake the display when the
// full-screen alarm notification fires.
const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

module.exports = function withLockScreenActivity(config) {
  return withAndroidManifest(config, (cfg) => {
    const main = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    main.$['android:showWhenLocked'] = 'true';
    main.$['android:turnScreenOn'] = 'true';
    return cfg;
  });
};
