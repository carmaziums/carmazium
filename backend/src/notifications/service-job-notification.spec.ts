import { NotificationsService } from './notifications.service';

describe('Service job notification delivery', () => {
    let db:any, gateway:any, email:any, service:any, old:string|undefined;
    const dto = {userId:'provider',type:'SERVICE_JOB_AVAILABLE',title:'New job',message:'Review job',entityId:'job',link:'/dashboard/service/jobs/job'};
    beforeEach(()=>{
        old=process.env.NOTIFICATION_EMAILS_ENABLED;process.env.NOTIFICATION_EMAILS_ENABLED='true';
        db={user:{findUnique:jest.fn().mockResolvedValue({email:'synthetic@invalid.example',preferences:{}})},notification:{create:jest.fn().mockImplementation(async ({data})=>({...data})),findUniqueOrThrow:jest.fn()},serviceJob:{findUnique:jest.fn().mockResolvedValue({id:'job',status:'OPEN',expiresAt:new Date('2099-01-01'),serviceType:'DELIVERY',customerId:'customer',workPostcodeArea:'B'})},contractorCapability:{findFirst:jest.fn().mockResolvedValue({id:'cap'})}};
        gateway={sendNotification:jest.fn(),isUserConnected:()=>true};email={sendBrandedEmail:jest.fn().mockResolvedValue({})};
        service=new NotificationsService(db,{get:()=>gateway} as any,email);
        jest.spyOn(service,'updateEmailState').mockResolvedValue(undefined);
    });
    afterEach(()=>{if(old===undefined)delete process.env.NOTIFICATION_EMAILS_ENABLED;else process.env.NOTIFICATION_EMAILS_ENABLED=old;});
    it('deduplicates concurrent retry keys before websocket/push delivery',async()=>{
        const first=await service.create(dto,'same'); db.notification.create.mockRejectedValueOnce({code:'P2002'});db.notification.findUniqueOrThrow.mockResolvedValue(first);
        expect(await service.create(dto,'same')).toEqual(first);expect(gateway.sendNotification).toHaveBeenCalledTimes(1);
        expect(first.data._email.state).toBe('pending');expect(first.id).toMatch(/^[0-9a-f-]{36}$/);
    });
    it('keeps account notification but does not queue email when disabled',async()=>{
        db.user.findUnique.mockResolvedValue({preferences:{notifications:{email:false}}});
        const result=await service.create(dto,'off');expect(result.data._email).toBeUndefined();expect(gateway.sendNotification).toHaveBeenCalledTimes(1);
    });
    it.each(['ACCEPTED','CANCELLED','EXPIRED'])('suppresses queued email for a %s job',async status=>{
        db.serviceJob.findUnique.mockResolvedValue({status,expiresAt:new Date('2099-01-01')});
        await service.deliverClaimedEmail({...dto,isRead:false,data:{_email:{attempts:1}}});
        expect(email.sendBrandedEmail).not.toHaveBeenCalled();expect(service.updateEmailState).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({reason:'job-or-provider-no-longer-eligible'}));
    });
    it('sends the requested email even when the account notification was read, using the job deep link',async()=>{
        jest.spyOn(service,'sentTodayCount').mockResolvedValue(0);
        await service.deliverClaimedEmail({...dto,isRead:true,data:{link:dto.link,_email:{attempts:1}}});
        expect(email.sendBrandedEmail).toHaveBeenCalledWith(expect.objectContaining({to:'synthetic@invalid.example',bodyHtml:expect.stringContaining('/dashboard/service/jobs/job')}));
        expect(service.updateEmailState).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({state:'sent'}));
    });
    it('rechecks provider eligibility before sending even after the account notice is read',async()=>{
        db.contractorCapability.findFirst.mockResolvedValue(null);
        await service.deliverClaimedEmail({...dto,isRead:true,data:{_email:{attempts:1}}});
        expect(db.contractorCapability.findFirst).toHaveBeenCalled();expect(email.sendBrandedEmail).not.toHaveBeenCalled();
    });
});
