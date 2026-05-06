
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSales() {
    try {
        const sales = await prisma.sale.findMany({
            include: {
                listing: true,
                seller: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });

        console.log('--- ALL SALES ---');
        console.log(JSON.stringify(sales, null, 2));

        const users = await prisma.user.findMany({
            take: 5,
            select: {
                id: true,
                email: true,
                role: true
            }
        });
        console.log('--- SAMPLE USERS ---');
        console.log(JSON.stringify(users, null, 2));

    } catch (error) {
        console.error('Error checking sales:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkSales();
