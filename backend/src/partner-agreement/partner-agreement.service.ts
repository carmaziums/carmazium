import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  PARTNER_AGREEMENT_TEXT, PARTNER_AGREEMENT_TITLE, PARTNER_AGREEMENT_VERSION,
} from './partner-agreement.document';

export const PARTNER_AGREEMENT_SHA256 = createHash('sha256')
  .update(PARTNER_AGREEMENT_TEXT, 'utf8').digest('hex');

export type BusinessKind = 'COMPANY' | 'SOLE_TRADER' | 'PARTNERSHIP' | 'OTHER_BUSINESS';

export type PartnerAgreementAcceptanceInput = {
  version?: unknown;
  sha256?: unknown;
  businessKind?: unknown;
  legalEntityName?: unknown;
  registrationNumber?: unknown;
  signatoryFullName?: unknown;
  signatoryCapacity?: unknown;
  authorityConfirmed?: unknown;
  explicitAcceptance?: unknown;
  channel?: unknown;
};

const SIGNABLE_ROLES = new Set<UserRole>([UserRole.DEALER, UserRole.CONTRACTOR]);

/** Requires two deliberate production controls after solicitor sign-off and DB migration.
 * Default is OFF: deploying unsigned code must never lock existing traders out. */
export function businessAgreementIsLive(): boolean {
  return process.env.PARTNER_AGREEMENT_ENFORCE === 'true'
    && process.env.PARTNER_AGREEMENT_LEGAL_REVIEW_COMPLETE === 'true';
}

/**
 * The authenticated business owner signs once for the legal business.
 * Dealer employees inherit their employer's signed agreement. They cannot
 * sign for the owner by pretending to be an owner.
 */
@Injectable()
export class PartnerAgreementService {
  constructor(private readonly prisma: PrismaService) {}

  document() {
    return {
      title: PARTNER_AGREEMENT_TITLE,
      version: PARTNER_AGREEMENT_VERSION,
      sha256: PARTNER_AGREEMENT_SHA256,
      text: PARTNER_AGREEMENT_TEXT,
      requiresLegalReviewBeforeProduction: process.env.PARTNER_AGREEMENT_LEGAL_REVIEW_COMPLETE !== 'true',
      signingEnabled: businessAgreementIsLive(),
    };
  }

