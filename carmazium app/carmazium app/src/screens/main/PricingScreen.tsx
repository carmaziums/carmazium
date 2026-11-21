import React, { useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@/components/BrandIcon';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, themeMode, themeStatusBarStyle } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import { PRICING } from '../../constants/pricing';
import { MainStackParamList } from '../../navigation/MainStackNavigator';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { NativePage, pageStyles } from '../../components/NativePage';
import { Button } from '../../components/Button';
import { useAuthStore } from '../../store/authStore';
type NavProp = NativeStackNavigationProp<MainStackParamList>;
const dark = themeMode === 'dark';

// Same card order, copy and Tailwind colour values as src/app/pricing/page.tsx.
const PLANS = [
  {id:'auction',title:'Auction seller',subtitle:'£0 seller listing fee',price:'Free',period:'',
    icon:'hammer-outline',label:Colors.accent,check:'#fb7185',border:'rgba(253,164,175,0.5)',tint:dark?'rgba(244,63,94,0.06)':'rgba(255,241,242,0.7)',
    features:[`${PRICING.marketplace.auction.durationHours}-hour live auction`,'Verified motor traders can bid','Live bidding and anti-snipe protection',`£${PRICING.marketplace.auction.sellerReward} reward after successful approved handover`]},
  {id:'basic',title:'Basic retail',subtitle:'Advertised until sold',price:`£${PRICING.listing.basic.price}`,period:'one-off',
    icon:'pricetag-outline',label:Colors.textSecondary,check:'#10b981',border:dark?'rgba(255,255,255,0.1)':'#e2e8f0',tint:dark?'rgba(255,255,255,0.035)':'rgba(248,250,252,0.8)',
    features:['Public marketplace listing','Offers and buyer chat','Vehicle history checks remain optional','Featured Boost available separately']},
  {id:'standard',title:'Standard retail',subtitle:'Includes a vehicle history report',price:`£${PRICING.listing.standard.price}`,period:'one-off',
    icon:'car-outline',label:dark?'#60a5fa':'#2563eb',check:'#3b82f6',border:'#3b82f6',tint:dark?'rgba(59,130,246,0.09)':'#eff6ff',
    badge:'HISTORY REPORT INCLUDED',badgeColor:'#2563eb',
    features:['Everything in Basic','Vehicle history report included','Standard package badge','Featured Boost still optional']},
  {id:'premium',title:'Premium retail',subtitle:'Vehicle history report + 28-day Featured Boost included',price:`£${PRICING.listing.premium.price}`,period:'one-off',
    icon:'ribbon-outline',label:dark?'#fbbf24':'#d97706',check:'#f59e0b',border:'rgba(251,191,36,0.6)',tint:dark?'rgba(245,158,11,0.07)':'rgba(255,251,235,0.9)',
    badge:'BEST VALUE · REPORT + BOOST',badgeColor:'#f59e0b',
    features:['Everything in Standard','Vehicle history report included','Premium listing badge and presentation','Featured Boost included for 28 days']},
];
const BENEFITS = [
  {icon:'people-outline',title:'Retail buyers pay £0',body:'No CarMazium buyer fee'},
  {icon:'shield-checkmark-outline',title:'Vehicle history report option',body:'Included in Standard & Premium'},
  {icon:'bag-outline',title:'Direct vehicle payment',body:'Buyer pays seller directly'},
  {icon:'bar-chart-outline',title:'No subscriptions',body:'Simple one-off listing fees'},
];
const ADD_ONS = [
  {title:'Vehicle History Check',body:'Optional for Auction and Basic Retail. Included with Standard and Premium Retail.',price:`£${PRICING.hpiReport.price}`,meta:'',icon:'shield-outline',color:'#3b82f6'},
  {title:'Featured Boost',body:'£25 for 28 days when purchased separately. Premium already includes the first 28-day Featured Boost.',price:`£${PRICING.featuredBoost.price}`,meta:`${PRICING.featuredBoost.durationDays} DAYS`,icon:'flash-outline',color:'#f59e0b'},
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

export function PricingScreen() {
  const insets=useSafeAreaInsets();
  const {width,fontScale}=useWindowDimensions();
  const columns=fontScale>1.2?1:width>=1280?4:width>=768?2:1;
  const cardWidth=(width-40-20*(columns-1))/columns;
  const navigation=useNavigation<NavProp>();
  const signedIn=useAuthStore(state=>state.isAuthenticated);
  const [openFaqs,setOpenFaqs]=useState<number[]>([]);
  const partner=()=>navigation.navigate(signedIn?'PartnerDashboard':'DealerOnboarding');
  return <View style={styles.container}>
    <StatusBar barStyle={themeStatusBarStyle} backgroundColor="transparent"/>
    <WebsiteTopBar/>
    <ScrollView contentContainerStyle={{paddingBottom:insets.bottom+64}}>
      <LinearGradient colors={[Colors.accentAlpha06,Colors.bgPrimary]} style={styles.intro}>
        <View style={styles.eyebrowPill}><Ionicons name="sparkles-outline" size={14} color={Colors.accent}/><Text style={styles.eyebrow}>SIMPLE CUSTOMER PRICING</Text></View>
        <Text style={styles.h1}>Simple, transparent pricing for every way you sell.</Text>
        <Text style={styles.introBody}>Auction for free, or choose the retail package that fits your car. Retail buyers pay no CarMazium buyer fee.</Text>
      </LinearGradient>
      <View style={styles.plansSection}>
        <View style={styles.grid}>{PLANS.map(plan=><View key={plan.id} style={[styles.planOuter,{width:cardWidth,borderColor:plan.border,borderWidth:plan.id==='standard'?2:1}]}>
          <LinearGradient colors={[plan.tint,Colors.bgCard,Colors.bgCard]} locations={[0,0.4,1]} style={styles.plan}>
            <View style={[styles.planHeader,{borderBottomColor:plan.id==='standard'?'rgba(59,130,246,0.2)':plan.id==='premium'?'rgba(245,158,11,0.2)':Colors.border}]}>
              <View style={styles.planLabelRow}><View style={[styles.planIcon,{backgroundColor:plan.tint,borderColor:plan.border}]}><Ionicons name={plan.icon as any} size={22} color={plan.label}/></View><Text style={[styles.eyebrow,{color:plan.label,flex:1}]}>{plan.title.toUpperCase()}</Text></View>
              <View style={styles.priceRow}><Text style={styles.price}>{plan.price}</Text>{!!plan.period&&<Text style={styles.period}>{plan.period}</Text>}</View>
              <Text style={styles.subtitle}>{plan.subtitle}</Text>
            </View>
            <View style={styles.features}>{plan.features.map(feature=><View key={feature} style={styles.featureRow}><Ionicons name="checkmark-circle-outline" size={18} color={plan.check} style={{marginTop:2}}/><Text style={styles.feature}>{feature}</Text></View>)}</View>
            <Button label={plan.id==='auction'?'Start Free Auction':`Choose ${plan.id[0].toUpperCase()+plan.id.slice(1)}`} icon={<Ionicons name="arrow-forward" size={17} color="#fff"/>} style={styles.cta} textStyle={styles.ctaText} onPress={()=>navigation.navigate('SellLanding',plan.id==='auction'?{listingType:'AUCTION'}:{listingType:'CLASSIFIED',badgeTier:plan.id.toUpperCase() as 'BASIC'|'STANDARD'|'PREMIUM'})}/>
          </LinearGradient>
          {plan.badge&&<View style={[styles.badge,{backgroundColor:plan.badgeColor,alignSelf:plan.id==='standard'?'center':'flex-end'}]}><Ionicons name={plan.id==='standard'?'checkmark-circle-outline':'star'} size={13} color="#fff"/><Text style={styles.badgeText}>{plan.badge}</Text></View>}
        </View>)}</View>
        <View style={styles.benefits}>{BENEFITS.map((benefit,i)=><View key={benefit.title} style={[styles.benefit,i>0&&styles.benefitDivider]}><Ionicons name={benefit.icon as any} size={22} color={Colors.textMuted}/><View style={{flex:1,gap:3}}><Text style={styles.bodyBold}>{benefit.title}</Text><Text style={styles.caption}>{benefit.body}</Text></View></View>)}</View>
      </View>
      <View style={styles.addonsSection}>
        <Text style={styles.h2}>Optional Add-Ons</Text><Text style={styles.sectionIntro}>Optional extras for Auction, Basic and Standard; Premium already includes a vehicle history report and the first 28-day Featured Boost.</Text>
        {ADD_ONS.map(addon=><View key={addon.title} style={styles.addonCard}>
          <View style={{flex:1,gap:8}}><View style={[styles.addonIcon,{backgroundColor:addon.color+'1a'}]}><Ionicons name={addon.icon as any} size={20} color={addon.color}/></View><Text style={styles.addonHeading}>{addon.title}</Text><Text style={styles.body}>{addon.body}</Text></View>
          <View style={{alignItems:'flex-end'}}><Text style={styles.addonPrice}>{addon.price}</Text>{!!addon.meta&&<Text style={styles.addonMeta}>{addon.meta}</Text>}</View>
        </View>)}
        <View style={styles.moneyNote}><Ionicons name="lock-closed-outline" size={17} color={Colors.accent}/><Text style={[styles.body,{flex:1}]}><Text style={styles.bodyBold}>Vehicle sale money stays between buyer and seller.</Text> CarMazium does not receive or hold the vehicle purchase price.</Text></View>
      </View>
      <View style={styles.partnerSection}><View style={styles.partnerCard}>
        <View style={styles.featureRow}><Ionicons name="checkmark-circle-outline" size={20} color={Colors.accent}/><Text style={[styles.eyebrow,{flex:1}]}>MOTOR TRADE & PARTNER ACCOUNTS</Text></View>
        <Text style={[styles.h2,{textAlign:'left'}]}>Are you a motor trader or automotive business?</Text>
        <Text style={styles.body}>Trader auction pricing and Partner Account information are kept on a separate business page.</Text>
        <View style={{gap:12,marginTop:16}}><Button label="View Trader Pricing" icon={<Ionicons name="arrow-forward" size={16} color="#fff"/>} size="lg" onPress={()=>navigation.navigate('TraderPricing')}/><Button label={signedIn?'Open Partner Account':'Create Partner Account'} size="lg" variant="outline" onPress={partner}/></View>
      </View></View>
      <View style={styles.faqSection}><View style={styles.questionLabel}><Ionicons name="help-circle-outline" size={18} color={Colors.accent}/><Text style={styles.eyebrow}>QUESTIONS</Text></View><Text style={[styles.h2,{marginBottom:24}]}>Frequently Asked Questions</Text>
        {FAQS.map((faq,index)=>{const expanded=openFaqs.includes(index);return <View key={faq.q} style={styles.faq}>
          <TouchableOpacity style={styles.faqButton} accessibilityRole="button" accessibilityLabel={faq.q} accessibilityState={{expanded}} onPress={()=>setOpenFaqs(old=>old.includes(index)?old.filter(x=>x!==index):[...old,index])}><Text style={[styles.bodyBold,{flex:1}]}>{faq.q}</Text><Ionicons name={expanded?'chevron-up':'chevron-down'} size={18} color={Colors.textMuted}/></TouchableOpacity>
          {expanded&&<Text style={[styles.body,styles.faqAnswer]}>{faq.a}</Text>}
        </View>})}
      </View>
    </ScrollView>
  </View>;
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:Colors.bgPrimary},
  intro:{paddingHorizontal:20,paddingTop:40,paddingBottom:32,alignItems:'center',borderBottomWidth:1,borderBottomColor:Colors.border},
  eyebrowPill:{flexDirection:'row',alignItems:'center',gap:8,borderRadius:999,borderWidth:1,borderColor:Colors.accentAlpha15,backgroundColor:Colors.accentAlpha06,paddingHorizontal:16,paddingVertical:8,marginBottom:16,maxWidth:'100%'},
  eyebrow:{fontFamily:FontFamily.bodyBlack,fontSize:12,letterSpacing:1.68,color:Colors.accent,flexShrink:1},
  h1:{fontFamily:FontFamily.headingBlack,fontSize:30,lineHeight:36,letterSpacing:-0.75,textAlign:'center',color:Colors.textPrimary},
  introBody:{fontFamily:FontFamily.regular,fontSize:16,lineHeight:28,textAlign:'center',color:Colors.textMuted,marginTop:16},
  plansSection:{paddingHorizontal:20,paddingTop:40,paddingBottom:40},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:20,alignItems:'stretch'},
  planOuter:{borderRadius:24,backgroundColor:Colors.bgCard,shadowColor:'#0f172a',shadowOpacity:0.07,shadowOffset:{width:0,height:14},shadowRadius:18,elevation:2},
  plan:{padding:24,borderRadius:23,flex:1},
  planHeader:{paddingBottom:24,borderBottomWidth:1},
  planLabelRow:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:16},
  planIcon:{width:44,height:44,borderRadius:12,borderWidth:1,alignItems:'center',justifyContent:'center'},
  priceRow:{flexDirection:'row',alignItems:'flex-end',gap:8,flexWrap:'wrap'},
  price:{fontFamily:FontFamily.bodyBlack,fontSize:48,lineHeight:48,letterSpacing:-1.2,color:Colors.textPrimary},
  period:{fontFamily:FontFamily.regular,fontSize:14,lineHeight:20,color:Colors.textMuted,marginBottom:6},
  subtitle:{fontFamily:FontFamily.regular,fontSize:14,lineHeight:20,color:Colors.textMuted,marginTop:8},
  features:{gap:14,marginVertical:24,flex:1},
  featureRow:{flexDirection:'row',gap:12,alignItems:'flex-start'},
  feature:{flex:1,fontFamily:FontFamily.regular,fontSize:14,lineHeight:20,color:Colors.textSecondary},
  cta:{minHeight:68,paddingVertical:24,backgroundColor:Colors.accent,shadowColor:'#dc2626',shadowOpacity:0.22,shadowOffset:{width:0,height:10},shadowRadius:12,elevation:2},
  ctaText:{fontFamily:FontFamily.bodyBold,fontSize:14},
  badge:{position:'absolute',top:-14,right:20,left:20,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:6,paddingHorizontal:16,paddingVertical:6,borderRadius:999},
  badgeText:{fontFamily:FontFamily.bodyBlack,fontSize:10,letterSpacing:1,color:'#fff',flexShrink:1,textAlign:'center'},
  benefits:{marginTop:36,borderWidth:1,borderColor:Colors.border,backgroundColor:Colors.bgCard,borderRadius:16,padding:20,gap:16},
  benefit:{flexDirection:'row',alignItems:'center',gap:12},
  benefitDivider:{borderTopWidth:1,borderTopColor:Colors.border,paddingTop:16},
  bodyBold:{fontFamily:FontFamily.bodyBold,fontSize:14,lineHeight:20,color:Colors.textPrimary},
  caption:{fontFamily:FontFamily.regular,fontSize:12,lineHeight:16,color:Colors.textMuted},
  h2:{fontFamily:FontFamily.headingBlack,fontSize:24,lineHeight:32,color:Colors.textPrimary,textAlign:'center'},
  body:{fontFamily:FontFamily.regular,fontSize:14,lineHeight:24,color:Colors.textMuted},
  sectionIntro:{fontFamily:FontFamily.regular,fontSize:14,lineHeight:20,color:Colors.textMuted,textAlign:'center',marginTop:8,marginBottom:36},
  addonsSection:{paddingHorizontal:20,paddingVertical:64,borderTopWidth:1,borderBottomWidth:1,borderColor:Colors.border},
  addonCard:{flexDirection:'row',alignItems:'flex-start',gap:16,borderWidth:1,borderColor:Colors.border,borderRadius:16,backgroundColor:Colors.bgCard,padding:28,marginBottom:20},
  addonIcon:{width:40,height:40,borderRadius:12,alignItems:'center',justifyContent:'center',marginBottom:4},
  addonHeading:{fontFamily:FontFamily.headingBlack,fontSize:16,lineHeight:24,color:Colors.textPrimary},
  addonPrice:{fontFamily:FontFamily.bodyBlack,fontSize:20,lineHeight:28,color:Colors.textPrimary},
  addonMeta:{fontFamily:FontFamily.bodyBold,fontSize:10,lineHeight:15,color:Colors.textMuted},
  moneyNote:{flexDirection:'row',alignItems:'flex-start',gap:12,padding:20,borderWidth:1,borderColor:Colors.border,borderRadius:12,backgroundColor:Colors.bgCard},
  partnerSection:{paddingHorizontal:20,paddingVertical:64},
  partnerCard:{padding:32,gap:12,borderRadius:24,borderWidth:1,borderColor:Colors.border,backgroundColor:Colors.bgCard},
  faqSection:{paddingHorizontal:20},
  questionLabel:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginBottom:12},
  faq:{borderRadius:16,borderWidth:1,borderColor:Colors.border,backgroundColor:Colors.bgCard,marginBottom:12,overflow:'hidden'},
  faqButton:{flexDirection:'row',alignItems:'center',gap:16,paddingHorizontal:24,paddingVertical:20},
  faqAnswer:{paddingHorizontal:24,paddingTop:16,paddingBottom:20,borderTopWidth:1,borderTopColor:Colors.border},
});

