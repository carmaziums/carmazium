import { Controller, Get, Header } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { makeSearchWhere } from './model-search';

const MAKES = ['Abarth', 'Alfa Romeo', 'Audi', 'Bentley', 'BMW', 'Chevrolet', 'Citroën', 'Cupra', 'Dacia', 'DS', 'Fiat', 'Ford', 'Honda', 'Hyundai', 'Infiniti', 'Jaguar', 'Jeep', 'Kia', 'Land Rover', 'Lexus', 'Mazda', 'Mercedes-Benz', 'MG', 'MINI', 'Mitsubishi', 'Nissan', 'Peugeot', 'Porsche', 'Renault', 'SEAT', 'Škoda', 'Smart', 'SsangYong', 'Subaru', 'Suzuki', 'Tesla', 'Toyota', 'Vauxhall', 'Volkswagen', 'Volvo'];
const LOCATIONS = ['Birmingham', 'Manchester', 'London', 'Leeds', 'Liverpool', 'Bristol', 'Sheffield', 'Nottingham', 'Leicester', 'Coventry', 'Wolverhampton', 'Bradford', 'Cardiff', 'Edinburgh', 'Glasgow', 'Newcastle', 'Southampton', 'Derby', 'Worcester', 'Walsall'];
export const collectionSlug = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

@Controller('retail-catalogue')
export class RetailCollectionsController {
    constructor(private readonly prisma: PrismaService) {}
    @Get('collections') @Header('Cache-Control', 'public, max-age=300')
    async collections() {
        // Only aggregate fields are returned. This endpoint cannot expose seller
        // contact details or unpublished stock and does not fetch photo arrays.
        const rows = await this.prisma.listing.groupBy({ by: ['make', 'location'],
            where: { type: 'CLASSIFIED', status: 'ACTIVE', deletedAt: null, vehicleType: 'CAR', OR: [{ bodyType: null }, { bodyType: { notIn: ['CARAVAN', 'CAMPERVAN'] } }] }, _count: { _all: true } });
        return { data: {
            makes: MAKES.map(label => { const aliases = makeSearchWhere(label).OR.map(x => x.make.equals.toLowerCase()); return { slug: collectionSlug(label), label, count: rows.reduce((n, row) => n + (aliases.includes((row.make || '').toLowerCase()) ? row._count._all : 0), 0) }; }),
            locations: LOCATIONS.map(label => ({ slug: collectionSlug(label), label, count: rows.reduce((n, row) => n + ((row.location || '').toLowerCase().includes(label.toLowerCase()) ? row._count._all : 0), 0) })),
        } };
    }
}
