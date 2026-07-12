// Shared body-type icon set — SearchScreen used to render plain emoji, HomeScreen
// used a mostly-generic Ionicons set (repeating 'car-outline' for most types),
// and SellCarFlowScreen had real distinct MaterialCommunityIcons per type. This
// consolidates on SellCarFlowScreen's set (mobile-ui-ux-audit.md §C6) so body-type
// icons look identical across Home, Search, and the Sell flow.

export interface BodyTypeIcon {
  value: string;
  label: string;
  /** MaterialCommunityIcons name (via src/components/BrandIcon). */
  icon: string;
}

export const BODY_TYPE_ICONS: BodyTypeIcon[] = [
  { value: 'HATCHBACK', label: 'Hatchback', icon: 'car-hatchback' },
  { value: 'SALOON', label: 'Saloon', icon: 'car-limousine' },
  { value: 'SEDAN', label: 'Sedan', icon: 'car' },
  { value: 'ESTATE', label: 'Estate', icon: 'car-estate' },
  { value: 'SUV', label: 'SUV', icon: 'car-suv' },
  { value: 'COUPE', label: 'Coupé', icon: 'car-sports' },
  { value: 'CONVERTIBLE', label: 'Convertible', icon: 'car-convertible' },
  { value: 'MPV', label: 'MPV', icon: 'car' },
  { value: 'VAN', label: 'Van', icon: 'van-utility' },
  { value: 'PICKUP', label: 'Pickup', icon: 'truck' },
  { value: 'OTHER', label: 'Other', icon: 'car-outline' },
];

export const getBodyTypeIcon = (value: string): string =>
  BODY_TYPE_ICONS.find((b) => b.value === value)?.icon ?? 'car-outline';
