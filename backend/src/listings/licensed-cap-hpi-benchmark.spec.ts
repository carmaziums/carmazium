import {
    classifyLicensedBenchmarkDifference,
    fetchLicensedCapHpiBenchmark,
    parseCapHpiVrmValuationXml,
} from './licensed-cap-hpi-benchmark';

const request = {
    registration: 'RO18 YWN', make: 'Audi', model: 'A1',
    year: 2018, mileage: 106470,
};

function sampleXml(override = '') {
    return `<?xml version="1.0" encoding="utf-8"?>
<VRMValuationResponse xmlns="https://soap.cap.co.uk/vrm">
  <VRMValuationResult>
    <Success>true</Success>
    <VRMLookup><Success>true</Success><VehicleFound>true</VehicleFound>
      <CAPMan>AUDI</CAPMan><CAPMod>A1</CAPMod><CAPDer>1.4 TFSI SPORT</CAPDer>
      <RegisteredDate>2018-04-18T00:00:00</RegisteredDate></VRMLookup>
    <Valuation><Success>true</Success><Retail>8000</Retail><Clean>6300</Clean>
      <Average>5800</Average><Below>5200</Below></Valuation>
    <MileageOutOfBounds>false</MileageOutOfBounds>
    ${override}
  </VRMValuationResult>
</VRMValuationResponse>`;
}

describe('licensed CAP HPI shadow benchmark', () => {
    const config = (extra: Record<string, string> = {}) => ({
        get: (key: string) => ({
            CAP_HPI_VALUATION_ENABLED: 'true',
            CAP_HPI_INTERNAL_COMPARISON_RIGHTS_CONFIRMED: 'true',
            CAP_HPI_SUBSCRIBER_ID: 'test-id',
            CAP_HPI_PASSWORD: 'test-password',
            ...extra,
        })[key],
    });

    it('parses an authorised VRM retail/trade response as a BENCHMARK, not adverts', () => {
        const outcome = parseCapHpiVrmValuationXml(sampleXml(), request);
        expect(outcome).toMatchObject({
            status: 'AVAILABLE',
            benchmark: {
                source: 'CAP_HPI',
                evidenceType: 'LICENSED_PROVIDER_BENCHMARK',
                retail: 8000, tradeClean: 6300, tradeAverage: 5800, tradeBelow: 5200,
            },
        });
    });

    it('requires explicit contractual permission as well as a feature flag', async () => {
        const transport = jest.fn();
        const result = await fetchLicensedCapHpiBenchmark(
            request,
            { get: (key: string) => key === 'CAP_HPI_VALUATION_ENABLED' ? 'true' : undefined } as any,
            transport as any,
        );
        expect(result).toEqual({ status: 'DISABLED' });
        expect(transport).not.toHaveBeenCalled();
    });

    it('pins provider URL, uses safe timeout and never sends an arbitrary endpoint', async () => {
        const transport = jest.fn().mockResolvedValue({
            ok: true, headers: { get: () => null }, text: async () => sampleXml(),
        });
        const outcome = await fetchLicensedCapHpiBenchmark(request, config() as any, transport);
        expect(outcome.status).toBe('AVAILABLE');
        expect(transport).toHaveBeenCalledTimes(1);
        const [url, options] = transport.mock.calls[0];
        expect(url).toBe('https://soap.cap.co.uk/vrm/capvrm.asmx/VRMValuation');
        expect(options.redirect).toBe('error');
        expect(options.signal).toBeDefined();
        const posted = new URLSearchParams(options.body);
        expect(posted.get('VRM')).toBe('RO18YWN');
        expect(posted.get('Mileage')).toBe('106470');
        expect(posted.get('Password')).toBe('test-password');
    });

    it('rejects a mismatched model, derivative or year instead of trusting a generic quote', () => {
        expect(parseCapHpiVrmValuationXml(sampleXml().replace('<CAPMod>A1</CAPMod>', '<CAPMod>A3</CAPMod>'), request))
            .toEqual({ status: 'IDENTITY_MISMATCH' });
        expect(parseCapHpiVrmValuationXml(sampleXml(), { ...request, variant: 'S LINE' }))
            .toEqual({ status: 'IDENTITY_MISMATCH' });
        expect(parseCapHpiVrmValuationXml(sampleXml(), { ...request, year: 2014 }))
            .toEqual({ status: 'IDENTITY_MISMATCH' });
    });

    it('ignores malformed XML, DTD, reversed trade prices and provider failures', async () => {
        expect(parseCapHpiVrmValuationXml('<!DOCTYPE x><x/>', request).status).toBe('UNAVAILABLE');
        expect(parseCapHpiVrmValuationXml(sampleXml().replace('<Clean>6300</Clean>', '<Clean>3000</Clean>'), request).status)
            .toBe('UNAVAILABLE');
        const transport = jest.fn().mockRejectedValue(new Error('network failure with sensitive response'));
        expect(await fetchLicensedCapHpiBenchmark(request, config() as any, transport))
            .toEqual({ status: 'UNAVAILABLE' });
    });

    it('classifies large deviations for internal investigation only', () => {
        const x = parseCapHpiVrmValuationXml(sampleXml(), request);
        if (x.status !== 'AVAILABLE') throw new Error('Expected licensed fixture');
        expect(classifyLicensedBenchmarkDifference(7650, x.benchmark)).toBe('ALIGNED');
        expect(classifyLicensedBenchmarkDifference(13000, x.benchmark)).toBe('REVIEW_REQUIRED');
    });
});
