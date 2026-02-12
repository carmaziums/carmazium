
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

// Colors for console output
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

async function request(method, path, body = null, cookie = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers['Cookie'] = cookie;

    const opts = {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
    };

    try {
        const res = await fetch(`${BASE_URL}${path}`, opts);
        const data = await res.json().catch(() => ({}));
        return { status: res.status, data, headers: res.headers };
    } catch (err) {
        log(`❌ Request failed: ${method} ${path} - ${err.message}`, colors.red);
        return { status: 0, data: null };
    }
}

async function runTests() {
    log('🚀 Starting Phase 6 Comprehensive Verification...', colors.cyan);

    // ========================================================================
    // 1. AUTHENTICATION & RBAC
    // ========================================================================
    log('\n--- 1. Authentication & RBAC ---', colors.yellow);

    // Login Admin
    log('Logging in as Admin...', colors.blue);
    const adminLogin = await request('POST', '/auth/login', { email: 'admin@test.com', password: 'Password123!' });
    const adminCookie = adminLogin.headers?.get('set-cookie');
    if (adminLogin.status === 200 || adminLogin.status === 201) log('✅ Admin Login Success', colors.green);
    else log(`❌ Admin Login Failed: ${adminLogin.status}`, colors.red);

    // Login Buyer
    log('Logging in as Buyer...', colors.blue);
    const buyerLogin = await request('POST', '/auth/login', { email: 'buyer@test.com', password: 'Password123!' });
    const buyerCookie = buyerLogin.headers?.get('set-cookie');
    if (buyerLogin.status === 200 || buyerLogin.status === 201) log('✅ Buyer Login Success', colors.green);
    else log(`❌ Buyer Login Failed: ${buyerLogin.status}`, colors.red);

    // RBAC Check: Buyer tries to access Admin Stats
    log('RBAC Check: Buyer accessing /admin/stats...', colors.blue);
    const rbacCheck = await request('GET', '/admin/stats', null, buyerCookie);
    if (rbacCheck.status === 403) log('✅ RBAC Success: Buyer denied access (403)', colors.green);
    else log(`❌ RBAC Failed: Expected 403, got ${rbacCheck.status}`, colors.red);

    // RBAC Check: Admin accessing Admin Stats
    log('RBAC Check: Admin accessing /admin/stats...', colors.blue);
    const adminCheck = await request('GET', '/admin/stats', null, adminCookie);
    if (adminCheck.status === 200) log('✅ RBAC Success: Admin granted access (200)', colors.green);
    else log(`❌ RBAC Failed: Expected 200, got ${adminCheck.status}`, colors.red);


    // ========================================================================
    // 2. LISTINGS & AUCTIONS
    // ========================================================================
    log('\n--- 2. Listings & Auctions ---', colors.yellow);

    log('Creating Listing as Seller...', colors.blue);
    const sellerLogin = await request('POST', '/auth/login', { email: 'seller@test.com', password: 'Password123!' });
    const sellerCookie = sellerLogin.headers?.get('set-cookie');

    const listingPayload = {
        title: `Verification Car ${Date.now()}`,
        price: 15000,
        listingType: 'AUCTION',
        make: 'TestMake',
        model: 'TestModel',
        year: 2023,
        mileage: 500,
        vrm: 'TESTVRM',
        images: ['http://example.com/img.jpg'],
        status: 'DRAFT' // Start as draft
    };

    const listingRes = await request('POST', '/listings', listingPayload, sellerCookie);
    const listingId = listingRes.data?.data?.id;

    if (listingRes.status === 201 && listingId) {
        log(`✅ Listing Created: ${listingId}`, colors.green);

        // Update Status
        log('Updating Status to ACTIVE...', colors.blue);
        const statusRes = await request('PATCH', `/listings/${listingId}/status`, { status: 'ACTIVE' }, sellerCookie);
        if (statusRes.status === 200) log('✅ Status Update Success', colors.green);
        else log(`❌ Status Update Failed: ${statusRes.status}`, colors.red);

        // Create Auction
        log('Creating Auction...', colors.blue);
        const auctionPayload = {
            listingId,
            startTime: new Date().toISOString(),
            endTime: new Date(Date.now() + 10000000).toISOString(),
            reservePrice: 16000,
            startingBid: 10000,
            minIncrement: 500
        };
        const auctionRes = await request('POST', '/auctions', auctionPayload, sellerCookie);
        if (auctionRes.status === 201) log('✅ Auction Created', colors.green);
        else log(`❌ Auction Creation Failed: ${auctionRes.status} - ${JSON.stringify(auctionRes.data)}`, colors.red);

    } else {
        log(`❌ Listing Creation Failed: ${listingRes.status} - ${JSON.stringify(listingRes.data)}`, colors.red);
    }

    // ========================================================================
    // 3. SERVICE REQUESTS
    // ========================================================================
    log('\n--- 3. Service Requests ---', colors.yellow);
    // Needed: Contractor ID. Let's find one via Admin
    const usersRes = await request('GET', '/admin/users?limit=100', null, adminCookie);
    const contractor = usersRes.data?.data?.find(u => u.role === 'CONTRACTOR');

    if (contractor && contractor.contractorProfile) {
        log(`Found Contractor: ${contractor.id} (Profile: ${contractor.contractorProfile.id})`, colors.blue);

        const servicePayload = {
            contractorId: contractor.contractorProfile.id,
            serviceType: 'Inspection',
            description: 'Please inspect my car',
            preferredDate: new Date().toISOString()
        };

        const serviceRes = await request('POST', '/service-requests', servicePayload, buyerCookie);
        if (serviceRes.status === 201) log('✅ Service Request Created', colors.green);
        else log(`❌ Service Request Failed: ${serviceRes.status}`, colors.red);

    } else {
        log('⚠️ No Contractor Profile found to test Service Requests', colors.magenta);
    }


    // ========================================================================
    // 4. REAL-TIME: CHAT & NOTIFICATIONS
    // ========================================================================
    log('\n--- 4. Chat & Notifications ---', colors.yellow);

    // Login another user to chat with
    const partnerLogin = await request('POST', '/auth/login', { email: 'dealer@test.com', password: 'Password123!' }); // Assuming dealer exists
    const partnerCookie = partnerLogin.headers?.get('set-cookie');
    // Get dealer profile to find ID
    const dealerProfile = await request('GET', '/auth/me', null, partnerCookie);
    const dealerId = dealerProfile.data?.data?.id;

    if (dealerId && buyerCookie) {
        // Create Room
        log('Creating Chat Room...', colors.blue);
        const roomPayload = { participantId: dealerId };
        const roomRes = await request('POST', '/chat/rooms', roomPayload, buyerCookie);
        const roomId = roomRes.data?.data?.id;

        if (roomRes.status === 201 && roomId) {
            log(`✅ Chat Room Created: ${roomId}`, colors.green);

            // Send Message
            log('Sending Message...', colors.blue);
            const msgPayload = { content: 'Hello from verification script!' };
            const msgRes = await request('POST', `/chat/rooms/${roomId}/messages`, msgPayload, buyerCookie);
            if (msgRes.status === 201) log('✅ Message Sent', colors.green);
            else log(`❌ Message Sending Failed: ${msgRes.status}`, colors.red);

            // Check Notification on Dealer side
            log('Checking Notifications for Dealer...', colors.blue);
            const notifRes = await request('GET', '/notifications/unread-count', null, partnerCookie);
            const count = notifRes.data?.data?.count;
            if (notifRes.status === 200 && typeof count === 'number') {
                log(`✅ Notification Count Retrieved: ${count}`, colors.green);
                if (count > 0) log('✅ Verified: Notification received!', colors.green);
                else log('⚠️ Warning: Notification count is 0', colors.magenta);
            } else {
                log(`❌ Notification Check Failed: ${notifRes.status}`, colors.red);
            }

        } else {
            log(`❌ Chat Room Creation Failed: ${roomRes.status}`, colors.red);
        }
    } else {
        log('⚠️ Could not setup chat test (missing users)', colors.magenta);
    }


    // ========================================================================
    // 5. PAYMENTS
    // ========================================================================
    log('\n--- 5. Payments ---', colors.yellow);

    log('Creating Payment Intent...', colors.blue);
    const paymentRes = await request('POST', '/payments/create-intent', { amount: 5000, currency: 'usd' }, buyerCookie);
    if (paymentRes.status === 201 && paymentRes.data?.data?.clientSecret) {
        log('✅ Payment Intent Created (Stub)', colors.green);
    } else {
        log(`❌ Payment Intent Failed: ${paymentRes.status}`, colors.red);
    }

    log('\n🚀 Verification Complete.', colors.cyan);
}

runTests();