export function TraderPricingScreen(){
 const navigation=useNavigation<NavProp>();const signedIn=useAuthStore(state=>state.isAuthenticated);
 const card=(title:string,price:string,description:string,features:string[],label:string,action:()=>void)=><View style={pageStyles.panel}><Text style={pageStyles.label}>{title}</Text><Text style={{fontFamily:FontFamily.bold,fontSize:40,color:Colors.textPrimary}}>{price}</Text><Text style={pageStyles.body}>{description}</Text>{features.map(text=><Text key={text} style={pageStyles.body}>✓ {text}</Text>)}<Button label={label} onPress={action}/></View>;
 return <NativePage title="Trader pricing, kept separate from customer pricing.">
 <Button label="See how to join and what to prepare" variant="outline" onPress={()=>navigation.navigate('PartnerGuide')}/><Text style={pageStyles.label}>Motor Trade & Partner Accounts</Text><Text style={pageStyles.body}>This page covers the fees and rules relevant to verified motor traders using CarMazium auctions and retail marketplace features.</Text>
 {card('Auction purchase',`£${PRICING.marketplace.auction.buyerFee}`,'Paid only by the winning verified Trader, within 72 hours of the win',['No auction buyer fee if you do not win','Seller contact and deal details unlock after the fee is paid','Vehicle purchase price is paid directly to the seller','CarMazium does not hold the vehicle purchase funds'],'Browse Auctions',()=>navigation.navigate('Tabs',{screen:'Live'}))}
 {card('Retail marketplace purchase','Free','£0 CarMazium retail buyer fee',['Browse retail vehicle listings','Make offers and negotiate with sellers','Pay the seller directly for the vehicle','No CarMazium retail buyer fee'],'Browse Retail Cars',()=>navigation.navigate('Tabs',{screen:'Search'}))}
 <View style={pageStyles.panel}><Text style={pageStyles.label}>One business account for your CarMazium services.</Text><Text style={pageStyles.body}>Verified Traders use a Partner Account for auction bidding and approved business capabilities. Trader verification is required before auction bidding is enabled.</Text><Button label={signedIn?'Open Partner Account':'Create Partner Account'} onPress={()=>navigation.navigate(signedIn?'PartnerDashboard':'DealerOnboarding')}/></View>
 <Text style={pageStyles.body}>Vehicle money does not pass through CarMazium. The auction fee above is CarMazium’s platform fee; the agreed vehicle purchase price is paid directly to the seller.</Text>
 <View style={pageStyles.panel}><Text style={pageStyles.label}>Not a motor trader? See customer pricing instead.</Text><Text style={pageStyles.body}>Customer pricing covers selling by auction, £1 retail listings and retail buying.</Text><Button label="Customer Pricing" variant="outline" onPress={()=>navigation.navigate('Pricing')}/></View>
 </NativePage>;
}
