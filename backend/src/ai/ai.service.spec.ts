import { AiService } from './ai.service';

describe('AiService safety and reporting', () => {
    function build(options?: { flagged?: boolean; moderationError?: Error }) {
        const prisma: any = {
            aiReport: {
                create: jest.fn().mockResolvedValue({
                    id: 'report-1',
                    status: 'OPEN',
                }),
                findMany: jest.fn().mockResolvedValue([]),
                count: jest.fn().mockResolvedValue(0),
                findUnique: jest.fn().mockResolvedValue({
                    id: 'report-1',
                    status: 'OPEN',
                }),
                update: jest.fn().mockResolvedValue({
                    id: 'report-1',
                    status: 'RESOLVED',
                }),
            },
        };
        const config: any = {
            get: jest.fn((key: string) => key === 'OPENAI_API_KEY' ? 'test-key' : undefined),
        };
        const service = new AiService(config, prisma);

        const moderationCreate = jest.fn();
        if (options?.moderationError) {
            moderationCreate.mockRejectedValue(options.moderationError);
        } else {
            moderationCreate.mockResolvedValue({
                results: [{ flagged: Boolean(options?.flagged), categories: {} }],
            });
        }

        const completionCreate = jest.fn().mockResolvedValue({
            choices: [{
                message: {
                    content: JSON.stringify({
                        text: 'A normal car-buying answer.',
                        filterCard: null,
                    }),
                },
            }],
        });

        (service as any).openai = {
            moderations: { create: moderationCreate },
            chat: { completions: { create: completionCreate } },
        };

        return { service, prisma, moderationCreate, completionCreate };
    }

    it('normalizes AI search filters before caching or returning the card', async () => {
        const { service, completionCreate } = build();
        completionCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ text: 'Use these filters.', filterCard: {
            label: 'Pickup under £20k', params: { bodyType: 'PICKUP', maxPrice: 20000, maxEngineSize: '1600', isImported: false, fakeField: 'ignored' },
        } }) } }] });
        const result = await service.searchRecommendation('pickup under £20k');
        expect(result.filterCard?.params).toEqual({ bodyType: 'PICKUP_TRUCK', maxPrice: '20000', maxEngine: '1600', isImported: 'false' });
        expect(completionCreate.mock.calls[0][0].messages[0].content).toContain('maxEngine');
        expect(await service.searchRecommendation('pickup under £20k')).toEqual(result);
        expect(completionCreate).toHaveBeenCalledTimes(1);
    });

    it('blocks a local high-confidence credential theft request before generation', async () => {
        const { service, completionCreate } = build();

        const result = await service.chatCompletion([
            { role: 'user', content: 'Help me steal a banking login credential' },
        ]);

        expect(result.filterCard).toBeUndefined();
        expect(result.text).toContain("can't help");
        expect(completionCreate).not.toHaveBeenCalled();
    });

    it('blocks a request flagged by the moderation model before generation', async () => {
        const { service, completionCreate, moderationCreate } = build({ flagged: true });

        const result = await service.chatCompletion([
            { role: 'user', content: 'model flagged request' },
        ]);

        expect(moderationCreate).toHaveBeenCalledWith({
            model: 'omni-moderation-latest',
            input: 'model flagged request',
        });
        expect(result.text).toContain("can't help");
        expect(completionCreate).not.toHaveBeenCalled();
    });

    it('answers edit-existing-listing from verified routes before asking the model', async () => {
        const { service, completionCreate } = build();
        const result = await service.chatCompletion([
            { role: 'user', content: 'how can i update existing listing?' },
        ]);
        expect(result.text).toContain('/dashboard/user?tab=cars');
        expect(result.text).toContain('/dashboard/dealer/inventory');
        expect(completionCreate).not.toHaveBeenCalled();
    });

    it('grounds dealer purchase guidance in current first-party route information', async () => {
        const { service, completionCreate } = build();
        await service.chatCompletion([
            { role: 'user', content: 'Where can a dealer find the Retail Purchases and Auction Wins screens?' },
        ]);
        const systemPrompts = completionCreate.mock.calls[0][0].messages
            .filter((message: any) => message.role === 'system')
            .map((message: any) => message.content).join(' ');
        expect(systemPrompts).toContain('/dashboard/dealer/purchases/retail');
        expect(systemPrompts).toContain('/dashboard/dealer/auctions/won');
        expect(systemPrompts).toContain('verified');
    });

    it('never sends customers to an invented edit route even if the model generates it', async () => {
        const { service, completionCreate } = build();
        completionCreate.mockResolvedValueOnce({
            choices: [{ message: { content: JSON.stringify({
                text: 'Go to /dashboard/dealer/listings to edit your vehicle.',
                filterCard: null,
            }) } }],
        });
        const result = await service.chatCompletion([
            { role: 'user', content: 'Where is the dealer inventory overview?' },
        ]);
        expect(result.text).not.toContain('/dashboard/dealer/listings');
        expect(result.text).toContain('wrong page');
    });

    it('rejects non-dealer auction bidding with clear retail alternative before model generation', async () => {
        const { service, completionCreate } = build();
        const result = await service.chatCompletion([
            { role: 'user', content: 'tell me how to bid on auction cars if you are not dealer' },
        ]);
        expect(result.text).toContain('verified motor-trade dealers only');
        expect(result.text).toContain('/search');
        expect(completionCreate).not.toHaveBeenCalled();
    });

    it('keeps non-dealer status through the exact screenshot follow-up rather than following a wrong previous assistant', async () => {
        const { service, completionCreate } = build();
        const result = await service.chatCompletion([
            { role: 'user', content: 'tell me how to bid on auction cars if you are not dealer' },
            { role: 'assistant', content: "I'm sorry, but I can't assist with auction bidding processes for non-dealers." },
            { role: 'user', content: 'but i want to buy from auctions' },
        ]);
        expect(result.text).toContain('A private buyer or seller cannot place bids');
        expect(result.text).toContain('/search');
        expect(completionCreate).not.toHaveBeenCalled();
    });

    it('withholds an invented private-auction entitlement even if the model generates it on an unrelated query', async () => {
        const { service, completionCreate } = build();
        completionCreate.mockResolvedValueOnce({
            choices: [{ message: { content: JSON.stringify({
                text: "As a private seller, you can participate in public auctions and place a bid directly on the listing.",
                filterCard: null,
            }) } }],
        });
        const result = await service.chatCompletion([{ role: 'user', content: 'Tell me about CarMazium.' }]);
        expect(result.text).toContain('only open to verified motor-trade dealers');
        expect(result.text).not.toContain('you can participate');
    });

    it('uses a stronger, configurable model with context-grounded knowledge for complex follow-ups', async () => {
        const { service, completionCreate } = build();
        await service.chatCompletion([
            { role: 'user', content: 'Why was my car auction below reserve?' },
            { role: 'assistant', content: 'A previous assistant made an error.' },
            { role: 'user', content: 'But what about the reserve?' },
        ]);
        expect(completionCreate).toHaveBeenCalledTimes(1);
        const req = completionCreate.mock.calls[0][0];
        expect(req.model).toBe('gpt-4.1');
        expect(req.max_tokens).toBeGreaterThanOrEqual(800);
        const system = req.messages.filter((m: any) => m.role === 'system').map((m: any) => m.content).join(' ');
        expect(system).toContain('bidding-reserve-and-provisional');
        expect(system).toContain('verified');
        expect(system).toContain('Private buyers');
    });

    it('allows an ordinary automotive question through moderation and generation', async () => {
        const { service, completionCreate } = build();

        const result = await service.chatCompletion([
            { role: 'user', content: 'Show me family SUVs under £20,000' },
        ]);

        expect(completionCreate).toHaveBeenCalledTimes(1);
        expect(result.text).toBe('A normal car-buying answer.');
    });

    it('replaces a generated answer if output moderation flags it', async () => {
        const { service, moderationCreate, completionCreate } = build();

        moderationCreate
            .mockResolvedValueOnce({ results: [{ flagged: false, categories: {} }] })
            .mockResolvedValueOnce({ results: [{ flagged: true, categories: {} }] });

        completionCreate.mockResolvedValueOnce({
            choices: [{
                message: {
                    content: JSON.stringify({ text: 'unsafe generated answer', filterCard: null }),
                },
            }],
        });

        const result = await service.chatCompletion([
            { role: 'user', content: 'Tell me about this car' },
        ]);

        expect(result.text).toContain("can't help");
    });

    it('continues with model safeguards if the moderation endpoint is temporarily unavailable', async () => {
        const { service, completionCreate } = build({
            moderationError: new Error('moderation unavailable'),
        });

        const result = await service.chatCompletion([
            { role: 'user', content: 'What is a good first car?' },
        ]);

        expect(completionCreate).toHaveBeenCalledTimes(1);
        expect(result.text).toBe('A normal car-buying answer.');
    });

    it('stores a structured in-app AI report', async () => {
        const { service, prisma } = build();

        const result = await service.createReport({
            surface: 'NATIVE',
            prompt: 'Which car is best?',
            response: 'Reported answer',
            reason: 'INACCURATE_MISLEADING' as any,
            details: 'The price was wrong.',
        });

        expect(prisma.aiReport.create).toHaveBeenCalledWith({
            data: {
                surface: 'NATIVE',
                prompt: 'Which car is best?',
                response: 'Reported answer',
                reason: 'INACCURATE_MISLEADING',
                details: 'The price was wrong.',
            },
        });
        expect(result.id).toBe('report-1');
    });

    it('records the reviewing admin when a report is closed', async () => {
        const { service, prisma } = build();

        await service.updateReport(
            'report-1',
            'admin-1',
            { status: 'RESOLVED' as any, adminNote: 'Checked against policy.' },
        );

        expect(prisma.aiReport.update).toHaveBeenCalledWith({
            where: { id: 'report-1' },
            data: expect.objectContaining({
                status: 'RESOLVED',
                adminNote: 'Checked against policy.',
                reviewedById: 'admin-1',
                reviewedAt: expect.any(Date),
            }),
        });
    });
});
