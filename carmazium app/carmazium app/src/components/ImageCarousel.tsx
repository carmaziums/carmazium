import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { parseVehicleImagePresentation } from '../lib/vehicleImagePresentation';
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
  /** Max images to page through; the website supports up to 100 supplied photos. */
  maxImages?: number;
  showIndicator?: boolean;
  /** Controlled page (e.g. synced with a thumbnail strip). */
  activeIndex?: number;
  /** Called when the user swipes to another page. */
  onIndexChange?: (index: number) => void;
}

// Native ScrollView paging carousel — deliberately not a JS pointer-drag
// reimplementation (that was tried and rewritten once already on web; see
// the Prompt 2 handover notes). Dots for <=5 images, "N/M" counter above
// that, matching web. Caller's own image-container View supplies
// overflow:hidden + borderRadius — this component just fills it.
export const ImageCarousel: React.FC<ImageCarouselProps> = React.memo(({
  images,
  width,
  height,
  onPress,
  maxImages = 100,
  showIndicator = true,
  activeIndex,
  onIndexChange,
}) => {
  const data = useMemo(() => images.filter(Boolean).slice(0, maxImages), [images, maxImages]);
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

  // Re-align the photo after rotation, density changes or thumbnail selection.
  useEffect(() => {
    const next = Math.max(0, Math.min(activeIndex ?? index, Math.max(0, data.length - 1)));
    if (next !== index) setIndex(next);
    scrollRef.current?.scrollTo({ x: next * width, animated: false });
  }, [activeIndex, width, data.length, data[0], index]);

  const photo = (raw: string) => {
    const display = parseVehicleImagePresentation(raw);
    return <Image source={{ uri: display.src }}
      style={{ width, height, transform: [{ scale: display.zoom }], transformOrigin: display.x + '% ' + display.y + '%' }}
      contentFit={display.fit} contentPosition={{ left: (display.x + '%') as any, top: (display.y + '%') as any }}
      transition={150} cachePolicy="memory-disk" recyclingKey={raw}/>;
  };
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
      <Pressable onPress={() => onPress?.(0)} style={{ width, height, overflow: 'hidden' }}>
        {photo(data[0])}
      </Pressable>
    );
  }

  return (
    <View style={[styles.frame, { width, height }]}>
      {/* A plain paging ScrollView, not a FlatList: this carousel sits inside
          horizontal FlatList rails (Home), and a nested same-orientation
          VirtualizedList laid its pages out wrongly on Android — the second
          photo rendered underneath the first, over the card's details. Pages are lightweight frames;
          only the visible photo and its neighbours decode image data. */}
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
          <Pressable key={`${item}-${i}`} onPress={() => onPress?.(i)} style={{ width, height, overflow: 'hidden' }}>
            {/* Only the visible photo and its neighbours are decoded. Mounting
                every photo (up to 100 per card) would make
                scrolling those screens judder. */}
            {Math.abs(i - index) <= 1 ? (
              photo(item)
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
    alignSelf: 'center',
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
