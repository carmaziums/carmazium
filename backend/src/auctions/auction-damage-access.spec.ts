import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { readAuctionDamageRecords } from './auction-damage-access';

describe('auction-scoped damage reports', () => {
  const record = { id:'damage-1', part:'boot', coords:{surfacePoint:{fx:.4,fy:.3,fz:.1}}, type:'DENT', imageUrl:'https://example.test/photo.jpg' };
  function setup(status = 'ENDED', listingStatus = 'DRAFT', role = 'DEALER') {
    const auction = { status, deletedAt:null, startTime:new Date(Date.now()-86400000), listing:{id:'listing-1', status:listingStatus, sellerId:'seller',deletedAt:null} };
    const prisma = { auction:{findUnique:jest.fn().mockResolvedValue(auction)}, listing:{findFirst:jest.fn().mockResolvedValue({damageRecords:[record]})},
      user:{findUnique:jest.fn().mockResolvedValue({role,deletedAt:null})}, dealerProfile:{findUnique:jest.fn().mockResolvedValue({id:'dealer-profile',userId:'viewer',isVerified:true})}, dealerStaff:{findFirst:jest.fn().mockResolvedValue(null)} };
    const service={getAuctionDamageRecords:(id:string,viewerId?:string)=>readAuctionDamageRecords(prisma as any,id,viewerId)};
    return {service,prisma,auction};
  }
  it('returns actual saved damage for an authorised dealer on an ended unsold auction',async()=>{const {service,prisma}=setup(); await expect(service.getAuctionDamageRecords('auction-1','viewer')).resolves.toEqual([record]); expect(prisma.listing.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({id:'listing-1',status:'DRAFT',auction:{is:expect.objectContaining({id:'auction-1',status:'ENDED'})}})}));});
  it.each(['BUYER','SELLER'])('blocks unrelated %s accounts',async role=>{const {service,prisma}=setup('ENDED','DRAFT',role);await expect(service.getAuctionDamageRecords('auction-1','viewer')).rejects.toBeInstanceOf(ForbiddenException);expect(prisma.listing.findFirst).not.toHaveBeenCalled();});
  it('blocks unauthenticated and unverified dealers',async()=>{const {service,prisma}=setup();await expect(service.getAuctionDamageRecords('auction-1')).rejects.toBeInstanceOf(ForbiddenException);prisma.dealerProfile.findUnique.mockResolvedValueOnce({id:'pending',userId:'viewer',isVerified:false});await expect(service.getAuctionDamageRecords('auction-1','viewer')).rejects.toBeInstanceOf(ForbiddenException);expect(prisma.listing.findFirst).not.toHaveBeenCalled();});
  it('does not grant access to an unpublished scheduled draft',async()=>{const {service,prisma}=setup('SCHEDULED','DRAFT');await expect(service.getAuctionDamageRecords('auction-1','viewer')).rejects.toBeInstanceOf(NotFoundException);expect(prisma.listing.findFirst).not.toHaveBeenCalled();});
  it('allows the seller to see their own scheduled draft',async()=>{const {service}=setup('SCHEDULED','DRAFT');await expect(service.getAuctionDamageRecords('auction-1','seller')).resolves.toEqual([record]);});
  it.each([['CANCELLED','DRAFT'],['ENDED','WITHDRAWN'],['ENDED','REJECTED']])('does not expose %s / %s records',async(status,listingStatus)=>{const {service,prisma}=setup(status,listingStatus);await expect(service.getAuctionDamageRecords('auction-1','viewer')).rejects.toBeInstanceOf(NotFoundException);expect(prisma.listing.findFirst).not.toHaveBeenCalled();});
  it('does not expose a deleted listing',async()=>{const {service,prisma,auction}=setup();prisma.auction.findUnique.mockResolvedValueOnce({...auction,listing:{...auction.listing,deletedAt:new Date()}});await expect(service.getAuctionDamageRecords('auction-1','viewer')).rejects.toBeInstanceOf(NotFoundException);expect(prisma.listing.findFirst).not.toHaveBeenCalled();});
  it('does not treat a concurrent state change as a damage-free vehicle',async()=>{const {service,prisma}=setup();prisma.listing.findFirst.mockResolvedValueOnce(null);await expect(service.getAuctionDamageRecords('auction-1','viewer')).rejects.toBeInstanceOf(NotFoundException);});
  it('returns an empty array only for a successfully loaded damage-free record set',async()=>{const {service,prisma}=setup('ACTIVE','ACTIVE');prisma.listing.findFirst.mockResolvedValueOnce({damageRecords:[]});await expect(service.getAuctionDamageRecords('auction-1','viewer')).resolves.toEqual([]);});
  it.each(['ACTIVE','SOLD'])('allows admin access to published %s condition records',async listingStatus=>{const {service}=setup('ENDED',listingStatus,'ADMIN');await expect(service.getAuctionDamageRecords('auction-1','viewer')).resolves.toEqual([record]);});
  it('does not disclose a deleted auction even to its seller',async()=>{const {service,prisma,auction}=setup();prisma.auction.findUnique.mockResolvedValueOnce({...auction,deletedAt:new Date()});await expect(service.getAuctionDamageRecords('auction-1','seller')).rejects.toBeInstanceOf(NotFoundException);});
});
