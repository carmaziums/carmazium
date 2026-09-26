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
