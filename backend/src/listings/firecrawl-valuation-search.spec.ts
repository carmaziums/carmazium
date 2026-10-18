import { parseVerifiedAdvert, searchFirecrawlValuationMarket } from './firecrawl-valuation-search';

describe('Optional Firecrawl valuation evidence', () => {
    const vehicle = {
        make: 'Volkswagen', model: 'Golf', year: 2019, mileage: 112600,
        variant: '1.5 TSI EVO R-Line', fuelType: 'PETROL', transmission: 'MANUAL',
    };
    const approved = ['dealer.example'];
    const page = [
        '# 2019 Volkswagen Golf 1.5 TSI EVO R-Line Petrol Manual',
        'Advertised cash price for the entire vehicle: £9,324',
        'Mileage: 112,600 miles',
        '2019 VW Golf petrol hatchback. Available for sale.',
        'Full specifications: 1.5 TSI EVO, R-Line, manual.',
    ].join('\n');
    const row = { title: '2019 Volkswagen Golf 1.5 TSI EVO R-Line Petrol Manual',
        url: 'https://dealer.example/cars/abc', markdown: page };

    const response = (json: unknown, status = 200) =>
        new Response(JSON.stringify(json), {
            status, headers: { 'Content-Type': 'application/json' },
        });

    it('requires an approved source domain and page content, not snippets', () => {
        expect(parseVerifiedAdvert(vehicle, row, approved)).toEqual(expect.objectContaining({
            priceGBP: 9324, mileage: 112600,
        }));
        expect(parseVerifiedAdvert(vehicle, { ...row, markdown: undefined }, approved)).toBeNull();
        expect(parseVerifiedAdvert(vehicle, { ...row, url: 'https://dealer.example.evil.test/cars/abc' }, approved)).toBeNull();
        expect(parseVerifiedAdvert(vehicle, { ...row, url: 'http://dealer.example/cars/abc' }, approved)).toBeNull();
        expect(parseVerifiedAdvert(vehicle, { ...row,
            metadata: { sourceURL: 'https://unapproved.example/redirect', statusCode: 200 } }, approved)).toBeNull();
        expect(parseVerifiedAdvert(vehicle, { ...row,
            metadata: { sourceURL: row.url, statusCode: 404 } }, approved)).toBeNull();
    });

    it('requires numeric model identifiers, not just model family names', () => {
        const tesla = {
            make: 'Tesla', model: 'Model 3', year: 2022, mileage: 20000,
            fuelType: 'ELECTRIC', transmission: 'AUTOMATIC',
        };
        const wrong = {
            title: '2022 Tesla Model X Electric Automatic',
            url: 'https://dealer.example/cars/tesla',
            markdown: '# 2022 Tesla Model X Electric Automatic\nPrice £25,000\nMileage: 20,000 miles\nAvailable with long-range equipment.',
        };
        expect(parseVerifiedAdvert(tesla, wrong, approved)).toBeNull();
    });

    it('rejects ambiguous multi-price, missing-mileage and sold pages', () => {
        expect(parseVerifiedAdvert(vehicle, { ...row, markdown: page + '\nPrice £11,000' }, approved)).toBeNull();
        expect(parseVerifiedAdvert(vehicle, { ...row, markdown: page.replace('Mileage: 112,600 miles', 'Mileage: unknown') }, approved)).toBeNull();
        expect(parseVerifiedAdvert(vehicle, { ...row, markdown: page + '\nStatus: SOLD' }, approved)).toBeNull();
        expect(parseVerifiedAdvert(vehicle, { ...row,
            markdown: page.replace('Advertised cash price for the entire vehicle:', 'Deposit:') }, approved)).toBeNull();
    });

    it('rejects model and engine/trim mismatches', () => {
        const wrong = page.replace(/Golf/g, 'Polo');
        expect(parseVerifiedAdvert(vehicle, { ...row, markdown: wrong }, approved)).toBeNull();
        const gti = page.replace(/1\.5/g, '2.0').replace(/R-Line/g, 'GTI');
        expect(parseVerifiedAdvert(vehicle, { ...row, markdown: gti }, approved)).toBeNull();
    });

    it('makes no API calls at all without an approved domain', async () => {
        const fake = jest.fn();
        const result = await searchFirecrawlValuationMarket(vehicle, {
            apiKey: 'test-only', approvedDomains: [], fetchImpl: fake as unknown as typeof fetch,
        });
        expect(fake).not.toHaveBeenCalled();
        expect(result.comparables).toEqual([]);
    });

    it('checks balance first and refuses to spend when the account is exhausted', async () => {
        const fake = jest.fn().mockResolvedValue(response({
            success: true, data: { remainingCredits: -16 },
        }));
        const result = await searchFirecrawlValuationMarket(vehicle, {
            apiKey: 'test-only', approvedDomains: approved, fetchImpl: fake as unknown as typeof fetch,
        });
        expect(fake).toHaveBeenCalledTimes(1);
        expect(fake.mock.calls[0][0]).toBe('https://api.firecrawl.dev/v2/team/credit-usage');
        expect(result.comparables).toEqual([]);
    });

    it('allows one bounded search but uses only verified matching advert pages', async () => {
        const fake = jest.fn()
            .mockResolvedValueOnce(response({ success: true, data: { remainingCredits: 100 } }))
            .mockResolvedValueOnce(response({
                success: true,
                data: { web: [
                    row,
                    { ...row, url: 'https://dealer.example/cars/b', markdown: page.replace(/112,600/g, '30,000') },
                    { ...row, url: 'https://dealer.example/cars/c', markdown: undefined },
                    { ...row, url: 'https://dealer.example/cars/d', markdown: page.replace(/R-Line/g, 'GTI') },
                    { ...row, url: 'https://dealer.example/cars/e', markdown: page },
                ] },
            }));
        const result = await searchFirecrawlValuationMarket(vehicle, {
            apiKey: 'test-only', approvedDomains: approved,
            maxResults: 4, fetchImpl: fake as unknown as typeof fetch,
        });
        expect(fake).toHaveBeenCalledTimes(2);
        const posted = JSON.parse(fake.mock.calls[1][1].body);
        expect(posted.limit).toBe(4);
        expect(posted.includeDomains).toEqual(['dealer.example']);
        expect(posted.scrapeOptions.formats).toEqual(['markdown']);
        expect(posted.query).not.toContain('EW19CFY');
        expect(result.comparables).toHaveLength(1);
        expect(result.comparables[0].price).toBe(9324);
    });

    it('refuses to price search excerpts when scraped content is unavailable', async () => {
        const fake = jest.fn()
            .mockResolvedValueOnce(response({ success: true, data: { remainingCredits: 100 } }))
            .mockResolvedValueOnce(response({ success: true,
                data: { web: [{ title: row.title, url: row.url, description: '£9,324 112,600 miles' }] },
            }));
        const result = await searchFirecrawlValuationMarket(vehicle, {
            apiKey: 'test-only', approvedDomains: approved,
            fetchImpl: fake as unknown as typeof fetch,
        });
        expect(result.comparables).toEqual([]);
    });
});
