import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, SecretOrKeyProvider } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import jwkToPem from 'jwk-to-pem';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(configService: ConfigService) {
        const secret = configService.get<string>('SUPABASE_JWT_SECRET');
        const isBase64 = secret?.includes('/') || secret?.includes('+') || secret?.endsWith('=');

        console.log('JwtStrategy Init:', {
            hasSecret: !!secret,
            length: secret?.length,
            isProbablyBase64: isBase64
        });

        // Provide a secretOrKeyProvider to support both HS256 (shared secret)
        // and RS256 (Supabase-issued JWTs via JWKS). This lets the strategy
        // dynamically return the correct key for verification.
        const secretOrKeyProvider: SecretOrKeyProvider = async (request, rawJwtToken, done) => {
            try {
                const headerSegment = rawJwtToken.split('.')[0];
                const headerJson = Buffer.from(headerSegment, 'base64').toString('utf8');
                const header = JSON.parse(headerJson);
                const alg = header.alg as string | undefined;

                // HS256: use configured secret
                if (!alg || alg.toUpperCase() === 'HS256') {
                    const key = secret && isBase64 ? Buffer.from(secret, 'base64') : secret;
                    return done(null, key as any);
                }

                // For RSA/RS256 tokens, fetch Supabase JWKS and convert to PEM
                const supabaseUrl = configService.get<string>('SUPABASE_URL');
                if (!supabaseUrl) return done(new Error('Missing SUPABASE_URL'));

                const jwksUrl = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/keys`;
                const res = await fetch(jwksUrl);
                const jwks = await res.json();
                const kid = header.kid;
                const key = jwks.keys?.find((k: any) => k.kid === kid) || jwks.keys?.[0];
                if (!key) return done(new Error('JWK not found'));

                const pem = jwkToPem(key);
                return done(null, pem);
            } catch (err) {
                return done(err as Error);
            }
        };

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKeyProvider,
            algorithms: ['HS256', 'RS256'],
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
