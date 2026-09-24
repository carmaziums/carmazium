import { DeviceEventEmitter } from 'react-native';

export type ProductSyncDomain = 'listings' | 'offers' | 'dealer' | 'services' | 'account';

export interface ProductSyncEvent {
  domain: ProductSyncDomain;
  action?: string;
  at?: number;
}

const EVENT_NAME = 'carmazium:product-changed';

export function emitProductSync(event: ProductSyncEvent): void {
  DeviceEventEmitter.emit(EVENT_NAME, event);
}

export function subscribeProductSync(
  domains: ProductSyncDomain[],
  callback: (event: ProductSyncEvent) => void,
): () => void {
  const allowed = new Set(domains);
  const subscription = DeviceEventEmitter.addListener(EVENT_NAME, (event: ProductSyncEvent) => {
    if (event && allowed.has(event.domain)) callback(event);
  });
  return () => subscription.remove();
}
