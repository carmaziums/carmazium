import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '../BrandIcon';
import { useDealerAccess } from '../../hooks/useDealerAccess';
import { Colors } from '../../constants/colors';
/** Persistent dealer destinations on stack pages, with the same permission gates as root tabs. */
export function DealerPageTabs() {
  const navigation=useNavigation<any>();
  const insets=useSafeAreaInsets();
  const {fontScale}=useWindowDimensions();
  const {loading,hasPermission}=useDealerAccess(true);
  const items=[
    {screen:'DealerHome',label:'Dashboard',icon:'grid-outline',permission:null},
    {screen:'DealerStock',label:'Stock',icon:'car-outline',permission:'VIEW_INVENTORY'},
    {screen:'DealerCustomers',label:'Customers',icon:'people-outline',permission:'MANAGE_CRM'},
    {screen:'DealerBuyBid',label:'Auctions',icon:'hammer-outline',permission:'VIEW_TRADE'},
  ] as const;
  return <View style={[styles.bar,{paddingBottom:insets.bottom}]}>{items.filter(i=>!i.permission||(!loading&&hasPermission(i.permission))).map(i=><TouchableOpacity key={i.screen} accessibilityRole="tab" accessibilityLabel={i.label} style={[styles.item,{minHeight:fontScale>=1.4?88:68}]} onPress={()=>navigation.navigate('Tabs',{screen:i.screen})}>
    <Ionicons name={i.icon} size={22} color={Colors.textSecondary}/><Text style={styles.text}>{i.label}</Text>
  </TouchableOpacity>)}</View>;
}
const styles=StyleSheet.create({bar:{flexDirection:'row',borderTopWidth:1,borderColor:Colors.border,backgroundColor:Colors.bgCard},item:{flex:1,alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:4},text:{fontSize:12,color:Colors.textSecondary,textAlign:'center'}});
