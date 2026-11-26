import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { IconButton } from './IconButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clampPhotoIndex, fullscreenPhotoCounter, fullscreenPhotoAccessibilityLabel } from '../lib/fullscreenGalleryNavigation';
import { parseVehicleImagePresentation } from '../lib/vehicleImagePresentation';

interface ImageLightboxProps {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
}


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
  onIndexChange,
}) => {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(() => clampPhotoIndex(initialIndex, images.length));
  const selectedIndex = clampPhotoIndex(index, images.length);
  const listRef = useRef<FlatList<string>>(null);

  // Reopening starts at the tapped photo. Rotation keeps the selected photo.
  useEffect(() => {
    if (visible) setIndex(clampPhotoIndex(initialIndex, images.length));
  }, [visible, initialIndex, images.length]);

  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: selectedIndex * width, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, selectedIndex, width]);

  const onMomentumScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = clampPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / width), images.length);
    setIndex(next);
    onIndexChange?.(next);
  }, [images.length, width, onIndexChange]);

  if (!images.length) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
      presentationStyle="overFullScreen"
    >
      <View style={styles.backdrop}>
        <FlatList
          ref={listRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={clampPhotoIndex(initialIndex, images.length)}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          extraData={width}
          onMomentumScrollEnd={onMomentumScrollEnd}
          keyExtractor={(uri, i) => `${uri}-${i}`}
          renderItem={({ item }) => (
            <View style={[styles.page, { width, height }]}>
              <Image
                source={{ uri: parseVehicleImagePresentation(item).src }}
                style={{ width, height: Math.max(0, height - insets.top - insets.bottom - 100) }}
                contentFit="contain"
                transition={150}
              />
            </View>
          )}
        />

        <IconButton
          style={[styles.closeBtn, { top: insets.top + 12 }]}
          icon={<Ionicons name="close" size={22} color={Colors.onAccent} />}
          onPress={onClose}
          accessibilityLabel="Close"
        />

        {images.length > 1 && (
          <View style={[styles.counterBadge, { bottom: insets.bottom + 16 }]} pointerEvents="none"
            accessible accessibilityRole="text" accessibilityLabel={fullscreenPhotoAccessibilityLabel(selectedIndex, images.length)}>
            <Text style={styles.counterText}>{fullscreenPhotoCounter(selectedIndex, images.length)}</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
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
    alignSelf: 'center',
    backgroundColor: Colors.blackAlpha75,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  counterText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size12,
    color: Colors.onAccent,
  },
});
