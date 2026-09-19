import { lookup as dnsLookup } from 'dns';
import { request as httpsRequest } from 'https';
import { BlockList, isIP } from 'net';

export type ImportedListingPlatform = 'AUTOTRADER' | 'CARGURUS' | 'CARWOW';

export interface DownloadedImage {
    buffer: Buffer;
    mimeType: string;
    extension: 'jpg' | 'png' | 'webp' | 'avif' | 'heic';
    finalUrl: string;
}

const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_REDIRECTS = 3;

const blockedNetworks = new BlockList();

// IPv4 non-public, documentation, benchmark, multicast and reserved ranges.
blockedNetworks.addSubnet('0.0.0.0', 8, 'ipv4');
blockedNetworks.addSubnet('10.0.0.0', 8, 'ipv4');
blockedNetworks.addSubnet('100.64.0.0', 10, 'ipv4');
blockedNetworks.addSubnet('127.0.0.0', 8, 'ipv4');
blockedNetworks.addSubnet('169.254.0.0', 16, 'ipv4');
blockedNetworks.addSubnet('172.16.0.0', 12, 'ipv4');
blockedNetworks.addSubnet('192.0.0.0', 24, 'ipv4');
blockedNetworks.addSubnet('192.0.2.0', 24, 'ipv4');
blockedNetworks.addSubnet('192.168.0.0', 16, 'ipv4');
blockedNetworks.addSubnet('198.18.0.0', 15, 'ipv4');
blockedNetworks.addSubnet('198.51.100.0', 24, 'ipv4');
blockedNetworks.addSubnet('203.0.113.0', 24, 'ipv4');
blockedNetworks.addSubnet('224.0.0.0', 4, 'ipv4');
blockedNetworks.addSubnet('240.0.0.0', 4, 'ipv4');

// IPv6 unspecified/loopback, discard, transition, documentation, ULA,
// link-local and multicast ranges.
blockedNetworks.addAddress('::', 'ipv6');
blockedNetworks.addAddress('::1', 'ipv6');
blockedNetworks.addSubnet('100::', 64, 'ipv6');
blockedNetworks.addSubnet('2001::', 32, 'ipv6');
blockedNetworks.addSubnet('2001:db8::', 32, 'ipv6');
blockedNetworks.addSubnet('2001:10::', 28, 'ipv6');
blockedNetworks.addSubnet('2002::', 16, 'ipv6');
blockedNetworks.addSubnet('fc00::', 7, 'ipv6');
blockedNetworks.addSubnet('fe80::', 10, 'ipv6');
blockedNetworks.addSubnet('ff00::', 8, 'ipv6');

function normaliseHostname(value: string): string {
    return value.trim().toLowerCase().replace(/\.$/, '');
}

function hostMatchesSuffix(host: string, suffix: string): boolean {
    const cleanSuffix = normaliseHostname(suffix).replace(/^\*\./, '');
    return Boolean(cleanSuffix) && (host === cleanSuffix || host.endsWith(`.${cleanSuffix}`));
}

export function isBlockedNetworkAddress(address: string): boolean {
    const clean = address.trim().toLowerCase().split('%')[0];
    const family = isIP(clean);

    if (!family) return true;

    // Reject IPv4-mapped IPv6 literals outright. DNS lookups normally return
    // native IPv4 records, so there is no compatibility benefit to accepting
    // this representation and it can obscure private IPv4 destinations.
    if (family === 6 && clean.startsWith('::ffff:')) return true;

    return blockedNetworks.check(clean, family === 4 ? 'ipv4' : 'ipv6');
}

export function isAllowedImportImageHost(
    hostValue: string,
    platform: ImportedListingPlatform,
    extraAllowedHosts: string[] = [],
): boolean {
    const host = normaliseHostname(hostValue);

    const platformAllowed = (() => {
        switch (platform) {
            case 'AUTOTRADER':
                return hostMatchesSuffix(host, 'autotrader.co.uk')
                    || hostMatchesSuffix(host, 'atcdn.co.uk');
            case 'CARGURUS':
                return hostMatchesSuffix(host, 'cargurus.co.uk')
                    || hostMatchesSuffix(host, 'cargurus.com');
            case 'CARWOW':
                return hostMatchesSuffix(host, 'carwow.co.uk')
                    || /^carwow-uk(?:-wp)?-\d+\.imgix\.net$/i.test(host);
        }
    })();

    if (platformAllowed) return true;

    return extraAllowedHosts.some((allowed) => hostMatchesSuffix(host, allowed));
}

