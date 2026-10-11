import { DamageAnalysisController } from './damage.controller';
import { DamageAnalysisService } from './damage.service';

describe('Damage session identity guard — Block 10', () => {
  const make = () => {
    const service = {
      saveDamageRecords: jest.fn().mockResolvedValue({}),
      getDamageRecords: jest.fn().mockResolvedValue([]),
      analyzeImages: jest.fn().mockResolvedValue([]),
    };
    return { controller: new DamageAnalysisController(service as unknown as DamageAnalysisService), service };
  };

  it('prefers the canonical cookie session over stale req.user when saving damage', async () => {
    const { controller, service } = make();
    await controller.save('listing-one', { detections: [] },
      { id: 'stale-other-account' }, { session: { userId: 'actual-owner' } } as any);
    expect(service.saveDamageRecords).toHaveBeenCalledWith('listing-one', [], 'actual-owner');
  });

  it('uses the verified Bearer-token identity when no existing cookie session user is set', async () => {
    const { controller, service } = make();
    await controller.save('listing-one', { detections: [] },
      { id: 'bearer-owner' }, { session: undefined } as any);
    expect(service.saveDamageRecords).toHaveBeenCalledWith('listing-one', [], 'bearer-owner');
  });

  it('prefers session identity when viewing a draft instead of an old cached user', async () => {
    const { controller, service } = make();
    await controller.get('listing-one', { id: 'stale-other-account' },
      { session: { userId: 'actual-owner' } } as any);
    expect(service.getDamageRecords).toHaveBeenCalledWith('listing-one', 'actual-owner');
  });

  it('leaves public ACTIVE records readable without authentication (service still enforces status)', async () => {
    const { controller, service } = make();
    await controller.get('listing-one', undefined, { session: undefined } as any);
    expect(service.getDamageRecords).toHaveBeenCalledWith('listing-one', undefined);
  });
});
