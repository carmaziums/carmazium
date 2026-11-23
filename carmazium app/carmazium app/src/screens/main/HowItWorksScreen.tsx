import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { Button } from '../../components/Button';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import guides from '../../data/marketplaceGuides.json';

function Timeline({steps,start=0}:{steps:{title:string;desc:string;tag?:string}[];start?:number}){
 return <View>{steps.map((step,i)=><View key={step.title} style={s.step}><Text style={s.number}>{String(start+i+1).padStart(2,'0')}</Text><View style={s.stepBody}><Text style={s.label}>{step.title}</Text><Text style={s.body}>{step.desc}</Text>{step.tag&&<Text style={s.tag}>{step.tag}</Text>}</View></View>)}</View>;
}
function Receipt({kind}:{kind:'seller'|'buyer'}){
 const receipt=guides.marketplace.RECEIPTS[kind];
 return <View style={s.panel}><Text style={s.eyebrow}>{receipt.label}</Text>{receipt.rows.map(row=><View key={row.k} style={s.receiptRow}><View style={{flex:1}}><Text style={s.label}>{row.k}</Text><Text style={s.small}>{row.note}</Text></View><Text style={s.amount}>{row.v}</Text></View>)}<View style={s.receiptRow}><Text style={[s.label,{flex:1}]}>{receipt.total.k}</Text><Text style={[s.amount,{color:Colors.accent}]}>{receipt.total.v}</Text></View><Text style={s.small}>Example figures only: not live bids, a confirmed valuation, or a guarantee of sale proceeds.</Text></View>;
}
function PhotoBreak({image,quote}:{image:string;quote:string}){
 return <View style={s.photoBreak}><Image source={{uri:'https://www.carmazium.com/assets/images/'+image}} contentFit="cover" style={StyleSheet.absoluteFillObject}/><View style={[StyleSheet.absoluteFillObject,{backgroundColor:'#02061799'}]}/><Text style={s.quote}>{quote}</Text></View>;
}
export function HowItWorksScreen({navigation}:any){
 const insets=useSafeAreaInsets(),{height}=useWindowDimensions();
 return <View style={s.page}><WebsiteTopBar/><ScrollView contentContainerStyle={{paddingBottom:insets.bottom+80}}>
  <View style={[s.hero,{minHeight:Math.max(500,height*.7)}]}>
   <Image source={{uri:'https://www.carmazium.com/assets/images/live-auction-hero.webp'}} contentFit="cover" style={StyleSheet.absoluteFillObject}/>
   <LinearGradient colors={['#02061780','#020617b3','#020617']} style={StyleSheet.absoluteFillObject}/>
   <Text accessibilityRole="header" style={s.heroTitle}>The Future of Car Trading is Here</Text>
   <Text style={s.heroBody}>Sellers can list in a free dealer auction or advertise to retail buyers for £1. Everyone can browse retail cars; only verified motor traders can bid in dealer auctions.</Text>
  </View>
  <View style={s.content}>
   <View style={[s.panel,{marginTop:-40}]}>{guides.marketplace.TRUST_STRIP.map(item=><Text key={item.label} style={[s.label,{textAlign:'center'}]}>{item.label}</Text>)}</View>
   <Text style={s.eyebrow}>For Sellers</Text><Text accessibilityRole="header" style={s.heading}>How it works for sellers</Text>
   <Text style={s.body}>List in the dealer auction without a seller fee, let verified traders compete, and receive £100 for qualifying sales after an approved handover.</Text>
   <Timeline steps={guides.marketplace.SELLER_STEPS.slice(0,3)}/><PhotoBreak image="blog-keys.webp" quote="The dealer pays you. Not us."/><Timeline steps={guides.marketplace.SELLER_STEPS.slice(3)} start={3}/><Receipt kind="seller"/>
   <Button label="Start Selling For Free" onPress={()=>navigation.navigate('SellLanding',{listingType:'AUCTION'})}/>
   <Text style={s.eyebrow}>For Verified Motor Traders</Text><Text accessibilityRole="header" style={s.heading}>How auctions work for dealers</Text>
   <Text style={s.body}>Only verified dealer accounts can place bids. Retail customers can browse and buy cars through the separate retail marketplace.</Text>
   <Timeline steps={guides.marketplace.DEALER_STEPS.slice(0,3)}/><PhotoBreak image="featured-suv.webp" quote="Pay the vehicle price directly to the seller."/><Timeline steps={guides.marketplace.DEALER_STEPS.slice(3)} start={3}/><Receipt kind="buyer"/>
   <Button label="Learn About Dealer Auctions" onPress={()=>navigation.navigate('AuctionGuide')}/>
   <View style={s.panel}><Text style={s.label}>Buying as a private customer?</Text><Text style={s.body}>You do not need to bid in a trade auction. Browse available retail listings and contact the seller through the retail purchase process.</Text><Button label="Browse retail cars" onPress={()=>navigation.navigate('Tabs',{screen:'Search'})}/></View>
   <View style={s.panel}><Text style={s.eyebrow}>Live Auctions</Text><Text style={s.heading}>Fairness Built-In with Anti-Snipe Tech</Text><Text style={s.body}>Say goodbye to last-second “sniping”. Our auction system simulates a real auction room—if a bid comes in during the final 3 minutes, 3 minutes are added to the scheduled closing time, giving bidders more time to respond.</Text>
    <Text style={s.label}>Community Driven</Text><Text style={s.body}>Bidding requires dealer verification, with marketplace controls to help detect suspicious activity.</Text><Text style={s.label}>True Market Value</Text><Text style={s.body}>Dealer competition helps test trade-market demand, but a final price is not guaranteed.</Text>
    <Text style={s.eyebrow}>EXAMPLE · NOT LIVE</Text><Text style={s.small}>Demo auction · Example time remaining</Text><Text style={[s.amount,{fontSize:36,color:Colors.accent}]}>00:01:58</Text><Text style={s.small}>A bid in the final 3 minutes adds 3 minutes to the closing time</Text>
    {guides.marketplace.BID_LOG.map(row=><View key={row.t} style={s.receiptRow}><Text style={s.small}>{row.t}</Text><Text style={s.amount}>{row.amount}</Text>{row.reset&&<Text style={s.small}>3 min added</Text>}</View>)}
    <Text style={s.small}>Demonstration amounts, bid times and countdown only. No live auction activity is shown here.</Text>
   </View>
   <Text style={s.heading}>Complete Peace of Mind</Text><Text style={s.body}>Everything you need to handle your vehicle effortlessly.</Text>
   {[['Delivery','Via trusted 3rd party'],['Warranty','Via 3rd-party providers'],['Direct Deals','Buyer & seller connect'],['Support','Mon–Fri, 9am–6pm UK time']].map(([title,detail])=><View key={title} style={s.panel}><Text style={s.label}>{title}</Text><Text style={s.body}>{detail}</Text></View>)}
  </View>
 </ScrollView></View>;
}
export function AuctionGuideScreen({navigation}:any){
 const insets=useSafeAreaInsets(),[open,setOpen]=useState<string[]>([]);
 return <View style={s.page}><WebsiteTopBar/><ScrollView contentContainerStyle={[s.content,{paddingTop:56,paddingBottom:insets.bottom+60}]}>
  <Button label="Back to TradeXchange" variant="ghost" onPress={()=>navigation.navigate('Services')}/>
  <Text style={s.eyebrow}>CarMazium TradeXchange</Text>
  <Text accessibilityRole="header" style={s.heading}>Free vehicle auctions for sellers. Trade stock for verified dealers.</Text>
  <Text style={s.body}>Vehicle payments go directly between buyer and seller. The standard buyer fee is £125 after a confirmed win, subject to an approved waiver. A qualifying sale can earn a £100 seller incentive.</Text>
  <View style={s.panel}><Text accessibilityRole="header" style={s.heading}>Sell a vehicle at auction</Text><Timeline steps={guides.auction.SELLER_STEPS}/><Button label="Start free auction listing" onPress={()=>navigation.navigate('SellLanding',{listingType:'AUCTION'})}/></View>
  <View style={s.panel}><Text accessibilityRole="header" style={s.heading}>Buy vehicles at auction</Text><Timeline steps={guides.auction.BUYER_STEPS}/><Button label="Browse dealer auctions" onPress={()=>navigation.navigate('Tabs',{screen:'Live'})}/><Button label="Partner Account guide" variant="outline" onPress={()=>navigation.navigate('PartnerGuide')}/></View>
  <View style={s.panel}><Text style={s.label}>Buying as a private customer?</Text><Text style={s.body}>Browse retail cars without bidding in a trade auction.</Text><Button label="Browse retail cars" onPress={()=>navigation.navigate('Tabs',{screen:'Search'})}/></View>
  <Text accessibilityRole="header" style={s.heading}>The Rules, Explained</Text><Text style={s.body}>The fine print, in plain English.</Text>{guides.auction.RULES.map(rule=><View key={rule.term} style={s.panel}><Text style={s.label}>{rule.term}</Text><Text style={s.body}>{rule.def}</Text></View>)}
  <Text accessibilityRole="header" style={s.heading}>Trust & Transparency</Text><Text style={s.body}>Review seller disclosures and available history before bidding.</Text>{guides.auction.TRUST.map(item=><View key={item.title} style={s.panel}><Text style={s.label}>{item.title}</Text><Text style={s.body}>{item.desc}</Text></View>)}
  <Text accessibilityRole="header" style={s.heading}>FAQ</Text><Button label="Get in touch" variant="ghost" onPress={()=>navigation.navigate('Contact')}/>
  {guides.auction.FAQS.map(faq=><View key={faq.q} style={s.panel}><TouchableOpacity accessibilityRole="button" accessibilityLabel={faq.q} accessibilityState={{expanded:open.includes(faq.q)}} onPress={()=>setOpen(prev=>prev.includes(faq.q)?prev.filter(q=>q!==faq.q):[...prev,faq.q])}><Text style={s.label}>{faq.q} {open.includes(faq.q)?'−':'+'}</Text></TouchableOpacity>{open.includes(faq.q)&&<Text style={s.body}>{faq.a}</Text>}</View>)}
 </ScrollView></View>;
}
const s=StyleSheet.create({
 page:{flex:1,backgroundColor:Colors.bgPrimary},content:{paddingHorizontal:20,gap:24},
 hero:{paddingHorizontal:24,paddingVertical:100,gap:32,alignItems:'center',justifyContent:'center'},heroTitle:{fontFamily:FontFamily.bold,fontSize:48,lineHeight:54,color:'#fff',textAlign:'center',letterSpacing:-1},heroBody:{fontFamily:FontFamily.medium,fontSize:20,lineHeight:32,color:'#e2e8f0',textAlign:'center'},
 heading:{fontFamily:FontFamily.bold,fontSize:30,lineHeight:38,color:Colors.textPrimary,marginTop:24},label:{fontFamily:FontFamily.bold,fontSize:16,lineHeight:24,color:Colors.textPrimary},body:{fontFamily:FontFamily.regular,fontSize:14,lineHeight:24,color:Colors.textSecondary},small:{fontFamily:FontFamily.regular,fontSize:12,lineHeight:20,color:Colors.textMuted},
 eyebrow:{fontFamily:FontFamily.bold,fontSize:11,letterSpacing:1.8,textTransform:'uppercase',color:Colors.accent,marginTop:12},panel:{padding:24,gap:16,borderWidth:1,borderColor:Colors.border,borderRadius:18,backgroundColor:Colors.bgCard},
 step:{flexDirection:'row',alignItems:'flex-start',gap:14,paddingVertical:16},number:{fontFamily:FontFamily.bold,color:Colors.accent,fontSize:15,paddingTop:3,width:30},stepBody:{flex:1,gap:7,borderBottomWidth:1,borderColor:Colors.border,paddingBottom:16},tag:{alignSelf:'flex-start',borderRadius:20,borderWidth:1,borderColor:Colors.border,paddingVertical:5,paddingHorizontal:12,fontFamily:FontFamily.medium,fontSize:12,color:Colors.textSecondary},
 receiptRow:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:16,justifyContent:'space-between',paddingVertical:10,borderBottomWidth:1,borderColor:Colors.border},amount:{fontFamily:FontFamily.bold,color:Colors.textPrimary,fontSize:20},photoBreak:{height:280,borderRadius:16,overflow:'hidden',justifyContent:'center',padding:32},quote:{fontFamily:FontFamily.bold,fontSize:22,lineHeight:32,color:'#fff'},toggle:{flexDirection:'row',flexWrap:'wrap',gap:8,justifyContent:'center'},pill:{paddingVertical:14,paddingHorizontal:24,borderRadius:28,borderWidth:1,borderColor:Colors.border},
});
