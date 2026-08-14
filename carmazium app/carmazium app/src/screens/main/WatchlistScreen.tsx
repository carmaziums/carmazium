import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { EmptyState } from '../../components/ui/EmptyState';
import { useWatchlistStore } from '../../store/watchlistStore';
import { VehicleCard } from '../../components/VehicleCard';
import { IconButton } from '../../components/IconButton';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';

type Props = NativeStackScreenProps<MainStackParamList, 'Watchlist'>;

export const WatchlistScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const savedListings = useWatchlistStore((s) => s.savedListings);
  const hydrateFromApi = useWatchlistStore((s) => s.hydrateFromApi);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    hydrateFromApi();
  }, [hydrateFromApi]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await hydrateFromApi();
    setRefreshing(false);
  }, [hydrateFromApi]);

  const handleOpen = useCallback(
    (id: string) => {
      const listing = savedListings.find((l) => l.id === id);
      if (listing) navigation.navigate('VehicleDetail', { listing });
    },
    [navigation, savedListings]
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha06, 'rgba(10,10,12,0)', Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={{ height: insets.top }} />

      <View style={styles.header}>
        <IconButton
          style={styles.backBtn}
          icon={<Ionicons name="chevron-back" size={18} color={Colors.white} />}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <Text style={styles.headerTitle}>Watchlist</Text>
        <View style={styles.headerRight} />
      </View>

      {savedListings.length === 0 ? (
        // Was a hand-rolled icon + two lines of text with no way forward — a
        // dead end at the exact moment the user needs direction (CONTEXT.md
        // section 8). Now the shared empty state, with a route onward.
        <EmptyState
          icon="heart-outline"
          eyebrow="Watchlist"
          title="No saved vehicles yet"
          subtitle="Tap the heart on any listing to save it here for later."
          ctaLabel="Browse listings"
          onCtaPress={() => navigation.navigate('Tabs' as any, { screen: 'Search' } as any)}
          accent
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          data={savedListings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <VehicleCard listing={item} onPress={handleOpen} />
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
          ListFooterComponent={<View style={{ height: 40 }} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.white,
  },
  headerRight: {
    width: 38,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 12,
  },
  cardWrap: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
});
