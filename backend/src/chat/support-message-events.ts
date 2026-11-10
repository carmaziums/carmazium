import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

/** Internal events emitted only after an authorised inbound message is persisted. */
@Injectable()
export class SupportMessageEvents {
    private readonly events = new EventEmitter();
    subscribe(listener: (roomId: string, messageId: string) => void): () => void {
        this.events.on('message', listener);
        return () => this.events.off('message', listener);
    }
    publish(roomId: string, messageId: string): void {
        this.events.emit('message', roomId, messageId);
    }
}
