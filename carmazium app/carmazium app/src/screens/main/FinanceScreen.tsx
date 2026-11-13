import React from 'react';
import { ScrollView, Text, View, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { HamburgerButton } from '../../components/HamburgerButton';
export const FinanceScreen: React.FC = () => {
  const inset = useSafeAreaInsets();
  return <ScrollView style={{flex:1,backgroundColor:Colors.bgPrimary}} contentContainerStyle={{padding:24,paddingTop:inset.top+20,gap:20}}>
    <HamburgerButton />
    <Text style={{fontSize:26,fontWeight:'700',color:Colors.textPrimary}}>Vehicle Finance</Text>
    <Text style={{color:Colors.textSecondary}}>On a participating retail listing, choose Apply for Finance. Enter your name, email and phone number so the CarMazium admin team can follow up, then continue to the Pulse Cars Limited Jigsaw Finance application.</Text>
    <Text style={{color:Colors.textSecondary}}>Sellers choose whether to display the calculator. CarMazium does not provide finance or make lending decisions. Jigsaw is a credit broker, not a lender. Finance is subject to status and lender approval. CarMazium charges its finance partner a fee for a successful application.</Text>
    <Text accessibilityRole="link" onPress={() => Linking.openURL('https://www.carmazium.com/search')} style={{color:Colors.accent}}>Browse cars</Text>
    <View style={{gap:12}}><Text style={{fontSize:20,fontWeight:'700',color:Colors.textPrimary}}>Finance providers</Text><Text style={{color:Colors.textSecondary}}>Want to offer vehicle finance through CarMazium? Contact our team directly to discuss a partnership. Finance-provider registration is not available online.</Text><Text accessibilityRole="link" onPress={() => Linking.openURL('https://www.carmazium.com/contact')} style={{color:Colors.accent}}>Contact the team</Text></View>
  </ScrollView>;
};