export function assertSafeImportImageUrl(
    rawUrl: string,
    platform: ImportedListingPlatform,
    extraAllowedHosts: string[] = [],
): URL {
    if (!rawUrl || rawUrl.length > 2_048) {
        throw new Error('External image URL is missing or too long');
    }

    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error('External image URL is invalid');
    }

    if (parsed.protocol !== 'https:') {
        throw new Error('External images must use HTTPS');
    }
    if (parsed.username || parsed.password) {
        throw new Error('External image URLs cannot contain credentials');
    }

    const host = normaliseHostname(parsed.hostname);
    if (!host || host === 'localhost' || host.endsWith('.local')) {
        throw new Error('External image host is not allowed');
    }

    if (isIP(host) !== 0 && isBlockedNetworkAddress(host)) {
        throw new Error('External image host resolves to a blocked network');
    }

    if (!isAllowedImportImageHost(host, platform, extraAllowedHosts)) {
        throw new Error('External image host is not approved for this marketplace');
    }

    return parsed;
}

function guardedLookup(hostname: string, options: any, callback: any): void {
    const requested = typeof options === 'number' ? { family: options } : { ...(options || {}) };

    // Resolve all addresses so a hostname with any private/reserved answer is
    // rejected rather than relying on resolver ordering.
    dnsLookup(hostname, { ...requested, all: true, verbatim: true }, (error, addresses) => {
        if (error) {
            callback(error);
            return;
        }

        if (!Array.isArray(addresses) || addresses.length === 0) {
            callback(new Error('External image host did not resolve'));
            return;
        }

        const blocked = addresses.find((entry) => isBlockedNetworkAddress(entry.address));
        if (blocked) {
            callback(new Error('External image host resolved to a blocked network'));
            return;
        }

        if (requested.all) {
            callback(null, addresses);
            return;
        }

        const first = addresses[0];
        callback(null, first.address, first.family);
    });
}

function firstHeader(value: string | string[] | undefined): string {
    return Array.isArray(value) ? (value[0] || '') : (value || '');
}

function normaliseDeclaredMime(value: string): string {
    const mime = value.split(';')[0].trim().toLowerCase();
    if (mime === 'image/jpg') return 'image/jpeg';
    if (mime === 'image/heif') return 'image/heic';
    return mime;
}

export function detectImageType(buffer: Buffer): Pick<DownloadedImage, 'mimeType' | 'extension'> | null {
    if (buffer.length >= 3
        && buffer[0] === 0xff
        && buffer[1] === 0xd8
        && buffer[2] === 0xff) {
        return { mimeType: 'image/jpeg', extension: 'jpg' };
    }

    if (buffer.length >= 8
        && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return { mimeType: 'image/png', extension: 'png' };
    }

    if (buffer.length >= 12
        && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
        && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
        return { mimeType: 'image/webp', extension: 'webp' };
    }

    if (buffer.length >= 16 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
        const brands = new Set<string>();
        for (let offset = 8; offset + 4 <= Math.min(buffer.length, 64); offset += 4) {
            brands.add(buffer.subarray(offset, offset + 4).toString('ascii').toLowerCase());
        }

        if (brands.has('avif') || brands.has('avis')) {
            return { mimeType: 'image/avif', extension: 'avif' };
        }

        const heicBrands = ['heic', 'heix', 'hevc', 'hevx', 'heif', 'heis', 'mif1', 'msf1'];
        if (heicBrands.some((brand) => brands.has(brand))) {
            return { mimeType: 'image/heic', extension: 'heic' };
        }
    }

    return null;
}

