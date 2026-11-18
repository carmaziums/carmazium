import { ChatService } from './chat.service';

describe('explicit support AI resume', () => {
    function setup(recentStaff: boolean) {
        const room = { id:'room', context:'SUPPORT', deletedAt:null, supportClosedAt:null,
            initiatorId:'customer', participantId:'admin', initiator:{role:'BUYER'}, participant:{role:'ADMIN'},
            supportHumanTakeoverAt:new Date(), supportAiOptedOutAt:new Date() };
        const db:any = { $queryRaw:jest.fn().mockResolvedValue([]),
            chatRoom:{findUnique:jest.fn().mockResolvedValue(room), update:jest.fn()},
            message:{findFirst:jest.fn().mockResolvedValue(recentStaff ? {id:'staff-reply'} : null)} };
        db.$transaction = jest.fn(fn => fn(db));
        const service = new ChatService(db, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
        return {service,db};
    }
    it('lets the customer resume immediately after a queued handoff', async () => {
        const {service,db}=setup(false);
        expect(await service.setSupportAiConsent('room','customer',true)).toEqual({consentToAi:true,humanTakeoverActive:false});
        expect(db.chatRoom.update.mock.calls[0][0].data).toMatchObject({supportAiOptedOutAt:null,supportHumanTakeoverAt:null});
        expect(db.$queryRaw).toHaveBeenCalled();
    });
    it('does not interrupt an actual recent human reply', async () => {
        const {service,db}=setup(true);
        await expect(service.setSupportAiConsent('room','customer',true)).rejects.toThrow('A human agent is replying');
        expect(db.chatRoom.update).not.toHaveBeenCalled();
    });
    it('rejects another user attempting to resume this room', async () => {
        const {service,db}=setup(false);
        await expect(service.setSupportAiConsent('room','someone-else',true)).rejects.toThrow('Only the support customer');
        expect(db.chatRoom.update).not.toHaveBeenCalled();
    });
    it('always permits the customer to pause AI', async () => {
        const {service,db}=setup(true);
        expect((await service.setSupportAiConsent('room','customer',false)).consentToAi).toBe(false);
        expect(db.message.findFirst).not.toHaveBeenCalled();
    });
});