  private async identity(actorUserId: string) {
    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: {
        id: true,
        role: true,
        deletedAt: true,
        dealerProfile: { select: { userId: true } },
        contractorProfile: { select: { userId: true } },
        dealerStaffMemberships: {
          where: { isActive: true },
          take: 1,
          select: { dealerProfile: { select: { userId: true } } },
        },
      },
    });
    if (!actor || actor.deletedAt) throw new NotFoundException('Account not found.');
    if (actor.role === UserRole.ADMIN) {
      return { required: false, ownerUserId: actorUserId, canSign: false };
    }
    // An active staff member inherits the owner's agreement, rather than
    // creating a fictitious new legal entity.
    if (!actor.dealerProfile && !actor.contractorProfile &&
        actor.dealerStaffMemberships?.length) {
      return {
        required: true,
        ownerUserId: actor.dealerStaffMemberships[0].dealerProfile.userId,
        canSign: false,
      };
    }
    return {
      required: SIGNABLE_ROLES.has(actor.role),
      ownerUserId: actorUserId,
      canSign: SIGNABLE_ROLES.has(actor.role),
    };
  }

  async status(actorUserId: string) {
    // Do not query the optional ledger until the migration and legal review
    // are complete, even when some old users have a Partner role.
    if (!businessAgreementIsLive()) {
      return { required: false, accepted: true, canSign: false,
        version: PARTNER_AGREEMENT_VERSION, sha256: PARTNER_AGREEMENT_SHA256,
        signingEnabled: false, acceptance: null };
    }
    const identity = await this.identity(actorUserId);
    if (!identity.required) {
      return {
        required: false, accepted: true, canSign: false,
        version: PARTNER_AGREEMENT_VERSION,
        sha256: PARTNER_AGREEMENT_SHA256,
        acceptance: null,
      };
    }
    const record = await this.prisma.partnerAgreementAcceptance.findFirst({
      where: {
        businessOwnerUserId: identity.ownerUserId,
        agreementVersion: PARTNER_AGREEMENT_VERSION,
        agreementSha256: PARTNER_AGREEMENT_SHA256,
        explicitAcceptance: true,
        authorityConfirmed: true,
      },
      orderBy: { acceptedAt: 'desc' },
    });
    return {
      required: true,
      accepted: Boolean(record),
      canSign: identity.canSign,
      version: PARTNER_AGREEMENT_VERSION,
      sha256: PARTNER_AGREEMENT_SHA256,
      acceptance: record ? {
        id: record.id,
        acceptedAt: record.acceptedAt,
        legalEntityName: record.legalEntityName,
        businessKind: record.businessKind,
        signatoryFullName: record.signatoryFullName,
        signatoryCapacity: record.signatoryCapacity,
        agreementVersion: record.agreementVersion,
        agreementSha256: record.agreementSha256,
      } : null,
    };
  }

  async assertAccepted(actorUserId: string): Promise<void> {
    const status = await this.status(actorUserId);
    if (status.required && !status.accepted) {
      throw new ForbiddenException(
        'BUSINESS_AGREEMENT_REQUIRED: An authorised business owner must electronically accept the current CarMazium Master Business Partner Agreement before new trade activity.',
      );
    }
  }

  async accept(
    actorUserId: string,
    input: PartnerAgreementAcceptanceInput,
    requestMeta: { userAgent?: string | null; ipAddress?: string | null } = {},
  ) {
    if (!businessAgreementIsLive()) throw new ServiceUnavailableException('Business agreements are not yet activated.');
    const identity = await this.identity(actorUserId);
    if (!identity.required || !identity.canSign) {
      throw new ForbiddenException('Only an authorised Partner Account owner may sign this agreement.');
    }
    if (input?.version !== PARTNER_AGREEMENT_VERSION || input?.sha256 !== PARTNER_AGREEMENT_SHA256) {
      throw new ConflictException('Agreement version changed. Read and accept the currently published text.');
    }
    if (input?.authorityConfirmed !== true || input?.explicitAcceptance !== true) {
      throw new BadRequestException('Confirm both the agreement and your authority to bind the business.');
    }

    const clean = (value: unknown, max: number) =>
      typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max + 1) : '';
    const businessKind = input.businessKind;
    const legalEntityName = clean(input.legalEntityName, 180);
    const signatoryFullName = clean(input.signatoryFullName, 180);
    const signatoryCapacity = clean(input.signatoryCapacity, 120);
    const registrationNumber = clean(input.registrationNumber, 40).toUpperCase();
    const kinds: BusinessKind[] = ['COMPANY', 'SOLE_TRADER', 'PARTNERSHIP', 'OTHER_BUSINESS'];

    if (!kinds.includes(businessKind as BusinessKind)) {
      throw new BadRequestException('Choose the legal form of the contracting business.');
    }
    if (legalEntityName.length < 3 || legalEntityName.length > 180 ||
        signatoryFullName.length < 5 || signatoryFullName.length > 180 ||
        signatoryCapacity.length < 2 || signatoryCapacity.length > 120) {
      throw new BadRequestException('Provide the complete legal business name, signatory name and business capacity.');
    }
    if (registrationNumber.length > 40 ||
        (registrationNumber && !/^[A-Z0-9 /.-]+$/.test(registrationNumber))) {
      throw new BadRequestException('Business registration number is invalid.');
    }
    if (businessKind === 'COMPANY' && !registrationNumber) {
      throw new BadRequestException('Registered companies must provide their company registration number.');
    }
    // User agent and an optionally keyed one-way IP pseudonym are supplemental
    // evidence, not a substitute for authenticated identity or an e-signature.
    const userAgent = clean(requestMeta.userAgent, 320);
    const pepper = process.env.PARTNER_AGREEMENT_IP_HASH_KEY;
    const pseudonymousIpHash = pepper && requestMeta.ipAddress
      ? createHash('sha256').update(pepper + '|' + requestMeta.ipAddress).digest('hex')
      : null;
    const channel = input.channel === 'ANDROID' ? 'ANDROID' : 'WEB';

    const record = await this.prisma.partnerAgreementAcceptance.create({
      data: {
        actorUserId,
        businessOwnerUserId: identity.ownerUserId,
        legalEntityName,
        businessKind: businessKind as string,
        registrationNumber: registrationNumber || null,
        signatoryFullName,
        signatoryCapacity,
        agreementVersion: PARTNER_AGREEMENT_VERSION,
        agreementSha256: PARTNER_AGREEMENT_SHA256,
        authorityConfirmed: true,
        explicitAcceptance: true,
        channel,
        userAgent: userAgent || null,
        pseudonymousIpHash,
      },
    });

    return {
      id: record.id,
      acceptedAt: record.acceptedAt,
      legalEntityName: record.legalEntityName,
      signatoryFullName: record.signatoryFullName,
      signatoryCapacity: record.signatoryCapacity,
      version: record.agreementVersion,
      sha256: record.agreementSha256,
      accepted: true,
    };
  }
}
