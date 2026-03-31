import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

// Ensure environment variables are loaded if running outside of Nest ecosystem
const SUPER_ADMIN_EMAIL = 'carmazium.app@gmail.com';
const SUPER_ADMIN_PASS = 'C@rm@Zium322';

const supabaseUrl = process.env.SUPABASE_URL || 'https://bwtnzmevjlowwronylxm.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseKey) {
  console.error("Missing SUPABASE_SERVICE_KEY in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log('--- Wiping Out All Users (Except Super Admin) ---');

  // 1. Delete all users from Supabase Auth
  console.log('Fetching users from Supabase Auth...');
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
  
  if (usersError) {
    console.error('Failed to fetch from Supabase:', usersError);
    process.exit(1);
  }

  let adminSupabaseId: string | null = null;
  const users = usersData?.users || [];

  console.log(`Found ${users.length} users in Supabase.`);

  // Delete all users EXCEPT the super admin
  for (const user of users) {
    if (user.email === SUPER_ADMIN_EMAIL) {
      console.log(`Skipping Supabase deletion for Super Admin: ${user.email} (ID: ${user.id})`);
      adminSupabaseId = user.id;
      continue;
    }
    
    console.log(`Deleting Supabase user: ${user.email} (${user.id})`);
    const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
    if (delError) {
      console.error(`  - Failed to delete ${user.email}:`, delError.message);
    }
  }

  // If Admin doesn't exist in Supabase, create it!
  if (!adminSupabaseId) {
    console.log(`Super Admin not found in Supabase. Creating ${SUPER_ADMIN_EMAIL}...`);
    const { data: newAdmin, error: createError } = await supabase.auth.admin.createUser({
      email: SUPER_ADMIN_EMAIL,
      password: SUPER_ADMIN_PASS,
      email_confirm: true,
      user_metadata: {
        first_name: 'Super',
        last_name: 'Admin',
        role: 'ADMIN',
      }
    });
    
    if (createError || !newAdmin.user) {
      console.error('Failed to create super admin in Supabase:', createError);
      process.exit(1);
    }
    adminSupabaseId = newAdmin.user.id;
    console.log(`Created Super Admin with ID: ${adminSupabaseId}`);
  }

  // 2. Delete all other users from Prisma DB
  // Because 'User' has relations to listings, bids, profiles, wiping users with cascading deletes works if schema allows deletes!
  // BUT Prisma sometimes needs explicit deletes or `onDelete: Cascade` must be properly defined.
  // In `schema.prisma`, `User` relations to Listing/Bid etc. don't all have `onDelete: Cascade`! 
  // Wait, let's delete them by selecting all DB users that are NOT the super admin!
  
  console.log('Fetching users from local database...');
  const dbUsers = await prisma.user.findMany({
    where: { NOT: { email: SUPER_ADMIN_EMAIL } }
  });

  console.log(`Found ${dbUsers.length} users in Prisma to delete.`);

  // To be safe against foreign key constraints, let's delete related data first if needed, 
  // or use Prisma's `deleteMany` on child tables.
  console.log('Cleaning up related tables to avoid Foreign Key violations...');
  await prisma.message.deleteMany({});
  await prisma.chatRoom.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.insuranceQuote.deleteMany({});
  await prisma.financeApplication.deleteMany({});
  await prisma.serviceRequest.deleteMany({});
  await prisma.bid.deleteMany({});
  await prisma.auction.deleteMany({});
  await prisma.featuredBoost.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.offer.deleteMany({});
  await prisma.watchlistItem.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.analyticsEvent.deleteMany({});
  await prisma.sellerReview.deleteMany({});
  await prisma.listing.deleteMany({});
  await prisma.vehicle.deleteMany({});
  
  // Profiles
  await prisma.dealerStaff.deleteMany({});
  await prisma.dealerProfile.deleteMany({});
  await prisma.sellerProfile.deleteMany({});
  await prisma.contractorProfile.deleteMany({});
  await prisma.partnerProfile.deleteMany({});

  console.log('Core tables cleared. Deleting users from Database...');
  await prisma.user.deleteMany({
    where: { NOT: { email: SUPER_ADMIN_EMAIL } }
  });
  console.log('Successfully wiped old users and data from the Prisma DB.');

  // 3. Upsert Super Admin in local DB
  console.log(`Upserting Super Admin in Prisma DB...`);
  await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {
      role: 'ADMIN', // Ensure the role is ADMIN
      firstName: 'Super',
      lastName: 'Admin',
      passwordHash: 'SUPABASE_EXTERNAL_AUTH',
      isEmailVerified: true,
      deletedAt: null,
    },
    create: {
      id: adminSupabaseId,
      email: SUPER_ADMIN_EMAIL,
      role: 'ADMIN',
      firstName: 'Super',
      lastName: 'Admin',
      passwordHash: 'SUPABASE_EXTERNAL_AUTH',
      isEmailVerified: true,
    }
  });

  console.log('--- WIPE COMPLETE & SUPER ADMIN READY ---');
}

main()
  .catch((e) => {
    console.error('Wipe script failed:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
