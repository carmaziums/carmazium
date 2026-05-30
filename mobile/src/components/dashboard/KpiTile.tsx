import React from 'react';
import { View, Text } from 'react-native';
import { FONT } from '@/constants/tokens';

export interface KpiTileProps {
  label:   string;
  value:   number | string;
  accent?: boolean;
  sub?:    string;
}

export function KpiTile({ label, value, accent = false, sub }: KpiTileProps) {
  const displayValue = typeof value === 'number'
    ? value.toLocaleString('en-GB')
    : value;

  return (
    <View
      className={`flex-1 items-center p-4 bg-[#13182a] rounded-[18px] border ${
        accent ? 'border-[#ff0037]/30' : 'border-white/5'
      }`}
    >
      <Text
        className="text-white text-2xl font-bold"
        style={{ fontFamily: FONT.mono }}
      >
        {displayValue}
      </Text>
      {sub && (
        <Text
          className="text-white/30 text-[8px] tracking-widest uppercase mt-0.5"
          style={{ fontFamily: FONT.bodyBold }}
        >
          {sub}
        </Text>
      )}
      <Text
        className="text-white/40 text-[9px] tracking-widest mt-1 uppercase"
        style={{ fontFamily: FONT.bodyBold }}
      >
        {label}
      </Text>
    </View>
  );
}
