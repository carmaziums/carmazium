const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: './env' });

console.log("DB URL:", process.env.DATABASE_URL);

const prisma = new PrismaClient();

async function main() {
    console.log("Connecting...");
    const res = await prisma.listing.updateMany({
        where: { status: 'DRAFT' },
        data: { status: 'ACTIVE' }
    });
    console.log('Updated listings:', res.count);
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
