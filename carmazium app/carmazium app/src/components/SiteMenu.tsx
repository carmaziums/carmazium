import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@/components/BrandIcon';
import { Colors } from '../constants/colors';
import { Radius } from '../constants/spacing';
import { FontFamily, FontSize } from '../constants/typography';

/**
 * The website's main menu (src/components/layout/Header.tsx mobile menu),
 * opened by the header's ☰. Same items, wording, descriptions and order:
 * Home, Buy Cars ▾, Sell Cars ▾, Get Valuation, TradeXchange ▾, Compare,
 * Pricing, About, then Sign Out. It opens below the header, which stays
 * visible with ☰ turned into ✕ — exactly like carmazium.com.
 *
 * The dashboard sidebar is a different menu (bottom "More"); see GlobalDrawer.
 */
export interface SiteTarget {
  tab?: string;
  tabParams?: Record<string, unknown>;
  screen?: string;
  params?: Record<string, unknown>;
  /** Website path opened in the in-app browser (no native screen yet). */
  web?: string;
}

interface Entry {
  id: string;
  label: string;
  desc?: string;
  icon: string;
  iconLib?: 'ion' | 'mci';
  badge?: string;
  target?: SiteTarget;
  /** Nested actions (website Delivery/Inspection: Post a Job, Find Jobs & Bid). */
  actions?: { id: string; label: string; desc: string; icon: string; target: SiteTarget }[];
}

interface Group { id: string; label: string; target?: SiteTarget; entries?: Entry[] }

const jobActions = (serviceType: 'DELIVERY' | 'INSPECTION') => [
  { id: `${serviceType}-post`, label: 'Post a Job', desc: 'Request quotes from approved providers.', icon: 'add-circle-outline', target: { screen: 'CreateServiceJob', params: { serviceType } } },
  { id: `${serviceType}-bid`, label: 'Find Jobs & Bid', desc: 'For verified service providers.', icon: 'briefcase-outline', target: { screen: 'ProviderJobs' } },
];

export const buildSiteGroups = (dealerMode: boolean): Group[] => [
  { id: 'home', label: 'Home', target: { tab: dealerMode ? 'DealerHome' : 'Home' } },
  {
    id: 'buy', label: 'Buy Cars', entries: [
      { id: 'retail', label: 'Retail Listings', desc: 'Cars advertised for retail buyers.', icon: 'car-outline', target: { tab: 'Search' } },
      {
        id: 'auctions', label: 'Live Auctions', desc: 'KYC-approved dealer access only.', icon: 'gavel', iconLib: 'mci', badge: 'VERIFIED DEALERS',
        target: dealerMode ? { tab: 'DealerBuyBid', tabParams: { initialSection: 'live' } } : { tab: 'Live' },
      },
    ],
  },
  {
    id: 'sell', label: 'Sell Cars', entries: [
      { id: 'sell-retail', label: 'Retail Listing', desc: 'Advertise directly to retail buyers from £1.', icon: 'car-outline', target: { screen: 'SellLanding' } },
      { id: 'sell-auction', label: 'Auction Listing', desc: 'List free and let verified dealers bid.', icon: 'gavel', iconLib: 'mci', target: { screen: 'SellLanding' } },
    ],
  },
  { id: 'valuation', label: 'Get Valuation', target: { screen: 'SellLanding' } },
  {
    id: 'trade', label: 'TradeXchange', entries: [
      { id: 'tx-overview', label: 'TradeXchange Overview', icon: 'grid-outline', target: { screen: 'Services' } },
      { id: 'tx-auctions', label: 'Vehicle Auctions', icon: 'gavel', iconLib: 'mci', target: { screen: 'HowItWorks' } },
      { id: 'tx-delivery', label: 'Delivery & Recovery', icon: 'car-sport-outline', actions: jobActions('DELIVERY') },
      { id: 'tx-inspection', label: 'Vehicle Inspection', icon: 'construct-outline', actions: jobActions('INSPECTION') },
      { id: 'tx-finance', label: 'Vehicle Finance', icon: 'cash-outline', target: { screen: 'Finance' } },
      { id: 'tx-warranty', label: 'Warranty', icon: 'shield-checkmark-outline', target: { web: '/services/warranty' } },
    ],
  },
  { id: 'compare', label: 'Compare', target: { screen: 'Compare' } },
  { id: 'pricing', label: 'Pricing', target: { screen: 'Pricing' } },
  { id: 'about', label: 'About', target: { screen: 'About' } },
];

// The website keeps these in its footer; the app has no footer, so one quiet
// line keeps them reachable without becoming a second menu.
const FOOTER: { label: string; target: SiteTarget }[] = [
  { label: 'How It Works', target: { screen: 'HowItWorks' } },
  { label: 'Reviews', target: { screen: 'Reviews' } },
  { label: 'Contact', target: { screen: 'Contact' } },
  { label: 'Terms', target: { screen: 'Terms' } },
  { label: 'Privacy', target: { screen: 'PrivacyPolicy' } },
];

