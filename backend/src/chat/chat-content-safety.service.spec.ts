import { BadRequestException } from '@nestjs/common';
import { ChatContentSafetyService } from './chat-content-safety.service';

describe('ChatContentSafetyService', () => {
    function build(apiResult?: any, apiError?: Error) {
        const config: any = {
            get: jest.fn((key: string) => key === 'OPENAI_API_KEY' ? 'test-key' : undefined),
        };
        const service = new ChatContentSafetyService(config);
        const create = jest.fn();

        if (apiError) create.mockRejectedValue(apiError);
        else create.mockResolvedValue(apiResult ?? { results: [{ flagged: false, categories: {} }] });

        (service as any).openai = { moderations: { create } };
        return { service, create };
    }

    it('blocks a high-confidence direct threat locally before external moderation', async () => {
        const { service, create } = build();

        await expect(
            service.assertAllowedText('I will kill you', 'MESSAGE'),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(create).not.toHaveBeenCalled();
    });

    it('blocks credential theft locally before external moderation', async () => {
        const { service, create } = build();

        await expect(
            service.assertAllowedText('Send me your one time code', 'MESSAGE'),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(create).not.toHaveBeenCalled();
    });

    it('uses omni-moderation-latest for ordinary member text', async () => {
        const { service, create } = build();

        await expect(
            service.assertAllowedText('Can I collect the car on Saturday?', 'MESSAGE'),
        ).resolves.toBeUndefined();

        expect(create).toHaveBeenCalledWith({
            model: 'omni-moderation-latest',
            input: 'Can I collect the car on Saturday?',
        });
    });

    it('blocks content flagged by the external moderation model', async () => {
        const { service } = build({
            results: [{
                flagged: true,
                categories: { harassment: true },
            }],
        });

        await expect(
            service.assertAllowedText('model flagged text', 'MESSAGE'),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('fails open only to the local rules when the external provider is unavailable', async () => {
        const { service } = build(undefined, new Error('provider unavailable'));

        await expect(
            service.assertAllowedText('Please send the service history.', 'MESSAGE'),
        ).resolves.toBeUndefined();
    });

    it('does nothing for an empty attachment caption', async () => {
        const { service, create } = build();

        await expect(
            service.assertAllowedText('   ', 'ATTACHMENT_CAPTION'),
        ).resolves.toBeUndefined();

        expect(create).not.toHaveBeenCalled();
    });
});
