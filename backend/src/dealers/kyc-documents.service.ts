import {
    Injectable,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
    BadRequestException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
    assertValidPrivateDocument,
    extensionForPrivateDocumentMime,
} from '../core/private-documents';

export const DEALER_KYC_BUCKET = 'dealer-kyc-documents';

/** How long an admin or dealer may view a document before the link dies. */
const SIGNED_URL_TTL_SECONDS = 10 * 60;

/**
 * The four KYC documents, mapped to the column holding their private object
 * key and the legacy column holding the old public URL.
 */
export const KYC_DOCUMENT_FIELDS = {
    directorIdProof: { path: 'directorIdProofPath', legacy: 'directorIdProof' },
    proofOfAddress: { path: 'proofOfAddressPath', legacy: 'proofOfAddress' },
    vatProof: { path: 'vatProofPath', legacy: 'vatProof' },
    companyRegistrationProof: { path: 'companyRegistrationProofPath', legacy: 'companyRegistrationProof' },
    // Legacy bank-transfer receipt from the pre-Stripe fee. Carries bank
    // details and is still shown in admin review, so it is treated as a
    // private document even though nothing uploads new ones.
    paymentScreenshot: { path: 'paymentScreenshotPath', legacy: 'paymentScreenshot' },
} as const;

export type KycDocumentField = keyof typeof KYC_DOCUMENT_FIELDS;

export function isKycDocumentField(value: string): value is KycDocumentField {
    return Object.prototype.hasOwnProperty.call(KYC_DOCUMENT_FIELDS, value);
}

/**
 * Private storage for dealer KYC identity documents.
 *
 * These files — passports, driving licences, proof of address, VAT and
 * Companies House certificates — were uploaded by the browser straight into the
 * PUBLIC `listings` bucket, and the permanent public URL was stored on the KYC
 * row. Anyone with a link could read a customer's identity document, and no
 * server code touched the file at any point.
 *
 * Uploads now go through here: the service-role key writes to a private bucket
 * the client has no credentials for, the object key is generated server-side so
 * a caller cannot choose where their file lands or overwrite someone else's,
 * and reads are 10-minute signed URLs issued only after the caller has been
 * authorised.
 */
@Injectable()
export class KycDocumentsService {
    private readonly logger = new Logger(KycDocumentsService.name);
    private readonly supabase: SupabaseClient | null;

    constructor(private readonly prisma: PrismaService) {
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_KEY;
        if (!url || !serviceKey) {
            this.logger.error(
                'Private KYC document storage needs SUPABASE_URL and SUPABASE_SERVICE_KEY. Uploads will be refused.',
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
            throw new ServiceUnavailableException('Private KYC document storage is not configured.');
        }
        return this.supabase;
    }

    /**
     * Store one KYC document for the caller's own dealer profile.
     *
     * Returns the object key. The key is built here, never accepted from the
     * client: `<dealerProfileId>/<field>/<uuid>.<ext>` keeps one dealer's
     * documents in their own prefix and makes a collision or an overwrite of
     * another dealer's file impossible.
     */
    async storeDocument(userId: string, field: KycDocumentField, file: any): Promise<string> {
        const mime = assertValidPrivateDocument(file);

        const profile = await this.prisma.dealerProfile.findUnique({
            where: { userId },
            select: { id: true },
        });
        if (!profile) {
            throw new NotFoundException('Set up your dealer profile before uploading documents.');
        }

        const key = `${profile.id}/${field}/${randomUUID()}.${extensionForPrivateDocumentMime(mime)}`;

        const { error } = await this.storage()
            .storage
            .from(DEALER_KYC_BUCKET)
            .upload(key, file.buffer, {
                contentType: mime,
                cacheControl: 'no-store',
                upsert: false,
            });

        if (error) {
            this.logger.error(`KYC document upload failed for dealer ${profile.id}: ${error.message}`);
            throw new BadRequestException('Could not store the document. Please try again.');
        }

        // Attach every upload to a KYC row immediately. First-time applicants
        // upload documents before they press the final submit button, so simply
        // storing the object without a row left the file orphaned and invisible
        // to reviewers. A minimal unpaid draft is safe because admin review only
        // surfaces applications after the Stripe verification fee is confirmed.
        const kyc = await this.prisma.dealerKyc.findUnique({
            where: { dealerProfileId: profile.id },
            select: { id: true },
        });
        const column = KYC_DOCUMENT_FIELDS[field].path;
        if (kyc) {
            await this.prisma.dealerKyc.update({
                where: { id: kyc.id },
                data: { [column]: key } as any,
            });
        } else {
            await this.prisma.dealerKyc.create({
                data: {
                    dealerProfileId: profile.id,
                    companyHouseName: '',
                    representativeName: '',
                    representativePosition: '',
                    vatNumber: '',
                    companyRegistrationNumber: '',
                    personOfSignificantControl: '',
                    directorName: '',
                    businessWebsite: '',
                    businessRegisteredAddress: '',
                    documentStatuses: {
                        [field]: { status: 'PENDING', note: '' },
                    },
                    [column]: key,
                } as any,
            });
        }

        this.logger.log(`Stored private KYC ${field} for dealer ${profile.id}`);
        return key;
    }

    /** A short-lived read URL, or null if the object cannot be signed. */
    async signPath(path: string | null | undefined): Promise<string | null> {
        if (!path) return null;
        const { data, error } = await this.storage()
            .storage
            .from(DEALER_KYC_BUCKET)
            .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
        if (error || !data?.signedUrl) {
            this.logger.warn(`Could not sign private KYC document ${path}: ${error?.message || 'no URL returned'}`);
            return null;
        }
        return data.signedUrl;
    }

    /**
     * Replace stored object keys with viewable URLs on a KYC record.
     *
     * Each field resolves to a signed URL when a private key exists, otherwise
     * the legacy public URL so records predating this change still open. The
     * `*Path` columns are stripped from the response — an internal storage key
     * is not something an API should hand out.
     */
    async hydrateDocuments<T extends Record<string, any>>(kyc: T | null): Promise<T | null> {
        if (!kyc) return kyc;

        const out: Record<string, any> = { ...kyc };
        for (const [field, columns] of Object.entries(KYC_DOCUMENT_FIELDS)) {
            const key = kyc[columns.path];
            if (key) {
                out[field] = await this.signPath(key);
                out[`${field}IsPrivate`] = true;
            } else {
                out[`${field}IsPrivate`] = false;
            }
            delete out[columns.path];
        }
        return out as T;
    }
}
