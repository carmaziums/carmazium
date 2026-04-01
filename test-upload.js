const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback

async function testUpload() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
        console.error("Missing env vars");
        return;
    }

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(url, anonKey);

    // Create a dummy text file instead of an image
    const fileName = `test-${Date.now()}.png`; // pretend it's a png
    const fileBody = "dummy data for image";

    console.log("Attempting upload to Supabase...");
    const { data, error } = await supabase.storage.from('listings').upload(fileName, fileBody, {
        contentType: 'image/png',
        upsert: false
    });

    if (error) {
        console.error("SDK Upload Error:", error);
    } else {
        console.log("SDK Upload Success:", data);
        
        // Clean up
        await supabase.storage.from('listings').remove([fileName]);
    }
}

testUpload();
