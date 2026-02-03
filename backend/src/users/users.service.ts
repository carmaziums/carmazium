import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Sync Supabase user with local database
     * Called after frontend signup
     */
    async syncSupabaseUser(data: {
        supabaseAuthId: string;
        email: string;
        firstName?: string;
        lastName?: string;
        role?: UserRole;
    }) {
        // Check if user already exists
        const existingUser = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { supabaseAuthId: data.supabaseAuthId },
                    { email: data.email }
                ]
            }
        });

        if (existingUser) {
            // If user exists but doesn't have supabaseAuthId (e.g., imported), linking them
            if (!existingUser.supabaseAuthId) {
                return this.prisma.user.update({
                    where: { id: existingUser.id },
                    data: { supabaseAuthId: data.supabaseAuthId }
                });
            }
            return existingUser;
        }

        // Create new user in our DB
        return this.prisma.user.create({
            data: {
                supabaseAuthId: data.supabaseAuthId,
                email: data.email,
                firstName: data.firstName,
                lastName: data.lastName,
                role: data.role || UserRole.BUYER,
            },
        });
    }

    /**
     * Get user profile with its role-specific profile data
     */
    async getProfile(supabaseAuthId: string) {
        const user = await this.prisma.user.findUnique({
            where: { supabaseAuthId: supabaseAuthId },
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

        return user;
    }

    /**
     * Elevate or switch role
     * This typically triggers a verification process
     */
    async requestRoleElevation(supabaseAuthId: string, newRole: UserRole) {
        const user = await this.prisma.user.findUnique({ where: { supabaseAuthId: supabaseAuthId } });
        if (!user) throw new NotFoundException('User not found');

        // Logic for role switching
        // In a real app, this might create a 'RoleRequest' record for admins to approve
        // For now, we update it and ensure the profile existence is handled in the UI
        return this.prisma.user.update({
            where: { supabaseAuthId: supabaseAuthId },
            data: { role: newRole },
        });
    }

    /**
     * Create or update a Dealer profile
     */
    async updateDealerProfile(supabaseAuthId: string, data: {
        companyName: string;
        vatNumber: string;
        registrationNumber?: string;
        businessAddress?: string;
    }) {
        const user = await this.prisma.user.findUnique({ where: { supabaseAuthId } });
        if (!user) throw new NotFoundException('User not found');

        return this.prisma.dealerProfile.upsert({
            where: { userId: user.id },
            update: data,
            create: {
                ...data,
                userId: user.id,
            },
        });
    }

    // Similarly for other profiles...
}
