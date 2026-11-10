import { ChatService } from './chat.service';
import { HUMAN_HANDOFF_REPLY, fixedSupportReply } from './support-automatic-responses';

const botId = 'e641510d-0b2c-4eb1-96c6-8874bb9e6b53';
const sourceId = '11111111-1111-4111-8111-111111111111';
describe('support reply persistence and identity', () => {
    const original = { ...process.env };
    beforeEach(() => { process.env.MAZIUM_SUPPORT_AUTO_REPLY_ENABLED = 'true'; process.env.MAZIUM_SUPPORT_BOT_USER_ID = botId; });
    afterEach(() => { process.env = { ...original }; });
    const setup = (content = 'How much does a retail listing cost?', roomChanges: any = {}) => {
        const room = { id: 'room', context: 'SUPPORT', deletedAt: null, supportClosedAt: null,
            initiatorId: 'customer', participantId: 'admin', initiator: { role: 'BUYER' }, participant: { role: 'ADMIN' },
            supportAiConsentAt: null, supportAiOptedOutAt: null, supportHumanTakeoverAt: null, ...roomChanges };
        const source = { id: sourceId, senderId: 'customer', chatRoomId: 'room', content, createdAt: new Date(), aiGenerated: false, attachmentPath: null };
        const prisma: any = {
            $queryRaw: jest.fn().mockResolvedValue([]),
            chatRoom: { findUnique: jest.fn().mockResolvedValue(room), update: jest.fn() },
            user: { findUnique: jest.fn().mockImplementation(({where}) => Promise.resolve(where.id === botId
                ? { id: botId, role: 'BUYER', deletedAt: null, lockoutUntil: new Date('9999-01-01') } : { id: 'customer', role: 'BUYER' })) },
            message: { findFirst: jest.fn().mockImplementation(({where}) => Promise.resolve(where.aiSourceMessageId || where.aiGenerated ? null : source)),
                findUnique: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(0),
                create: jest.fn().mockImplementation(({data}) => Promise.resolve({ id: 'reply', ...data })) },
        };
        prisma.$transaction = jest.fn(cb => cb(prisma));
        const notifications = { create: jest.fn().mockResolvedValue({ id: 'notice' }) };
        const service = new ChatService(prisma, notifications as any, { sendNotification: jest.fn() } as any, {} as any, {} as any, {} as any, {} as any);
        return { service, prisma, source, room };
    };
    it('saves exactly the canonical handoff even after a customer opts out', async () => {
        const {service, prisma} = setup('I want a human agent', {supportAiOptedOutAt: new Date(), supportHumanTakeoverAt: new Date()});
        expect((await service.persistSupportAutoReply('room', sourceId, botId, HUMAN_HANDOFF_REPLY, 'FIXED')).created).toBe(true);
        const data = prisma.message.create.mock.calls[0][0].data;
        expect(data).toMatchObject({senderId: botId, aiGenerated: true, aiSourceMessageId: sourceId, content: HUMAN_HANDOFF_REPLY});
    });
    it('does not allow fixed replies to smuggle arbitrary text without consent', async () => {
        const { service, prisma } = setup();
        expect((await service.persistSupportAutoReply('room', sourceId, botId, 'I will refund you.', 'FIXED')).created).toBe(false);
        expect(prisma.message.create).not.toHaveBeenCalled();
    });
    it('allows local FAQ answers but forbids model replies without consent', async () => {
        const { service, source } = setup();
        expect((await service.persistSupportAutoReply('room', sourceId, botId, fixedSupportReply(source.content)!, 'FIXED')).created).toBe(true);
        expect((await service.persistSupportAutoReply('room', sourceId, botId, 'Try updating your browser.', 'AI')).created).toBe(false);
    });
    it('rejects duplicate delivery, changed source, private rooms and bot impersonation', async () => {
        const {service,prisma,room,source} = setup('I want a human');
        prisma.message.findUnique.mockResolvedValue({id:'existing'});
        expect((await service.persistSupportAutoReply('room',sourceId,botId,HUMAN_HANDOFF_REPLY,'FIXED')).created).toBe(false);
        prisma.message.findUnique.mockResolvedValue(null); source.senderId='admin';
        expect((await service.persistSupportAutoReply('room',sourceId,botId,HUMAN_HANDOFF_REPLY,'FIXED')).created).toBe(false);
        source.senderId='customer'; room.context='RETAIL';
        expect((await service.persistSupportAutoReply('room',sourceId,botId,HUMAN_HANDOFF_REPLY,'FIXED')).created).toBe(false);
        room.context='SUPPORT'; prisma.user.findUnique.mockResolvedValue({id:botId,role:'ADMIN',lockoutUntil:new Date('9999-01-01')});
        expect((await service.persistSupportAutoReply('room',sourceId,botId,HUMAN_HANDOFF_REPLY,'FIXED')).created).toBe(false);
        expect(prisma.message.create).not.toHaveBeenCalled();
    });
    it('keeps handoff acknowledgement working when the generation budget is exhausted', async () => {
        const {service,prisma} = setup('Please connect me with a person');
        prisma.message.count.mockResolvedValue(100000);
        expect((await service.persistSupportAutoReply('room',sourceId,botId,HUMAN_HANDOFF_REPLY,'FIXED')).created).toBe(true);
    });
});
