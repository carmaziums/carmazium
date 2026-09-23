import {
    Injectable,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
    assertValidPrivateDocument,
    extensionForPrivateDocumentMime,
} from '../core/private-documents';

export const HANDOVER_BUCKET = 'auction-handover-documents';

/** How long an admin or the seller may view a proof before the link dies. */
const SIGNED_URL_TTL_SECONDS = 10 * 60;

/** Legacy public object path, or null when the URL is not one. */
export function legacyPublicHandoverKey(url: string | null | undefined): string | null {
    if (typeof url !== 'string') return null;
    const marker = '/storage/v1/object/public/listings/';
    const at = url.indexOf(marker);
    if (at === -1) return null;
    return decodeURIComponent(url.slice(at + marker.length).split('?')[0]) || null;
}

/**
 * Private storage for auction handover proof.
 *
 * Handover proof is the evidence a seller submits to release the £100 bonus:
 * photographs of the vehicle being handed over and, in at least one live case, a
 * signed PDF handover document carrying both parties' names and addresses. The
 * browser uploaded it straight into the PUBLIC `listings` bucket under
 * `handover/<auctionId>/`, so anyone holding a link could read it.
 *
 * PR #97 hardened the delete and enumeration policies on that bucket but left
 * public delivery in place as "temporary legacy compatibility" for shipped
 * mobile clients. This closes the web half using the same shape as dealer KYC:
 * the service-role key writes to a bucket the client has no credentials for, the
 * object key is built server-side so a caller cannot choose where their file
 * lands, and reads are 10-minute signed URLs issued after authorisation.
 *
 * The released mobile app still uploads to its own public path and still POSTs a
 * URL; that route is untouched so those users keep working. Their proof stays
 * public until the app ships an update pointing at this endpoint.
 */
@Injectable()
export class HandoverDocumentsService {
    private readonly logger = new Logger(HandoverDocumentsService.name);
    private readonly supabase: SupabaseClient | null;

    constructor(private readonly prisma: PrismaService) {
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceKey) {
            this.logger.error(
                'Private handover storage needs SUPABASE_URL and SUPABASE_SERVICE_KEY. Uploads will be refused.',
            );
            this.supabase = null;
            return;
        }
        this.supabase = createClient(url, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
    }

    private storage(): SupabaseClient {
        if (!this.supabase) {
            throw new ServiceUnavailableException('Private handover storage is not configured.');
        }
        return this.supabase;
    }

    /**
     * Store handover proof for an auction the caller sells.
     *
     * Ownership is checked here as well as in submitHandoverProof: this writes a
     * file before the submission runs, so it must not accept a file for someone
     * else's auction and leave it sitting in storage.
     */
    async storeProof(userId: string, auctionId: string, file: any): Promise<string> {
        const mime = assertValidPrivateDocument(file);

        const auction = await this.prisma.auction.findUnique({
            where: { id: auctionId },
            select: { id: true, deletedAt: true, listing: { select: { sellerId: true } } },
        });
        if (!auction || auction.deletedAt) {
            throw new NotFoundException('Auction not found');
        }
        if (auction.listing.sellerId !== userId) {
            throw new ForbiddenException('You do not own this auction');
        }

        const key = `${auctionId}/${randomUUID()}.${extensionForPrivateDocumentMime(mime)}`;

        const { error } = await this.storage()
            .storage
            .from(HANDOVER_BUCKET)
            .upload(key, file.buffer, {
                contentType: mime,
                cacheControl: 'no-store',
                upsert: false,
            });

        if (error) {
            this.logger.error(`Handover proof upload failed for auction ${auctionId}: ${error.message}`);
            throw new BadRequestException('Could not store the proof. Please try again.');
        }

        this.logger.log(`Stored private handover proof for auction ${auctionId}`);
        return key;
    }

    /** A short-lived read URL, or null if the object cannot be signed. */
    async signPath(path: string | null | undefined): Promise<string | null> {
        if (!path) return null;
        const { data, error } = await this.storage()
            .storage
            .from(HANDOVER_BUCKET)
            .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
        if (error || !data?.signedUrl) {
            this.logger.warn(`Could not sign handover proof ${path}: ${error?.message || 'no URL returned'}`);
            return null;
        }
        return data.signedUrl;
    }

    /**
     * Replace a stored object key with a viewable URL on an auction record.
     *
     * Resolves to a signed URL when a private key exists, otherwise the legacy
     * public URL so proof submitted before this change — and proof still coming
     * from released mobile clients — keeps opening in admin review. The `*Path`
     * column is stripped: an internal storage key is not something an API hands
     * out.
     */
    async hydrateProof<T extends Record<string, any>>(auction: T | null): Promise<T | null> {
        if (!auction) return auction;
        const out: Record<string, any> = { ...auction };
        const key = auction.handoverProofPath;
        if (key) {
            out.handoverProofUrl = await this.signPath(key);
            out.handoverProofIsPrivate = true;
        } else {
            out.handoverProofIsPrivate = false;
        }
        delete out.handoverProofPath;
        return out as T;
    }

    async hydrateMany<T extends Record<string, any>>(auctions: T[]): Promise<T[]> {
        return Promise.all(auctions.map((a) => this.hydrateProof(a))) as Promise<T[]>;
    }

    /**
     * Delete a denied proof from whichever bucket holds it.
     *
     * Never throws: a denial must complete even when storage is unreachable,
     * otherwise the seller cannot resubmit.
     */
    async deleteProof(privatePath: string | null | undefined, legacyUrl: string | null | undefined): Promise<void> {
        try {
            if (privatePath) {
                const { error } = await this.storage().storage.from(HANDOVER_BUCKET).remove([privatePath]);
                if (error) throw new Error(error.message);
                return;
            }
            const legacyKey = legacyPublicHandoverKey(legacyUrl);
            if (legacyKey) {
                const { error } = await this.storage().storage.from('listings').remove([legacyKey]);
                if (error) throw new Error(error.message);
            }
        } catch (e: any) {
            this.logger.error(`Could not purge denied handover proof: ${e?.message || e}`);
        }
    }
}
