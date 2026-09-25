import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    Logger,
    ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import { SELF_SERVICE_USER_ROLES, isSelfServiceUserRole } from '../core/account-roles';
import { resolveFrontendUrl } from '../core/frontend-url';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const VERIFICATION_CODE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_VERIFICATION_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 12;

// Loose UK phone format: +44 or 0 prefix, 10-11 digits total, spaces/dashes allowed
const UK_PHONE_REGEX = /^(?:\+44|0)\d{9,10}$/;

function assertValidPhone(phone: string) {
    const stripped = phone.replace(/[\s-]/g, '');
    if (!UK_PHONE_REGEX.test(stripped)) {
        throw new BadRequestException('Please enter a valid UK phone number (e.g. 07123 456789 or +44 7123 456789).');
    }
}

@Injectable()
export class UsersService {
    private readonly logger = new Logger(UsersService.name);
    private readonly supabaseAdmin: SupabaseClient | null;

    constructor(
        private readonly prisma: PrismaService,
        private readonly emailService: EmailService,
        private readonly config: ConfigService,
    ) {
        const supabaseUrl =
            this.config.get<string>('SUPABASE_URL')
            || this.config.get<string>('NEXT_PUBLIC_SUPABASE_URL');
        const serviceKey = this.config.get<string>('SUPABASE_SERVICE_KEY');

        let validatedUrl: string | null = null;
        if (supabaseUrl) {
            try {
                const parsed = new URL(supabaseUrl);
                if (parsed.protocol === 'https:') validatedUrl = parsed.toString().replace(/\/$/, '');
            } catch {
                validatedUrl = null;
            }
        }

        this.supabaseAdmin = validatedUrl && serviceKey
            ? createClient(validatedUrl, serviceKey, {
                auth: { persistSession: false, autoRefreshToken: false },
            })
            : null;
    }

