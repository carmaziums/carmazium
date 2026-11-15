import { NotFoundException, ServiceUnavailableException, StreamableFile } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { TourNarrationService } from './tour-narration.service';
import { TourNarrationController } from './tour-narration.controller';
import { TOUR_NARRATION } from './tour-narration.catalog';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';

const keys = Object.keys(TOUR_NARRATION);
const response = () => new Response(new Uint8Array(1000), { headers: { 'Content-Type': 'audio/mpeg' } });
function setup() {
    const service = new TourNarrationService({ get: () => 'test-key' } as any);
    const generate = jest.fn().mockImplementation(async () => response());
    (service as any).client = { audio: { speech: { create: generate } } };
    return { service, generate };
}

describe('Natural tour narration', () => {
    it('rejects arbitrary text, inherited keys and unknown hashes without calling the provider', async () => {
        const { service, generate } = setup();
        for (const key of ['Read my private message', '__proto__', 'constructor', '0'.repeat(64)]) {
            await expect(service.get(key)).rejects.toBeInstanceOf(NotFoundException);
        }
        expect(generate).not.toHaveBeenCalled();
    });
    it('sends only approved public copy and reuses the audio across users', async () => {
        const { service, generate } = setup();
        const first = await service.get(keys[0]);
        expect(await service.get(keys[0])).toBe(first);
        expect(generate).toHaveBeenCalledTimes(1);
        expect(generate.mock.calls[0][0]).toMatchObject({ input: TOUR_NARRATION[keys[0]], voice: 'marin', response_format: 'mp3' });
        expect(generate.mock.calls[0][0].instructions).toContain('natural British English');
    });
    it('coalesces concurrent requests and limits concurrent provider calls', async () => {
        const { service, generate } = setup();
        const resolvers: Array<(response: Response) => void> = [];
        generate.mockImplementation(() => new Promise(resolve => resolvers.push(resolve)));
        const a = service.get(keys[0]);
        const b = service.get(keys[0]);
        const c = service.get(keys[1]);
        await expect(service.get(keys[2])).rejects.toBeInstanceOf(ServiceUnavailableException);
        expect(generate).toHaveBeenCalledTimes(2);
        resolvers.forEach(resolve => resolve(response()));
        const [aa, bb] = await Promise.all([a, b, c]);
        expect(aa).toBe(bb);
    });
    it('sanitizes failures and prevents immediate chargeable retries', async () => {
        const { service, generate } = setup();
        generate.mockRejectedValue(new Error('private provider error'));
        await expect(service.get(keys[0])).rejects.toThrow('Voice guidance is temporarily unavailable');
        await expect(service.get(keys[0])).rejects.toThrow('Voice guidance is temporarily unavailable');
        expect(generate).toHaveBeenCalledTimes(1);
    });
    it('rejects non-audio and oversized responses', async () => {
        const { service, generate } = setup();
        generate.mockResolvedValueOnce(new Response('bad response'));
        await expect(service.get(keys[0])).rejects.toBeInstanceOf(ServiceUnavailableException);
        generate.mockResolvedValueOnce(new Response(new Uint8Array(2_000_001), { headers: { 'Content-Type': 'audio/mpeg' } }));
        await expect(service.get(keys[1])).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
    it('fails safely when no server key is configured', async () => {
        const service = new TourNarrationService({ get: () => undefined } as any);
        await expect(service.get(keys[0])).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
    it('requires authentication, consumes the authenticated user limit and returns binary audio', async () => {
        expect(Reflect.getMetadata(GUARDS_METADATA, TourNarrationController)).toContain(SessionAuthGuard);
        const { service } = setup();
        const rateLimit = { consumeTourNarration: jest.fn().mockResolvedValue(undefined) };
        const controller = new TourNarrationController(service, rateLimit as any);
        const result = await controller.get(keys[0], { id: 'signed-in-user' });
        expect(rateLimit.consumeTourNarration).toHaveBeenCalledWith('signed-in-user');
        expect(result).toBeInstanceOf(StreamableFile);
        expect(result.getHeaders()).toMatchObject({ type: 'audio/mpeg', length: 1000 });
    });
});
