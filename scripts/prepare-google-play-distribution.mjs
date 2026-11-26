import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function prepareGooglePlayDistribution(directory) {
  const path = resolve(directory, 'app.json');
  const app = JSON.parse(readFileSync(path, 'utf8'));
  if (app.expo?.android?.package !== 'uk.carmazium.app') throw new Error('Unexpected Android identity');
  const permission = 'android.permission.REQUEST_INSTALL_PACKAGES';
  app.expo.android.permissions = (app.expo.android.permissions ?? []).filter(value => value !== permission);
  app.expo.android.blockedPermissions = [...new Set([...(app.expo.android.blockedPermissions ?? []), permission])];
  // Keep Play updates on the store. An OTA from the direct-download channel
  // must never restore the APK installer code into the Play installation.
  app.expo.updates = { ...app.expo.updates, enabled: false, checkAutomatically: 'NEVER' };
  delete app.expo.updates.requestHeaders;
  copyFileSync(resolve(directory, 'src/lib/appUpdater.play.ts'), resolve(directory, 'src/lib/appUpdater.ts'));
  writeFileSync(path, JSON.stringify(app, null, 2) + '\n');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepareGooglePlayDistribution(process.argv[2] ?? process.cwd());
}
