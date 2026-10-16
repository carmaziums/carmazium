import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

const backend = read('backend/src/dvla/dvla.service.ts');
const schema = read('backend/prisma/schema.prisma');
const dto = read('backend/src/listings/dto/create-listing.dto.ts');
const listings = read('backend/src/listings/listings.service.ts');
const webLanding = read('src/app/sell/page.tsx');
const webWizard = read('src/components/listing/ListingWizard.tsx');
const webHandoff = read('src/lib/pendingSellerHandoff.ts');
const nativeLanding = read('carmazium app/carmazium app/src/screens/sell/SellLandingScreen.tsx');
const nativeWizard = read('carmazium app/carmazium app/src/screens/sell/SellCarFlowScreen.tsx');
const nativeNav = read('carmazium app/carmazium app/src/navigation/MainStackNavigator.tsx');
const buyerWeb = read('src/components/listing/BuyerVehicleInformation.tsx');
const buyerNative = read('carmazium app/carmazium app/src/components/BuyerVehicleFacts.tsx');
const admin = read('backend/src/admin/admin.service.ts');

test('optional official data is stored, validated and inherited when the car is in both channels', () => {
    assert.match(schema, /officialVehicleData\s+Json\?/);
    assert.match(dto, /officialVehicleData\?: OfficialVehicleData/);
    assert.equal((listings.match(/officialVehicleData: source\.officialVehicleData \?\? undefined/g) || []).length, 2);
    assert.match(listings, /officialVehicleData: normalizeOfficialVehicleData\(createListingDto\.officialVehicleData\)/);
    assert.match(listings, /mergeOfficialVehicleData\(listing\.officialVehicleData/);
    assert.match(admin, /mergeOfficialVehicleData\(current\.officialVehicleData, official\.officialVehicleData\)/);
});

test('both APIs retain their supplementary vehicle metadata and original MOT failure reasons', () => {
    for (const name of ['monthOfFirstDvlaRegistration', 'artEndDate', 'revenueWeight',
        'realDrivingEmissions', 'automatedVehicle', 'registrationDate', 'manufactureDate',
        'secondaryColour', 'lastMotTestDate', 'motTestDueDate', 'odometerResultType']) {
        assert.ok(backend.includes(name), name);
    }
    assert.match(backend, /typeof d\.type === 'string'/);
});

test('vehicle facts survive the entire website and native seller workflows', () => {
    for (const item of [webLanding, webWizard, webHandoff, nativeLanding, nativeWizard, nativeNav]) {
        assert.ok(item.includes('officialVehicleData'));
    }
    assert.match(webWizard, /r\.co2Emissions != null/);
    assert.match(webLanding, /vehicle\.co2Emissions != null/);
    assert.match(nativeWizard, /data\.co2Emissions != null/);
    assert.match(webWizard, /r\.colour \|\| r\.primaryColour/);
    assert.match(nativeWizard, /data\.colour \|\| data\.primaryColour/);
    assert.match(nativeWizard, /markedForExport \?\? undefined/);
    assert.match(webHandoff, /vehicle\.motHistory\.slice\(0, 100\)/);
});

test('both public website pages and both native buyer pages show only saved valid facts', () => {
    assert.match(buyerWeb, /official\?\.dvla\?\.revenueWeight/);
    assert.match(buyerWeb, /official\?\.mot\?\.registrationDate/);
    assert.match(buyerNative, /official\?\.dvla\?\.revenueWeight/);
    assert.match(buyerNative, /official\?\.mot\?\.registrationDate/);
    assert.match(read('src/app/vehicle/[id]/VehicleDetailPageClient.tsx'), /BuyerVehicleInformation/);
    assert.match(read('src/app/buy-cars/[slug]/VehicleDetailsPageClient.tsx'), /BuyerVehicleInformation/);
    assert.match(read('carmazium app/carmazium app/src/screens/vehicle/VehicleDetailScreen.tsx'), /BuyerVehicleFacts/);
    assert.match(read('carmazium app/carmazium app/src/screens/vehicle/AuctionDetailScreen.tsx'), /BuyerVehicleFacts/);
});
