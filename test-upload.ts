import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testUpload() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
        console.error("Missing env vars");
        return;
    }

    const supabase = createClient(url, anonKey);
    const fileName = `test-${Date.now()}.png`; 
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
        await supabase.storage.from('listings').remove([fileName]);
    }
}

testUpload();
