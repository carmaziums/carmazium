// App entry (package.json "main"). Replaces node_modules/expo/AppEntry.js so
// the light/dark palette is resolved BEFORE App — and with it every screen's
// module-level StyleSheet.create() — is evaluated. Nothing imported at the top
// of this file may import a screen or component.
//
// The root component is registered synchronously (React Native expects it to
// exist as soon as the bundle has run); it renders nothing while the native
// splash is still held, then requires App lazily once the theme is applied.
import React from 'react';
import { registerRootComponent } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import { initThemeFromPreference } from './src/lib/themePreference';

SplashScreen.preventAutoHideAsync().catch(() => {});

let themeApplied = false;
const themeReady = initThemeFromPreference()
  .catch(() => undefined)
  .then(() => {
    themeApplied = true;
  });

function Root() {
  const [ready, setReady] = React.useState(themeApplied);
  React.useEffect(() => {
    if (ready) return undefined;
    let alive = true;
    themeReady.then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [ready]);
  if (!ready) return null;
  // Lazy on purpose: this is the first point any screen module evaluates.
  const App = require('./App').default;
  return React.createElement(App);
}

registerRootComponent(Root);
