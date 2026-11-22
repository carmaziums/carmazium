import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/MainStackNavigator';
import { Colors } from '../../constants/colors';

type RetiredRoute = 'ProviderCapabilities' | 'ProviderVerification' | 'ProviderMatching';
type Props = NativeStackScreenProps<MainStackParamList, RetiredRoute>;

/** Keep old deep links and notification targets, without retaining legacy settings UI. */
export function LegacyProviderRouteRedirectScreen({ navigation, route }: Props) {
  useEffect(() => {
    const section = route.name === 'ProviderMatching' ? 'preferences'
      : route.name === 'ProviderVerification' ? 'business' : 'services';
    const capabilityId = route.name !== 'ProviderCapabilities' && route.params
      ? (route.params as { capabilityId: string }).capabilityId
      : undefined;
    navigation.replace('PartnerDashboard', { openSection: section, capabilityId });
  }, [navigation, route.name, route.params]);
  return <View style={styles.container}><ActivityIndicator accessibilityLabel="Opening TradeXchange" color={Colors.accent}/></View>;
}
const styles=StyleSheet.create({container:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:Colors.bgPrimary}});
