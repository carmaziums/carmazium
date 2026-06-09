import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  StatusBar,
  ImageBackground,
  Animated as RNAnimated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@/components/BrandIcon';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

interface SlideData {
  id: string;
  eyebrow: string;
  headlineLight: string;
  headlineRed: string;
  description: string;
  buttonLabel: string;
  image: any;
}

const SLIDES: SlideData[] = [
  {
    id: '1',
    eyebrow: 'WELCOME TO CARMAZIUM',
    headlineLight: "Britain's most\ncurated",
    headlineRed: 'car marketplace.',
    description:
      'Verified sellers, transparent pricing, live auctions. Buy or sell with the kind of confidence the showroom forgot.',
    buttonLabel: 'GET STARTED',
    image: require('../../../assets/images/onboarding_car1.png'),
  },
  {
    id: '2',
    eyebrow: 'MAZIUM AI',
    headlineLight: 'Describe your\ndream car',
    headlineRed: 'in your words.',
    description:
      'No clunky filters. Tell our AI you want "a red SUV under £30k" and it does the rest — matching cars, finance, the lot.',
    buttonLabel: 'TRY IT',
    image: require('../../../assets/images/onboarding_car2.png'),
  },
  {
    id: '3',
    eyebrow: 'LIVE AUCTIONS',
    headlineLight: 'Bid in real time.',
    headlineRed: 'From anywhere.',
    description:
      'Sub-second updates, anti-snipe extensions, and proxy bidding. The gavel drops in your pocket — not someone else\'s.',
    buttonLabel: 'CONTINUE',
    image: require('../../../assets/images/onboarding_car3.png'),
  },
];

const SlideItem: React.FC<{
  item: SlideData;
  index: number;
  scrollX: RNAnimated.Value;
}> = ({ item, index, scrollX }) => {
  const inputRange = [
    (index - 1) * SCREEN_WIDTH,
    index * SCREEN_WIDTH,
    (index + 1) * SCREEN_WIDTH,
  ];

  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  const translateY = scrollX.interpolate({
    inputRange,
    outputRange: [30, 0, -30],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.slide}>
      {/* Background Image with Dark Vignette */}
      <ImageBackground
        source={item.image}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      >
        {/* Dark vertical gradient overlay to make text highly legible */}
        <LinearGradient
          colors={['rgba(10, 10, 12, 0.1)', 'rgba(10, 10, 12, 0.5)', '#0A0A0C']}
          locations={[0, 0.45, 0.85]}
          style={StyleSheet.absoluteFillObject}
        />
      </ImageBackground>

      {/* Content Section */}
      <RNAnimated.View
        style={[styles.slideContent, { opacity, transform: [{ translateY }] }]}
      >
        {/* Eyebrow */}
        <Text style={styles.slideEyebrow}>{item.eyebrow}</Text>

        {/* Headline */}
        <View style={styles.headlineWrapper}>
          <Text style={styles.headlineLight}>{item.headlineLight}</Text>
          <Text style={styles.headlineRed}>{item.headlineRed}</Text>
        </View>

        {/* Description */}
        <Text style={styles.slideDescription}>{item.description}</Text>
      </RNAnimated.View>
    </View>
  );
};

export const OnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new RNAnimated.Value(0)).current;
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);

  const handleScroll = RNAnimated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const handleMomentumScrollEnd = useCallback((e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(index);
  }, []);

  const handlePressCTA = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
      setActiveIndex(activeIndex + 1);
    } else {
      completeOnboarding();
      navigation.navigate('Login');
    }
  };

  const handleSkip = () => {
    completeOnboarding();
    navigation.navigate('Login');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Skip Button (Static on top right) */}
      <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
        <Text style={styles.skipText}>SKIP</Text>
      </TouchableOpacity>

      {/* Horizontal Page Slider */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        renderItem={({ item, index }) => (
          <SlideItem item={item} index={index} scrollX={scrollX} />
        )}
      />

      {/* Bottom Controls (Indicators + Full width Chamfer Button) */}
      <View style={styles.controls}>
        {/* Dot Indicators */}
        <View style={styles.dotsContainer}>
          {SLIDES.map((_, i) => {
            const dotWidth = scrollX.interpolate({
              inputRange: [
                (i - 1) * SCREEN_WIDTH,
                i * SCREEN_WIDTH,
                (i + 1) * SCREEN_WIDTH,
              ],
              outputRange: [6, 24, 6],
              extrapolate: 'clamp',
            });
            const dotOpacity = scrollX.interpolate({
              inputRange: [
                (i - 1) * SCREEN_WIDTH,
                i * SCREEN_WIDTH,
                (i + 1) * SCREEN_WIDTH,
              ],
              outputRange: [0.4, 1, 0.4],
              extrapolate: 'clamp',
            });

            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.8}
                onPress={() => {
                  flatListRef.current?.scrollToIndex({ index: i, animated: true });
                  setActiveIndex(i);
                }}
              >
                <RNAnimated.View
                  style={[
                    styles.dot,
                    {
                      width: dotWidth,
                      opacity: dotOpacity,
                      backgroundColor: i === activeIndex ? Colors.accent : '#5C5C6B',
                    },
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom Diagonal Cut Full-Width Button */}
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.ctaButton}
          onPress={handlePressCTA}
        >
          <View style={styles.ctaContent}>
            <Text style={styles.ctaText}>{SLIDES[activeIndex].buttonLabel}</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={styles.ctaIcon} />
          </View>
          
          {/* Visual Chamfer diagonal cut on bottom right corner */}
          <View style={styles.chamferCut} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  slideContent: {
    position: 'absolute',
    bottom: 180,
    left: 24,
    right: 24,
  },
  slideEyebrow: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: Colors.accent,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  headlineWrapper: {
    marginBottom: 16,
  },
  headlineLight: {
    fontFamily: FontFamily.extraBold,
    fontSize: 38,
    lineHeight: 44,
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  headlineRed: {
    fontFamily: FontFamily.extraBold,
    fontSize: 38,
    lineHeight: 44,
    color: Colors.accent,
    letterSpacing: -1,
  },
  slideDescription: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 24,
    color: '#A0A0AB',
    maxWidth: SCREEN_WIDTH * 0.85,
  },
  // Skip button (Top Right)
  skipBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 44,
    right: 24,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#A0A0AB',
    letterSpacing: 1.5,
  },
  // Bottom Controls
  controls: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 44 : 30,
    left: 24,
    right: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  // Custom Chamfer CTA
  ctaButton: {
    height: 54,
    backgroundColor: Colors.accent,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  ctaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  ctaIcon: {
    marginTop: 1,
  },
  chamferCut: {
    position: 'absolute',
    bottom: -12,
    right: -12,
    width: 24,
    height: 24,
    backgroundColor: '#0A0A0C', // Cuts corner with background color
    transform: [{ rotate: '45deg' }],
  },
});
