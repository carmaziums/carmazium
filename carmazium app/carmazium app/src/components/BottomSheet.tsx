import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize } from '../constants/typography';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';

import { IconButton } from './IconButton';
// Shared bottom-sheet shell. Before this component, every modal in the app
// (EnquireModal, DealerLeadsScreen's create-lead sheet, SearchScreen filters,
// etc.) hand-rolled its own overlay + sheet + handle + close-button, each with
// slightly different backdrop opacity, sheet background shade, and close-button
// style — reading as several different products stitched together rather than
// one. This standardizes on the most polished existing version of the pattern.
//
// Web has no bottom-sheet equivalent (its modals are centered desktop dialogs),
// so this doesn't copy web 1:1 — it keeps the native mobile bottom-sheet
// convention but aligns the backdrop/border/shadow language (dark, blurred-feel
// backdrop, rounded card, subtle border) to match the web app's dialog styling.
//
// Drag-to-dismiss: the gesture is scoped to the handle + header strip only,
// not the whole sheet body — most callers put a ScrollView/FlatList as their
// first child (filters, create-lead forms, etc.), and a pan gesture covering
// that content would fight the list's own scroll gesture. Dragging the handle
// down past a distance/velocity threshold closes the sheet exactly the way
// tapping the backdrop or the X button already does — same onClose() call,
// no new behavior surface for the 13 existing callers to account for.

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Wrap content in KeyboardAvoidingView — enable for sheets with text inputs. */
  avoidKeyboard?: boolean;
  maxHeightPercent?: number;
  /** Sheets whose top-level child uses `flex: 1` (multi-step wizards, embedded
   * FlatLists that fill the sheet) need a *definite* height on the sheet —
   * Yoga collapses `flex: 1` children to 0 when the parent height is only
   * bounded by `maxHeight`. When true, the sheet renders at exactly
   * `maxHeightPercent` of the screen instead of shrink-to-fit. */
  fillHeight?: boolean;
}

const DISMISS_DISTANCE = 80;
const DISMISS_VELOCITY = 800;

export const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  children,
  avoidKeyboard = false,
  maxHeightPercent = 92,
  fillHeight = false,
}) => {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);
  // See useKeyboardHeight.ts — Android-only; iOS keeps the native
  // KeyboardAvoidingView path below, which already works reliably there.
  const androidKeyboardHeight = useKeyboardHeight();

  // Reset drag position on every fresh open — otherwise re-opening after a
  // drag-dismiss would start the sheet already translated off-screen.
  useEffect(() => {
    if (visible) translateY.value = 0;
  }, [visible, translateY]);

  const handleDismiss = () => {
    translateY.value = 0;
    onClose();
  };

  const dragGesture = Gesture.Pan()
    .onUpdate((e) => {
      // Only allow dragging down — the sheet is already at its natural
      // resting position, dragging up has nothing to reveal.
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (translateY.value > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        translateY.value = withTiming(600, { duration: 200 }, () => {
          runOnJS(handleDismiss)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const sheetContent = (
    <>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheet,
          fillHeight
            ? { height: `${maxHeightPercent}%`, paddingBottom: Math.max(insets.bottom, 20) + 12 }
            : { maxHeight: `${maxHeightPercent}%`, paddingBottom: Math.max(insets.bottom, 20) + 12 },
          sheetAnimatedStyle,
        ]}
      >
        <GestureDetector gesture={dragGesture}>
          <View style={styles.dragArea}>
            <View style={styles.handle} />
            {!!title && (
              <View style={styles.headerRow}>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                <IconButton style={styles.closeBtn} icon={<Ionicons name="close" size={18} color={Colors.textPrimary} />} onPress={onClose} accessibilityLabel="Close" />
              </View>
            )}
          </View>
        </GestureDetector>

        {children}
      </Animated.View>
    </>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      {/* Conditionally rendering a component *type* (rather than this JSX
          ternary) would create a new component identity on every render,
          forcing React to unmount/remount the whole subtree — including any
          focused TextInput — on every keystroke from a sibling field. */}
      {avoidKeyboard && Platform.OS === 'ios' ? (
        // RN's Modal opens a separate native Window that the Activity's
        // automatic keyboard-resize handling doesn't reach, so something
        // has to actively shrink content here. iOS's KeyboardAvoidingView
        // already does this reliably.
        <KeyboardAvoidingView style={styles.overlay} behavior="padding">
          {sheetContent}
        </KeyboardAvoidingView>
      ) : (
        // Android: KeyboardAvoidingView computes its shift from a view frame
        // captured on layout, which races with react-native-screens' Fragment
        // inset delivery under the edge-to-edge display Expo SDK 54 forces on
        // — that race is exactly the "covers the field, fixed after you back
        // out and back in" bug. Driving paddingBottom straight off the native
        // keyboard-show event sidesteps the race entirely.
        <View style={[styles.overlay, avoidKeyboard && { paddingBottom: androidKeyboardHeight }]}>
          {sheetContent}
        </View>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.blackAlpha75,
  },
  sheet: {
    backgroundColor: Colors.bgSecondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    paddingHorizontal: 22,
    paddingTop: 12,
  },
  dragArea: {
    // Extra invisible top padding widens the drag hit-area beyond the thin
    // 4px handle bar itself, without changing its visible size.
    marginHorizontal: -22,
    paddingHorizontal: 22,
    paddingTop: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.whiteAlpha15,
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    flex: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.whiteAlpha06,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
