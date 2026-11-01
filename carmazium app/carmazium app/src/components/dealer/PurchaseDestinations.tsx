import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Radius } from '../../constants/spacing';

export type PurchaseDestination = 'progress' | 'completed' | 'cancelled';

/** Exactly one stage tab row; auction/retail is a separate compact filter. */
const ITEMS: { id: PurchaseDestination; label: string; icon: string }[] = [
  { id: 'progress', label: 'In progress', icon: 'time-outline' },
  { id: 'completed', label: 'Completed', icon: 'checkmark-circle-outline' },
  { id: 'cancelled', label: 'Cancelled', icon: 'close-circle-outline' },
];

export const PurchaseDestinations: React.FC<{
  active: PurchaseDestination;
  onSelect: (destination: PurchaseDestination) => void;
}> = ({ active, onSelect }) => (
  <View style={styles.wrap} accessibilityRole="tablist" accessibilityLabel="Purchase stages">
    {ITEMS.map(item => {
      const selected = item.id === active;
      return (
        <TouchableOpacity
          key={item.id}
          style={[styles.item, selected && styles.itemActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected }}
          onPress={() => { if (!selected) onSelect(item.id); }}
          activeOpacity={0.8}
        >
          <Ionicons name={item.icon} size={18} color={selected ? Colors.white : Colors.textMuted} />
          <Text style={[styles.label, selected && styles.labelActive]} numberOfLines={2}>
            {item.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 4,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 4,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    backgroundColor: Colors.bgCard,
  },
  item: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: Radius.chip,
  },
  itemActive: { backgroundColor: Colors.accent },
  label: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    lineHeight: 16,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  labelActive: { color: Colors.white },
});
