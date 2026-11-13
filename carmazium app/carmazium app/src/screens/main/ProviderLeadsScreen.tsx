import React from 'react';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HamburgerButton } from '../../components/HamburgerButton';
import { Colors } from '../../constants/colors';
export const ProviderLeadsScreen: React.FC<any> = () => {
  const inset = useSafeAreaInsets();
  return <ScrollView style={{flex:1,backgroundColor:Colors.bgPrimary}} contentContainerStyle={{padding:24,paddingTop:inset.top+20,gap:20}}>
    <HamburgerButton />
    <Text style={{fontSize:24,fontWeight:'700',color:Colors.textPrimary}}>Managed by CarMazium admin</Text>
    <Text style={{color:Colors.textSecondary}}>Finance and warranty enquiries are managed directly by the CarMazium team. The provider inbox is no longer available.</Text>
  </ScrollView>;
};
