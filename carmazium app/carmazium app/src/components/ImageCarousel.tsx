import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';

interface ImageCarouselProps {
  images: string[];
  width: number;
  height: number;
  /** Called on tap with the index of the tapped/currently-visible page (each
   * page wraps its own Pressable so swipe gestures don't fire a tap) —
   * callers that don't care which photo was tapped (e.g. "navigate to
   * detail regardless") can just ignore the argument. */
  onPress?: (index: number) => void;
  /** Max images to page through — web parity caps this at 8 (4 interior + 4 exterior). */
  maxImages?: number;
  showIndicator?: boolean;
  /** Controlled page (e.g. synced with a thumbnail strip). */
  activeIndex?: number;
  /** Called when the user swipes to another page. */
  onIndexChange?: (index: number) => void;
}

// Native FlatList paging carousel — deliberately not a JS pointer-drag
// reimplementation (that was tried and rewritten once already on web; see
// the Prompt 2 handover notes). Dots for <=5 images, "N/M" counter above
// that, matching web. Caller's own image-container View supplies
// overflow:hidden + borderRadius — this component just fills it.
export const ImageCarousel: React.FC<ImageCarouselProps> = React.memo(({
  images,
  width,
  height,
  onPress,
  maxImages = 8,
  showIndicator = true,
  activeIndex,
  onIndexChange,
}) => {
  const data = images.slice(0, maxImages);
  const [index, setIndex] = useState(activeIndex ?? 0);
  const scrollRef = useRef<ScrollView>(null);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.x / width), data.length - 1));
      setIndex(i);
      onIndexChange?.(i);
    },
    [width, data.length, onIndexChange],
  );

  // Follow an externally chosen page (thumbnail tap).
  useEffect(() => {
    if (activeIndex == null || activeIndex === index || activeIndex >= data.length) return;
    setIndex(activeIndex);
    scrollRef.current?.scrollTo({ x: activeIndex * width, animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  if (data.length === 0) {
    // Empty media must never be replaced with a stock photo of a different car.
    return (
      <Pressable onPress={() => onPress?.(0)} accessibilityLabel="Vehicle photo unavailable"
        style={{ width, height, backgroundColor: Colors.bgSecondaryAlt, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Ionicons name="car-outline" size={28} color={Colors.textMuted} />
        <Text style={{ color: Colors.textMuted, fontFamily: FontFamily.medium, fontSize: 12 }}>No photo available</Text>
      </Pressable>
    );
  }

  if (data.length <= 1) {
    return (
      <Pressable onPress={() => onPress?.(0)} style={{ width, height }}>
        <Image
          source={{ uri: data[0] }}
          style={{ width, height }}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      </Pressable>
    );
  }

  return (
    <View style={[styles.frame, { width, height }]}>
      {/* A plain paging ScrollView, not a FlatList: this carousel sits inside
          horizontal FlatList rails (Home), and a nested same-orientation
          VirtualizedList laid its pages out wrongly on Android — the second
          photo rendered underneath the first, over the card's details. With at
          most `maxImages` (8) pages there is nothing to virtualise. */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumScrollEnd}
        style={{ width, height }}
        contentContainerStyle={styles.pages}
      >
        {data.map((item, i) => (
          <Pressable key={`${item}-${i}`} onPress={() => onPress?.(i)} style={{ width, height }}>
            {/* Only the visible photo and its neighbours are decoded. Mounting
                every page (up to 8 per card × every card on Home/Live) made
                scrolling those screens judder. */}
            {Math.abs(i - index) <= 1 ? (
              <Image
                source={{ uri: item }}
                style={{ width, height }}
                contentFit="cover"
                transition={150}
                cachePolicy="memory-disk"
                recyclingKey={item}
              />
            ) : (
              <View style={{ width, height, backgroundColor: Colors.bgSecondary }} />
            )}
          </Pressable>
        ))}
      </ScrollView>
      {showIndicator && (
        data.length <= 5 ? (
          <View style={styles.dotsRow} pointerEvents="none">
            {data.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        ) : (
          <View style={styles.counterBadge} pointerEvents="none">
            <Text style={styles.counterText}>{index + 1}/{data.length}</Text>
          </View>
        )
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  pages: { flexDirection: 'row' },
  dotsRow: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.whiteAlpha50,
  },
  dotActive: {
    width: 12,
    backgroundColor: Colors.onAccent,
  },
  counterBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: Colors.blackAlpha75,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  counterText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.onAccent,
  },
});
