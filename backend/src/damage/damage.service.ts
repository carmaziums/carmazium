import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DamageDetection {
  part: string;
  type: string;
  size: string;
  coords: { x: number; y: number; view: 'FRONT' | 'SIDE' | 'REAR' | 'TOP' };
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

  async saveDamageRecords(listingId: string, detections: DamageDetection[]) {
    // Replace, not append — the wizard resubmits the seller's *complete* current
    // set of marked zones each time (e.g. after editing), not just new ones.
    // Without deleting first, re-saving would duplicate every previously-saved
    // record and inflate the automatic grade computed below.
    const [, , updatedListing] = await this.prisma.$transaction([
      (this.prisma as any).damageRecord.deleteMany({ where: { listingId } }),
      (this.prisma as any).damageRecord.createMany({
        data: detections.map(d => ({
          listingId,
          part: d.part,
          type: d.type,
          size: d.size,
          coords: d.coords as any,
          imageUrl: d.imageUrl,
        })),
      }),
      this.prisma.listing.update({
        where: { id: listingId },
        data: { exteriorGrade: computeExteriorGrade(detections) },
      }),
    ]);
    return updatedListing;
  }

  async getDamageRecords(listingId: string) {
    return (this.prisma as any).damageRecord.findMany({
      where: { listingId },
    });
  }
}

/**
 * Automatic exterior grading (1 = best, 5 = worst) from a vehicle's reported
 * damage — sellers never choose a grade directly. Mirrors the platform's
 * published grading definitions:
 *   Grade 1 — negligible damage (e.g. 2 small scratches)
 *   Grade 2 — Grade 1 + a few additional minor damages (e.g. 3 items)
 *   Grade 3 — Grade 1-2 + noticeable moderate damage (e.g. 5 items)
 *   Grade 4 — Grade 1-3 + multiple additional moderate damages (e.g. 12 items)
 *   Grade 5 — Grade 1-4 + excessive wear / major damage, regardless of count
 *
 * Zone *count* is the primary signal (matches how the in-app 3D damage mapper
 * is actually used — sellers mark zones without picking a severity today).
 * Any zone explicitly reported as large/major/severe forces Grade 5 outright,
 * so more detailed damage data (e.g. from AI photo analysis) still ranks a
 * vehicle correctly even when its zone count alone wouldn't.
 */
export function computeExteriorGrade(records: { size?: string }[]): number {
  if (!records || records.length === 0) return 1;

  const hasMajorDamage = records.some((r) => {
    const size = (r.size || '').toUpperCase();
    return size.includes('LARGE') || size.includes('MAJOR') || size.includes('SEVERE') || size.includes('15CM+') || size.includes('EXTENSIVE');
  });
  if (hasMajorDamage) return 5;

  const count = records.length;
  if (count <= 2) return 1;
  if (count === 3) return 2;
  if (count <= 6) return 3;
  if (count <= 14) return 4;
  return 5;
}
