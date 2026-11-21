import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import {
  PARTNER_AGREEMENT_SHA256,
  PartnerAgreementService,
} from './partner-agreement.service';
import { PARTNER_AGREEMENT_VERSION, PARTNER_AGREEMENT_TEXT } from './partner-agreement.document';
import { createHash } from 'crypto';

describe('Master Business Partner Agreement authenticated signing and gating', () => {
  const previousEnforce = process.env.PARTNER_AGREEMENT_ENFORCE;
  const previousReview = process.env.PARTNER_AGREEMENT_LEGAL_REVIEW_COMPLETE;
  const previousSigning = process.env.PARTNER_AGREEMENT_ACCEPT_ENABLED;
  afterAll(() => {
    if (previousEnforce === undefined) delete process.env.PARTNER_AGREEMENT_ENFORCE;
    else process.env.PARTNER_AGREEMENT_ENFORCE = previousEnforce;
    if (previousReview === undefined) delete process.env.PARTNER_AGREEMENT_LEGAL_REVIEW_COMPLETE;
    else process.env.PARTNER_AGREEMENT_LEGAL_REVIEW_COMPLETE = previousReview;
    if (previousSigning === undefined) delete process.env.PARTNER_AGREEMENT_ACCEPT_ENABLED;
    else process.env.PARTNER_AGREEMENT_ACCEPT_ENABLED = previousSigning;
  });
  let prisma: any;
  let service: PartnerAgreementService;
  const baseUser = (role: UserRole = UserRole.DEALER) => ({
    id: 'owner-1', role, deletedAt: null,
    dealerProfile: { userId: 'owner-1' }, contractorProfile: null,
    dealerStaffMemberships: [],
  });
  const signature = {
    version: PARTNER_AGREEMENT_VERSION,
    sha256: PARTNER_AGREEMENT_SHA256,
    businessKind: 'COMPANY',
    legalEntityName: 'Test Trader Limited',
    registrationNumber: '12345678',
    signatoryFullName: 'Test Trading Director',
    signatoryCapacity: 'Director',
    authorityConfirmed: true,
    explicitAcceptance: true,
    channel: 'WEB',
  };

  beforeEach(() => {
    process.env.PARTNER_AGREEMENT_ENFORCE = 'true';
    process.env.PARTNER_AGREEMENT_LEGAL_REVIEW_COMPLETE = 'true';
    delete process.env.PARTNER_AGREEMENT_ACCEPT_ENABLED;
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(baseUser()) },
      partnerAgreementAcceptance: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({data}: any) => ({
          id: 'receipt-1', acceptedAt: new Date('2026-11-21T18:00:00Z'), ...data,
        })),
      },
    };
    service = new PartnerAgreementService(prisma);
  });

  it('stays disabled until BOTH rollout and completed legal review switches are enabled', async () => {
    delete process.env.PARTNER_AGREEMENT_ENFORCE;
    await expect(service.assertAccepted('owner-1')).resolves.toBeUndefined();
    await expect(service.accept('owner-1', signature)).rejects.toThrow('Business agreements are not yet activated.');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.partnerAgreementAcceptance.findFirst).not.toHaveBeenCalled();
    process.env.PARTNER_AGREEMENT_ENFORCE = 'true';
    delete process.env.PARTNER_AGREEMENT_LEGAL_REVIEW_COMPLETE;
    await expect(service.assertAccepted('owner-1')).resolves.toBeUndefined();
  });

  it('allows owner signatures before enforcement without locking out old Android clients', async () => {
    delete process.env.PARTNER_AGREEMENT_ENFORCE;
    process.env.PARTNER_AGREEMENT_ACCEPT_ENABLED = 'true';
    expect(service.document()).toMatchObject({signingEnabled: true, requiresLegalReviewBeforeProduction: false});
    expect(await service.status('owner-1')).toMatchObject({required: true, accepted: false, canSign: true});
    await expect(service.assertAccepted('owner-1')).resolves.toBeUndefined();
    expect(await service.accept('owner-1', signature)).toMatchObject({accepted: true});
    expect(prisma.partnerAgreementAcceptance.create).toHaveBeenCalledTimes(1);
  });

  it('never permits signatures without confirmed legal review, even in pre-enforcement mode', async () => {
    delete process.env.PARTNER_AGREEMENT_ENFORCE;
    process.env.PARTNER_AGREEMENT_ACCEPT_ENABLED = 'true';
    delete process.env.PARTNER_AGREEMENT_LEGAL_REVIEW_COMPLETE;
    expect(service.document()).toMatchObject({signingEnabled: false, requiresLegalReviewBeforeProduction: true});
    expect(await service.status('owner-1')).toMatchObject({required: false, canSign: false});
    await expect(service.accept('owner-1', signature)).rejects.toThrow('Business agreements are not yet activated.');
    expect(prisma.partnerAgreementAcceptance.create).not.toHaveBeenCalled();
  });

  it('fingerprints the complete immutable source rather than a user-supplied document', () => {
    expect(PARTNER_AGREEMENT_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(PARTNER_AGREEMENT_SHA256).toBe(createHash('sha256').update(PARTNER_AGREEMENT_TEXT).digest('hex'));
    expect(PARTNER_AGREEMENT_TEXT).toContain('SCHEDULE A');
    expect(PARTNER_AGREEMENT_TEXT).toContain('SCHEDULE F');
  });

  it('denies new dealer actions without acceptance of the exact current version', async () => {
    await expect(service.assertAccepted('owner-1')).rejects.toThrow(ForbiddenException);
    const status = await service.status('owner-1');
    expect(status).toMatchObject({required: true, accepted: false, canSign: true});
    expect(prisma.partnerAgreementAcceptance.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        businessOwnerUserId: 'owner-1',
        agreementVersion: PARTNER_AGREEMENT_VERSION,
        agreementSha256: PARTNER_AGREEMENT_SHA256,
        explicitAcceptance: true,
        authorityConfirmed: true,
      }),
      orderBy: {acceptedAt: 'desc'},
    });
  });

  it('rejects wrong version or hash, missing authority, fake identity fields', async () => {
    await expect(service.accept('owner-1', {...signature, sha256: 'wrong'})).rejects.toThrow(ConflictException);
    await expect(service.accept('owner-1', {...signature, authorityConfirmed: false})).rejects.toThrow(BadRequestException);
    await expect(service.accept('owner-1', {...signature, explicitAcceptance: false})).rejects.toThrow(BadRequestException);
    await expect(service.accept('owner-1', {...signature, registrationNumber: ''})).rejects.toThrow(BadRequestException);
    await expect(service.accept('owner-1', {...signature, businessKind: 'UNKNOWN'})).rejects.toThrow(BadRequestException);
    await expect(service.accept('owner-1', {...signature, signatoryFullName: ''})).rejects.toThrow(BadRequestException);
    expect(prisma.partnerAgreementAcceptance.create).not.toHaveBeenCalled();
  });

  it('creates a server-owned receipt with actor, signer, legal entity, document hash and timestamp', async () => {
    const result = await service.accept('owner-1', signature, {
      userAgent: 'CarMazium-browser',
      ipAddress: '203.0.113.8',
    });
    expect(result).toMatchObject({
      accepted: true, id: 'receipt-1', version: PARTNER_AGREEMENT_VERSION,
      sha256: PARTNER_AGREEMENT_SHA256, legalEntityName: signature.legalEntityName,
    });
    expect(prisma.partnerAgreementAcceptance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'owner-1',
        businessOwnerUserId: 'owner-1',
        signatoryFullName: signature.signatoryFullName,
        signatoryCapacity: 'Director',
        authorityConfirmed: true, explicitAcceptance: true,
        agreementVersion: PARTNER_AGREEMENT_VERSION,
        agreementSha256: PARTNER_AGREEMENT_SHA256,
        channel: 'WEB', userAgent: 'CarMazium-browser',
        pseudonymousIpHash: null,
      }),
    });
  });

  it('accepts a real sole trader without a Companies House number', async () => {
    await expect(service.accept('owner-1', {
      ...signature, businessKind: 'SOLE_TRADER',
      legalEntityName: 'Test Trading Director',
      registrationNumber: undefined,
      signatoryCapacity: 'Sole trader',
    })).resolves.toMatchObject({accepted: true});
  });

  it('uses the active dealership owner signature for staff, but never lets staff sign', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'staff-1', role: UserRole.DEALER, deletedAt: null,
      dealerProfile: null, contractorProfile: null,
      dealerStaffMemberships: [{dealerProfile: {userId: 'owner-1'}}],
    });
    const status = await service.status('staff-1');
    expect(status).toMatchObject({required: true, accepted: false, canSign: false});
    expect(prisma.partnerAgreementAcceptance.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({businessOwnerUserId: 'owner-1'}),
    }));
    await expect(service.accept('staff-1', signature)).rejects.toThrow(ForbiddenException);
  });

  it("rejects a verified company's mismatched registration number and legal form", async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...baseUser(), dealerProfile: {
        userId: 'owner-1', isVerified: true,
        kyc: {status: 'APPROVED', businessType: 'PRIVATE_LIMITED', companyRegistrationNumber: '98765432'},
      },
    });
    await expect(service.accept('owner-1', signature)).rejects.toThrow('Company registration number does not match');
    await expect(service.accept('owner-1', {...signature, businessKind: 'SOLE_TRADER'})).rejects.toThrow('must sign as a company');
    expect(prisma.partnerAgreementAcceptance.create).not.toHaveBeenCalled();
  });

  it('requires a fresh acceptance when a pre-KYC signed entity does not match later verified KYC', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...baseUser(), dealerProfile: {
        userId: 'owner-1', isVerified: true,
        kyc: {status: 'APPROVED', businessType: 'PRIVATE_LIMITED', companyRegistrationNumber: '98765432'},
      },
    });
    prisma.partnerAgreementAcceptance.findFirst.mockResolvedValue({
      id: 'accept-1', actorUserId: 'owner-1', businessOwnerUserId: 'owner-1',
      businessKind: 'COMPANY', registrationNumber: '12345678',
      agreementVersion: PARTNER_AGREEMENT_VERSION,
      agreementSha256: PARTNER_AGREEMENT_SHA256,
      explicitAcceptance: true, authorityConfirmed: true,
      acceptedAt: new Date(),
    });
    await expect(service.assertAccepted('owner-1')).rejects.toThrow(ForbiddenException);
    expect((await service.status('owner-1')).accepted).toBe(false);
  });

  it('requires a sole-trader signature for verified sole traders', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...baseUser(), dealerProfile: {
        userId: 'owner-1', isVerified: true,
        kyc: {status: 'APPROVED', businessType: 'SOLE_PROPRIETORSHIP', companyRegistrationNumber: ''},
      },
    });
    await expect(service.accept('owner-1', signature)).rejects.toThrow('must sign as a sole trader');
    await expect(service.accept('owner-1', {...signature, businessKind:'SOLE_TRADER', registrationNumber:undefined,
      legalEntityName:'Test Trading Director', signatoryCapacity:'Sole trader'})).resolves.toMatchObject({accepted:true});
  });

  it('allows existing paid customer operations and normal consumers to bypass the business gate', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser(UserRole.BUYER));
    await expect(service.assertAccepted('owner-1')).resolves.toBeUndefined();
    const state = await service.status('owner-1');
    expect(state.required).toBe(false);
    expect(prisma.partnerAgreementAcceptance.findFirst).not.toHaveBeenCalled();
  });

  it('fails closed if the business acceptance ledger cannot be queried', async () => {
    prisma.partnerAgreementAcceptance.findFirst.mockRejectedValue(new Error('Database unavailable'));
    await expect(service.assertAccepted('owner-1')).rejects.toThrow('Database unavailable');
  });
});
