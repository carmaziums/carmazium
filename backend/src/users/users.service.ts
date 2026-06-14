import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';

const VERIFICATION_CODE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_VERIFICATION_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly emailService: EmailService,
        private readonly config: ConfigService,
    ) { }

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
            preferences?: Record<string, any>;
        },
    ) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
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
     * Request a role elevation or switch.
     * In production this would create an approval request; for dev we update directly.
     */
    async requestRoleElevation(userId: string, newRole: UserRole) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const updated = await this.prisma.user.update({
            where: { id: userId },
            data: { role: newRole },
        });

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

        // On create, companyName is required — fall back to a placeholder so the
        // upsert doesn't fail when a dealer saves partial info before KYC.
        const existing = await this.prisma.dealerProfile.findUnique({ where: { userId: user.id } });

        if (existing) {
            // Allow update if a profile already exists (handles OAuth role-sync edge cases)
            return this.prisma.dealerProfile.update({
                where: { userId: user.id },
                data,
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
        const role = data.role && Object.values(UserRole).includes(data.role) ? data.role : undefined;

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
                ...(role !== undefined && { role }),
            },
            create: {
                ...(userId && { id: userId }),
                email,
                firstName: data.firstName,
                lastName: data.lastName,
                ...(role !== undefined && { role }),
                passwordHash: 'SUPABASE_EXTERNAL_AUTH', // Placeholder since auth is external
            },
        });

        // Fire and forget welcome email if it's a completely new user
        if (!userExists) {
            this.emailService.sendWelcomeEmail(user.email, user.firstName || undefined, user.role).catch(console.error);
        }

        return user;
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
    async createConnectOnboardingLink(userId: string, returnUrl: string, refreshUrl: string) {
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
                capabilities: { transfers: { requested: true } },
            });
            accountId = account.id;
            await this.prisma.user.update({
                where: { id: userId },
                data: { stripeConnectAccountId: accountId },
            });
        }

        const link = await stripe.accountLinks.create({
            account: accountId,
            return_url: returnUrl,
            refresh_url: refreshUrl,
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
        const complete = !!(account.charges_enabled && account.payouts_enabled);

        // Persist completion state so other services can check without hitting Stripe
        if (complete && !user.stripeConnectOnboardingComplete) {
            await this.prisma.user.update({
                where: { id: userId },
                data: { stripeConnectOnboardingComplete: true },
            });
        }

        return {
            connected: true,
            onboardingComplete: complete,
            accountId: user.stripeConnectAccountId,
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
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
