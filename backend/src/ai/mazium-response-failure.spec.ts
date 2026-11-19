import { AiService } from './ai.service';
import { maziumFailureCode } from './mazium-response-failure';

describe('MaziuM bounded response recovery', () => {
    const setup = (responses: jest.Mock) => {
        const service = new AiService({ get: (key: string) => key === 'OPENAI_API_KEY' ? 'test-key' : undefined } as any, {} as any);
        (service as any).openai = { responses: { create: responses }, moderations: { create: jest.fn().mockResolvedValue({ results: [{ flagged: false }] }) } };
        jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
        return service;
    };
    const question = [{ role: 'user' as const, content: 'I think I paid a platform charge twice. Should I pay it again?' }];
    const answer = { output: [], output_text: JSON.stringify({ text: 'Do not pay again. Check your receipts and ask for a payment review in your support conversation.' }) };

    it.each([408, 409, 429, 500, 503])('recovers once from HTTP %s using the same conversation', async status => {
        const responses = jest.fn().mockRejectedValueOnce({ status, message: 'private provider body' }).mockResolvedValueOnce(answer);
        const result = await setup(responses).chatCompletion(question);
        expect(result.text).toContain('Do not pay again');
        expect(result.requiresHumanReview).toBeUndefined();
        expect(responses).toHaveBeenCalledTimes(2);
        expect(responses.mock.calls[1][0].input).toEqual(responses.mock.calls[0][0].input);
    });
    it('recovers malformed model JSON without exposing it', async () => {
        const responses = jest.fn().mockResolvedValueOnce({ output: [], output_text: '{invalid private draft' }).mockResolvedValueOnce(answer);
        const result = await setup(responses).chatCompletion(question);
        expect(result.text).toContain('Do not pay again');
        expect(responses).toHaveBeenCalledTimes(2);
    });
    it('stops after one recovery attempt and returns only a coarse diagnostic', async () => {
        const responses = jest.fn().mockRejectedValue({ status: 503, message: 'private provider body' });
        const result = await setup(responses).chatCompletion(question);
        expect(responses).toHaveBeenCalledTimes(2);
        expect(result).toMatchObject({ requiresHumanReview: true, failureCode: 'PROVIDER_TRANSIENT' });
        expect(JSON.stringify(result)).not.toContain('private provider body');
    });
    it.each([400, 401, 403])('does not retry rejected HTTP %s requests', async status => {
        const responses = jest.fn().mockRejectedValue({ status });
        expect(await setup(responses).chatCompletion(question)).toMatchObject({ requiresHumanReview: true, failureCode: 'PROVIDER_REJECTED' });
        expect(responses).toHaveBeenCalledTimes(1);
    });
    it('does not retry arbitrary internal failures', async () => {
        const responses = jest.fn().mockRejectedValue(new Error('private internal detail'));
        expect(await setup(responses).chatCompletion(question)).toMatchObject({ requiresHumanReview: true, failureCode: 'INTERNAL' });
        expect(responses).toHaveBeenCalledTimes(1);
    });
    it('classifies transport failures without using their private messages', () => {
        expect(maziumFailureCode({ name: 'APIConnectionError' })).toBe('PROVIDER_TRANSIENT');
        expect(maziumFailureCode({ name: 'APIConnectionTimeoutError' })).toBe('PROVIDER_TRANSIENT');
        expect(maziumFailureCode('an error containing an email or credential')).toBe('INTERNAL');
    });
});
