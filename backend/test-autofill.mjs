import dotenv from 'dotenv';
dotenv.config();

const dvlaKey = process.env.DVLA_API_KEY;
const motKey = process.env.MOT_API_KEY;

console.log("DVLA KEY:", !!dvlaKey);
console.log("MOT KEY:", !!motKey);

async function test(vrm) {
    console.log(`Testing VRM: ${vrm}`);
    
    // DVLA
    console.log('\n--- DVLA API ---');
    try {
        const dvlaRes = await fetch('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': dvlaKey
            },
            body: JSON.stringify({ registrationNumber: vrm })
        });
        const dvlaData = await dvlaRes.json();
        console.log(JSON.stringify(dvlaData, null, 2));
    } catch (e) {
        console.error(e);
    }

    // MOT
    console.log('\n--- MOT API ---');
    try {
        const motRes = await fetch(`https://beta.check-mot.service.gov.uk/trade/vehicles/mot-tests?registration=${vrm}`, {
            headers: {
                'x-api-key': motKey,
                'Accept': 'application/json'
            }
        });
        const motData = await motRes.json();
        console.log(JSON.stringify(motData, null, 2));
    } catch (e) {
        console.error(e);
    }
}

test('YG17YSJ');
