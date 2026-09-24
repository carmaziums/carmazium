import { Injectable } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { WS_CORS } from '../core/allowed-origins';

export type ProductSyncDomain =
  | 'listings'
  | 'offers'
  | 'dealer'
  | 'services'
  | 'account';

export interface ProductSyncEvent {
  domain: ProductSyncDomain;
  action?: string;
}

/**
 * Lightweight cross-client invalidation channel.
 *
 * No business data is transported here. The event only says which domain
 * changed; web/iOS/Android then refetch the authoritative REST resource.
 * This keeps the database/backend as the sole source of truth while allowing
 * an already-open client to react to a mutation made on another device.
 */
@Injectable()
@WebSocketGateway({
  cors: WS_CORS,
  namespace: '/sync',
})
export class ProductSyncGateway {
  @WebSocketServer()
  server: Server;

  broadcast(event: ProductSyncEvent): void {
    this.server?.emit('product:changed', {
      domain: event.domain,
      action: event.action ?? 'changed',
      at: Date.now(),
    });
  }
}
