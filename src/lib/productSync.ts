export type ProductSyncDomain = 'listings' | 'offers' | 'dealer' | 'services' | 'account';

export interface ProductSyncEvent {
  domain: ProductSyncDomain;
  action?: string;
  at?: number;
}

export const PRODUCT_SYNC_EVENT = 'carmazium:product-changed';

export function subscribeProductSync(
  domains: ProductSyncDomain[],
  callback: (event: ProductSyncEvent) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};

  const allowed = new Set(domains);
  const handler = (raw: Event) => {
    const event = (raw as CustomEvent<ProductSyncEvent>).detail;
    if (event && allowed.has(event.domain)) callback(event);
  };

  window.addEventListener(PRODUCT_SYNC_EVENT, handler as EventListener);
  return () => window.removeEventListener(PRODUCT_SYNC_EVENT, handler as EventListener);
}
