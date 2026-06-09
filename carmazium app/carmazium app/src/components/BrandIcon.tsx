import React from 'react';
import * as Lucide from 'lucide-react-native';

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
  'logo-google': 'Chrome',

  // People / Account
  'person-outline': 'User',
  'person': 'User',
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
  'information-circle-outline': 'Info',
  'alert-circle-outline': 'AlertCircle',
  'alert-circle': 'AlertCircle',
  'warning-outline': 'AlertTriangle',
  'help-circle-outline': 'HelpCircle',

  // Status / checks
  'checkmark': 'Check',
  'checkmark-sharp': 'Check',
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

  // Misc
  'eye-outline': 'Eye',
  'eye': 'Eye',
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

export const MaterialCommunityIcons = Ionicons;
export const FontAwesome = Ionicons;
