const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const OLD_URL = "https://qcqnllehtuczgammazwi.supabase.co";
const OLD_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjcW5sbGVodHVjemdhbW1hendpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcwNTE4NywiZXhwIjoyMDg1MjgxMTg3fQ.O2ZZlgwjNmx8QM0xMiAjEq4icK_3nyESS9L88W0cHss";

const NEW_URL = "https://bwtnzmevjlowwronylxm.supabase.co";
const NEW_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3dG56bWV2amxvd3dyb255bHhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTA3NTQ4NiwiZXhwIjoyMDY0NjUxNDg2fQ.80JgHOyIrQCOzlbC_O5jq_06ooGUrlXJZYlzngeo1mE";

const NEW_DB_URL = "postgresql://postgres:EcJXUwPUSpRE5OR7@db.bwtnzmevjlowwronylxm.supabase.co:5432/postgres";

const BUCKETS = ['listings'];

async function ensureBucketExists(newSupabase, bucketName) {
    const { data, error } = await newSupabase.storage.getBucket(bucketName);
    if (error) {
        if (error.message.includes('not found')) {
            console.log(`- Bucket ${bucketName} not found. Creating it...`);
            const { error: createError } = await newSupabase.storage.createBucket(bucketName, {
                public: true,
                allowedMimeTypes: ['image/*'],
                fileSizeLimit: 5242880 // 5MB
            });
            if (createError) {
                console.error(`- Failed to create bucket ${bucketName}:`, createError.message);
                return false;
            }
            console.log(`- Successfully created bucket ${bucketName}.`);
            return true;
        }
        console.error(`- Error checking bucket ${bucketName}:`, error.message);
        return false;
    }
    return true;
}

async function migrateStorage() {
    const oldSupabase = createClient(OLD_URL, OLD_SERVICE_KEY);
    const newSupabase = createClient(NEW_URL, NEW_SERVICE_KEY);

    for (const bucketName of BUCKETS) {
        console.log(`Migrating bucket: ${bucketName}...`);
        
        const exists = await ensureBucketExists(newSupabase, bucketName);
        if (!exists) continue;
        
        // List objects in old
        const { data: objects, error: listError } = await oldSupabase.storage.from(bucketName).list('', { limit: 1000 });
        if (listError) {
            console.error(`- Failed to list objects in ${bucketName}:`, listError.message);
            continue;
        }

        console.log(`- Found ${objects.length} objects.`);

        for (const obj of objects) {
            if (obj.name === '.emptyFolderPlaceholder') continue;
            console.log(`- Migrating object: ${obj.name}...`);
            
            // Download from old
            const { data: blob, error: downloadError } = await oldSupabase.storage.from(bucketName).download(obj.name);
            if (downloadError) {
                console.error(`  - Failed to download ${obj.name}:`, downloadError.message);
                continue;
            }

            // Upload to new
            const { error: uploadError } = await newSupabase.storage.from(bucketName).upload(obj.name, blob, {
                upsert: true,
                contentType: blob.type
            });

            if (uploadError) {
                console.error(`  - Failed to upload ${obj.name}:`, uploadError.message);
            } else {
                console.log(`  - Successfully migrated ${obj.name}.`);
            }
        }
    }

    // Now update database references from qcqnllehtuczgammazwi to bwtnzmevjlowwronylxm
    const pgClient = new Client({ connectionString: NEW_DB_URL, ssl: { rejectUnauthorized: false } });
    try {
        await pgClient.connect();
        console.log('Updating absolute image URLs in the listings table...');
        
        const oldRef = "qcqnllehtuczgammazwi";
        const newRef = "bwtnzmevjlowwronylxm";

        // This replaces the old project ref with the new one in the 'images' array column
        const updateQuery = `
            UPDATE listings 
            SET images = array_replace(
                CAST(images AS text[]), 
                CAST(regexp_replace(unnest(images), '${oldRef}', '${newRef}', 'g') AS text)
            )
            WHERE images::text LIKE '%${oldRef}%'
        `;
        // Wait, array_replace is tricky. Better to fetch and update if needed, but let's try a simpler regex
        const res = await pgClient.query(`
            UPDATE listings 
            SET images = ARRAY(
                SELECT regexp_replace(img, '${oldRef}', '${newRef}', 'g')
                FROM unnest(images) AS img
            )
            WHERE array_to_string(images, ',') LIKE '%${oldRef}%'
        `);
        console.log(`- Updated ${res.rowCount} listings with new image URLs.`);
    } catch (e) {
        console.error('Failed to update DB URLs:', e);
    } finally {
        await pgClient.end();
    }

    console.log('Storage migration completed.');
}

migrateStorage();
