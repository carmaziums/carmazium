const { withGradleProperties } = require('@expo/config-plugins');

// Same problem as withAndroidReleaseSigning.js: android/gradle.properties is
// regenerated from scratch by `expo prebuild --clean`, wiping any manual
// tuning. This plugin re-applies a larger JVM heap on every prebuild.
//
// Why this exists: a full `assembleRelease` build (this app has 20+ native
// modules — Stripe, Reanimated, gesture-handler, screens, svg, webview,
// worklets, the full Expo module set) run continuously in one JVM process
// hit the stock template's 2 GiB heap / 512 MiB metaspace ceiling during the
// late-stage optimizeReleaseResources/lintVitalAnalyzeRelease tasks, causing
// those tasks to fail and the process to hang trying to report the failure
// under memory pressure (confirmed 2026-07-12: re-running the same two tasks
// against a fresh, less memory-pressured process succeeded immediately with
// no code/config changes — this was a resource ceiling, not a real bug).

const MIN_HEAP_MB = 4096;
const MIN_METASPACE_MB = 1024;

const withAndroidGradleMemory = (config) =>
  withGradleProperties(config, (config) => {
    const existing = config.modResults.find((item) => item.type === 'property' && item.key === 'org.gradle.jvmargs');
    const newValue = `-Xmx${MIN_HEAP_MB}m -XX:MaxMetaspaceSize=${MIN_METASPACE_MB}m`;

    if (existing) {
      existing.value = newValue;
    } else {
      config.modResults.push({ type: 'property', key: 'org.gradle.jvmargs', value: newValue });
    }
    return config;
  });

module.exports = withAndroidGradleMemory;
