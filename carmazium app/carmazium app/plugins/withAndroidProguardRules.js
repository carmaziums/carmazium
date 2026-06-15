const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const KEEP_RULES = `
# expo-modules-core: Kotlin type cache required for New Architecture TurboModule bridge.
# AnyTypeCache is referenced via Kotlin reflection; R8 removes it without these rules.
-keep class expo.modules.kotlin.** { *; }
-keepnames class expo.modules.kotlin.** { *; }
-keepclassmembers class expo.modules.kotlin.** { *; }
-dontwarn expo.modules.kotlin.**

# Keep all Expo module definitions (SystemUIModule, etc.)
-keep class expo.modules.** { *; }
-keepnames class expo.modules.** { *; }
-keepclassmembers class expo.modules.** { *; }
-dontwarn expo.modules.**
`;

const withAndroidProguardRules = (config) => {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const proguardFile = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro'
      );
      if (fs.existsSync(proguardFile)) {
        const existing = fs.readFileSync(proguardFile, 'utf8');
        if (!existing.includes('expo.modules.kotlin.**')) {
          fs.appendFileSync(proguardFile, KEEP_RULES);
        }
      }
      return config;
    },
  ]);
};

module.exports = withAndroidProguardRules;
