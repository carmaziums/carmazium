import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { TOUR_NARRATION } from './tour-narration.catalog';

/** No caller-supplied text, voices or prompts. Cache is bounded by the fixed catalog. */
@Injectable()
export class TourNarrationService {
    private readonly cache = new Map<string, Buffer>();
    private readonly pending = new Map<string, Promise<Buffer>>();
    private readonly failedUntil = new Map<string, number>();
    private bytes = 0;
    private readonly client: OpenAI | null;

    constructor(config: ConfigService) {
        const apiKey = config.get<string>('OPENAI_API_KEY');
        this.client = apiKey ? new OpenAI({ apiKey, timeout: 45_000, maxRetries: 0 }) : null;
    }

    async get(key: string): Promise<Buffer> {
        if (!Object.prototype.hasOwnProperty.call(TOUR_NARRATION, key)) throw new NotFoundException('Unknown tour step');
        const cached = this.cache.get(key);
        if (cached) return cached;
        const pending = this.pending.get(key);
        if (pending) return pending;
        if (!this.client || this.pending.size >= 2 || (this.failedUntil.get(key) ?? 0) > Date.now()) {
            throw new ServiceUnavailableException('Voice guidance is temporarily unavailable');
        }
        const task = this.generate(key).finally(() => this.pending.delete(key));
        this.pending.set(key, task);
        return task;
    }

    private async generate(key: string): Promise<Buffer> {
        try {
            const response = await this.client!.audio.speech.create({
                model: 'gpt-4o-mini-tts', voice: 'marin', response_format: 'mp3',
                input: TOUR_NARRATION[key],
                instructions: 'Speak in natural British English, like a friendly, helpful website guide talking to one person. Use a warm conversational tone, natural intonation and short pauses between ideas. Avoid robotic delivery, exaggerated enthusiasm or a sales pitch. Read the supplied words faithfully. Pronounce CarMazium as Car-mez-ee-um. Read pound amounts as British pounds.',
            });
            const audio = Buffer.from(await response.arrayBuffer());
            if (!response.headers.get('content-type')?.startsWith('audio/') || audio.length < 100 || audio.length > 2_000_000 || this.bytes + audio.length > 64_000_000) {
                throw new Error('Invalid or oversized narration');
            }
            this.cache.set(key, audio);
            this.bytes += audio.length;
            this.failedUntil.delete(key);
            return audio;
        } catch {
            this.failedUntil.set(key, Date.now() + 60_000);
            // Do not disclose provider errors, configuration or credentials.
            throw new ServiceUnavailableException('Voice guidance is temporarily unavailable');
        }
    }
}