export const SiteMenu: React.FC<{
  top: number;
  activeTab: string;
  dealerMode: boolean;
  isGuest: boolean;
  onNavigate: (target: SiteTarget) => void;
  onSignIn: (screen: 'Login' | 'Signup') => void;
  onSignOut: () => void;
}> = ({ top, activeTab, dealerMode, isGuest, onNavigate, onSignIn, onSignOut }) => {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<string | null>(null);
  const [openEntry, setOpenEntry] = useState<string | null>(null);
  const groups = buildSiteGroups(dealerMode);

  const icon = (e: { icon: string; iconLib?: 'ion' | 'mci' }) => e.iconLib === 'mci'
    ? <MaterialCommunityIcons name={e.icon} size={20} color={Colors.accent} />
    : <Ionicons name={e.icon} size={20} color={Colors.accent} />;

  return (
    <View style={[styles.panel, { top }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }} showsVerticalScrollIndicator={false}>
        {groups.map(group => {
          if (group.target) {
            const active = !!group.target.tab && group.target.tab === activeTab;
            return (
              <TouchableOpacity key={group.id} style={styles.navRow} onPress={() => onNavigate(group.target!)} accessibilityRole="button" accessibilityState={{ selected: active }}>
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{group.label}</Text>
              </TouchableOpacity>
            );
          }
          const isOpen = open === group.id;
          return (
            <View key={group.id}>
              <TouchableOpacity style={styles.navRow} onPress={() => { setOpen(isOpen ? null : group.id); setOpenEntry(null); }} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}>
                <Text style={styles.navLabel}>{group.label}</Text>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textPrimary} />
              </TouchableOpacity>
              {isOpen && (
                <View style={styles.card}>
                  {group.entries!.map((entry, i) => {
                    const entryOpen = openEntry === entry.id;
                    return (
                      <View key={entry.id} style={i > 0 && styles.cardDivider}>
                        <TouchableOpacity
                          style={styles.entry}
                          onPress={() => entry.actions ? setOpenEntry(entryOpen ? null : entry.id) : onNavigate(entry.target!)}
                          accessibilityRole="button"
                          accessibilityState={entry.actions ? { expanded: entryOpen } : undefined}
                        >
                          <View style={styles.entryIcon}>{icon(entry)}</View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.entryTitleRow}>
                              <Text style={styles.entryTitle}>{entry.label}</Text>
                              {entry.badge && (
                                <View style={styles.badge}>
                                  <Ionicons name="shield-checkmark-outline" size={11} color={Colors.success} />
                                  <Text style={styles.badgeText}>{entry.badge}</Text>
                                </View>
                              )}
                            </View>
                            {entry.desc && <Text style={styles.entryDesc}>{entry.desc}</Text>}
                          </View>
                          {entry.actions && <Ionicons name={entryOpen ? 'chevron-up' : 'chevron-down'} size={17} color={Colors.textPrimary} />}
                        </TouchableOpacity>
                        {entryOpen && entry.actions!.map(action => (
                          <TouchableOpacity key={action.id} style={[styles.entry, styles.subEntry]} onPress={() => onNavigate(action.target)} accessibilityRole="button">
                            <View style={styles.entryIcon}><Ionicons name={action.icon} size={18} color={Colors.accent} /></View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.entryTitle}>{action.label}</Text>
                              <Text style={styles.entryDesc}>{action.desc}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.actions}>
          {isGuest ? (
            <>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => onSignIn('Login')} accessibilityRole="button">
                <Text style={styles.primaryText}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => onSignIn('Signup')} accessibilityRole="button">
                <Text style={styles.outlineTextDark}>Create Free Account</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.outlineBtn} onPress={onSignOut} accessibilityRole="button">
              <Text style={styles.outlineText}>Sign Out</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.footer}>
          {FOOTER.map(link => (
            <TouchableOpacity key={link.label} onPress={() => onNavigate(link.target)} accessibilityRole="link" hitSlop={6}>
              <Text style={styles.footerText}>{link.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.bgPrimary,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 64 },
  navLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.xl, color: Colors.textPrimary, textAlign: 'center' },
  navLabelActive: { color: Colors.accent },
  card: {
    marginHorizontal: 20, marginBottom: 10,
    borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgCard, overflow: 'hidden',
  },
  cardDivider: { borderTopWidth: 1, borderTopColor: Colors.border },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 15 },
  subEntry: { paddingLeft: 30, backgroundColor: Colors.bgSecondary },
  entryIcon: { width: 24, alignItems: 'center' },
  entryTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  entryTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.textPrimary },
  entryDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 3 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill,
    backgroundColor: Colors.successAlpha10,
  },
  badgeText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, letterSpacing: 0.6, color: Colors.success },
  actions: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  primaryBtn: { minHeight: 52, borderRadius: Radius.inline, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.onAccent },
  outlineBtn: { minHeight: 52, borderRadius: Radius.inline, borderWidth: 1, borderColor: Colors.borderHi, alignItems: 'center', justifyContent: 'center' },
  outlineText: { fontFamily: FontFamily.semiBold, fontSize: FontSize.base, color: Colors.accent },
  outlineTextDark: { fontFamily: FontFamily.semiBold, fontSize: FontSize.base, color: Colors.textPrimary },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 16, rowGap: 8, paddingHorizontal: 20, paddingTop: 20 },
  footerText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.textMuted },
});
