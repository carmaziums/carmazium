import React, { useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@/components/BrandIcon';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, themeStatusBarStyle } from '../../constants/colors';
import { FontFamily, FontSize } from '../../constants/typography';
import { Elevation, Radius } from '../../constants/spacing';
import { PRICING } from '../../constants/pricing';
import { MainStackParamList } from '../../navigation/MainStackNavigator';

import { IconButton } from '../../components/IconButton';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { NativePage, pageStyles } from '../../components/NativePage';
import { Button } from '../../components/Button';
import { useAuthStore } from '../../store/authStore';
type NavProp = NativeStackNavigationProp<MainStackParamList>;

// ─────────────────────────── data ──────────────────────────────────
// Mirrors the web app's pricing page (src/app/pricing/page.tsx) and its
// single source of truth, src/lib/pricingConfig.ts — these are listing-fee
// tiers (how much it costs to publish a car), not account/role plans. The
// previous version of this screen modeled buyer/seller/dealer subscription
// tiers with "Coming Soon" placeholders, which doesn't match the real
// pricing model at all.

interface PlanCard {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  period: string;
  badge?: string;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  features: { label: string; included: boolean }[];
}

const PLANS: PlanCard[] = [
  {
    id: 'auction',
    title: 'Auction seller',
    subtitle: '£0 seller listing fee',
    price: 'Free',
    period: '',
    accentColor: Colors.accent,
    accentBg: Colors.accentAlpha06,
    accentBorder: Colors.accentAlpha25,
    features: ['24-hour live auction','Verified motor traders can bid','Live bidding and anti-snipe protection',`£${PRICING.marketplace.auction.sellerReward} reward after successful approved handover`].map(label=>({label,included:true})),
  },
  {
    id: 'basic',
    title: 'Basic retail',
    subtitle: '£1 one-off · advertised until sold',
    price: `£${PRICING.listing.basic.price}`,
    period: 'one-off',
    accentColor: Colors.textSecondary,
    accentBg: Colors.whiteAlpha06,
    accentBorder: Colors.whiteAlpha15,
    features: [
      { label: 'Public marketplace listing', included: true },
      { label: 'Offer & negotiation system', included: true },
      { label: 'Direct buyer chat', included: true },
      { label: 'DVLA auto-fill', included: true },
      { label: 'Featured Boost available separately', included: true },
      { label: 'Performance analytics', included: true },
    ],
  },
  {
    id: 'standard',
    title: 'Standard retail',
    subtitle: 'Vehicle history report included',
    price: `£${PRICING.listing.standard.price}`,
    period: 'one-off',
    accentColor: Colors.infoBlue,
    accentBg: Colors.infoBlueAlpha10,
    accentBorder: Colors.infoBlueAlpha25,
    features: [
      { label: 'Everything in Basic', included: true },
      { label: 'Vehicle history report included', included: true },
      { label: 'Standard package badge', included: true },
      { label: 'Advertised until sold', included: true },
      { label: 'Featured Boost available separately', included: true },
    ],
  },
  {
    id: 'premium',
    title: 'Premium retail',
    subtitle: 'Vehicle history report + 28-day Featured Boost included',
    price: `£${PRICING.listing.premium.price}`,
    period: 'one-off',
    badge: 'BEST VALUE · REPORT + BOOST',
    accentColor: Colors.warning,
    accentBg: Colors.warningAlpha10,
    accentBorder: Colors.warningAlpha25,
    features: [
      { label: 'Everything in Standard', included: true },
      { label: 'Vehicle history report included', included: true },
      { label: 'Premium listing badge and presentation', included: true },
      { label: 'Advertised until sold', included: true },
      { label: 'Featured Boost included for 28 days', included: true },
    ],
  },
];

interface AddOn {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  meta?: string;
  icon: string;
  accentColor: string;
  accentBg: string;
}

const ADD_ONS: AddOn[] = [
  {
    id: 'hpi',
    title: 'Vehicle History Check',
    subtitle: 'Optional for Auction and Basic Retail. Standard and Premium Retail already include a vehicle history report.',
    price: `£${PRICING.hpiReport.price}`,
    icon: 'shield-checkmark-outline',
    accentColor: Colors.success,
    accentBg: Colors.successAlpha10,
  },
  {
    id: 'boost',
    title: 'Featured Boost',
    subtitle: '£25 for 28 days when bought separately. Premium already includes the first 28-day Featured Boost.',
    price: `£${PRICING.featuredBoost.price}`,
    meta: `${PRICING.featuredBoost.durationDays} days`,
    icon: 'flash-outline',
    accentColor: Colors.warning,
    accentBg: Colors.warningAlpha10,
  },
];

const FAQS = [
    {
        q: "What retail listing packages can I choose?",
        a: `Basic is £${PRICING.listing.basic.price}, Standard is £${PRICING.listing.standard.price} and includes a vehicle history report, and Premium is £${PRICING.listing.premium.price} and includes the Standard package benefits plus a 28-day Featured Boost.`,
    },
    {
        q: "How much does it cost to put my car into auction?",
        a: "Nothing. Auction listings are free for sellers and run for 24 hours. Verified motor traders can bid.",
    },
    {
        q: "Is a vehicle history check compulsory?",
        a: "No. A vehicle history check is optional. Choose Basic without one, purchase a report separately, or choose Standard/Premium with a report included.",
    },
    {
        q: "Does CarMazium charge retail buyers?",
        a: "No. CarMazium does not charge a buyer fee for retail vehicle purchases.",
    },
    {
        q: "Does CarMazium handle the vehicle purchase money?",
        a: "No. Buyers pay sellers directly for the vehicle. CarMazium only collects its own applicable platform fees and optional add-on charges.",
    },
    {
        q: "How does the £100 auction seller reward work?",
        a: `After a successful auction sale, the seller uploads the handover photo. Once the handover is approved, CarMazium releases the £${PRICING.marketplace.auction.sellerReward} seller reward.`,
    },
]

// ═══════════════════════════ COMPONENT ════════════════════════════

export const PricingScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const [openFaq,setOpenFaq]=useState<number|null>(null);
  const signedIn=useAuthStore(state=>state.isAuthenticated);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={themeStatusBarStyle} translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.accentAlpha06, Colors.groundClear, Colors.bgPrimary]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
        style={StyleSheet.absoluteFillObject}
      />

      <WebsiteTopBar />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent,{paddingBottom:insets.bottom+60}]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Intro ── */}
        <View style={styles.introSection}>
          <Text style={{fontSize:12,letterSpacing:1.5,color:Colors.accent,fontFamily:FontFamily.bold}}>SIMPLE CUSTOMER PRICING</Text>
          <Text style={[styles.introHeading,{fontSize:32,lineHeight:40,textAlign:'center'}]}>Simple, transparent pricing for every way you sell.</Text>
          <Text style={[styles.introSub,{fontSize:16,lineHeight:28,textAlign:'center'}]}>Auction for free, or choose the retail package that fits your car. Retail buyers pay no CarMazium buyer fee.</Text>
        </View>

        {/* ── Plan cards ── */}
        {PLANS.map((plan) => (
          <View
            key={plan.id}
            style={[
              styles.planCard,
              { borderColor: plan.accentBorder },
            ]}
          >
            {/* Card top accent bar */}


            {plan.badge && (
              <View style={styles.mostPopularBadge}>
                <Ionicons name="star" size={10} color={Colors.onAccent} />
                <Text style={styles.mostPopularText}>{plan.badge}</Text>
              </View>
            )}

            {/* Card header */}
            <View style={styles.planHeader}>
              <View style={[styles.planIconWrap, { backgroundColor: plan.accentBg }]}>
                <Ionicons
                  name={plan.id === 'auction' ? 'hammer-outline' : 'pricetag-outline'}
                  size={20}
                  color={plan.accentColor}
                />
              </View>
              <View style={styles.planTitleWrap}>
                <Text style={[styles.planTitle,{fontSize:12,letterSpacing:1.5,color:plan.accentColor}]}>{plan.title.toUpperCase()}</Text>
              </View>
            </View>

            {/* Price */}
            <View style={styles.priceRow}>
              <Text style={[styles.planPrice, { color: plan.accentColor, fontFamily: FontFamily.bold,fontSize:48,lineHeight:58 }]}>
                {plan.price}
              </Text>
              {plan.period ? (
                <Text style={styles.planPeriod}> {plan.period}</Text>
              ) : null}
            </View>

            <Text style={[styles.planSubtitle,{paddingHorizontal:24,fontSize:14,paddingBottom:24}]}>{plan.subtitle}</Text>
            {/* Divider */}
            <View style={styles.planDivider} />

            {/* Features */}
            <View style={styles.featuresSection}>
              {plan.features.map((feat) => (
                <View key={feat.label} style={styles.featureRow}>
                  <Ionicons
                    name={feat.included ? 'checkmark' : 'close'}
                    size={14}
                    color={feat.included ? plan.accentColor : Colors.textFaint}
                  />
                  <Text style={[styles.featureText, !feat.included && styles.featureTextExcluded]}>
                    {feat.label}
                  </Text>
                </View>
              ))}
            </View>
            <View style={{padding:24,paddingTop:8}}><Button label={plan.id==='auction'?'Start Free Auction':`Choose ${plan.id[0].toUpperCase()+plan.id.slice(1)}`} onPress={()=>navigation.navigate('SellLanding',plan.id==='auction'?{listingType:'AUCTION'}:{listingType:'CLASSIFIED',badgeTier:plan.id.toUpperCase() as 'BASIC'|'STANDARD'|'PREMIUM'})}/></View>
          </View>
        ))}

        {/* ── Add-ons ── */}
        <View style={styles.sectionHeadingWrap}>
          <Text style={styles.sectionHeading}>Optional add-ons</Text>
          <Text style={styles.sectionSub}>Optional extras for Auction, Basic and Standard; Premium already includes a vehicle history report and the first 28-day Featured Boost.</Text>
        </View>

        {ADD_ONS.map((addon) => (
          <View key={addon.id} style={styles.addonCard}>
            <View style={[styles.addonIconWrap, { backgroundColor: addon.accentBg }]}>
              <Ionicons name={addon.icon as any} size={22} color={addon.accentColor} />
            </View>
            <View style={styles.addonBody}>
              <View style={styles.addonTitleRow}>
                <Text style={styles.addonTitle}>{addon.title}</Text>
                <View style={styles.addonPriceWrap}>
                  <Text style={styles.addonPrice}>{addon.price}</Text>
                  {addon.meta && <Text style={styles.addonMeta}>{addon.meta}</Text>}
                </View>
              </View>
              <Text style={styles.addonSubtitle}>{addon.subtitle}</Text>
            </View>
          </View>
        ))}

        {/* ── Dealer prompt ── */}
        <TouchableOpacity
          style={styles.dealerPrompt}
          activeOpacity={0.8}
          onPress={() => navigation.navigate(signedIn?'PartnerDashboard':'DealerOnboarding')}
        >
          <View style={styles.dealerPromptIconWrap}>
            <Ionicons name="business-outline" size={20} color={Colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.dealerPromptTitle}>Motor trader or automotive business?</Text>
            <Text style={styles.dealerPromptSub}>Use a Partner Account for verified business tools and auction access.</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
        </TouchableOpacity>

        <Button label="View Trader Pricing" onPress={()=>navigation.navigate('TraderPricing')}/>
        <Button label={signedIn?'Open Partner Account':'Create Partner Account'} onPress={()=>navigation.navigate(signedIn?'PartnerDashboard':'DealerOnboarding')}/>
        <Text style={styles.sectionHeading}>Frequently Asked Questions</Text>
        {FAQS.map((faq,index)=><View key={faq.q} style={pageStyles.panel}><TouchableOpacity accessibilityRole="button" accessibilityLabel={faq.q} accessibilityState={{expanded:openFaq===index}} onPress={()=>setOpenFaq(old=>old===index?null:index)}><Text style={pageStyles.label}>{faq.q} {openFaq===index?'−':'+'}</Text></TouchableOpacity>{openFaq===index&&<Text style={pageStyles.body}>{faq.a}</Text>}</View>)}
        {/* ── Footer note ── */}
        <View style={styles.footerNote}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
          <Text style={styles.footerNoteText}>
            Retail buyers pay no CarMazium buyer fee. Vehicle sale money is paid directly between buyer and seller; CarMazium does not hold it.
          </Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
};

