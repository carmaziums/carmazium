import React from 'react';
import * as Lucide from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

const ICON_MAP: Record<string, string> = {
  // Navigation
  'home-outline': 'Home',
  'home': 'Home',
  'chevron-back': 'ChevronLeft',
  'chevron-forward': 'ChevronRight',
  'chevron-up': 'ChevronUp',
  'chevron-down': 'ChevronDown',
  'arrow-back': 'ArrowLeft',
  'arrow-forward': 'ArrowRight',
  'arrow-down': 'ArrowDown',
  'arrow-up': 'ArrowUp',
  'close': 'X',
  'add': 'Plus',

  // Search & UI
  'search-outline': 'Search',
  'search': 'Search',
  'share-social-outline': 'Share2',
  'share-outline': 'Share2',
  'create-outline': 'Pencil',
  'pencil': 'Edit2',
  'pencil-outline': 'Pencil',
  'trash-outline': 'Trash2',
  'options-outline': 'SlidersHorizontal',
  'filter-outline': 'SlidersHorizontal',
  'filter': 'SlidersHorizontal',
  'bookmark-outline': 'Bookmark',
  'bookmark': 'Bookmark',
  'heart': 'Heart',
  'heart-outline': 'Heart',
  'refresh-outline': 'RefreshCw',
  'refresh': 'RefreshCw',
  'list-outline': 'List',
  'list': 'List',
  'grid-outline': 'LayoutGrid',
  'grid': 'LayoutGrid',
  'send': 'Send',
  'send-outline': 'Send',
  'radio-button-on': 'CircleDot',
  'radio-button-off': 'Circle',
  'logo-apple': 'Apple',

  // People / Account
  'person-outline': 'User',
  'person': 'User',
  'people-outline': 'Users',
  'people': 'Users',
  'ribbon': 'Award',
  'briefcase-sharp': 'Briefcase',
  'business-sharp': 'Briefcase',
  'wallet-outline': 'Wallet',
  'wallet': 'Wallet',
  'receipt-outline': 'Receipt',
  'receipt': 'Receipt',

  // Notifications
  'notifications-outline': 'Bell',
  'notifications': 'Bell',
  'notifications-circle-outline': 'BellRing',
  'information-circle-outline': 'Info',
  'alert-circle-outline': 'AlertCircle',
  'alert-circle': 'AlertCircle',
  'warning-outline': 'AlertTriangle',
  'help-circle-outline': 'HelpCircle',

  // Status / checks
  'checkmark': 'Check',
  'checkmark-sharp': 'Check',
  'checkmark-done': 'CheckCheck',
  'checkmark-circle': 'CheckCircle2',
  'checkmark-circle-outline': 'CheckCircle2',
  'checkmark-circle-sharp': 'CheckCircle2',
  'add-circle-outline': 'PlusCircle',
  'add-circle': 'PlusCircle',
  'shield-checkmark-outline': 'ShieldAlert',
  'shield-checkmark': 'ShieldCheck',
  'shield-outline': 'Shield',
  'shield': 'Shield',
  'ban-outline': 'Ban',
  'ban': 'Ban',

  // Vehicle / listings
  'car-sharp': 'Car',
  'car-outline': 'Car',
  'car': 'Car',
  'car-side': 'Car',
  'car-hatchback': 'Car',
  'car-sports': 'CarFront',
  'car-estate': 'Car',
  'car-convertible': 'Car',
  'car-2-plus': 'Car',
  'car-minivan': 'Car',
  'gavel': 'Gavel',
  'hammer-outline': 'Hammer',
  'hammer': 'Hammer',
  'pricetag-outline': 'Tag',
  'trophy': 'Trophy',
  'trophy-outline': 'Trophy',
  'star': 'Star',
  'star-outline': 'Star',

  // Media
  'camera-outline': 'Camera',
  'camera': 'Camera',
  'image-outline': 'Image',

  // Time / calendar
  'time-outline': 'Clock',
  'time': 'Clock',
  'calendar-outline': 'Calendar',
  'calendar': 'Calendar',
  'calendar-clock': 'CalendarClock',

  // Connectivity
  'wifi-outline': 'Wifi',
  'flash-outline': 'Zap',
  'flash': 'Zap',
  'sparkles': 'Sparkles',

  // Charts / data
  'trending-up': 'TrendingUp',
  'trending-down': 'TrendingDown',
  'bar-chart-outline': 'BarChart2',
  'speedometer-outline': 'Gauge',
  'gas-station-outline': 'Fuel',

  // Location
  'location-outline': 'MapPin',
  'location': 'MapPin',

  // Navigation / wayfinding
  'compass-outline': 'Compass',
  'compass': 'Compass',
  'trail-sign-outline': 'Signpost',
  'trail-sign': 'Signpost',

  // Commerce / business
  'storefront-outline': 'Store',
  'storefront': 'Store',
  'construct-outline': 'Wrench',
  'construct': 'Wrench',
  'albums-outline': 'Layers',
  'albums': 'Layers',

  // Compare
  'git-compare-outline': 'GitCompare',
  'git-compare': 'GitCompare',

  // Misc
  'eye-outline': 'Eye',
  'eye': 'Eye',
  'eye-off-outline': 'EyeOff',
  'eye-off': 'EyeOff',
  'cube-outline': 'Box',
  'card-outline': 'CreditCard',
  'card': 'CreditCard',
  'document-text-outline': 'FileText',
  'log-out-outline': 'LogOut',
  'settings-outline': 'Settings',
  'settings': 'Settings',
  'chatbubble-outline': 'MessageCircle',
  'chatbubble-ellipses-outline': 'MessageCircle',
  'chatbubbles-outline': 'MessageSquare',
  'mail-outline': 'Mail',
  'mail': 'Mail',
  'lock-closed-outline': 'Lock',
  'rocket-outline': 'Rocket',
  'rocket': 'Rocket',
  'arrow-undo-outline': 'RotateCcw',
  'arrow-undo': 'RotateCcw',
  'cloud-upload-outline': 'Upload',
  'close-circle-outline': 'XCircle',
  'ellipsis-horizontal': 'MoreHorizontal',
  'ellipsis-vertical': 'MoreVertical',
};

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: any;
  onPress?: () => void;
}

export const Ionicons: React.FC<IconProps> = ({ name, size = 24, color = '#FFFFFF', style, onPress }) => {
  const lucideName = ICON_MAP[name] || 'HelpCircle';
  const Component = (Lucide as any)[lucideName] || Lucide.HelpCircle;
  return <Component size={size} color={color} style={style} onPress={onPress} />;
};

interface GoogleIconProps {
  size?: number;
}
export const GoogleIcon: React.FC<GoogleIconProps> = ({ size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <Path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <Path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <Path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </Svg>
);

export const MaterialCommunityIcons = Ionicons;
export const FontAwesome = Ionicons;
