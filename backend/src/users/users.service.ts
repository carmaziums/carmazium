import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { EmailService } from '../email/email.service';

@Injectable()
export class UsersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly emailService: EmailService,
    ) { }

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
                ...(data.profileImage !== undefined && {
                    profileImage: data.profileImage,
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
            companyName: string;
            vatNumber: string;
            registrationNumber?: string;
            businessAddress?: string;
        },
    ) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.role !== UserRole.DEALER) {
            throw new BadRequestException(
                'Only users with the DEALER role can have a dealer profile',
            );
        }

        return this.prisma.dealerProfile.upsert({
            where: { userId: user.id },
            update: data,
            create: {
                ...data,
                userId: user.id,
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
                firstName: data.firstName,
                lastName: data.lastName,
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
}