// ═══════════════════════════ STYLES ════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 2,
    ...Elevation.card,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  headerPlaceholder: {
    width: 38,
  },

  // ── Scroll ──
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 40,
    gap: 24,
  },

  // ── Intro ──
  introSection: {
    gap: 20,
    alignItems: 'center',
    paddingVertical: 40,
  },
  introHeading: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    color: Colors.textPrimary,
  },
  introSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 21,
  },

  // ── Plan card ──
  planCard: {
    borderRadius: Radius.card,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.bgCard,
    borderColor: Colors.border,
    ...Elevation.card,
  },
  planTopBar: {
    height: 3,
    width: '100%',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 24,
    paddingBottom: 16,
  },
  planIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  planTitleWrap: {
    flex: 1,
    gap: 2,
  },
  planTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  planSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  mostPopularBadge: {
    position: 'absolute',
    top: 11,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    zIndex: 1,
  },
  mostPopularText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.onAccent,
    letterSpacing: 0.5,
  },

  // ── Price ──
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  planPrice: {
    fontSize: FontSize['2xl'],
  },
  planPeriod: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },

  // ── Divider ──
  planDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 24,
  },

  // ── Features ──
  featuresSection: {
    padding: 24,
    gap: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  featureText: {
    fontFamily: FontFamily.regular,
    fontSize: 16,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  featureTextExcluded: {
    color: Colors.textFaint,
  },

  // ── Add-ons / Dealer prompt ──
  sectionHeadingWrap: {
    gap: 4,
    paddingTop: 8,
  },
  sectionHeading: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
  },
  sectionSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  addonCard: {
    flexDirection: 'row',
    gap: 14,
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: 16,
    backgroundColor: Colors.bgCard,
    borderColor: Colors.border,
    ...Elevation.card,
  },
  addonIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addonBody: {
    flex: 1,
    gap: 4,
  },
  addonTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  addonTitle: {
    flex: 1,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  addonPriceWrap: {
    alignItems: 'flex-end',
  },
  addonPrice: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: Colors.textPrimary,
  },
  addonMeta: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  addonSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  dealerPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.bgSecondary,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha06,
    padding: 16,
  },
  dealerPromptIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.inline,
    backgroundColor: Colors.accentAlpha10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dealerPromptTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  dealerPromptSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },

  // ── Footer note ──
  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    backgroundColor: Colors.glassBg,
    borderRadius: Radius.inline,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  footerNoteText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
});

