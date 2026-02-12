import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) { }

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
                dealerProfile: true,
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
     */
    async syncUser(data: {
        id: string;
        email: string;
        firstName?: string;
        lastName?: string;
    }) {
        const email = data.email.toLowerCase().trim();

        return this.prisma.user.upsert({
            where: { email },
            update: {
                firstName: data.firstName,
                lastName: data.lastName,
            },
            create: {
                id: data.id, // Using the provided ID from sync
                email,
                firstName: data.firstName,
                lastName: data.lastName,
                passwordHash: 'SUPABASE_EXTERNAL_AUTH', // Placeholder since auth is external
            },
        });
    }
}
