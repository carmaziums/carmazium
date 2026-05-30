import React from 'react';
import { View, Text } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { CZM, FONT } from '@/constants/tokens';

export interface LeadFunnel {
  NEW:         number;
  CONTACTED:   number;
  QUALIFIED:   number;
  NEGOTIATING: number;
  WON:         number;
  LOST:        number;
}

interface Props {
  funnel: LeadFunnel;
}

export function LeadFunnelBar({ funnel }: Props) {
  const values = [funnel.NEW, funnel.CONTACTED, funnel.QUALIFIED, funnel.NEGOTIATING, funnel.WON, funnel.LOST];
  const total  = values.reduce((a, b) => a + b, 0);

  if (total === 0) {
    return (
      <View className="items-center py-8">
        <Text className="text-white/30 text-sm" style={{ fontFamily: FONT.body }}>
          No leads yet
        </Text>
      </View>
    );
  }

  const data = [
    { value: funnel.NEW,         label: 'NEW',    frontColor: CZM.blue },
    { value: funnel.CONTACTED,   label: 'CONT.',  frontColor: CZM.amber },
    { value: funnel.QUALIFIED,   label: 'QUAL.',  frontColor: CZM.amberLight },
    { value: funnel.NEGOTIATING, label: 'NEG.',   frontColor: CZM.red },
    { value: funnel.WON,         label: 'WON',    frontColor: CZM.emerald },
    { value: funnel.LOST,        label: 'LOST',   frontColor: CZM.fg4 },
  ];

  return (
    <BarChart
      data={data}
      barWidth={32}
      spacing={12}
      roundedTop
      hideRules
      xAxisColor={CZM.border}
      yAxisColor={CZM.border}
      yAxisTextStyle={{ color: CZM.fg3, fontFamily: FONT.bodyBold, fontSize: 10 }}
      xAxisLabelTextStyle={{ color: CZM.fg3, fontFamily: FONT.bodyBold, fontSize: 9 }}
      noOfSections={4}
      maxValue={Math.max(...values, 1)}
      isAnimated
    />
  );
}
