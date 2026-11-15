import React from 'react';
import { Text, View } from 'react-native';
import { Colors } from '../constants/colors';
export function SellerServiceBadges({ seller }: { seller?: { financeOffered?: boolean; warrantyOffered?: boolean } | null }) {
  if (!seller?.financeOffered && !seller?.warrantyOffered) return null;
  return <View style={{ paddingVertical: 10, gap: 6 }}>
    {seller.financeOffered === true && <Text style={{ color: Colors.textPrimary, fontWeight: '700' }}>Seller can arrange finance</Text>}
    {seller.warrantyOffered === true && <Text style={{ color: Colors.textPrimary, fontWeight: '700' }}>Seller offers warranties</Text>}
    <Text style={{ color: Colors.textSecondary, fontSize: 12 }}>Contact this seller for availability, eligibility, prices and terms.</Text>
  </View>;
}