export function TraderPricingScreen(){
 const navigation=useNavigation<NavProp>();const signedIn=useAuthStore(state=>state.isAuthenticated);
 const card=(title:string,price:string,description:string,features:string[],label:string,action:()=>void)=><View style={pageStyles.panel}><Text style={pageStyles.label}>{title}</Text><Text style={{fontFamily:FontFamily.bold,fontSize:40,color:Colors.textPrimary}}>{price}</Text><Text style={pageStyles.body}>{description}</Text>{features.map(text=><Text key={text} style={pageStyles.body}>✓ {text}</Text>)}<Button label={label} onPress={action}/></View>;
 return <NativePage title="Trader pricing, kept separate from customer pricing.">
 <Text style={pageStyles.label}>Motor Trade & Partner Accounts</Text><Text style={pageStyles.body}>This page covers the fees and rules relevant to verified motor traders using CarMazium auctions and retail marketplace features.</Text>
 {card('Auction purchase',`£${PRICING.marketplace.auction.buyerFee}`,'Paid only by the winning verified Trader, within 72 hours of the win',['No auction buyer fee if you do not win','Seller contact and deal details unlock after the fee is paid','Vehicle purchase price is paid directly to the seller','CarMazium does not hold the vehicle purchase funds'],'Browse Auctions',()=>navigation.navigate('Tabs',{screen:'Live'}))}
 {card('Retail marketplace purchase','Free','£0 CarMazium retail buyer fee',['Browse retail vehicle listings','Make offers and negotiate with sellers','Pay the seller directly for the vehicle','No CarMazium retail buyer fee'],'Browse Retail Cars',()=>navigation.navigate('Tabs',{screen:'Search'}))}
 <View style={pageStyles.panel}><Text style={pageStyles.label}>One business account for your CarMazium services.</Text><Text style={pageStyles.body}>Verified Traders use a Partner Account for auction bidding and approved business capabilities. Trader verification is required before auction bidding is enabled.</Text><Button label={signedIn?'Open Partner Account':'Create Partner Account'} onPress={()=>navigation.navigate(signedIn?'PartnerDashboard':'DealerOnboarding')}/></View>
 <Text style={pageStyles.body}>Vehicle money does not pass through CarMazium. The auction fee above is CarMazium’s platform fee; the agreed vehicle purchase price is paid directly to the seller.</Text>
 <View style={pageStyles.panel}><Text style={pageStyles.label}>Not a motor trader? See customer pricing instead.</Text><Text style={pageStyles.body}>Customer pricing covers selling by auction, £1 retail listings and retail buying.</Text><Button label="Customer Pricing" variant="outline" onPress={()=>navigation.navigate('Pricing')}/></View>
 </NativePage>;
}
