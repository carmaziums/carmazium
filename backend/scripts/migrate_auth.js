const { createClient } = require('@supabase/supabase-js');

const OLD_URL = "https://qcqnllehtuczgammazwi.supabase.co";
const OLD_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjcW5sbGVodHVjemdhbW1hendpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcwNTE4NywiZXhwIjoyMDg1MjgxMTg3fQ.O2ZZlgwjNmx8QM0xMiAjEq4icK_3nyESS9L88W0cHss";

const NEW_URL = "https://bwtnzmevjlowwronylxm.supabase.co";
const NEW_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3dG56bWV2amxvd3dyb255bHhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTA3NTQ4NiwiZXhwIjoyMDY0NjUxNDg2fQ.80JgHOyIrQCOzlbC_O5jq_06ooGUrlXJZYlzngeo1mE";

async function migrateAuth() {
    const oldSupabase = createClient(OLD_URL, OLD_SERVICE_KEY);
    const newSupabase = createClient(NEW_URL, NEW_SERVICE_KEY);

    console.log('Fetching users from OLD project...');
    const { data: { users }, error: listError } = await oldSupabase.auth.admin.listUsers({
        perPage: 1000
    });

    if (listError) {
        console.error('Failed to list users:', listError);
        return;
    }

    console.log(`Found ${users.length} users.`);

    for (const user of users) {
        console.log(`Migrating user: ${user.email} (${user.id})...`);
        
        // We use createUser to preserve the ID
        // Note: Password cannot be migrated this way, setting a random one
        // and assuming they will use Forgot Password or their app-level login.
        const { data: newUser, error: createError } = await newSupabase.auth.admin.createUser({
            id: user.id,
            email: user.email,
            email_confirm: true,
            user_metadata: user.user_metadata,
            app_metadata: user.app_metadata
        });

        if (createError) {
            console.error(`- Failed to create user ${user.email}:`, createError.message);
        } else {
            console.log(`- Successfully recreated user ${user.email}.`);
        }
    }

    console.log('Auth migration completed.');
}

migrateAuth();
