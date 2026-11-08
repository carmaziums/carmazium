import { AdminController } from './admin.controller';
import { markListingSold } from './admin-mark-listing-sold';

const listing = { id: 'car', sellerId: 'seller', linkedListingId: null, status: 'DRAFT', deletedAt: null };
const input = { source: 'EXTERNAL' as const, reason: 'Seller confirmed sold elsewhere in support chat.' };
function setup(rows: any[] = [listing]) {
    const tx: any = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        listing: { findUnique: jest.fn().mockResolvedValue(rows[0]), findMany: jest.fn().mockResolvedValue(rows), updateMany: jest.fn().mockResolvedValue({ count: rows.length }) },
        auction: { findFirst: jest.fn().mockResolvedValue(null) },
        offer: { findFirst: jest.fn().mockResolvedValue(null), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        sale: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
        analyticsEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma: any = { $transaction: jest.fn(fn => fn(tx)) };
    return { tx, prisma, run: () => markListingSold(prisma, 'car', 'admin', input) };
}
describe('admin reported sold closure', () => {
    it.each(['DRAFT', 'ACTIVE', 'PENDING_REVIEW', 'REJECTED', 'WITHDRAWN'])('closes %s with actor/source audit and without a fabricated purchase', async status => {
        const {tx, run} = setup([{...listing, status}]);
        await expect(run()).resolves.toMatchObject({status:'SOLD', alreadySold:false});
        expect(tx.listing.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{status:'SOLD'}}));
        expect(tx.sale.create).not.toHaveBeenCalled();
        expect(tx.analyticsEvent.create).toHaveBeenCalledWith({data: expect.objectContaining({userId:'admin',type:'admin_listing_marked_sold',payload:expect.objectContaining({source:'EXTERNAL',platformSaleRecorded:false,reason:input.reason})})});
        expect(tx.offer.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{status:'CANCELLED'}}));
    });
    it.each(['auction','offer','sale'])('protects existing %s commitments', async relation => {
        const {tx,run}=setup();tx[relation].findFirst.mockResolvedValue({id:'commitment'});
        await expect(run()).rejects.toThrow(/resolve first/);
        expect(tx.listing.updateMany).not.toHaveBeenCalled();
    });
    it('protects sale-pending listings even if the accepted-offer row is missing',async()=>{
        const {run,tx}=setup([{...listing,status:'OFFER_ACCEPTED'}]);
        await expect(run()).rejects.toThrow(/resolve first/);expect(tx.listing.updateMany).not.toHaveBeenCalled();
    });
    it('closes reciprocal linked adverts together',async()=>{
        const {run,tx}=setup([{...listing,linkedListingId:'sibling'},{...listing,id:'sibling',linkedListingId:'car'}]);
        await run();expect(tx.listing.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({id:{in:['car','sibling']}})}));
    });
    it('refuses a link to a different seller',async()=>{
        const {run,tx}=setup([{...listing,linkedListingId:'sibling'},{...listing,id:'sibling',linkedListingId:'car',sellerId:'other'}]);
        await expect(run()).rejects.toThrow(/linked adverts/);expect(tx.listing.updateMany).not.toHaveBeenCalled();
    });
    it('does not duplicate the audit when submitted twice',async()=>{
        const {run,tx}=setup([{...listing,status:'SOLD'}]);
        await expect(run()).resolves.toMatchObject({alreadySold:true});expect(tx.analyticsEvent.create).not.toHaveBeenCalled();
    });
    it('rejects concurrent status changes instead of recording a false closure',async()=>{
        const {run,tx}=setup();tx.listing.updateMany.mockResolvedValue({count:0});
        await expect(run()).rejects.toThrow(/changed/);expect(tx.analyticsEvent.create).not.toHaveBeenCalled();
    });
    it('rejects deleted listings',async()=>{
        const {run}=setup([{...listing,deletedAt:new Date()}]);await expect(run()).rejects.toThrow(/not found/);
    });
    it('requires a meaningful audit reason',async()=>{
        const {prisma}=setup();await expect(markListingSold(prisma,'car','admin',{...input,reason:' '})).rejects.toThrow(/reason/);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });
});

 it('uses the authenticated admin ID in the closure audit', async () => {
    const service = { markListingSold: jest.fn().mockResolvedValue({status:'SOLD'}) };
    const controller = new AdminController(service as any, {} as any);
    await controller.markListingSold('car', {id:'authenticated-admin'}, input);
    expect(service.markListingSold).toHaveBeenCalledWith('car','authenticated-admin',input);
 });
