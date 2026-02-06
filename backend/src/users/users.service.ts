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
        try {
            console.log('Syncing user:', data.email, data.supabaseAuthId);

            // Upsert user: Create if not exists, Update if exists (by email or authId)
            // Since we can't easily upsert on multiple unique fields (email OR supabaseAuthId),
            // we'll try to find by email first (primary stable identifier for sync).

            const existingUser = await this.prisma.user.findUnique({
                where: { email: data.email }
            });

            if (existingUser) {
                // Update implementation
                return this.prisma.user.update({
                    where: { email: data.email },
                    data: {
                        supabaseAuthId: data.supabaseAuthId, // Link auth ID if missing
                        firstName: data.firstName || existingUser.firstName, // Update only if provided
                        lastName: data.lastName || existingUser.lastName,
                        // Don't overwrite role if exists, strictly speaking, unless we want to enforce it
                    }
                });
            }

            // Create new
            return await this.prisma.user.create({
                data: {
                    supabaseAuthId: data.supabaseAuthId,
                    email: data.email,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    role: data.role || UserRole.BUYER,
                },
            });
        } catch (error) {
            console.error('Error syncing user:', error);
            // Return null or rethrow based on preference, but prevent 500 crash for controller
            throw new ConflictException(`Failed to sync user: ${error.message}`);
        }
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
