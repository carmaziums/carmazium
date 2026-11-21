import React, { useState } from 'react';
import { Alert, Linking, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@/components/BrandIcon';
import { Colors, themeStatusBarStyle } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import type { MainStackParamList } from '../../navigation/MainStackNavigator';
import { IconButton } from '../../components/IconButton';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';

// Copy follows the current website About page; no invented marketplace totals.
const values = [{"title": "Clarity first", "text": "Fees, marketplace roles and service workflows should be understandable before a user commits to an action."}, {"title": "Trust through information", "text": "Vehicle data, seller information and relevant checks are presented so buyers can make their own informed decisions."}, {"title": "Direct marketplace relationships", "text": "CarMazium provides the platform and workflow while buyers and sellers remain responsible for the vehicle transaction between them."}];
const differentiators = [{"title": "Auction and retail routes", "text": "Sellers can choose the route that fits their vehicle rather than being forced into one selling method."}, {"title": "Compare before committing", "text": "Buyers can browse listings, compare vehicles and review the information supplied before arranging the next step."}, {"title": "One Partner Account", "text": "Automotive businesses can use one Partner Account and add the services or capabilities relevant to the work they provide."}];
const questions = [{"title": "Is CarMazium involved in the sale of vehicles?", "text": "CarMazium is a marketplace platform. Buyers and sellers agree the vehicle transaction between themselves, and CarMazium does not hold the vehicle purchase funds."}, {"title": "How does vehicle information work?", "text": "Listings can include vehicle data, photos, history information and other seller-provided details. Buyers should review the available information and arrange any inspection or checks they consider appropriate before completing a purchase."}, {"title": "How do auctions work?", "text": "Auction listings use the current auction workflow and connect the successful verified dealer bidder with the seller so they can arrange the next steps. Vehicle payment remains between the buyer and seller."}, {"title": "What is a Partner Account?", "text": "A Partner Account is the main business account. Vehicle Dealer, Delivery & Recovery and Vehicle Inspection are capabilities or services used from that business architecture rather than separate customer account types."}, {"title": "How do finance and warranty services work?", "text": "Buyers apply for finance from participating listings: enter your name, email and phone, then continue to the selected provider’s application. CarMazium does not provide finance and charges its finance partner a fee for a successful application. Finance providers should contact our team directly. Warranty enquiries and partnerships are handled directly by CarMazium admin."}];

export const AboutScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [openQuestion, setOpenQuestion] = useState<number | null>(0);
  const browse = () => navigation.navigate('Tabs', { screen: 'Search', params: { _t: Date.now() } } as any);
  const action = (label: string, onPress: () => void) => <TouchableOpacity accessibilityRole="button" onPress={onPress} style={s.action}><Text style={s.actionText}>{label} →</Text></TouchableOpacity>;
  return <View style={s.container}>
    <StatusBar barStyle={themeStatusBarStyle} backgroundColor={Colors.bgPrimary} />
    <WebsiteTopBar />
    <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 80 }]}>
      <Text style={s.eyebrow}>ABOUT CARMAZIUM</Text>
      <Text accessibilityRole="header" style={s.hero}>A clearer way to connect the UK vehicle marketplace</Text>
      <Text style={s.body}>CarMazium brings buying, selling, dealer access and automotive services into one platform while keeping the role of each participant clear.</Text>
      {action('Browse cars', browse)}
      {action('Sell a car', () => navigation.navigate('SellLanding'))}
      <Text style={s.eyebrow}>OUR STORY</Text>
      <Text accessibilityRole="header" style={s.heading}>Built around a simple marketplace problem</Text>
      <Text style={s.body}>Buying and selling a used vehicle often means jumping between advertising sites, dealer channels, vehicle checks and separate service providers. CarMazium was created to bring those journeys closer together without pretending the platform itself is the buyer, seller, lender or warranty provider.</Text>
      <Text style={s.body}>The result is a marketplace with distinct routes for retail listings, dealer auctions and supporting automotive services. Each route is designed to make the next action easier to understand while preserving the responsibilities of the people and businesses actually completing the transaction.</Text>
      <View style={s.card}><Text style={s.cardTitle}>Marketplace, not middleman</Text><Text style={s.body}>CarMazium provides the digital tools; vehicle sale funds are handled directly between buyer and seller.</Text></View>
      <Text style={s.eyebrow}>WHAT THE PLATFORM DOES</Text>
      <Text accessibilityRole="header" style={s.heading}>Different journeys, one connected platform</Text>
      {[
        {title:'For sellers',text:'Choose between the available auction and retail routes, create the vehicle listing and deal directly with the successful buyer.',label:'Explore selling',onPress:()=>navigation.navigate('SellLanding')},
        {title:'For buyers',text:'Browse live vehicles, compare listings and use the available listing information and checks before agreeing a purchase.',label:'Browse vehicles',onPress:browse},
        {title:'For automotive businesses',text:'Use one Partner Account for the business and the relevant approved capabilities, including Vehicle Dealer and supported TradeXchange services.',label:'Explore TradeXchange',onPress:()=>navigation.navigate('Services')},
      ].map(item=><View key={item.title} style={s.card}><Text style={s.cardTitle}>{item.title}</Text><Text style={s.body}>{item.text}</Text>{action(item.label,item.onPress)}</View>)}
      <Text style={s.eyebrow}>HOW WE THINK ABOUT TRUST</Text>
      <Text accessibilityRole="header" style={s.heading}>Useful information over empty claims</Text>
      <Text style={s.body}>CarMazium’s trust model is based on clearer information, defined platform roles and practical checks — not unsupported awards, rankings or invented marketplace statistics.</Text>
      {values.map(item=><View key={item.title} style={s.card}><Text style={s.cardTitle}>{item.title}</Text><Text style={s.body}>{item.text}</Text></View>)}
      <Text style={s.eyebrow}>WHAT MAKES CARMAZIUM DIFFERENT</Text>
      <Text accessibilityRole="header" style={s.heading}>Choice without mixing the workflows</Text>
      {differentiators.map(item=><View key={item.title} style={s.card}><Text style={s.cardTitle}>{item.title}</Text><Text style={s.body}>{item.text}</Text></View>)}
      <View style={s.card}><Text style={s.cardTitle}>Our location</Text><Text style={s.body}>{'181-187 Hunters Rd\nLozells, Birmingham\nB19 1ES, United Kingdom'}</Text></View>
      <View style={s.card}><Text style={s.cardTitle}>Contact CarMazium</Text>{action('0121 838 5040',()=>{void Linking.openURL('tel:+441218385040').catch(()=>Alert.alert('Contact CarMazium','Call 0121 838 5040.'));})}<Text style={s.body}>Monday – Friday, 9am – 6pm UK time</Text></View>
      <Text style={s.eyebrow}>COMMON QUESTIONS</Text>
      <Text accessibilityRole="header" style={s.heading}>About the marketplace model</Text>
      {questions.map((item,index)=><View key={item.title} style={s.card}>
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: openQuestion===index }} onPress={()=>setOpenQuestion(openQuestion===index?null:index)} style={s.question}><Text style={[s.cardTitle,{flex:1}]}>{item.title}</Text><Ionicons name={openQuestion===index?'chevron-up':'chevron-down'} size={20} color={Colors.textPrimary} /></TouchableOpacity>
        {openQuestion===index&&<Text style={s.body}>{item.text}</Text>}
      </View>)}
      {action('How it works',()=>navigation.navigate('HowItWorks'))}
      {action('Browse cars',browse)}
    </ScrollView>
  </View>;
};
const s=StyleSheet.create({
  container:{flex:1,backgroundColor:Colors.bgPrimary},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingVertical:12,gap:10},
  headerTitle:{fontFamily:FontFamily.bold,fontSize:18,color:Colors.textPrimary,flex:1,textAlign:'center'},
  content:{paddingHorizontal:20,gap:12,paddingTop:18},
  eyebrow:{fontFamily:FontFamily.extraBold,fontSize:11,letterSpacing:1.1,color:Colors.accent,marginTop:20},
  hero:{fontFamily:FontFamily.extraBold,fontSize:32,lineHeight:39,color:Colors.textPrimary,letterSpacing:-.7},
  heading:{fontFamily:FontFamily.bold,fontSize:24,lineHeight:31,color:Colors.textPrimary},
  body:{fontFamily:FontFamily.regular,fontSize:14,lineHeight:24,color:Colors.textSecondary,marginTop:6},
  card:{padding:18,borderWidth:1,borderColor:Colors.border,borderRadius:16,backgroundColor:Colors.bgCard,gap:6},
  cardTitle:{fontFamily:FontFamily.bold,fontSize:17,lineHeight:25,color:Colors.textPrimary},
  action:{minHeight:44,justifyContent:'center',paddingVertical:10},
  actionText:{fontFamily:FontFamily.bold,fontSize:14,color:Colors.textPrimary,textDecorationLine:'underline'},
  question:{minHeight:44,flexDirection:'row',alignItems:'center',gap:10},
});
