import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(configService: ConfigService) {
        const secret = configService.get<string>('SUPABASE_JWT_SECRET');
        console.log('JwtStrategy initialized. Secret loaded:', !!secret);

        // Supabase JWT secret is base64 encoded, decode it for verification
        const secretBuffer = secret ? Buffer.from(secret, 'base64') : undefined;

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: secretBuffer || secret!,
            algorithms: ['HS256'],
        });
    }

    async validate(payload: any) {
        console.log('JWT Payload:', payload);
        // Supabase JWT payload contains 'sub' (user ID) and other metadata
        if (!payload || !payload.sub) {
            console.error('Invalid token payload - missing sub');
            throw new UnauthorizedException('Invalid token payload');
        }

        // Return the user data that will be attached to the Request object
        return {
            id: payload.sub,
            email: payload.email,
            role: payload.role, // This is the role from Supabase metadata if exists
        };
    }
}
