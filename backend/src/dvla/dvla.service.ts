import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../ai/ai.service';

// ─── DVLA VES API Response ────────────────────────────────────────────────────

export interface DvlaVehicleResponse {
    registrationNumber: string;
    make?: string;
    colour?: string;
    yearOfManufacture?: number;
    engineCapacity?: number;
    co2Emissions?: number;
    fuelType?: string;
    motStatus?: string;
    motExpiryDate?: string;
    taxStatus?: string;
    taxDueDate?: string;
    typeApproval?: string;
    wheelplan?: string;
    revenueWeight?: number;
    dateOfLastV5CIssued?: string;
    euroStatus?: string;
    realDrivingEmissions?: string;
    markedForExport?: boolean;
    firstUsedDate?: string;
    manufactureDate?: string;
    monthOfFirstRegistration?: string;
}

// ─── Mapped lookup result returned to the frontend ────────────────────────────

export interface DvlaLookupResult {
    vrm: string;
    make?: string;
    model?: string;
    colour?: string;
    primaryColour?: string;
    firstUsedDate?: string;
    year?: number;
    engineSize?: number;      // cc
    co2Emissions?: number;    // g/km
    fuelType?: string;        // mapped to our FuelType enum string
    euroStandard?: string;    // mapped to our EuroStandard enum string
    motStatus?: string;       // e.g. "Valid", "Not valid"
    motExpiryDate?: string;   // ISO date string
    taxStatus?: string;       // e.g. "Taxed", "SORN"
    taxDueDate?: string;      // ISO date string
    wheelplan?: string;       // e.g. "2 AXLE RIGID BODY"
    typeApproval?: string;    // e.g. "M1"
    revenueWeight?: number;   // kg
    markedForExport?: boolean;
    monthOfFirstRegistration?: string; // e.g. "2015-03"
    dateOfLastV5CIssued?: string;
    realDrivingEmissions?: string;
    transmission?: string;
    variant?: string;
    bodyType?: string;
    driveType?: string;
    doors?: number;
    seats?: number;
    bhp?: number;
    engineDescription?: string;
    specEnrichment?: {
        confidence: 'LOW' | 'MEDIUM' | 'HIGH';
        matchBasis: 'EXACT_REGISTRATION' | 'PROFILE_CONSENSUS' | 'NONE';
        evidenceCount: number;
        source: 'AI_LIVE_WEB';
    };
    dataSource: 'DVLA';
    motHistory?: MotTestResult[];
}

// ─── MOT History API Response ──────────────────────────────────────────────────

export interface MotTestResult {
    completedDate: string;
    testResult: 'PASSED' | 'FAILED';
    expiryDate?: string;
    odometerValue?: string;
    odometerUnit?: string;
    motTestNumber: string;
    defects?: MotTestDefect[];
}

export interface MotTestDefect {
    text: string;
    type: 'ADVISORY' | 'MINOR' | 'MAJOR' | 'DANGEROUS';
    dangerous: boolean;
}

// ─── Fuel type mapping (DVLA values → our enum) ────────────────────────────────

const DVLA_FUEL_MAP: Record<string, string> = {
    PETROL: 'PETROL',
    DIESEL: 'DIESEL',
    'ELECTRIC': 'ELECTRIC',
    'ELECTRICITY': 'ELECTRIC',
    'HYBRID ELECTRIC': 'HYBRID',
    'PLUG-IN HYBRID ELECTRIC': 'PLUGIN_HYBRID',
    'GAS/PETROL': 'PETROL',
    'GAS/DIESEL': 'DIESEL',
    'GAS BI-FUEL': 'BI_FUEL',
    'BI-FUEL': 'BI_FUEL',
    'GAS': 'NATURAL_GAS',
    'NATURAL GAS': 'NATURAL_GAS',
    'FUEL CELL ELECTRIC': 'HYDROGEN_CELL',
    'HYDROGEN': 'HYDROGEN_CELL',
};

// ─── Euro status mapping (DVLA values → our enum) ─────────────────────────────

