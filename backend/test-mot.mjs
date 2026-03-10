async function test() {
    const vrm = 'YG17YSJ';
    const motKey = 'TVwxombXLI1vo4pV11hcCaqfVm4yAxVk24IoQuuP';
    
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
test();
