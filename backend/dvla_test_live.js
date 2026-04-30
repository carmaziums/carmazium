const VRM = 'MC21PJJ';
const DVLA_API_KEY = 'lnOlOZgw0L6t9FLJh1hr4aEK3twDXAAq7h4lflhB';
const MOT_API_KEY = 'TVwxombXLI1vo4pV11hcCaqfVm4yAxVk24IoQuuP';

async function testDVLA() {
    console.log('\n=== DVLA VES API ===');
    const res = await fetch('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles', {
        method: 'POST',
        headers: {
            'x-api-key': DVLA_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ registrationNumber: VRM }),
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Raw DVLA response:');
    console.log(JSON.stringify(data, null, 2));
    return data;
}

async function testMOT() {
    console.log('\n=== MOT History API ===');
    const res = await fetch(`https://beta.check-mot.service.gov.uk/trade/vehicles/mot-tests?registration=${VRM}`, {
        method: 'GET',
        headers: {
            'x-api-key': MOT_API_KEY,
            'Accept': 'application/json+v6',
        },
    });
    console.log('Status:', res.status);
    if (!res.ok) {
        const text = await res.text();
        console.log('Error:', text);
        return null;
    }
    const data = await res.json();
    console.log('Raw MOT response:');
    console.log(JSON.stringify(data, null, 2));
    return data;
}

(async () => {
    try {
        await testDVLA();
    } catch (e) {
        console.error('DVLA error:', e.message);
    }
    try {
        await testMOT();
    } catch (e) {
        console.error('MOT error:', e.message);
    }
})();
