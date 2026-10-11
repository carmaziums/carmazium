import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DamageDetection {
  /** Stable ID of this defect, not its panel. Existing clients may omit it. */
  id?: string;
  part: string;
  type: string;
  size: string;
  coords: {
    x: number; y: number;
    view: 'FRONT' | 'SIDE' | 'REAR' | 'TOP' | 'INTERIOR';
    /** Exact position on the generic GLB box, independent of the 2D map. */
    surfacePoint?: { fx: number; fy: number; fz: number };
  };
  imageUrl: string;
}

@Injectable()
export class DamageAnalysisService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mock AI Analysis (Simulating YOLOv8)
   * In production, this would call a Python/FastAPI service.
   */
  async analyzeImages(imageUrls: string[]): Promise<DamageDetection[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2500));

    const detections: DamageDetection[] = [];

    // Predefined mockup data to show off the UI plotting capabilities
    // We only trigger detections for images that look like they might be damage photos
    // (In our case, we'll just mock 2-3 detections for the demo)
    
    const mockOptions = [
      { part: 'Front Bumper', type: 'Scratch', size: 'Small (0-5cm)', coords: { x: 45, y: 35, view: 'FRONT' } },
      { part: 'Driver Door', type: 'Scuff', size: 'Medium (6-15cm)', coords: { x: 30, y: 48, view: 'SIDE' } },
      { part: 'Rear Quarter', type: 'Dent', size: 'Large (15cm+)', coords: { x: 75, y: 52, view: 'SIDE' } },
      { part: 'Hood', type: 'Stone Chip', size: 'Small (0-5cm)', coords: { x: 52, y: 45, view: 'FRONT' } },
      { part: 'Rear Bumper', type: 'Scratch', size: 'Small (0-5cm)', coords: { x: 48, y: 65, view: 'REAR' } },
    ];

    // Pick 2-3 random mock detections to make it feel "real"
    const count = Math.min(imageUrls.length, 2 + Math.floor(Math.random() * 2));
    for (let i = 0; i < count; i++) {
      const option = mockOptions[Math.floor(Math.random() * mockOptions.length)];
      detections.push({
        ...option,
        imageUrl: imageUrls[i % imageUrls.length],
      } as DamageDetection);
    }

    return detections;
  }

  /**
   * Trust only the SessionAuthGuard principal, then re-check the DB identity
   * inside the same transaction as every damage-record mutation.
   */
  async saveDamageRecords(listingId: string, detections: DamageDetection[], callerId: string) {
    if (!callerId) throw new UnauthorizedException('Sign in to edit damage records.');
    if (!Array.isArray(detections) || detections.length > 100) {
      throw new BadRequestException('Provide at most 100 damage records.');
    }
    return this.prisma.$transaction(async tx => {
      const listing = await tx.listing.findUnique({
        where: { id: listingId },
        select: { id: true, sellerId: true, status: true, images: true },
      });
      if (!listing) throw new NotFoundException('Listing not found.');
      const actor = await tx.user.findUnique({
        where: { id: callerId }, select: { id: true, role: true, deletedAt: true },
      });
      if (!actor || actor.deletedAt) throw new UnauthorizedException('Session user is inactive.');
      const owner = !!listing.sellerId && listing.sellerId === actor.id;
      const admin = actor.role === 'ADMIN';
      let authorisedStaff = false;
      if (!owner && !admin && listing.sellerId) {
        const dealership = await tx.dealerProfile.findUnique({
          where: { userId: listing.sellerId }, select: { id: true },
        });
        if (dealership) {
          const staff = await tx.dealerStaff.findFirst({
            where: {
              userId: actor.id, dealerProfileId: dealership.id, isActive: true,
              role: { in: ['ADMIN', 'SALES_AGENT'] },
            },
            select: { id: true },
          });
          authorisedStaff = Boolean(staff);
        }
      }
      if (!owner && !admin && !authorisedStaff) {
        throw new ForbiddenException('You cannot modify this listing.');
      }

      const existing = await tx.damageRecord.findMany({
        where: { listingId }, select: { id: true, imageUrl: true },
      });
      const priorPhotoUrls = new Set<string>([
        ...listing.images.map(url => url.split('#')[0]),
        ...existing.map(row => row.imageUrl).filter((url): url is string => !!url),
      ]);
      const envHost = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      let storageOrigin = '';
      try { storageOrigin = envHost ? new URL(envHost).origin : ''; } catch { /* fail closed */ }
      const ids = new Set<string>();
      for (const d of detections) {
        if (!d || typeof d !== 'object') throw new BadRequestException('Invalid damage entry.');
        if (typeof d.part !== 'string' || !d.part.trim() || d.part.length > 160
          || typeof d.type !== 'string' || d.type.length > 4000
          || typeof d.size !== 'string' || !d.size.trim() || d.size.length > 80) {
          throw new BadRequestException('Invalid damage part, type or size.');
        }
        if (d.id !== undefined) {
          if (typeof d.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(d.id)) {
            throw new BadRequestException('Invalid damage record identifier.');
          }
          if (ids.has(d.id)) throw new BadRequestException('Duplicate damage record identifier.');
          ids.add(d.id);
          const inOtherListing = await tx.damageRecord.findFirst({
            where: { id: d.id, listingId: { not: listingId } }, select: { id: true },
          });
          if (inOtherListing) throw new BadRequestException('Damage identifier already belongs to another listing.');
        }
        const coords = d.coords;
        if (!coords || !Number.isFinite(coords.x) || !Number.isFinite(coords.y)
          || coords.x < -10 || coords.x > 100 || coords.y < -10 || coords.y > 100
          || !['FRONT', 'SIDE', 'REAR', 'TOP', 'INTERIOR'].includes(coords.view)) {
          throw new BadRequestException('Invalid damage map coordinates.');
        }
        const point = d.coords?.surfacePoint;
        if (point !== undefined && (!point || ![point.fx, point.fy, point.fz].every(
          n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1,
        ))) {
          throw new BadRequestException('Invalid 3D damage marker location.');
        }
        if (d.imageUrl !== undefined && d.imageUrl !== null && d.imageUrl !== '') {
          if (typeof d.imageUrl !== 'string' || d.imageUrl.length > 2048) {
            throw new BadRequestException('Invalid damage evidence URL.');
          }
          let photoUrl: URL;
          try { photoUrl = new URL(d.imageUrl); } catch { throw new BadRequestException('Invalid damage evidence URL.'); }
          // Seller may upload under their own account. An ACTIVE delegated
          // dealer agent may also upload into their own authenticated folder,
          // but never another user's unassigned folder.
          const permittedUploadOwners = [listing.sellerId, ...(authorisedStaff ? [actor.id] : [])]
            .filter((id): id is string => !!id);
          const validOwnerPrefix = permittedUploadOwners.some(ownerId =>
            photoUrl.pathname.startsWith('/storage/v1/object/public/listings/' + ownerId + '/'));
          const validNewUpload = photoUrl.protocol === 'https:'
            && !!storageOrigin && photoUrl.origin === storageOrigin
            && validOwnerPrefix
            && /^\/storage\/v1\/object\/public\/listings\/[^/]+\/(damage|exterior|vehicle|interior)\//.test(photoUrl.pathname)
            && !photoUrl.search && !photoUrl.hash;
          const validExistingUrl = priorPhotoUrls.has(d.imageUrl);
          if (!validNewUpload && !validExistingUrl) {
            throw new BadRequestException('Damage photo must belong to this listing.');
          }
        }
      }
      await tx.damageRecord.deleteMany({ where: { listingId } });
      if (detections.length) {
        await tx.damageRecord.createMany({
          data: detections.map(d => ({
            ...(d.id ? { id: d.id } : {}),
            listingId, part: d.part, type: d.type, size: d.size,
            coords: d.coords as any, imageUrl: d.imageUrl || null,
          })),
        });
      }
      // Prisma 6 permits filtering a unique update by the previously checked
      // sellerId. This makes a concurrent ownership transfer fail atomically
      // (rolling back damage deletes/creates), instead of allowing the prior
      // owner to rewrite a transferred listing after the authorization read.
      return tx.listing.update({
        where: { id: listingId, sellerId: listing.sellerId },
        data: { exteriorGrade: computeExteriorGrade(detections) },
      });
    });
  }

  async getDamageRecords(listingId: string, callerId?: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId }, select: { sellerId: true, status: true },
    });
    if (!listing) throw new NotFoundException('Listing not found.');
    const visible = ['ACTIVE', 'OFFER_ACCEPTED', 'SOLD'].includes(listing.status);
    if (!visible) {
      if (!callerId) throw new NotFoundException('Listing not found.');
      const actor = await this.prisma.user.findUnique({
        where: { id: callerId }, select: { role: true, deletedAt: true },
      });
      if (!actor || actor.deletedAt) throw new NotFoundException('Listing not found.');
      let allowed = listing.sellerId === callerId || actor.role === 'ADMIN';
      if (!allowed && listing.sellerId) {
        const dealership = await this.prisma.dealerProfile.findUnique({
          where: { userId: listing.sellerId }, select: { id: true },
        });
        if (dealership) {
          allowed = !!(await this.prisma.dealerStaff.findFirst({
            where: { userId: callerId, dealerProfileId: dealership.id, isActive: true,
              role: { in: ['ADMIN', 'SALES_AGENT'] } },
            select: { id: true },
          }));
        }
      }
      if (!allowed) throw new NotFoundException('Listing not found.');
    }
    return this.prisma.damageRecord.findMany({ where: { listingId } });
  }
}

/**
 * Automatic exterior grading (1 = best, 5 = worst) from the number of
 * seller-reported damage/defect records.
 *
 * CarMazium grading rule:
 *   0-1 defects -> Grade 1
 *   2-3 defects -> Grade 2
 *   4-5 defects -> Grade 3
 *   6-7 defects -> Grade 4
 *   8+ defects  -> Grade 5
 *
 * Grade is never seller-selectable. The backend recalculates it from the
 * complete saved damage set whenever records are replaced.
 */
export function computeExteriorGrade(records: { size?: string }[]): number {
  const count = Array.isArray(records) ? records.length : 0;
  if (count <= 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  if (count <= 7) return 4;
  return 5;
}
