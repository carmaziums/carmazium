import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@/components/BrandIcon';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Colors } from '../../constants/colors';
import { useAppearanceStore } from '../../store/appearanceStore';
import { adaptLegacyLightStyles } from '../../theme/appearancePalette';
import { FontFamily, FontSize } from '../../constants/typography';
import { auctionToListingParam, getAuction } from '../../lib/auctionApi';
import { ThemedStatusBar } from '../../components/ThemedStatusBar';

type Props = NativeStackScreenProps<MainStackParamList, 'AuctionDeepLink'>;

export const AuctionDeepLinkScreen: React.FC<Props> = ({ navigation, route }) => {
  const appearanceMode = useAppearanceStore(state => state.mode);
  const ts = appearanceMode === 'light' ? adaptLegacyLightStyles(styles) : styles;
  const { auctionId } = route.params;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    getAuction(auctionId)
      .then((auction) => {
        if (!active) return;
        const listing = auctionToListingParam(auction);
        navigation.reset({
          index: 1,
          routes: [
            { name: 'Tabs' },
            { name: 'LiveAuctionDetailed', params: { listing } },
          ],
        });
      })
      .catch((err: any) => {
        if (active) setError(err?.message || 'Could not open this auction.');
      });

    return () => { active = false; };
  }, [auctionId, navigation]);

  return (
    <View style={ts.container}>
      <ThemedStatusBar backgroundColor={Colors.bgPrimary} />
      {error ? (
        <View style={ts.card}>
          <Ionicons name="alert-circle-outline" size={34} color={Colors.accent} />
          <Text style={ts.title}>Auction unavailable</Text>
          <Text style={ts.body}>{error}</Text>
          <TouchableOpacity
            style={ts.button}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] })}
            accessibilityRole="button"
          >
            <Text style={ts.buttonText}>BACK TO AUCTIONS</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={ts.loading}>
          <ActivityIndicator color={Colors.accent} />
          <Text style={ts.body}>Opening auction…</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgPrimary, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loading: { alignItems: 'center', gap: 12 },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgSecondaryAlt,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha08,
    borderRadius: 18,
    padding: 24,
  },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.white, textAlign: 'center' },
  body: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  button: { marginTop: 6, backgroundColor: Colors.accent, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  buttonText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.white },
});
