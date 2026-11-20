export interface DashboardPreferences { order: string[]; hidden: string[] }
export const defaultPreferences = (): DashboardPreferences => ({ order: [], hidden: [] });

export function parseDashboardPreferences(raw: string | null): DashboardPreferences {
  try {
    const value = JSON.parse(raw || '{}');
    const strings = (input: unknown): string[] => Array.isArray(input)
      ? [...new Set(input.filter((id): id is string => typeof id === 'string'))] : [];
    return { order: strings(value?.order), hidden: strings(value?.hidden) };
  } catch { return defaultPreferences(); }
}

// Resolve against today's permitted items. Saved preferences never grant access.
export function orderDashboardItems<T extends { id: string }>(items: T[], preferences: DashboardPreferences): T[] {
  const byId = new Map(items.map(item => [item.id, item]));
  return [...new Set([...preferences.order, ...items.map(item => item.id)])]
    .flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
}

export function moveDashboardItem(preferences: DashboardPreferences, visibleIds: string[], id: string, direction: -1 | 1): DashboardPreferences {
  const index = visibleIds.indexOf(id), next = index + direction;
  if (index < 0 || next < 0 || next >= visibleIds.length) return preferences;
  const order = [...visibleIds];
  [order[index], order[next]] = [order[next], order[index]];
  return { ...preferences, order: [...order, ...preferences.order.filter(key => !order.includes(key))] };
}
