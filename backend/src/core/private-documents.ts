import { BadRequestException } from '@nestjs/common';

/**
 * Validation shared by every private document upload.
 *
 * Deliberately its own module rather than an import from
 * services/service-operations.service.ts: that file owns TradeXchange case
 * evidence and is under active change, and dealer KYC should not be coupled to
 * it. The rules are the same because the threat is the same — a browser can
 * claim any MIME type it likes, so the bytes are checked too.
 */

export const PRIVATE_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export const PRIVATE_DOCUMENT_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
] as const;

export type PrivateDocumentMime = typeof PRIVATE_DOCUMENT_MIME_TYPES[number];

export function extensionForPrivateDocumentMime(mime: PrivateDocumentMime): string {
    if (mime === 'application/pdf') return 'pdf';
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    return 'jpg';
}

/**
 * True when the leading bytes match the declared type. A renamed `.exe` or an
 * HTML page claiming `image/png` fails here even though the MIME header and the
 * extension both looked correct.
 */
export function hasExpectedDocumentSignature(
    bytes: Uint8Array,
    mime: PrivateDocumentMime,
): boolean {
    if (mime === 'application/pdf') {
        return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
    }
    if (mime === 'image/jpeg') {
        return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }
    if (mime === 'image/png') {
        const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
        return bytes.length >= signature.length && signature.every((v, i) => bytes[i] === v);
    }
    if (mime === 'image/webp') {
        return bytes.length >= 12 &&
            String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
            String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
    }
    return false;
}

/**
 * Validates an uploaded file and returns its confirmed MIME type.
 *
 * Checks name, declared MIME, size, that the received buffer is the full file,
 * that the extension agrees with the MIME, and finally the magic bytes.
 */
export function assertValidPrivateDocument(file: any): PrivateDocumentMime {
    const name = typeof file?.originalname === 'string' ? file.originalname.trim() : '';
    const mime = typeof file?.mimetype === 'string' ? file.mimetype.toLowerCase() : '';
    const size = Number(file?.size || 0);
    const buffer: Buffer | undefined = file?.buffer;

    if (!name || name.length > 255) {
        throw new BadRequestException('Document name is invalid.');
    }
    if (!PRIVATE_DOCUMENT_MIME_TYPES.includes(mime as PrivateDocumentMime)) {
        throw new BadRequestException('Only PDF, JPEG, PNG and WebP documents are allowed.');
    }
    if (!Number.isInteger(size) || size < 1 || size > PRIVATE_DOCUMENT_MAX_BYTES) {
        throw new BadRequestException('Documents must be 10 MB or smaller.');
    }
    if (!buffer || buffer.length !== size) {
        throw new BadRequestException('Uploaded document data is incomplete.');
    }

    const allowed = mime as PrivateDocumentMime;
    const expected = extensionForPrivateDocumentMime(allowed);
    const supplied = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
    const extensionMatches = allowed === 'image/jpeg'
        ? supplied === 'jpg' || supplied === 'jpeg'
        : supplied === expected;
    if (!extensionMatches) {
        throw new BadRequestException('Document extension does not match its file type.');
    }

    if (!hasExpectedDocumentSignature(new Uint8Array(buffer.subarray(0, 16)), allowed)) {
        throw new BadRequestException('Uploaded file content does not match its declared type.');
    }

    return allowed;
}
