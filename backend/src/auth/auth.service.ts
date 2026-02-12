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

    /**
     * Register a new user account.
     * Hashes the password with bcrypt and creates the user record.
     */
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
        try {
            const { data, error } = await this.supabase.auth.getUser(token);

            if (error || !data.user) {
                this.logger.warn(`Supabase token verification failed: ${error?.message || 'No user'}`);
                return null;
            }

            const email = data.user.email;
            if (!email) {
                this.logger.warn('Supabase user has no email');
                return null;
            }

            // Look up the local user by email
            const localUser = await this.prisma.user.findUnique({
                where: { email: email.toLowerCase().trim() },
                include: {
                    dealerProfile: true,
                    contractorProfile: true,
                    financePartnerProfile: true,
                    insurancePartnerProfile: true,
                },
            });

            if (!localUser || localUser.deletedAt) {
                this.logger.warn(`No local user found for Supabase email: ${email}`);
                return null;
            }

            const { passwordHash: _, ...safeUser } = localUser;
            return safeUser;
        } catch (err) {
            this.logger.error(`Supabase token verification error: ${err.message}`);
            return null;
        }
    }
}
