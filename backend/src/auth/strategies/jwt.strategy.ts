import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, SecretOrKeyProvider } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import jwkToPem from 'jwk-to-pem';

// Cache for JWKS to avoid fetching on every request
interface JwksCache {
    keys: any[];
    fetchedAt: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    private static jwksCache: JwksCache | null = null;
    private static readonly JWKS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
    private readonly logger = new Logger(JwtStrategy.name);

    constructor(configService: ConfigService) {
        const secret = configService.get<string>('SUPABASE_JWT_SECRET');
        const supabaseUrl = configService.get<string>('SUPABASE_URL');
        const isBase64 = secret?.includes('/') || secret?.includes('+') || secret?.endsWith('=');

        // Log initialization status for debugging
        console.log('JwtStrategy Init:', {
            hasSecret: !!secret,
            secretLength: secret?.length,
            hasSupabaseUrl: !!supabaseUrl,
            isProbablyBase64: isBase64
        });

        // Validate required configuration at startup
        if (!secret) {
            console.error('CRITICAL: SUPABASE_JWT_SECRET is not configured!');
        }

        // Provide a secretOrKeyProvider to support both HS256 (shared secret)
        // and RS256 (Supabase-issued JWTs via JWKS). This lets the strategy
        // dynamically return the correct key for verification.
        const secretOrKeyProvider: SecretOrKeyProvider = async (request, rawJwtToken, done) => {
            try {
                // Parse JWT header using proper Base64url decoding
                const headerSegment = rawJwtToken.split('.')[0];
                // Base64url: replace URL-safe chars and add padding if needed
                const base64 = headerSegment.replace(/-/g, '+').replace(/_/g, '/');
                const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
                const headerJson = Buffer.from(padded, 'base64').toString('utf8');
                const header = JSON.parse(headerJson);
                const alg = (header.alg as string)?.toUpperCase();

                console.log('JWT Header:', { alg, kid: header.kid });

                // HS256: use configured secret (Supabase default)
                if (!alg || alg === 'HS256') {
                    if (!secret) {
                        return done(new Error('SUPABASE_JWT_SECRET is not configured. Set it in environment variables.'));
                    }
                    const key = isBase64 ? Buffer.from(secret, 'base64') : secret;
                    return done(null, key as any);
                }

                // RS256/RS384/RS512: fetch JWKS from Supabase
                if (alg.startsWith('RS')) {
                    if (!supabaseUrl) {
                        return done(new Error('SUPABASE_URL is not configured. Required for RS256 token verification.'));
                    }

                    // Check cache first
                    const now = Date.now();
                    if (JwtStrategy.jwksCache && (now - JwtStrategy.jwksCache.fetchedAt) < JwtStrategy.JWKS_CACHE_TTL_MS) {
                        const cachedKey = JwtStrategy.jwksCache.keys.find((k: any) => k.kid === header.kid) || JwtStrategy.jwksCache.keys[0];
                        if (cachedKey) {
                            return done(null, jwkToPem(cachedKey));
                        }
                    }

                    // Fetch fresh JWKS
                    const jwksUrl = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/keys`;
                    console.log('Fetching JWKS from:', jwksUrl);

                    const res = await fetch(jwksUrl);
                    if (!res.ok) {
                        return done(new Error(`Failed to fetch JWKS: HTTP ${res.status} from ${jwksUrl}`));
                    }

                    const jwks = await res.json();

                    if (!jwks.keys || jwks.keys.length === 0) {
                        return done(new Error(
                            'JWKS endpoint returned empty keys. ' +
                            'If using HS256 (shared secret), ensure the JWT alg header is HS256. ' +
                            'Current token alg: ' + alg
                        ));
                    }

                    // Cache the keys
                    JwtStrategy.jwksCache = { keys: jwks.keys, fetchedAt: now };

                    const key = jwks.keys.find((k: any) => k.kid === header.kid) || jwks.keys[0];
                    const pem = jwkToPem(key);
                    return done(null, pem);
                }

                // Unsupported algorithm
                return done(new Error(`Unsupported JWT algorithm: ${alg}. Supported: HS256, RS256, RS384, RS512`));
            } catch (err) {
                console.error('JWT verification error:', err);
                return done(err as Error);
            }
        };

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKeyProvider,
            algorithms: ['HS256', 'RS256', 'RS384', 'RS512'],
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
