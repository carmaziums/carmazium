import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Animated as RNAnimated,
} from 'react-native';
// expo-image over react-native's Image: caching/recycling — these hero slides
// are large, full-bleed images shown on the most-visited screen (Home).
import { Image } from 'expo-image';
import { Ionicons } from '@/components/BrandIcon';
import { CarListing, formatPrice } from '../data/listings';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 280;
const SLIDE_WIDTH = SCREEN_WIDTH - 48;

interface HeroCarouselProps {
  listings: CarListing[];
  onPress: (listing: CarListing) => void;
}

// Hoisted + memoized so FlatList only re-renders the slide whose props
// actually changed (mobile-audit.md P3/P4).
const HeroSlide: React.FC<{ item: CarListing; onPress: (listing: CarListing) => void }> = React.memo(({ item, onPress }) => (
  <TouchableOpacity
    style={styles.slide}
    onPress={() => onPress(item)}
    activeOpacity={0.92}
  >
    <Image
      source={{ uri: item.images[0] }}
      style={styles.image}
      contentFit="cover"
      transition={200}
      cachePolicy="memory-disk"
    />

    {/* Dark bottom gradient overlay */}
    <View style={styles.overlay} />

    {/* Top badge */}
    <View style={styles.topRow}>
      <View style={styles.featuredPill}>
        <View style={styles.featuredDot} />
        <Text style={styles.featuredLabel}>FEATURED</Text>
      </View>
      <View style={styles.categoryPill}>
        <Text style={styles.categoryText}>{item.category.toUpperCase()}</Text>
      </View>
    </View>

    {/* Bottom info */}
    <View style={styles.info}>
      <Text style={styles.makeLabel}>{item.make.toUpperCase()}</Text>
      <Text style={styles.modelLabel}>
        {item.model} {item.variant}
      </Text>
      <View style={styles.bottomRow}>
        <Text style={styles.price}>{formatPrice(item.price)}</Text>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>View</Text>
          <Ionicons name="arrow-forward" size={12} color={Colors.white} />
        </View>
      </View>
      <View style={styles.quickSpecs}>
        <Text style={styles.specItem}>{item.year}</Text>
        <View style={styles.specDot} />
        <Text style={styles.specItem}>{item.bhp} bhp</Text>
        <View style={styles.specDot} />
        <Text style={styles.specItem}>{item.zeroToSixty}s 0-60</Text>
      </View>
    </View>
  </TouchableOpacity>
));

export const HeroCarousel: React.FC<HeroCarouselProps> = ({ listings, onPress }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new RNAnimated.Value(0)).current;
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const featured = listings.filter((l) => l.isFeatured);

  const startAutoPlay = () => {
    autoPlayRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % featured.length;
        flatListRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 4000);
  };

  useEffect(() => {
    startAutoPlay();
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, []);

  const handleScrollEnd = (e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SLIDE_WIDTH);
    setActiveIndex(index);
  };

  const handleUserScroll = () => {
    if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    startAutoPlay();
  };

  const renderSlide = useCallback(
    ({ item }: { item: CarListing }) => <HeroSlide item={item} onPress={onPress} />,
    [onPress],
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={featured}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={SLIDE_WIDTH + 12}
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        onScroll={RNAnimated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollBeginDrag={handleUserScroll}
        renderItem={renderSlide}
      />

      {/* Dot indicators */}
      <View style={styles.dots}>
        {featured.map((_, i) => {
          const dotOpacity = scrollX.interpolate({
            inputRange: [
              (i - 1) * SLIDE_WIDTH,
              i * SLIDE_WIDTH,
              (i + 1) * SLIDE_WIDTH,
            ],
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });
          const dotWidth = scrollX.interpolate({
            inputRange: [
              (i - 1) * SLIDE_WIDTH,
              i * SLIDE_WIDTH,
              (i + 1) * SLIDE_WIDTH,
            ],
            outputRange: [6, 20, 6],
            extrapolate: 'clamp',
          });
          return (
            <RNAnimated.View
              key={i}
              style={[
                styles.dot,
                {
                  width: dotWidth,
                  opacity: dotOpacity,
                  backgroundColor: i === activeIndex ? Colors.accent : Colors.textMuted,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: 24,
    gap: 12,
  },
  slide: {
    width: SLIDE_WIDTH,
    height: HERO_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    gap: 8,
  },
  featuredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  featuredDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.white,
  },
  featuredLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.white,
    letterSpacing: 1.2,
  },
  categoryPill: {
    backgroundColor: Colors.blackAlpha50,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha15,
  },
  categoryText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.size9,
    color: Colors.white,
    letterSpacing: 1,
  },
  info: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 18,
    backgroundColor: Colors.blackAlpha55,
  },
  makeLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.accent,
    letterSpacing: 2,
    marginBottom: 2,
  },
  modelLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.white,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  price: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.xl,
    color: Colors.white,
    letterSpacing: -0.3,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  ctaText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  quickSpecs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  specItem: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.65)',
  },
  specDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 14,
  },
  dot: {
    height: 5,
    borderRadius: 2.5,
  },
});
