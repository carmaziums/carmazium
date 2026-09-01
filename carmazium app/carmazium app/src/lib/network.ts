import NetInfo from '@react-native-community/netinfo';

/**
 * Reachability, kept deliberately small (CROSS-015, OQ-28).
 *
 * Scope is the agreed minimum: know whether we are offline, say so, and let
 * `apiClient` fail with a sentinel screens can recognise. **No request queueing
 * and no cached reads** — both were explicitly held back for a separate
 * discussion, because both change what "saved" and "up to date" mean across the
 * whole app.
 *
 * Before this, an offline request rejected with a raw RN
 * `TypeError: Network request failed`, which is none of the existing sentinels
 * (`NO_SESSION`, `REQUEST_TIMEOUT`, `AUTH_REDIRECT`), so every screen rendered
 * it differently — usually as a generic failure indistinguishable from a server
 * error.
 */

/**
 * Last known state. Starts optimistic on purpose: NetInfo's first callback is
 * asynchronous, and blocking or failing requests during that gap would break
 * cold start on a perfectly good connection.
 */
let online = true;

/**
 * `isInternetReachable` is null until NetInfo has actually probed, and false
 * positives there are common on captive portals and some Android emulators.
 * Treat only a definite `false` as offline, and let a real request be the
 * arbiter otherwise — a wrong "you're offline" on a working connection is worse
 * than letting one request fail honestly.
 */
export function startNetworkMonitor(): () => void {
  const unsubscribe = NetInfo.addEventListener((state) => {
    online = !(state.isConnected === false || state.isInternetReachable === false);
  });
  return unsubscribe;
}

/** Synchronous best guess, for callers that cannot await. */
export function isOnline(): boolean {
  return online;
}

/**
 * Subscribe to connectivity for UI purposes. Returns an unsubscribe function.
 * Fires immediately with the current value so a banner does not wait for the
 * next change to render.
 */
export function subscribeToConnectivity(cb: (isOnline: boolean) => void): () => void {
  cb(online);
  return NetInfo.addEventListener((state) => {
    const next = !(state.isConnected === false || state.isInternetReachable === false);
    online = next;
    cb(next);
  });
}