function isPlausibleVehicleModel(
    model?: string | null,
    make?: string | null,
    year?: number | null,
): boolean {
    const normalizedModel = (model ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
    const normalizedMake = (make ?? '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

    if (!normalizedModel || normalizedModel.length < 2) return false;
    if (normalizedMake && normalizedModel === normalizedMake) return false;
    if (year && normalizedModel === String(year)) return false;

    return true;
}

const DVLA_EURO_MAP: Record<string, string> = {
    EURO4: 'EURO_4',
    EURO5: 'EURO_5',
    EURO6: 'EURO_6',
    EURO6D: 'EURO_6D',
    'EURO 4': 'EURO_4',
    'EURO 5': 'EURO_5',
    'EURO 6': 'EURO_6',
    'EURO 6D': 'EURO_6D',
    'EURO 6 DT': 'EURO_6D',
    'EURO 6 D-TEMP': 'EURO_6D',
    'EURO 6 AD': 'EURO_6D',
    'EURO 6 D': 'EURO_6D',
    'EURO 6D-TEMP': 'EURO_6D',
    'EURO 6D TEMP': 'EURO_6D',
};

// ─── Endpoint ─────────────────────────────────────────────────────────────────

const DVLA_PROD_URL = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';

@Injectable()
export class DvlaService {
    private readonly logger = new Logger(DvlaService.name);
    private readonly apiKey: string | undefined;
    private readonly baseUrl: string;
    private readonly dvlaTimeoutMs: number;
    private readonly motTimeoutMs: number;
    private readonly aiSyncTimeoutMs: number;
    private readonly aiOptionalTimeoutMs: number;
    // Short-lived same-process cache is only for the separate optional AI call.
    private readonly coreCache = new Map<string, { value: DvlaLookupResult; expiresAt: number }>();
    private motTokenCache: { token: string; expiresAt: number } | null = null;
    private motTokenInFlight: Promise<string> | null = null;

    private async withDeadline<T>(
        name: string,
        timeoutMs: number,
        task: (signal: AbortSignal) => Promise<T>,
    ): Promise<T> {
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            return await Promise.race([
                task(controller.signal),
                new Promise<never>((_, reject) => {
                    timer = setTimeout(() => {
                        controller.abort();
                        reject(new Error(name + ' deadline exceeded'));
                    }, timeoutMs);
                }),
            ]);
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    constructor(
        private configService: ConfigService,
        private readonly aiService: AiService,
    ) {
        this.apiKey = this.configService.get<string>('DVLA_API_KEY');
        this.baseUrl = this.configService.get<string>('DVLA_API_URL') ?? DVLA_PROD_URL;
        const budget = (name: string, fallback: number, ceiling: number) => {
            const configured = Number(this.configService.get<string>(name));
            return Number.isFinite(configured) && configured >= 20
                ? Math.min(configured, ceiling) : fallback;
        };
        this.dvlaTimeoutMs = budget('DVLA_CORE_TIMEOUT_MS', 8_000, 15_000);
        this.motTimeoutMs = budget('DVLA_MOT_TIMEOUT_MS', 2_500, 6_000);
        this.aiSyncTimeoutMs = budget('DVLA_SYNC_AI_TIMEOUT_MS', 3_000, 6_000);
        this.aiOptionalTimeoutMs = budget('DVLA_OPTIONAL_AI_TIMEOUT_MS', 18_000, 22_000);

        if (!this.apiKey) {
            this.logger.warn('DVLA_API_KEY is not set — VRM lookups will fail');
        }
        this.logger.log(`DVLA endpoint: ${this.baseUrl}`);
    }

    // ─── Public entry point ───────────────────────────────────────────────────

    async lookupVrm(vrm: string, allowAiEnrichment = false): Promise<DvlaLookupResult> {
        const normalised = vrm.replace(/\s+/g, '').toUpperCase();

        if (!/^[A-Z0-9]{2,7}$/.test(normalised)) {
            throw new BadRequestException(`Invalid UK registration number: "${vrm}"`);
        }

        if (!this.apiKey) {
            throw new ServiceUnavailableException(
                'DVLA API key is not configured. Please contact the administrator.',
            );
        }

        const cached = this.coreCache.get(normalised);
        if (cached && cached.expiresAt > Date.now()) {
            const core = { ...cached.value, motHistory: cached.value.motHistory?.slice() };
            return allowAiEnrichment
                ? this.enrichCore(normalised, core, this.aiSyncTimeoutMs)
                : core;
        }
        // Optional MOT can stall independently, but never longer than its
        // own 2.5-second budget. The core DVLA request has an 8-second cap.
        const [dvlaResult, motResult] = await Promise.allSettled([
            this.dvlaWithRetry(normalised),
            this.motApiRequest(normalised),
        ]);

        if (dvlaResult.status === 'rejected') {
            throw dvlaResult.reason;
        }

        const combined = dvlaResult.value;
        if (motResult.status === 'fulfilled' && motResult.value) {
            combined.motHistory = motResult.value.motTests;
            if (isPlausibleVehicleModel(
                motResult.value.model,
                combined.make,
                combined.year,
            )) {
                combined.model = motResult.value.model;
            } else if (motResult.value.model) {
                this.logger.warn(
                    `Ignoring implausible MOT model "${motResult.value.model}" for ${combined.make ?? 'unknown make'} ${combined.year ?? ''}`,
                );
            }
            if (motResult.value.primaryColour) combined.primaryColour = motResult.value.primaryColour;
            if (motResult.value.firstUsedDate) combined.firstUsedDate = motResult.value.firstUsedDate;
        }

        // Only authoritative DVLA/MOT facts are cached, not AI output.
        if (this.coreCache.size >= 200) this.coreCache.clear();
        this.coreCache.set(normalised, {
            value: { ...combined, motHistory: combined.motHistory?.slice() },
            expiresAt: Date.now() + (combined.model ? 2 * 60_000 : 20_000),
        });
        return allowAiEnrichment
            ? this.enrichCore(normalised, { ...combined }, this.aiSyncTimeoutMs)
            : combined;
    }

    /** Dedicated, explicit-consent optional enrichment; core lookup does not wait for it. */
    async enrichVrm(vrm: string, consent = false): Promise<DvlaLookupResult> {
        if (!consent) throw new BadRequestException('Explicit AI data sharing consent is required');
        const core = await this.lookupVrm(vrm, false);
        return this.enrichCore(vrm.replace(/\s+/g, '').toUpperCase(), core, this.aiOptionalTimeoutMs);
    }

    private async enrichCore(
        normalised: string, combined: DvlaLookupResult, timeoutMs: number,
    ): Promise<DvlaLookupResult> {
        const enrichment = await this.withDeadline(
            'Optional live vehicle specification',
            timeoutMs,
            () => this.aiService.enrichVehicleSpecification({
                vrm: normalised,
                make: combined.make,
                model: combined.model,
                year: combined.year,
                engineSize: combined.engineSize,
                fuelType: combined.fuelType,
                colour: combined.primaryColour || combined.colour,
                firstUsedDate: combined.firstUsedDate,
            }),
        ).catch(error => {
            this.logger.warn('Optional specification enrichment unavailable: ' + (error?.message ?? 'unknown'));
            return null;
        });

        if (enrichment) {
            combined.specEnrichment = {
                confidence: enrichment.confidence,
                matchBasis: enrichment.matchBasis,
                evidenceCount: enrichment.evidenceCount,
                source: 'AI_LIVE_WEB',
            };

            const exactHighConfidence =
                enrichment.matchBasis === 'EXACT_REGISTRATION'
                && enrichment.confidence === 'HIGH'
                && enrichment.evidenceCount >= 1;

            const strongProfileConsensus =
                enrichment.matchBasis === 'PROFILE_CONSENSUS'
                && ['MEDIUM', 'HIGH'].includes(enrichment.confidence)
                && enrichment.evidenceCount >= 2;

            if (exactHighConfidence && enrichment.variant) {
                combined.variant = enrichment.variant;
            }

            if (exactHighConfidence || strongProfileConsensus) {
                if (!combined.transmission && enrichment.transmission) {
                    combined.transmission = enrichment.transmission;
                }
                if (enrichment.bodyType) combined.bodyType = enrichment.bodyType;
                if (enrichment.driveType) combined.driveType = enrichment.driveType;
                if (enrichment.doors != null) combined.doors = enrichment.doors;
                if (enrichment.seats != null) combined.seats = enrichment.seats;
                if (enrichment.bhp != null) combined.bhp = enrichment.bhp;
                if (enrichment.engineDescription) {
                    combined.engineDescription = enrichment.engineDescription;
                }
            }
        }

        return combined;
    }

    /**
     * DVLA's POST /vehicles endpoint only reads vehicle information, so one
     * transient transport retry is safe. Never repeat invalid registrations,
     * permission/configuration errors or arbitrary application mutations.
     */
    private async dvlaWithRetry(vrm: string): Promise<DvlaLookupResult> {
        try {
            return await this.dvlaRequest(vrm);
        } catch (error) {
            if (!(error instanceof ServiceUnavailableException)) throw error;
            const message = error.message || '';
            if (/DVLA API returned (400|401|403|404|422)\b/.test(message)) throw error;
            this.logger.warn('DVLA temporary upstream failure; retrying lookup once');
            await new Promise(resolve => setTimeout(resolve, 250));
            return this.dvlaRequest(vrm);
        }
    }

    // ─── DVLA REST request ────────────────────────────────────────────────────

    private async dvlaRequest(normalised: string): Promise<DvlaLookupResult> {
        this.logger.log(`DVLA lookup for VRM: ${normalised}`);

        return this.withDeadline('DVLA VES', this.dvlaTimeoutMs, async signal => {
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            signal,
            headers: {
                'x-api-key': this.apiKey!,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ registrationNumber: normalised }),
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new BadRequestException(
                    `Vehicle not found for registration: ${normalised}. Please check the number and try again.`,
                );
            }
            const text = await response.text().catch(() => '');
            this.logger.error(`DVLA API error ${response.status}: ${text}`);
            throw new ServiceUnavailableException(`DVLA API returned ${response.status}`);
        }

        const data: DvlaVehicleResponse = await response.json();

        return {
            vrm: data.registrationNumber,
            make: data.make,
            colour: data.colour,
            year: data.yearOfManufacture,
            engineSize: data.engineCapacity,
            co2Emissions: data.co2Emissions,
            fuelType: data.fuelType ? DVLA_FUEL_MAP[data.fuelType.toUpperCase()] : undefined,
            euroStandard: data.euroStatus ? DVLA_EURO_MAP[data.euroStatus.toUpperCase()] : undefined,
            motStatus: data.motStatus,
            motExpiryDate: data.motExpiryDate,
            taxStatus: data.taxStatus,
            taxDueDate: data.taxDueDate,
            wheelplan: data.wheelplan,
            typeApproval: data.typeApproval,
            revenueWeight: data.revenueWeight,
            markedForExport: data.markedForExport,
            monthOfFirstRegistration: data.monthOfFirstRegistration,
            dateOfLastV5CIssued: data.dateOfLastV5CIssued,
            realDrivingEmissions: data.realDrivingEmissions,
            transmission: (data as any).transmission,
            dataSource: 'DVLA' as const,
        };
        }).catch(error => {
            if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
            this.logger.error('DVLA transport deadline/failure: ' + (error instanceof Error ? error.message : 'unknown'));
            throw new ServiceUnavailableException('DVLA is responding slowly. Please retry your registration lookup.');
        });
    }

    // ─── Current DVSA MOT History API (v1) ────────────────────────────────────

    private hasCurrentMotCredentials(): boolean {
        return [
            'MOT_HISTORY_API_KEY', 'MOT_HISTORY_CLIENT_ID',
            'MOT_HISTORY_CLIENT_SECRET', 'MOT_HISTORY_SCOPE', 'MOT_HISTORY_TOKEN_URL',
        ].every(key => !!this.configService.get<string>(key));
    }

    private async motHistoryAccessToken(signal: AbortSignal): Promise<string> {
        const saved = this.motTokenCache;
        if (saved && saved.expiresAt > Date.now() + 60_000) return saved.token;
        if (this.motTokenInFlight) return this.motTokenInFlight;

        const tokenUrl = this.configService.get<string>('MOT_HISTORY_TOKEN_URL')!;
        if (!tokenUrl.startsWith('https://')) throw new Error('DVSA MOT token URL must use HTTPS');
        const form = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.configService.get<string>('MOT_HISTORY_CLIENT_ID')!,
            client_secret: this.configService.get<string>('MOT_HISTORY_CLIENT_SECRET')!,
            scope: this.configService.get<string>('MOT_HISTORY_SCOPE')!,
        });
        this.motTokenInFlight = (async () => {
            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: form.toString(),
                signal,
            });
            if (!response.ok) throw new Error('DVSA MOT OAuth returned HTTP ' + response.status);
            const body = await response.json() as { access_token?: string; expires_in?: number };
            if (!body.access_token || typeof body.access_token !== 'string') {
                throw new Error('DVSA MOT OAuth response did not include an access token');
            }
            const expiresIn = Number(body.expires_in);
            this.motTokenCache = {
                token: body.access_token,
                expiresAt: Date.now() + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 1200) * 1000,
            };
            return body.access_token;
        })();
        try {
            return await this.motTokenInFlight;
        } finally {
            this.motTokenInFlight = null;
        }
    }

    private async currentMotHistoryRequest(
        normalised: string,
    ): Promise<{ motTests: MotTestResult[], model?: string, primaryColour?: string, firstUsedDate?: string } | null> {
        const timeout = Number(this.configService.get<string>('MOT_HISTORY_TIMEOUT_MS'));
        const maxWait = Number.isFinite(timeout) && timeout >= 1000
            ? Math.min(timeout, 8000) : 5500;
        const baseUrl = this.configService.get<string>('MOT_HISTORY_API_URL')
            || 'https://history.mot.api.gov.uk';
        if (!baseUrl.startsWith('https://')) {
            this.logger.warn('DVSA MOT v1 URL must use HTTPS');
            return null;
        }

        try {
            // Authentication and lookup share one deadline. Never hold up
            // core registration data indefinitely while MOT is unavailable.
            return await this.withDeadline('DVSA MOT v1', maxWait, async signal => {
                const accessToken = await this.motHistoryAccessToken(signal);
                const url = baseUrl.replace(/\/$/, '')
                    + '/v1/trade/vehicles/registration/' + encodeURIComponent(normalised);
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        Authorization: 'Bearer ' + accessToken,
                        'X-API-Key': this.configService.get<string>('MOT_HISTORY_API_KEY')!,
                        Accept: 'application/json',
                    },
                    signal,
                });
                if (response.status === 404) return { motTests: [] };
                if (!response.ok) {
                    // Do not log tokens, headers, or registration details.
                    this.logger.warn('DVSA MOT v1 returned HTTP ' + response.status);
                    if (response.status === 401) this.motTokenCache = null;
                    return null;
                }
                const data = await response.json() as Record<string, unknown> | unknown[];
                const vehicle = Array.isArray(data) ? data[0] : data;
                if (!vehicle || typeof vehicle !== 'object') return { motTests: [] };
                const entry = vehicle as Record<string, unknown>;
                return {
                    motTests: Array.isArray(entry.motTests) ? entry.motTests as MotTestResult[] : [],
                    model: typeof entry.model === 'string' ? entry.model : undefined,
                    primaryColour: typeof entry.primaryColour === 'string' ? entry.primaryColour : undefined,
                    firstUsedDate: typeof entry.firstUsedDate === 'string' ? entry.firstUsedDate : undefined,
                };
            });
        } catch (error) {
            this.logger.warn('DVSA MOT v1 optional lookup unavailable: '
                + (error instanceof Error ? error.message : 'unknown'));
            return null;
        }
    }

    // Existing legacy integration is retained only for environments that have
    // not yet received DVSA v1 OAuth credentials. DVSA deprecated v6 in 2025;
    // do not treat the legacy response as guaranteed or use it for new setups.
    private async motApiRequest(
        normalised: string,
    ): Promise<{ motTests: MotTestResult[], model?: string, primaryColour?: string, firstUsedDate?: string } | null> {
        if (this.hasCurrentMotCredentials()) {
            return this.currentMotHistoryRequest(normalised);
        }

        const motApiKey = this.configService.get<string>('MOT_API_KEY');
        if (!motApiKey) {
            this.logger.warn('DVSA MOT v1 credentials missing and legacy MOT_API_KEY is not configured');
            return null;
        }
        const url = `https://beta.check-mot.service.gov.uk/trade/vehicles/mot-tests?registration=${normalised}`;
        try {
            return await this.withDeadline('MOT legacy history', this.motTimeoutMs, async signal => {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: { 'x-api-key': motApiKey, Accept: 'application/json+v6' },
                    signal,
                });
                if (response.status === 404) return { motTests: [] };
                if (!response.ok) {
                    this.logger.warn('Legacy MOT lookup returned HTTP ' + response.status);
                    return null;
                }
                const data = await response.json();
                const vehicle = Array.isArray(data) ? data[0] : null;
                return vehicle ? {
                    motTests: vehicle.motTests || [],
                    model: vehicle.model,
                    primaryColour: vehicle.primaryColour,
                    firstUsedDate: vehicle.firstUsedDate,
                } : { motTests: [] };
            });
        } catch (error) {
            this.logger.warn('Optional legacy MOT unavailable: '
                + (error instanceof Error ? error.message : 'unknown'));
            return null;
        }
    }
}
