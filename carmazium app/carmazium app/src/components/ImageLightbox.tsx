import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { IconButton } from './IconButton';

interface ImageLightboxProps {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Full-screen image viewer opened from a card's image tap — mobile
// equivalent of web's ImageLightbox.tsx (Prompt: "full-screen image
// lightbox on Buy Cars cards"). Web's version is paging + prev/next +
// keyboard arrows + backdrop-click/Esc + thumbnail strip; mobile has no
// keyboard or hover, so this adapts to swipe paging + a close button +
// Android hardware-back (via Modal's onRequestClose) + an N/M counter,
// which is the same indicator language ImageCarousel already uses on cards.
export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  visible,
  images,
  initialIndex = 0,
  onClose,
}) => {
  const [index, setIndex] = useState(initialIndex);
  const listRef = useRef<FlatList<string>>(null);

  // Reset to the tapped photo every time the lightbox re-opens, and jump the
  // FlatList there without an animated scroll (which would visibly play out
  // ± an image mid-transition right as the modal appears).
  useEffect(() => {
    if (visible) {
      setIndex(initialIndex);
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: initialIndex * SCREEN_WIDTH, animated: false });
      });
    }
  }, [visible, initialIndex]);

  const onMomentumScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setIndex(Math.max(0, Math.min(i, images.length - 1)));
  }, [images.length]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <FlatList
          ref={listRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
          onMomentumScrollEnd={onMomentumScrollEnd}
          keyExtractor={(uri, i) => `${uri}-${i}`}
          renderItem={({ item }) => (
            <View style={styles.page}>
              <Image
                source={{ uri: item }}
                style={styles.image}
                contentFit="contain"
                transition={150}
              />
            </View>
          )}
        />

        <IconButton
          style={styles.closeBtn}
          icon={<Ionicons name="close" size={22} color={Colors.white} />}
          onPress={onClose}
          accessibilityLabel="Close"
        />

        {images.length > 1 && (
          <View style={styles.counterBadge} pointerEvents="none">
            <Text style={styles.counterText}>{index + 1} / {images.length}</Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  closeBtn: {
    position: 'absolute',
    top: 48,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.blackAlpha50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBadge: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: Colors.blackAlpha75,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  counterText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.white,
  },
});
