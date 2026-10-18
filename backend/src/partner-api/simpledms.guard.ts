import { CanActivate, ExecutionContext, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

/**
 * Dedicated, read-only partner identity. Do not accept user sessions, Supabase
 * bearer tokens or credentials used by other CarMazium APIs.
 */
@Injectable()
export class SimpleDmsGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    // A global kill switch AND a per-partner kill switch; both default to off.
    if (this.config.get<string>('PARTNER_API_ENABLED') !== 'true' ||
        this.config.get<string>('PARTNER_API_SIMPLEDMS_ENABLED') !== 'true') {
      throw new NotFoundException();
    }

    // Store only SHA-256 digests in server-side secret management. A comma-
    // separated overlap permits credential rotation without interruption.
    const hashes = (this.config.get<string>('PARTNER_API_SIMPLEDMS_KEY_SHA256') || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter((value) => /^[0-9a-f]{64}$/.test(value));

    if (hashes.length === 0) {
      // Never accidentally publish an unprotected feed after misconfiguration.
      throw new ServiceUnavailableException('Partner feed is not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const supplied = request.header('x-partner-key');
    if (!supplied || supplied.length < 32 || supplied.length > 256) {
      throw new UnauthorizedException('Invalid partner credentials');
    }

    const receivedDigest = createHash('sha256').update(supplied, 'utf8').digest();
    let valid = false;
    for (const expectedHash of hashes) {
      const expectedDigest = Buffer.from(expectedHash, 'hex');
      // Always compare fixed-length digests in constant time.
      valid = timingSafeEqual(receivedDigest, expectedDigest) || valid;
    }

    if (!valid) throw new UnauthorizedException('Invalid partner credentials');
    return true;
  }
}
