import { StyleSheet } from 'react-native';

/**
 * Shared layout fixes.
 *
 * `hScroll`: a horizontal ScrollView in a column layout is shrinkable by
 * default, so on a small phone or with a larger system font size Android
 * squashed chip/tab rows and cut their labels in half (Buy Cars quick
 * filters, My Auctions status tabs). Never let the row shrink below its
 * content; the list beneath it gives up space instead.
 */
export const Layout = StyleSheet.create({
  hScroll: { flexShrink: 0 },
});