function declaredMimeMatchesDetected(declared: string, detected: string): boolean {
    const normalised = normaliseDeclaredMime(declared);
    if (normalised === detected) return true;

    return normalised === 'image/heic' && detected === 'image/heic';
}

export async function downloadExternalImage(
    rawUrl: string,
    platform: ImportedListingPlatform,
    options: {
        maxBytes?: number;
        timeoutMs?: number;
        maxRedirects?: number;
        extraAllowedHosts?: string[];
    } = {},
): Promise<DownloadedImage> {
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
    const extraAllowedHosts = options.extraAllowedHosts ?? [];

    const download = (input: string, redirects: number): Promise<DownloadedImage> => {
        const parsed = assertSafeImportImageUrl(input, platform, extraAllowedHosts);

        return new Promise((resolve, reject) => {
            const request = httpsRequest(parsed, {
                method: 'GET',
                headers: {
                    'User-Agent': 'CarMazium/1.0 image-importer',
                    'Accept': 'image/avif,image/webp,image/png,image/jpeg,image/heic,image/heif',
                    'Accept-Encoding': 'identity',
                },
                lookup: guardedLookup,
            }, (response) => {
                const status = response.statusCode ?? 0;

                if (status >= 300 && status < 400) {
                    const location = firstHeader(response.headers.location);
                    response.resume();

                    if (!location) {
                        reject(new Error('External image redirect had no destination'));
                        return;
                    }
                    if (redirects >= maxRedirects) {
                        reject(new Error('External image exceeded redirect limit'));
                        return;
                    }

                    let nextUrl: string;
                    try {
                        nextUrl = new URL(location, parsed).href;
                    } catch {
                        reject(new Error('External image redirect URL is invalid'));
                        return;
                    }

                    // The recursive call re-validates protocol, marketplace host,
                    // DNS answers, redirect count, MIME and response size.
                    resolve(download(nextUrl, redirects + 1));
                    return;
                }

                if (status < 200 || status >= 300) {
                    response.resume();
                    reject(new Error(`External image fetch failed with HTTP ${status}`));
                    return;
                }

                const declaredMime = normaliseDeclaredMime(firstHeader(response.headers['content-type']));
                const allowedDeclaredMimes = new Set([
                    'image/jpeg',
                    'image/png',
                    'image/webp',
                    'image/avif',
                    'image/heic',
                ]);
                if (!allowedDeclaredMimes.has(declaredMime)) {
                    response.resume();
                    reject(new Error('External response is not an approved image MIME type'));
                    return;
                }

                const lengthHeader = firstHeader(response.headers['content-length']);
                const declaredLength = lengthHeader ? Number(lengthHeader) : NaN;
                if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
                    response.resume();
                    reject(new Error('External image is too large'));
                    return;
                }

                const chunks: Buffer[] = [];
                let bytes = 0;
                let finished = false;

                const fail = (error: Error) => {
                    if (finished) return;
                    finished = true;
                    response.destroy();
                    reject(error);
                };

                response.on('data', (chunk: Buffer | Uint8Array) => {
                    if (finished) return;
                    const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                    bytes += bufferChunk.length;
                    if (bytes > maxBytes) {
                        fail(new Error('External image exceeded the maximum download size'));
                        return;
                    }
                    chunks.push(bufferChunk);
                });

                response.on('error', (error) => fail(error));

                response.on('end', () => {
                    if (finished) return;
                    finished = true;

                    const buffer = Buffer.concat(chunks, bytes);
                    const detected = detectImageType(buffer);
                    if (!detected) {
                        reject(new Error('External response did not contain a recognised image file'));
                        return;
                    }
                    if (!declaredMimeMatchesDetected(declaredMime, detected.mimeType)) {
                        reject(new Error('External image MIME type does not match its file contents'));
                        return;
                    }

                    resolve({
                        buffer,
                        mimeType: detected.mimeType,
                        extension: detected.extension,
                        finalUrl: parsed.href,
                    });
                });
            });

            request.setTimeout(timeoutMs, () => {
                request.destroy(new Error('External image download timed out'));
            });
            request.on('error', reject);
            request.end();
        });
    };

    return download(rawUrl, 0);
}
