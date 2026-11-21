import React from 'react';
import {
  Image, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@/components/BrandIcon';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { Colors } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import type { MainStackParamList } from '../../navigation/MainStackNavigator';
import { useTabBarClearance } from '../../hooks/useTabBarClearance';
import {
  DEALER_LISTING_CHOICES, DEALER_LISTING_STEPS,
  type DealerListingChoice,
} from '../../lib/dealerListingEntry';

type Nav = NativeStackNavigationProp<MainStackParamList>;

/** The dealer website starts a NEW listing with a dedicated method selector.
 * Never pre-select retail or create a listing until a dealer explicitly taps.
 * Existing listing edits continue straight to the edit form.
 */
export const DealerListingMethodScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const bottomPad = useTabBarClearance(24);
  const start = (choice: DealerListingChoice) => {
    navigation.navigate('SellCarFlow', {
      listingType: choice.method,
      ...(choice.method === 'CLASSIFIED' ? { badgeTier: 'BASIC' as const } : {}),
    });
  };
  const renderCard = (choice: DealerListingChoice) => {
    const auction = choice.method === 'AUCTION';
    return <TouchableOpacity
      key={choice.method}
      onPress={() => start(choice)}
      accessibilityRole="button"
      accessibilityLabel={choice.action}
      style={[styles.methodCard, auction && styles.auctionCard]}
      activeOpacity={0.85}
    >
      {auction && <Image
        source={require('../../../assets/images/auction-100-stamp.png')}
        resizeMode="contain"
        accessibilityLabel="£100 seller reward for a qualifying completed auction after approved handover"
        style={styles.rewardStamp}
      />}
      {auction && <Text style={styles.liveBadge}>LIVE BIDDING</Text>}
      <View style={[styles.iconWrap, auction ? styles.auctionIcon : styles.retailIcon]}>
        <Ionicons
          name={auction ? 'hammer-outline' : 'pricetag-outline'}
          size={34}
          color={auction ? Colors.warning : Colors.accent}
        />
      </View>
      <Text style={styles.methodTitle}>{choice.title}</Text>
      <Text style={styles.description}>{choice.description}</Text>
      {auction && <View style={styles.bidNotice}>
        <Ionicons name="shield-checkmark-outline" size={16} color={Colors.warning} />
        <Text style={styles.bidNoticeText}>Only verified dealers can bid. Open to all registered sellers to list.</Text>
      </View>}
      <View style={styles.benefits}>
        {choice.benefits.map(benefit => <View key={benefit} style={styles.benefitRow}>
          <Ionicons name="checkmark-circle-outline" size={17} color={auction ? Colors.warning : Colors.success} />
          <Text style={styles.benefitText}>{benefit}</Text>
        </View>)}
      </View>
      <View style={[styles.actionButton, auction ? styles.auctionAction : styles.retailAction]}>
        <Text style={styles.actionText}>{choice.action}</Text>
        <Ionicons name={auction ? 'hammer-outline' : 'arrow-forward'} size={20} color={Colors.onAccent} />
      </View>
    </TouchableOpacity>;
  };

  return <View style={styles.screen}>
    <WebsiteTopBar />
    <ScrollView
      contentContainerStyle={[styles.page, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={styles.back} accessibilityRole="button"
        onPress={() => navigation.goBack()} accessibilityLabel="Back to dealer stock">
        <Ionicons name="arrow-back" size={19} color={Colors.textSecondary} />
        <Text style={styles.backText}>Back to Stock</Text>
      </TouchableOpacity>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>CHOOSE YOUR LISTING METHOD</Text>
        <Text style={styles.headingTitle} accessibilityRole="header">Choose How You Want to Sell</Text>
        <Text style={styles.headingDescription}>
          Use the free dealer auction for verified motor-trade bids or advertise directly to retail buyers from £1.
        </Text>
      </View>
      <View style={styles.cards}>
        {DEALER_LISTING_CHOICES.map(renderCard)}
      </View>
      <View style={styles.steps}>
        {DEALER_LISTING_STEPS.map(step => <View key={step.index} style={styles.step}>
          <View style={styles.stepBubble}><Text style={styles.stepNum}>{step.index}</Text></View>
          <Text style={styles.stepText}>{step.title}</Text>
        </View>)}
      </View>
    </ScrollView>
  </View>;
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgPrimary },
  page: { paddingHorizontal: 20, gap: 20, paddingTop: 14 },
  back: { minHeight: 44, flexDirection: 'row', gap: 8, alignItems: 'center' },
  backText: { color: Colors.textSecondary, fontFamily: FontFamily.medium, fontSize: FontSize.sm },
  heading: { alignItems: 'center', gap: 14, backgroundColor: Colors.bgCard, padding: 24, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  eyebrow: { color: Colors.accent, fontFamily: FontFamily.extraBold, fontSize: FontSize.xs, letterSpacing: 1.4, textAlign: 'center' },
  headingTitle: { fontFamily: FontFamily.extraBold, fontSize: FontSize['3xl'], color: Colors.textPrimary, lineHeight: 36, textAlign: 'center' },
  headingDescription: { fontSize: FontSize.lg, fontFamily: FontFamily.regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 28 },
  cards: { gap: 22 },
  methodCard: { padding: 27, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderRadius: 20, gap: 13, overflow: 'visible' },
  auctionCard: { borderColor: Colors.warningAlpha25 },
  rewardStamp: { position: 'absolute', width: 116, height: 116, top: -20, right: 8, zIndex: 2, transform: [{ rotate: '12deg' }] },
  liveBadge: { alignSelf: 'center', color: Colors.warning, borderRadius: 20, borderWidth: 1, borderColor: Colors.warningAlpha30, backgroundColor: Colors.warningAlpha10, paddingHorizontal: 12, paddingVertical: 6, fontFamily: FontFamily.bold, fontSize: FontSize.xs },
  iconWrap: { width: 68, height: 68, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  auctionIcon: { backgroundColor: Colors.warningAlpha10, borderColor: Colors.warningAlpha20, borderWidth: 1 },
  retailIcon: { backgroundColor: Colors.accentAlpha10, borderColor: Colors.border, borderWidth: 1 },
  methodTitle: { fontFamily: FontFamily.bold, fontSize: FontSize['2xl'], color: Colors.textPrimary },
  description: { fontSize: FontSize.base, color: Colors.textSecondary, lineHeight: 23 },
  bidNotice: { borderRadius: 11, padding: 12, backgroundColor: Colors.warningAlpha06, borderColor: Colors.warningAlpha20, borderWidth: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bidNoticeText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  benefits: { gap: 11, marginVertical: 9 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  benefitText: { color: Colors.textSecondary, fontSize: FontSize.base, flex: 1 },
  actionButton: { minHeight: 53, borderRadius: 12, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', marginTop: 7 },
  auctionAction: { backgroundColor: Colors.warning },
  retailAction: { backgroundColor: Colors.accent },
  actionText: { color: Colors.onAccent, fontFamily: FontFamily.bold, fontSize: FontSize.lg },
  steps: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 18 },
  step: { minWidth: '22%', flexGrow: 1, alignItems: 'center', gap: 7, padding: 11, borderRadius: 13, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard },
  stepBubble: { borderRadius: 28, width: 36, height: 36, borderColor: Colors.accentAlpha30, backgroundColor: Colors.accentAlpha10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepNum: { color: Colors.accent, fontFamily: FontFamily.extraBold, fontSize: FontSize.sm },
  stepText: { color: Colors.textPrimary, fontFamily: FontFamily.semiBold, fontSize: FontSize.sm },
});