    private async getStripe() {
        const Stripe = (await import('stripe')).default;
        return new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!, {
            apiVersion: '2026-02-25.clover' as any,
        });
    }

    /**
     * Find a user by their primary ID (UUID).
     */
    async findById(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    /**
     * Find a user by email address.
     * Used internally by AuthService during login.
     */
    async findByEmail(email: string) {
        return this.prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() },
        });
    }

    /**
     * Get user profile with role-specific profile data included.
     */
    async getProfile(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                dealerProfile: {
                    include: {
                        kyc: true
                    }
                },
                contractorProfile: true,
                financePartnerProfile: true,
                insurancePartnerProfile: true,
                dealerStaffMemberships: {
                    where: { isActive: true },
                    include: {
                        dealerProfile: {
                            select: { id: true, companyName: true, isVerified: true, logo: true },
                        },
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Strip password hash from response
        const { passwordHash: _, ...safeUser } = user;
        return safeUser;
    }

    private deletionStorageClient(): SupabaseClient {
        if (!this.supabaseAdmin) {
            throw new ServiceUnavailableException(
                'Account deletion is temporarily unavailable because secure storage cleanup is not configured.',
            );
        }
        return this.supabaseAdmin;
    }

    private publicStoragePath(value: string | null | undefined, bucket: string): string | null {
        if (!value) return null;
        const clean = value.split('#')[0].split('?')[0];
        const marker = `/storage/v1/object/public/${bucket}/`;
        const index = clean.indexOf(marker);
        if (index < 0) return null;
        try {
            return decodeURIComponent(clean.slice(index + marker.length));
        } catch {
            return null;
        }
    }

    private async removeStoragePaths(bucket: string, paths: Iterable<string>): Promise<void> {
        const unique = Array.from(new Set(Array.from(paths).filter(Boolean)));
        if (!unique.length) return;

        const storage = this.deletionStorageClient().storage.from(bucket);
        // Supabase Storage remove() is capped; keep batches deliberately below
        // the documented 1000-object maximum.
        for (let i = 0; i < unique.length; i += 500) {
            const batch = unique.slice(i, i + 500);
            const { error } = await storage.remove(batch);
            if (error) {
                this.logger.error(
                    `Account deletion storage cleanup failed in ${bucket}: ${error.message}`,
                );
                throw new ServiceUnavailableException(
                    'Could not remove all account files. Nothing else has been deleted; please try again.',
                );
            }
        }
    }

    /**
     * Remove account-owned Storage objects before deleting the Supabase Auth
     * identity. Supabase refuses a hard Auth deletion while that identity still
     * owns Storage objects, so this is a required first phase rather than
     * best-effort cleanup.
     *
     * Reads of storage.objects are metadata-only; object deletion is always
     * performed through the Storage API, never by deleting Storage rows in SQL.
     */
    private async removeAccountStorage(
        userId: string,
        user: { profileImage?: string | null },
        dealerProfile: any | null,
        listings: Array<{ images: string[] }>,
        chatAttachments: Array<{ attachmentPath: string | null }>,
    ): Promise<void> {
        const byBucket = new Map<string, Set<string>>();
        const add = (bucket: string, path: string | null | undefined) => {
            if (!path) return;
            const set = byBucket.get(bucket) ?? new Set<string>();
            set.add(path);
            byBucket.set(bucket, set);
        };

        // Files uploaded directly by an authenticated user can live under many
        // path shapes. owner_id is the authoritative way to find them.
        const owned = await this.prisma.$queryRaw<Array<{ bucket_id: string; name: string }>>`
            SELECT bucket_id, name
            FROM storage.objects
            WHERE owner_id::text = ${userId}
        `;
        for (const object of owned) add(object.bucket_id, object.name);

        // Service-role uploads have no owner_id, so collect the sensitive paths
        // from application records as well.
        const kyc = dealerProfile?.kyc;
        for (const field of [
            'vatProofPath',
            'companyRegistrationProofPath',
            'directorIdProofPath',
            'proofOfAddressPath',
            'paymentScreenshotPath',
        ]) {
            add('dealer-kyc-documents', kyc?.[field]);
        }

        for (const field of [
            'vatProof',
            'companyRegistrationProof',
            'directorIdProof',
            'proofOfAddress',
            'paymentScreenshot',
        ]) {
            add('listings', this.publicStoragePath(kyc?.[field], 'listings'));
        }

        add('listings', this.publicStoragePath(user.profileImage, 'listings'));
        add('listings', this.publicStoragePath(dealerProfile?.logo, 'listings'));

        for (const listing of listings) {
            for (const image of listing.images ?? []) {
                add('listings', this.publicStoragePath(image, 'listings'));
            }
        }

        for (const message of chatAttachments) {
            add('chat-attachments', message.attachmentPath);
        }

        for (const [bucket, paths] of byBucket) {
            await this.removeStoragePaths(bucket, paths);
        }
    }

    private async deleteSupabaseIdentity(userId: string): Promise<void> {
        const admin = this.deletionStorageClient().auth.admin;
        const { error } = await admin.deleteUser(userId);
        if (!error) return;

        // Local-only legacy accounts may never have had a Supabase identity.
        // Treat an absent identity as already deleted, but fail closed for every
        // other Auth error so the API never claims deletion succeeded when the
        // login identity still exists.
        if (/user.*not found|not found/i.test(error.message || '')) {
            this.logger.warn(`No Supabase Auth identity existed for deleted local user ${userId}`);
            return;
        }

        this.logger.error(
            `Supabase Auth deletion failed for ${userId}: ${error.message}`,
        );
        throw new ServiceUnavailableException(
            'Could not remove the sign-in identity. Account deletion has not been completed; please try again.',
        );
    }

    /**
     * Permanently close the account while preserving only records that have a
     * genuine transaction, safety, fraud, accounting or dispute reason to
     * survive. The User row itself remains as a pseudonymous referential anchor
     * because bids, sales, transactions and shared conversations reference it.
     *
     * Deletion phases:
     *  1. reject unsafe live-auction deletion,
     *  2. erase Storage/KYC media,
     *  3. hard-delete the Supabase Auth identity,
     *  4. atomically erase/anonymise application PII and transient records.
     */
    async deleteAccount(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');
        if (user.deletedAt) throw new BadRequestException('This account has already been deleted');

        const liveAuctionAsSeller = await this.prisma.listing.findFirst({
            where: { sellerId: userId, deletedAt: null, auction: { status: 'ACTIVE' } },
            select: { id: true },
        });
        if (liveAuctionAsSeller) {
            throw new BadRequestException(
                'You have a live auction in progress. Please wait for it to end before deleting your account.',
            );
        }

        const activeBid = await this.prisma.bid.findFirst({
            where: { bidderId: userId, deletedAt: null, listing: { auction: { status: 'ACTIVE' } } },
            select: { id: true },
        });
        if (activeBid) {
            throw new BadRequestException(
                'You have an active bid on a live auction. Please wait for it to end before deleting your account.',
            );
        }

        const [dealerProfile, listings, chatAttachments] = await Promise.all([
            this.prisma.dealerProfile.findUnique({
                where: { userId },
                include: { kyc: true },
            }),
            this.prisma.listing.findMany({
                where: { sellerId: userId },
                select: { images: true },
            }),
            this.prisma.message.findMany({
                where: { senderId: userId, attachmentPath: { not: null } },
                select: { attachmentPath: true },
            }),
        ]);

        // Complete irreversible file/Auth cleanup before committing the local
        // anonymisation transaction. If Storage/Auth is unavailable, the user
        // can safely retry because the local account is still intact.
        await this.removeAccountStorage(
            userId,
            user,
            dealerProfile,
            listings,
            chatAttachments,
        );
        await this.deleteSupabaseIdentity(userId);

        const deletedAt = new Date();
        const deletedEmail = `deleted-${userId}@deleted.carmazium.com`;

        await this.prisma.$transaction(async (tx) => {
            // Remove transient/personal records that have no reason to survive
            // an account deletion.
            await tx.addressVerification.deleteMany({ where: { userId } });
            await tx.notification.deleteMany({ where: { userId } });
            await tx.watchlistItem.deleteMany({ where: { userId } });
            await tx.analyticsEvent.deleteMany({ where: { userId } });

            // Unfinished enquiries are not accounting records. Completed or
            // accepted financial/insurance records remain linked only to the
            // pseudonymous account anchor for audit/legal history.
            await tx.financeApplication.deleteMany({
                where: { userId, status: { in: ['PENDING', 'REJECTED'] } },
            });
            await tx.insuranceQuote.deleteMany({
                where: { userId, status: { in: ['PENDING', 'QUOTED', 'EXPIRED', 'REJECTED'] } },
            });

            // Remove contact/financial-preference data from TradeXchange leads
            // while preserving a non-identifying lifecycle record.
            await tx.serviceLead.updateMany({
                where: { customerId: userId },
                data: {
                    customerId: null,
                    fullName: null,
                    email: null,
                    phone: null,
                    postcode: null,
                    summary: null,
                    depositPence: null,
                    termMonths: null,
                    monthlyBudgetPence: null,
                    employmentStatus: null,
                    annualIncomePence: null,
                    consentToProviderContact: false,
                    consentRecordedAt: null,
                    anonymizedAt: deletedAt,
                    closedAt: deletedAt,
                },
            });
            await tx.serviceLead.updateMany({
                where: { customerId: null, anonymizedAt: deletedAt, status: 'OPEN' },
                data: { status: 'EXPIRED' },
            });

            // CRM/HPI/sale rows can contain snapshots that would otherwise keep
            // name, email, phone or postcode after the account itself is erased.
            await tx.lead.updateMany({
                where: { buyerId: userId },
                data: {
                    buyerId: null,
                    buyerName: 'Deleted user',
                    buyerEmail: null,
                    buyerPhone: null,
                    notes: null,
                    nextFollowUpAt: null,
                },
            });
            await tx.sale.updateMany({
                where: { buyerId: userId },
                data: {
                    buyerName: null,
                    buyerEmail: null,
                    buyerPostcode: null,
                },
            });
            await tx.hpiReportEmailRequest.updateMany({
                where: { buyerId: userId },
                data: { buyerEmail: deletedEmail },
            });
            await tx.sellerReview.updateMany({
                where: { reviewerId: userId },
                data: { comment: null },
            });

            // User-authored private attachment files have already been erased.
            // Keep message text only where the shared transcript itself is a
            // legitimate transaction/safety record, but remove file pointers.
            await tx.message.updateMany({
                where: { senderId: userId },
                data: {
                    attachmentPath: null,
                    attachmentName: null,
                    attachmentMime: null,
                    attachmentSize: null,
                },
            });

            // Withdraw unfinished listings and remove seller-authored media,
            // free text and precise location from every retained listing.
            await tx.listing.updateMany({
                where: {
                    sellerId: userId,
                    deletedAt: null,
                    status: { in: ['DRAFT', 'PENDING_REVIEW', 'ACTIVE'] },
                },
                data: { status: 'WITHDRAWN' },
            });
            await tx.listing.updateMany({
                where: { sellerId: userId },
                data: {
                    images: [],
                    videoUrls: [],
                    description: null,
                    location: null,
                    latitude: null,
                    longitude: null,
                    notOwnerRelationship: null,
                },
            });

            // Dealer/sole-trader KYC identity evidence is intentionally erased
            // rather than retained as general marketplace history.
            if (dealerProfile) {
                if (dealerProfile.kyc) {
                    await tx.dealerKyc.delete({ where: { id: dealerProfile.kyc.id } });
                }
                await tx.dealerInvite.deleteMany({
                    where: { dealerProfileId: dealerProfile.id },
                });
                await tx.dealerStaff.updateMany({
                    where: { dealerProfileId: dealerProfile.id },
                    data: { isActive: false },
                });
                await tx.dealerProfile.update({
                    where: { id: dealerProfile.id },
                    data: {
                        companyName: `Deleted business ${dealerProfile.id.slice(0, 8)}`,
                        vatNumber: `DELETED-${dealerProfile.id}`,
                        registrationNumber: null,
                        businessAddress: null,
                        logo: null,
                        description: null,
                        phone: null,
                        website: null,
                        openingHours: null,
                        isVerified: false,
                        verificationDate: null,
                        deletedAt,
                    },
                });
            }

            // Remove this person's membership in other dealer teams.
            await tx.dealerStaff.deleteMany({ where: { userId } });

            const contractor = await tx.contractorProfile.findUnique({
                where: { userId },
                select: { id: true },
            });
            if (contractor) {
                await tx.contractorCapability.updateMany({
                    where: { contractorId: contractor.id },
                    data: {
                        status: 'SUSPENDED',
                        verificationStatus: 'NOT_SUBMITTED',
                        jobNationwide: false,
                        jobPostcodeAreas: [],
                        leadNationwide: false,
                        leadPostcodeAreas: [],
                        leadMinVehicleValuePence: null,
                        leadMaxVehicleValuePence: null,
                        leadMinVehicleYear: null,
                        leadMaxVehicleMileage: null,
                        leadMinAnnualIncomePence: null,
                        leadFinanceTermMinMonths: null,
                        leadFinanceTermMaxMonths: null,
                        leadWarrantyLevels: [],
                        leadWarrantyMinMonths: null,
                        leadWarrantyMaxMonths: null,
                    } as any,
                });
                await tx.contractorProfile.update({
                    where: { id: contractor.id },
                    data: {
                        businessName: null,
                        phone: null,
                        serviceTypes: [],
                        serviceArea: null,
                        certifications: [],
                        deletedAt,
                    },
                });
            }

            const partnerProfiles = await tx.partnerProfile.findMany({
                where: {
                    OR: [
                        { financeUserId: userId },
                        { insuranceUserId: userId },
                    ],
                },
                select: { id: true },
            });
            for (const partner of partnerProfiles) {
                await tx.partnerProfile.update({
                    where: { id: partner.id },
                    data: {
                        companyName: `Deleted partner ${partner.id.slice(0, 8)}`,
                        apiKey: `deleted-${partner.id}`,
                        callbackUrl: null,
                        isActive: false,
                        deletedAt,
                    },
                });
            }

            // Keep only the minimum pseudonymous row needed by retained shared
            // transaction/safety records. Stripe identifiers are retained here
            // solely because refunds, chargebacks or unsettled payouts may still
            // need to be reconciled after account closure.
            await tx.user.update({
                where: { id: userId },
                data: {
                    deletedAt,
                    email: deletedEmail,
                    passwordHash: 'ACCOUNT_DELETED',
                    firstName: 'Deleted',
                    lastName: 'User',
                    phone: null,
                    profileImage: null,
                    isEmailVerified: false,
                    isPhoneVerified: false,
                    isAddressVerified: false,
                    addressVerifiedAt: null,
                    bankAccountName: null,
                    bankSortCode: null,
                    bankAccountNumber: null,
                    notifyOnSale: false,
                    showPublicProfile: false,
                    location: null,
                    postcode: null,
                    preferences: null,
                },
            });
        });

        this.logger.log(`Completed account erasure for ${userId}`);
        return {
            success: true,
            deletedAt,
            retainedRecordClasses: [
                'completed transactions and payments',
                'auction bids/offers and completed sales',
                'dispute/moderation records',
                'transactional chat text without private attachments',
                'Stripe identifiers needed for refunds, chargebacks or unsettled payouts',
            ],
        };
    }

    /**
     * Update basic profile fields for the authenticated user.
     */
    async updateProfile(
        userId: string,
        data: {
            firstName?: string;
            lastName?: string;
            phone?: string;
            profileImage?: string;
            notifyOnSale?: boolean;
            showPublicProfile?: boolean;
            location?: string;
            postcode?: string;
            preferences?: Record<string, any>;
        },
    ) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (data.phone !== undefined && data.phone !== null && data.phone.trim() !== '') {
            assertValidPhone(data.phone);
        }

        const updated = await this.prisma.user.update({
            where: { id: userId },
            data: {
                ...(data.firstName !== undefined && { firstName: data.firstName }),
                ...(data.lastName !== undefined && { lastName: data.lastName }),
                ...(data.phone !== undefined && { phone: data.phone }),
                ...(data.profileImage !== undefined && { profileImage: data.profileImage }),
                ...(data.notifyOnSale !== undefined && { notifyOnSale: data.notifyOnSale }),
                ...(data.showPublicProfile !== undefined && { showPublicProfile: data.showPublicProfile }),
                ...(data.location !== undefined && { location: data.location }),
                ...(data.postcode !== undefined && { postcode: data.postcode }),
                ...(data.preferences !== undefined && {
                    preferences: {
                        ...((user.preferences as Record<string, any>) ?? {}),
                        ...data.preferences,
                    },
                }),
            },
            include: {
                dealerProfile: true,
                contractorProfile: true,
            },
        });

        const { passwordHash: _, ...safeUser } = updated;
        return safeUser;
    }

    /**
     * Roles a signed-in user may move themselves into, unassisted.
     *
     * Everything absent from this list is privileged and must be granted by an
     * admin, never by the account itself:
     *   ADMIN                       — full platform control
     *   FINANCE_PARTNER / INSURANCE_PARTNER — partner dashboards and lead access
     *
     * DEALER is self-serve on purpose: it only unlocks the dealer dashboard in
     * limited mode, and everything that matters behind it (bidding, payouts)
     * additionally requires an approved KYC review.
     *
     * CONTRACTOR is self-serve for the same reason. The role alone grants
     * nothing: taking Trade Exchange work requires an admin-APPROVED
     * ContractorCapability for that service, and payouts require Stripe
     * Connect onboarding. The role is the door to the application form, not
     * to the work.
     */
    /**
     * Switch the caller's own account between self-service roles.
     *
     * This used to write whatever role it was handed, straight to the database,
     * for any authenticated caller — so any signed-in buyer could POST
     * `{ newRole: 'ADMIN' }` and take over the platform. The allowlist below is
     * the fix; do not replace it with a denylist, because a new privileged role
     * added to the enum would then be self-grantable by default.
     */
    async requestRoleElevation(userId: string, newRole: UserRole) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (!SELF_SERVICE_USER_ROLES.includes(newRole)) {
            // Deliberately vague to the caller, loud in the logs: probing this
            // endpoint for privileged roles is not something a real user does.
            this.logger.warn(
                `Blocked self-service role escalation: user ${userId} (${user.role}) requested ${newRole}`,
            );
            throw new ForbiddenException(
                'That account type has to be set up by our team. Contact support to request it.',
            );
        }

        // An admin must not be able to drop their own privileges through the
        // self-service door — a hijacked admin session could use it to hide the
        // takeover, and a real admin has no reason to demote themselves here.
        if (user.role === UserRole.ADMIN) {
            throw new ForbiddenException('Admin accounts cannot change their own role.');
        }

        const updated = await this.prisma.user.update({
            where: { id: userId },
            data: { role: newRole },
        });

        this.logger.log(`Role change: user ${userId} ${user.role} -> ${newRole}`);

        const { passwordHash: _, ...safeUser } = updated;
        return safeUser;
    }

    /**
     * Create or update a Dealer profile for the authenticated user.
     */
    async updateDealerProfile(
        userId: string,
        data: {
            companyName?: string;
            vatNumber?: string;
            registrationNumber?: string;
            businessAddress?: string;
            phone?: string;
            website?: string;
            description?: string;
            logo?: string;
        },
    ) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (data.phone !== undefined && data.phone !== null && data.phone.trim() !== '') {
            assertValidPhone(data.phone);
        }

        // Whitelist the fields a dealer may set about themselves. The `data`
        // type says these are the only keys, but the controller hands this the
        // raw request body (`@Body() body: any`), so the type proves nothing at
        // runtime. Spreading the body straight into Prisma let a dealer PATCH
        // `{ isVerified: true }` and self-approve past KYC — appearing to admins
        // as a verified dealer without any review. Build the update explicitly:
        // isVerified and verificationDate live only on the admin KYC-approval
        // path and must never be writable from this endpoint.
        const raw = data as Record<string, unknown>;
        const allowed: Record<string, unknown> = {};
        for (const key of [
            'companyName', 'vatNumber', 'registrationNumber', 'businessAddress',
            'phone', 'website', 'description', 'logo', 'openingHours',
        ]) {
            if (raw[key] !== undefined) allowed[key] = raw[key];
        }

        // On create, companyName is required — fall back to a placeholder so the
        // upsert doesn't fail when a dealer saves partial info before KYC.
        const existing = await this.prisma.dealerProfile.findUnique({ where: { userId: user.id } });

        if (existing) {
            // Allow update if a profile already exists (handles OAuth role-sync edge cases)
            return this.prisma.dealerProfile.update({
                where: { userId: user.id },
                data: allowed,
            });
        }

        // Enforce DEALER role only when creating a new dealer profile
        if (user.role !== UserRole.DEALER) {
            throw new BadRequestException(
                'Only users with the DEALER role can have a dealer profile',
            );
        }

        return this.prisma.dealerProfile.create({
            data: {
                userId: user.id,
                companyName: data.companyName || `${user.firstName || 'Dealer'}'s Dealership`,
                vatNumber: data.vatNumber || `PENDING-${user.id.slice(0, 8)}`,
                registrationNumber: data.registrationNumber,
                businessAddress: data.businessAddress,
                phone: data.phone,
                website: data.website,
                description: data.description,
                logo: data.logo,
            },
        });
    }

    /**
     * Sync user from Supabase (Legacy Frontend Support).
     * Creates a user record if it doesn't exist.
     * Accepts id or supabaseAuthId; optionally persists role.
     */
    async syncUser(data: {
        id?: string;
        supabaseAuthId?: string;
        email: string;
        firstName?: string;
        lastName?: string;
        role?: UserRole;
    }) {
        const email = data.email.toLowerCase().trim();
        const userId = data.id ?? data.supabaseAuthId;

        // A role chosen at signup may only be one the user is allowed to grant
        // themselves — the same allowlist that governs /users/elevate. ADMIN,
        // FINANCE_PARTNER and INSURANCE_PARTNER are privileged and set by staff,
        // never self-declared through the sync payload.
        const requestedRole =
            data.role && isSelfServiceUserRole(data.role) ? data.role : undefined;

        // Check if user already exists
        const userExists = await this.prisma.user.findUnique({
            where: { email },
        });

        const user = await this.prisma.user.upsert({
            where: { email },
            update: {
                // Only overwrite existing name if we have a non-empty value coming in
                ...(data.firstName && { firstName: data.firstName }),
                ...(data.lastName && { lastName: data.lastName }),
                // Role is deliberately NOT updated here. sync runs on every
                // login, not just signup; changing role from it would let a
                // returning DEALER be silently downgraded to BUYER, and was half
                // of the escalation hole. Role changes go through
                // requestRoleElevation(), which enforces its own allowlist.
            },
            create: {
                ...(userId && { id: userId }),
                email,
                firstName: data.firstName,
                lastName: data.lastName,
                ...(requestedRole !== undefined && { role: requestedRole }),
                passwordHash: 'SUPABASE_EXTERNAL_AUTH', // Placeholder since auth is external
            },
        });

        // Fire and forget welcome email if it's a completely new user
        if (!userExists) {
            this.emailService.sendWelcomeEmail(user.email, user.firstName || undefined, user.role).catch(console.error);
        }

        // `isNewUser` is the authoritative "a brand-new account was just
        // created" signal — it can only ever be true once per account, on the
        // request that actually inserted the row. The frontend uses it to fire
        // the Google Ads "Completed Seller Registration" conversion, which must
        // never fire on a login, a dashboard refresh, or a return visit.
        // Deriving newness client-side (e.g. from how recent user.created_at
        // looks) would be a guess; this is a fact.
        return { user, isNewUser: !userExists };
    }

    /**
     * Start address verification: generates a one-time code, stores its hash,
     * and emails it to the user's account email address.
     */
    async startAddressVerification(userId: string, address: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const code = String(Math.floor(100000 + Math.random() * 900000));
        const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
        const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

        await this.prisma.addressVerification.create({
            data: { userId, address, codeHash, expiresAt },
        });

        const name = user.firstName || 'there';
        await this.emailService.sendAddressVerificationCodeEmail(user.email, name, code, address);

        return { address, expiresAt, message: `We've emailed a 6-digit verification code to ${user.email}.` };
    }

    /**
     * Confirm address verification using the most recent unconsumed code for the user.
     */
    async confirmAddressVerification(userId: string, code: string) {
        const verification = await this.prisma.addressVerification.findFirst({
            where: { userId, consumedAt: null },
            orderBy: { createdAt: 'desc' },
        });

        if (!verification) {
            throw new BadRequestException('No pending verification found. Please request a new code.');
        }

        if (verification.expiresAt < new Date()) {
            throw new BadRequestException('This code has expired. Please request a new one.');
        }

        if (verification.attempts >= MAX_VERIFICATION_ATTEMPTS) {
            throw new BadRequestException('Too many incorrect attempts. Please request a new code.');
        }

        const isMatch = await bcrypt.compare(code, verification.codeHash);
        if (!isMatch) {
            await this.prisma.addressVerification.update({
                where: { id: verification.id },
                data: { attempts: { increment: 1 } },
            });
            throw new BadRequestException('Incorrect code. Please try again.');
        }

        const now = new Date();
        await this.prisma.$transaction([
            this.prisma.addressVerification.update({
                where: { id: verification.id },
                data: { consumedAt: now },
            }),
            this.prisma.user.update({
                where: { id: userId },
                data: { isAddressVerified: true, addressVerifiedAt: now, location: verification.address },
            }),
        ]);

        return { verified: true, address: verification.address, verifiedAt: now };
    }

    /**
     * Create (or retrieve) a Stripe Express account for the user and return
     * a one-time onboarding link.
     */
    private safeConnectRedirectUrl(value: string, field: 'returnUrl' | 'refreshUrl') {
        let parsed: URL;
        try {
            parsed = new URL(value);
        } catch {
            throw new BadRequestException(`${field} must be a valid CarMazium URL`);
        }

        const configuredOrigin = new URL(
            resolveFrontendUrl(this.config.get<string>('FRONTEND_URL')),
        ).origin;
        const allowedOrigins = new Set([
            configuredOrigin,
            'https://carmazium.com',
            'https://www.carmazium.com',
        ]);
        if (process.env.NODE_ENV !== 'production') {
            allowedOrigins.add('http://localhost:3000');
            allowedOrigins.add('http://127.0.0.1:3000');
        }

        if (!allowedOrigins.has(parsed.origin)) {
            throw new BadRequestException(
                `${field} must return to an approved CarMazium origin`,
            );
        }
        if (parsed.protocol !== 'https:' && !parsed.hostname.match(/^(localhost|127\.0\.0\.1)$/)) {
            throw new BadRequestException(`${field} must use HTTPS`);
        }
        return parsed.toString();
    }

    async createConnectOnboardingLink(userId: string, returnUrl: string, refreshUrl: string) {
        const safeReturnUrl = this.safeConnectRedirectUrl(returnUrl, 'returnUrl');
        const safeRefreshUrl = this.safeConnectRedirectUrl(refreshUrl, 'refreshUrl');

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, stripeConnectAccountId: true },
        });
        if (!user) throw new NotFoundException('User not found');

        const stripe = await this.getStripe();

        // Create Express account on first call; reuse on subsequent calls
        let accountId = user.stripeConnectAccountId;
        if (!accountId) {
            const account = await stripe.accounts.create({
                type: 'express',
                country: 'GB',
                email: user.email,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
            });
            accountId = account.id;
            await this.prisma.user.update({
                where: { id: userId },
                data: { stripeConnectAccountId: accountId },
            });
        }

        const link = await stripe.accountLinks.create({
            account: accountId,
            return_url: safeReturnUrl,
            refresh_url: safeRefreshUrl,
            type: 'account_onboarding',
        });

        return { url: link.url };
    }

    /**
     * Check whether the user's Stripe Connect account has completed onboarding.
     */
    async getConnectStatus(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { stripeConnectAccountId: true, stripeConnectOnboardingComplete: true },
        });
        if (!user) throw new NotFoundException('User not found');

        if (!user.stripeConnectAccountId) {
            return { connected: false, onboardingComplete: false };
        }

        const stripe = await this.getStripe();
        const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);
        // details_submitted is the authoritative flag — it becomes true only after
        // the seller actually completes Stripe's onboarding wizard. charges_enabled
        // and payouts_enabled can be true in test mode immediately after account
        // creation, before the seller has submitted anything.
        const complete = !!(
            account.details_submitted &&
            account.charges_enabled &&
            account.payouts_enabled &&
            (!account.requirements?.currently_due || account.requirements.currently_due.length === 0)
        );

        // Persist completion state so other services can check without hitting Stripe
        if (complete && !user.stripeConnectOnboardingComplete) {
            await this.prisma.user.update({
                where: { id: userId },
                data: { stripeConnectOnboardingComplete: true },
            });
        } else if (!complete && user.stripeConnectOnboardingComplete) {
            // Requirements were added back (e.g. Stripe requested more info) — mark incomplete
            await this.prisma.user.update({
                where: { id: userId },
                data: { stripeConnectOnboardingComplete: false },
            });
        }

        return {
            connected: true,
            onboardingComplete: complete,
            accountId: user.stripeConnectAccountId,
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
            detailsSubmitted: account.details_submitted,
        };
    }

    async updateBankDetails(
        userId: string,
        dto: {
            bankAccountName?: string;
            bankSortCode?: string;
            bankAccountNumber?: string;
            payoutPreference?: string;
        },
    ) {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
        if (!user) throw new NotFoundException('User not found');

        return this.prisma.user.update({
            where: { id: userId },
            data: {
                ...(dto.bankAccountName !== undefined && { bankAccountName: dto.bankAccountName }),
                ...(dto.bankSortCode !== undefined && { bankSortCode: dto.bankSortCode }),
                ...(dto.bankAccountNumber !== undefined && { bankAccountNumber: dto.bankAccountNumber }),
                ...(dto.payoutPreference !== undefined && { payoutPreference: dto.payoutPreference }),
            },
            select: {
                bankAccountName: true,
                bankSortCode: true,
                bankAccountNumber: true,
                payoutPreference: true,
            },
        });
    }
}
