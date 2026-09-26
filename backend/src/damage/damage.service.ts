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
 * Automatic exterior grading (1 = best, 5 = worst) from the number of
 * seller-reported damage/defect records.
 *
 * CarMazium grading rule:
 *   0 defects   -> Grade 1
 *   1-2 defects -> Grade 2
 *   3-4 defects -> Grade 3
 *   5-6 defects -> Grade 4
 *   7+ defects  -> Grade 5
 *
 * Grade is never seller-selectable. The backend recalculates it from the
 * complete saved damage set whenever records are replaced.
 */
export function computeExteriorGrade(records: { size?: string }[]): number {
  const count = Array.isArray(records) ? records.length : 0;
  if (count === 0) return 1;
  if (count <= 2) return 2;
  if (count <= 4) return 3;
  if (count <= 6) return 4;
  return 5;
}
