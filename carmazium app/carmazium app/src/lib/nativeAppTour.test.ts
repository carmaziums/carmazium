import {
  getNativeAppTourSteps, nativeTourStorageKey,
  requestNativeAppTourReplay, subscribeNativeAppTourReplay,
} from './nativeAppTour';

describe('native app tour parity', () => {
  test.each(['buyer', 'seller', 'dealer', 'contractor', 'admin', 'finance_partner', 'insurance_partner'])(
    '%s has a guided introduction, safe native navigation and a settings replay step',
    role => {
      const steps = getNativeAppTourSteps(role);
      expect(steps.length).toBeGreaterThan(5);
      expect(steps[0].id).toBe('welcome');
      expect(steps[steps.length - 1].id).toBe('settings');
      expect(steps[steps.length - 1].destination).toEqual({
        screen: 'Settings', params: { section: 'personal' },
      });
      expect(new Set(steps.map(step => step.id)).size).toBe(steps.length);
      expect(steps.every(step => typeof step.title === 'string' && !!step.description)).toBe(true);
      expect(steps.some(step => step.id === 'pricing')).toBe(role !== 'admin');
    },
  );

  test('dealer guide covers dealership-specific tasks', () => {
    const ids = getNativeAppTourSteps('dealer').map(step => step.id);
    expect(ids).toEqual(expect.arrayContaining([
      'inventory', 'customers', 'bids', 'purchases', 'services',
    ]));
    expect(ids).not.toContain('my-cars');
  });

  test('personal guide includes purchase, saved and message information', () => {
    const ids = getNativeAppTourSteps('buyer').map(step => step.id);
    expect(ids).toEqual(expect.arrayContaining([
      'dashboard', 'my-cars', 'saved', 'purchases', 'messages',
    ]));
  });

  test('role guide never opens a destructive operation', () => {
    for (const role of ['dealer', 'buyer', 'admin', 'contractor']) {
      const text = getNativeAppTourSteps(role).map(step => step.description).join(' ');
      expect(text).toMatch(/never|no bids|no payments|no forms/i);
      expect(getNativeAppTourSteps(role).every(step =>
        !/submit|pay|delete|approve|accept|placebid|placeoffer/i.test(step.destination?.screen ?? ''),
      )).toBe(true);
    }
  });

  test('the completion acknowledgement stays scoped per user and version', () => {
    expect(nativeTourStorageKey('user-1')).not.toBe(nativeTourStorageKey('user-2'));
    expect(nativeTourStorageKey('user-1')).toMatch(/native-app-tour:v\d+:user-1/);
  });

  test('the replay button triggers subscribers and cleans up', () => {
    const cb = jest.fn();
    const unsubscribe = subscribeNativeAppTourReplay(cb);
    requestNativeAppTourReplay();
    expect(cb).toHaveBeenCalledTimes(1);
    unsubscribe();
    requestNativeAppTourReplay();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
