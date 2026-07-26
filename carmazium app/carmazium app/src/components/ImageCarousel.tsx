import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
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
}) => {
  const data = images.slice(0, maxImages);
  const [index, setIndex] = useState(0);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = Math.round(e.nativeEvent.contentOffset.x / width);
      setIndex(Math.max(0, Math.min(i, data.length - 1)));
    },
    [width, data.length],
  );

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
    <View style={{ width, height }}>
      <FlatList
        data={data}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={width}
        snapToAlignment="start"
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumScrollEnd}
        keyExtractor={(uri, i) => `${uri}-${i}`}
        renderItem={({ item, index: i }) => (
          <Pressable onPress={() => onPress?.(i)} style={{ width, height }}>
            <Image
              source={{ uri: item }}
              style={{ width, height }}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          </Pressable>
        )}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
      />
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
    backgroundColor: Colors.white,
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
    color: Colors.white,
  },
});
