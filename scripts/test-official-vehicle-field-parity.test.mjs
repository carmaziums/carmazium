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

test('every buyer route renders the complete shared vehicle facts and saved MOT test defects', () => {
    const webAuction = read('src/app/auctions/live/[id]/page.tsx');
    const nativeAuction = read('carmazium app/carmazium app/src/screens/vehicle/AuctionDetailScreen.tsx');
    assert.match(webAuction, /<BuyerVehicleInformation listing=\{auction\.listing as unknown as Listing\}/);
    assert.doesNotMatch(webAuction, /motHistory\.slice\(0, 8\)/);
    for (const file of [
        'src/app/vehicle/[id]/VehicleDetailPageClient.tsx',
        'src/app/buy-cars/[slug]/VehicleDetailsPageClient.tsx',
    ]) assert.match(read(file), /<BuyerVehicleInformation listing=\{listing\}/);
    for (const file of [
        'carmazium app/carmazium app/src/screens/vehicle/VehicleDetailScreen.tsx',
        'carmazium app/carmazium app/src/screens/vehicle/AuctionDetailScreen.tsx',
    ]) assert.match(read(file), /<BuyerVehicleFacts record=/);
    for (const panel of [buyerNative, buyerWeb]) {
        for (const field of [
            'motHistory', 'motTestNumber', 'odometerValue', 'odometerResultType',
            'defects', 'typeApproval', 'wheelplan', 'numberOfKeys', 'serviceHistory',
            'mechanicalIssues', 'electricalIssues', 'motExpiryDate', 'taxDueDate',
            'firstUsedDate', 'dateOfLastV5CIssued', 'officialVehicleData',
            'stolenRecovered', 'hasOutstandingFinance', 'isLegalRegisteredKeeper',
            'isDepartedSale', 'deliveryAvailable', 'deliveryPricePerMile',
            'deliveryMaxMiles', 'co2Emissions', 'markedForExport',
        ]) {
            assert.ok(panel.includes(field), 'missing buyer display mapping: ' + field);
        }
    }
    assert.match(nativeAuction, /<BuyerVehicleFacts record=\{auction\?\.listing \?\? listing\}/);
});

test('all seller-uploaded media remains buyer-accessible across retail and auction', () => {
    const nativeAuction = read('carmazium app/carmazium app/src/screens/vehicle/AuctionDetailScreen.tsx');
    const nativeRetail = read('carmazium app/carmazium app/src/screens/vehicle/VehicleDetailScreen.tsx');
    const webAuction = read('src/app/auctions/live/[id]/page.tsx');
    const webGeneric = read('src/app/vehicle/[id]/VehicleDetailPageClient.tsx');
    const webRetail = read('src/app/buy-cars/[slug]/VehicleDetailsPageClient.tsx');
    assert.match(nativeAuction, /photoGallery\.map\(\(url, index\)/);
    assert.match(nativeAuction, /setActivePhotoIndex\(index\)/);
    assert.match(nativeAuction, /auction\.listing\.videoUrls\.filter/);
    assert.match(nativeRetail, /listing\.videoUrls\.map/);
    assert.match(webGeneric, /listing\.videoUrls\.filter/);
    assert.match(webAuction, /\.videoUrls as string\[\]/);
    assert.match(webRetail, /listing\.videoUrls/);
    assert.match(nativeAuction, /listing\.images/);
    assert.match(nativeRetail, /images\.map/);
});

test('buyer fields exclude private commercial data, VIN, seller contact and relationship free text', () => {
    for (const panel of [buyerNative, buyerWeb]) {
        for (const unsafe of ['priceMin', 'priceMax', 'auctionReservePrice', 'partnerDistributionAccepted',
            'notOwnerRelationship', 'departedRelationship', 'stripeCustomerId']) {
            assert.ok(!panel.includes(unsafe), 'private field unexpectedly in public buyer panel: ' + unsafe);
        }
        assert.ok(!/\bdata\.vin\b|\blisting\.vin\b/.test(panel), 'VIN should not be revealed in buyer panel');
    }
    const vehiclePage = read('src/app/vehicle/[id]/VehicleDetailPageClient.tsx');
    assert.match(vehiclePage, /listing\.hpiReport\?\.status === 'COMPLETED'/);
    assert.doesNotMatch(vehiclePage, /listing\.badgeTier === 'PREMIUM' && \(\s*<AccordionItem title="HPI Verification"/);
});

test('simultaneously listed auction and retail copy every seller disclosure and 3D damage marker', () => {
    // Both linked-listing directions must copy these vehicle facts in the same
    // Prisma transaction without copying reserve, seller fees or statuses.
    for (const field of [
        'videoUrls', 'motHistory', 'officialVehicleData', 'features',
        'mechanicalIssues', 'electricalIssues', 'serviceHistory', 'numberOfKeys',
        'isDepartedSale', 'departedRelationship', 'notOwnerRelationship',
        'deliveryAvailable', 'deliveryPricePerMile', 'deliveryMaxMiles',
        'stolenRecovered', 'hasOutstandingFinance', 'isLegalRegisteredKeeper',
        'exteriorGrade', 'co2Emissions', 'firstUsedDate', 'dateOfLastV5CIssued',
    ]) {
        const occurrences = (listings.match(new RegExp(field + ': source\\.' + field, 'g')) || []).length;
        assert.equal(occurrences, 2, 'missing shared vehicle data in one linked channel: ' + field);
    }
    assert.equal((listings.match(/damageRecords: \{/g) || []).length >= 2, true);
    assert.equal((listings.match(/coords: d\.coords as Prisma\.InputJsonValue/g) || []).length, 2);
    assert.equal((listings.match(/damageRecords: true/g) || []).length >= 2, true);
    assert.match(listings, /linkedListingId: listingId/);
});
