// Shared body-type icon set — SearchScreen used to render plain emoji, HomeScreen
// used a mostly-generic Ionicons set (repeating 'car-outline' for most types),
// and SellCarFlowScreen had real distinct MaterialCommunityIcons per type. This
// consolidates on SellCarFlowScreen's set (mobile-ui-ux-audit.md §C6) so body-type
// icons look identical across Home, Search, and the Sell flow.
//
// `value` must exactly match the backend's BodyType enum (backend/prisma/schema.prisma)
// — this used to contain invented values ('SALOON', 'PICKUP', 'OTHER') that aren't real
// enum members, so any screen using them 400'd (or, for the Search quick-filters that
// don't hit validation the same way, silently returned nothing). Fixed as part of
// mobile-production-readiness-plan.md F11 — all 13 values below are the real enum, no
// more, no fewer. `icon` names are only ever valid if they exist in the ICON_MAP inside
// src/components/BrandIcon.tsx (that file maps these Ionicons/MCI-style name strings to
// actual lucide-react-native components) — several of the old icon names here
// ('car-suv', 'car-limousine', 'truck') weren't in that map and silently rendered as a
// generic HelpCircle glyph. Fixed alongside the enum fix; see BrandIcon.tsx's ICON_MAP
// for the two new entries ('van-utility', 'car-pickup') this required.

export interface BodyTypeIcon {
  value: string;
  label: string;
  /** MaterialCommunityIcons name (via src/components/BrandIcon). */
  icon: string;
}

export const BODY_TYPE_ICONS: BodyTypeIcon[] = [
  { value: 'HATCHBACK', label: 'Hatchback', icon: 'car-hatchback' },
  { value: 'SEDAN', label: 'Sedan', icon: 'car' },
  { value: 'ESTATE', label: 'Estate', icon: 'car-estate' },
  { value: 'STATION_WAGON', label: 'Station Wagon', icon: 'car-estate' },
  { value: 'SUV', label: 'SUV', icon: 'car-side' },
  { value: 'CROSSOVER', label: 'Crossover', icon: 'car-side' },
  { value: 'COUPE', label: 'Coupé', icon: 'car-sports' },
  { value: 'SPORTS_CAR', label: 'Sports Car', icon: 'car-sports' },
  { value: 'CONVERTIBLE', label: 'Convertible', icon: 'car-convertible' },
  { value: 'MINIVAN', label: 'Minivan', icon: 'car-minivan' },
  { value: 'MPV', label: 'MPV', icon: 'car-2-plus' },
  { value: 'VAN', label: 'Van', icon: 'van-utility' },
  { value: 'PICKUP_TRUCK', label: 'Pickup Truck', icon: 'car-pickup' },
];

export const getBodyTypeIcon = (value: string): string =>
  BODY_TYPE_ICONS.find((b) => b.value === value)?.icon ?? 'car-outline';
