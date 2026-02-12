import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const password = 'Password123!';
    const passwordHash = await bcrypt.hash(password, 12);

    const users = [
        {
            email: 'buyer@test.com',
            role: UserRole.BUYER,
            firstName: 'John',
            lastName: 'Buyer',
        },
        {
            email: 'seller@test.com',
            role: UserRole.SELLER,
            firstName: 'Jane',
            lastName: 'Seller',
        },
        {
            email: 'dealer@test.com',
            role: UserRole.DEALER,
            firstName: 'Mike',
            lastName: 'Dealer',
            dealerProfile: {
                create: {
                    companyName: 'Mike Motors',
                    vatNumber: 'UK123456789',
                    businessAddress: '123 Car Lane, London',
                },
            },
        },
        {
            email: 'contractor@test.com',
            role: UserRole.CONTRACTOR,
            firstName: 'Bob',
            lastName: 'Builder',
            contractorProfile: {
                create: {
                    serviceTypes: ['MECHANIC', 'INSPECTION'],
                    rating: 4.8,
                    totalReviews: 12,
                    serviceArea: 'London',
                    certifications: ['Certified Mechanic'],
                },
            },
        },
        {
            email: 'finance@test.com',
            role: UserRole.FINANCE_PARTNER,
            firstName: 'Fred',
            lastName: 'Finance',
            financePartnerProfile: {
                create: {
                    partnerType: UserRole.FINANCE_PARTNER,
                    companyName: 'Fast Finance Ltd',
                    apiKey: 'finance-api-key-123',
                    callbackUrl: 'https://finance-partner.com/callback',
                },
            },
        },
        {
            email: 'insurance@test.com',
            role: UserRole.INSURANCE_PARTNER,
            firstName: 'Ian',
            lastName: 'Insurance',
            insurancePartnerProfile: {
                create: {
                    partnerType: UserRole.INSURANCE_PARTNER,
                    companyName: 'Safe Insurance Co',
                    apiKey: 'insurance-api-key-123',
                    callbackUrl: 'https://insurance-partner.com/callback',
                },
            },
        },
        {
            email: 'admin@test.com',
            role: UserRole.ADMIN,
            firstName: 'Super',
            lastName: 'Admin',
        },
    ];

    console.log('🌱 Seeding users...');

    for (const u of users) {
        const { dealerProfile, contractorProfile, financePartnerProfile, insurancePartnerProfile, ...userData } = u;

        console.log(`Processing ${u.email}...`);

        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: {},
            create: {
                ...userData,
                passwordHash,
                isEmailVerified: true,
                dealerProfile,
                contractorProfile,
                // Relations for partners are a bit tricky with upsert if specific relation structure is used
                // But let's try standard nested create
                financePartnerProfile,
                insurancePartnerProfile,
            },
        });

        console.log(`Created/Updated ${u.role}: ${u.email}`);
    }

    console.log('✅ Seeding complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
