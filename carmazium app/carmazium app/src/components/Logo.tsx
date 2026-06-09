import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../constants/colors';
import { FontFamily } from '../constants/typography';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', style }) => {
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  const circleSize = isSm ? 24 : isLg ? 60 : 40;
  const fontSize = isSm ? 16 : isLg ? 36 : 24;
  const gap = isSm ? 6 : isLg ? 14 : 10;
  const letterSpacing = isSm ? 1 : isLg ? 3 : 2;

  return (
    <View style={[styles.container, { gap }, style]}>
      {/* Red circle with white C */}
      <View
        style={[
          styles.circle,
          {
            width: circleSize,
            height: circleSize,
            borderRadius: circleSize / 2,
          },
        ]}
      >
        <Text
          style={[
            styles.circleText,
            {
              fontSize: circleSize * 0.55,
              lineHeight: circleSize,
              // Offset slightly for optical centering
              marginTop: isSm ? -1 : isLg ? -3 : -2,
            },
          ]}
        >
          C
        </Text>
      </View>

      {/* CARMAZIUM Text split into CAR (white) and MAZIUM (red) */}
      <View style={styles.textContainer}>
        <Text style={[styles.textBase, { fontSize, letterSpacing }, styles.textWhite]}>
          CAR
        </Text>
        <Text style={[styles.textBase, { fontSize, letterSpacing }, styles.textRed]}>
          MAZIUM
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleText: {
    fontFamily: FontFamily.extraBold,
    color: Colors.white,
    textAlign: 'center',
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textBase: {
    fontFamily: FontFamily.extraBold,
  },
  textWhite: {
    color: Colors.white,
  },
  textRed: {
    color: Colors.accent,
  },
});
