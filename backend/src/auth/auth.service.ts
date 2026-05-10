import {
    Injectable,
    ConflictException,
    UnauthorizedException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const BCRYPT_ROUNDS = 12;



@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private supabase: SupabaseClient;

    private async processPendingInvitations(user: any) {
        try {
            const invites = await this.prisma.dealerInvite.findMany({
                where: { email: user.email.toLowerCase().trim() }
            });

            if (invites.length > 0) {
                await Promise.all(invites.map(invite => 
                    this.prisma.dealerStaff.create({
                        data: {
                            userId: user.id,
                            dealerProfileId: invite.dealerProfileId,
                            role: invite.role,
                        }
                    })
                ));

                await this.prisma.dealerInvite.deleteMany({
                    where: { email: user.email.toLowerCase().trim() }
                });

                this.logger.log(`Auto-processed ${invites.length} dealership invitations for ${user.email}`);
            }
        } catch (err: any) {
            this.logger.error(`Failed to process invitations for ${user.email}: ${err.message}`);
        }
    }

    constructor(private readonly prisma: PrismaService) {
        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            this.logger.warn('Supabase URL or key not configured — Supabase token verification will fail');
        }

        this.supabase = createClient(
            supabaseUrl || 'https://placeholder.supabase.co',
            supabaseKey || 'placeholder-key',
        );
    }

    async register(dto: RegisterDto) {
        // Check for existing user
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email.toLowerCase().trim() },
        });

        if (existing) {
            throw new ConflictException('An account with this email already exists');
        }

        // Hash the password
        const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

        // Create the user
        const user = await this.prisma.user.create({
            data: {
                email: dto.email.toLowerCase().trim(),
                passwordHash,
                firstName: dto.firstName,
                lastName: dto.lastName,
                phone: dto.phone,
                role: dto.role || UserRole.BUYER,
            },
        });

        // Process any pending dealership invitations
        await this.processPendingInvitations(user);

        // Return user without password hash
        const { passwordHash: _, ...safeUser } = user;
        return safeUser;
    }

    /**
     * Validate login credentials.
     * Returns the user if email + password match, otherwise throws.
     */
    async login(dto: LoginDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email.toLowerCase().trim() },
        });

        if (!user || !user.passwordHash) {
            throw new UnauthorizedException('Invalid email or password');
        }

        // Check if account is locked
        if (user.lockoutUntil && user.lockoutUntil > new Date()) {
            const minutesLeft = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000);
            throw new UnauthorizedException(`Account locked. Try again in ${minutesLeft} minutes.`);
        }

        const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);

        if (!passwordValid) {
            // Increment failed attempts
            const attempts = user.loginAttempts + 1;
            const lockoutUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

            await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    loginAttempts: attempts,
                    lockoutUntil,
                },
            });

            throw new UnauthorizedException('Invalid email or password');
        }

        // Reset attempts on successful login
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                loginAttempts: 0,
                lockoutUntil: null,
            },
        });

        // Return user without password hash
        const { passwordHash: _, ...safeUser } = user;
        return safeUser;
    }

    /**
     * Reset/Change user password
     */
    async resetPassword(userId: string, dto: any) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        // If user is authenticated via Supabase external auth, they should reset password via Supabase
        if (user.passwordHash === 'SUPABASE_EXTERNAL_AUTH') {
            throw new ConflictException('Please reset your password via your external authentication provider');
        }

        // Verify old password
        const oldPasswordValid = await bcrypt.compare(dto.oldPassword, user.passwordHash || '');
        if (!oldPasswordValid) {
            throw new UnauthorizedException('Current password is incorrect');
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

        // Update user
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                passwordHash: newPasswordHash,
            },
        });

        return { success: true, message: 'Password reset successfully' };
    }


    /**
     * Retrieve a user by ID for session hydration.
     * Called by session middleware to populate req.user on each request.
     */
    async validateSession(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                dealerProfile: true,
                contractorProfile: true,
                financePartnerProfile: true,
                insurancePartnerProfile: true,
            },
        });

        if (!user || user.deletedAt) {
            return null;
        }

        const { passwordHash: _, ...safeUser } = user;
        return safeUser;
    }

    /**
     * Verify a Supabase access token and return the local DB user.
     * Used by the auth bridge to create backend sessions from Supabase JWTs.
     */
    async verifySupabaseToken(token: string) {
        if (!token?.trim()) {
            this.logger.warn('verifySupabaseToken: empty token');
            return null;
        }
        try {
            this.logger.log(`Verifying Supabase token...`);
            const { data, error } = await this.supabase.auth.getUser(token);

            if (error || !data.user) {
                this.logger.warn(
                    `Supabase getUser failed: ${error?.message || 'No user returned'}`
                );
                return null;
            }

            const email = data.user.email;
            if (!email) {
                this.logger.warn('Supabase user has no email');
                return null;
            }

            const emailNorm = email.toLowerCase().trim();

            // Look up the local user by Supabase ID first (most reliable), then email
            let localUser = await this.prisma.user.findFirst({
                    where: {
                        OR: [
                            { id: data.user.id },
                            { email: emailNorm },
                        ]
                    },
                    include: {
                        dealerProfile: true,
                        contractorProfile: true,
                        financePartnerProfile: true,
                        insurancePartnerProfile: true,
                    },
                });

            const isEmailConfirmed = !!data.user.email_confirmed_at;

            if (localUser && isEmailConfirmed && !localUser.isEmailVerified) {
                try {
                    localUser = await this.prisma.user.update({
                        where: { id: localUser.id },
                        data: { isEmailVerified: true },
                        include: {
                            dealerProfile: true,
                            contractorProfile: true,
                            financePartnerProfile: true,
                            insurancePartnerProfile: true,
                        },
                    });
                    this.logger.log(`Marked email as verified for ${emailNorm}`);
                } catch (e: any) {
                    this.logger.error(`Failed to update email verification for ${emailNorm}: ${e?.message}`);
                }
            }

            // Auto-sync: if valid Supabase user but no local user, create one
            if (!localUser) {
                try {
                    const meta = (data.user.user_metadata || {}) as Record<string, string>;
                    const role =
                        meta?.role && Object.values(UserRole).includes(meta.role as UserRole)
                            ? (meta.role as UserRole)
                            : UserRole.BUYER;
                    localUser = await this.prisma.user.upsert({
                            where: { email: emailNorm },
                            update: {
                                id: data.user.id,
                                firstName: meta.first_name ?? meta.firstName ?? undefined,
                                lastName: meta.last_name ?? meta.lastName ?? undefined,
                                ...(role && { role }),
                            },
                            create: {
                                id: data.user.id,
                                email: emailNorm,
                                firstName: meta.first_name ?? meta.firstName ?? null,
                                lastName: meta.last_name ?? meta.lastName ?? null,
                                role,
                                passwordHash: 'SUPABASE_EXTERNAL_AUTH',
                                isEmailVerified: isEmailConfirmed,
                            },
                            include: {
                                dealerProfile: true,
                                contractorProfile: true,
                                financePartnerProfile: true,
                                insurancePartnerProfile: true,
                            },
                        });
                    this.logger.log(`Auto-synced new user from Supabase: ${email} (${data.user.id})`);
                    
                    // Process any pending dealership invitations
                    await this.processPendingInvitations(localUser);
                } catch (syncErr: any) {
                    this.logger.error(
                        `Auto-sync failed for ${email}: ${syncErr?.message || syncErr}`,
                        syncErr?.stack,
                    );
                    return null;
                }
            }

            if (localUser.deletedAt) {
                this.logger.warn(`User ${email} is marked as deleted`);
                return null;
            }

            const { passwordHash: _, ...safeUser } = localUser;
            return safeUser;
        } catch (err: any) {
            this.logger.error(`Supabase token verification error: ${err?.message}`, err?.stack);
            return null;
        }
    }
}
