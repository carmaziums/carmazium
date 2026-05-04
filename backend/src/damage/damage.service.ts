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
    return (this.prisma as any).damageRecord.createMany({
      data: detections.map(d => ({
        listingId,
        part: d.part,
        type: d.type,
        size: d.size,
        coords: d.coords as any,
        imageUrl: d.imageUrl,
      })),
    });
  }

  async getDamageRecords(listingId: string) {
    return (this.prisma as any).damageRecord.findMany({
      where: { listingId },
    });
  }
}
