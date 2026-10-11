#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const base = '../carmazium app/carmazium app/src/';
const get = path => readFileSync(new URL(base + path, import.meta.url), 'utf8');
const files = {
  partner: get('screens/main/PartnerDashboardScreen.tsx'),
  overview: get('screens/main/DealerWebParityOverview.tsx'),
  inventory: get('screens/main/DealerInventoryScreen.tsx'),
  team: get('screens/main/DealerTeamScreen.tsx'),
  leads: get('screens/main/DealerLeadsScreen.tsx'),
  analytics: get('screens/main/DealerAnalyticsScreen.tsx'),
  buybid: get('screens/main/DealerBuyBidScreen.tsx'),
  profile: get('screens/main/DealerProfileScreen.tsx'),
  unified: get('screens/account/UnifiedDashboardScreen.tsx'),
  roles: get('screens/account/AccountRoleHomeScreen.tsx'),
};

const checks = [
  ['partner','usePartnerDashboardScreenPalette','styles',['container','headerTitle','card','cardTitle','input','serviceCard']],
  ['overview','useDealerWebParityOverviewPalette','styles',['hero','heroTitle','rangePanel','amountInput','metricCard','actionCard']],
  ['inventory','useDealerInventoryPalette','styles',['container','websiteStockCard','stockPrice','inventorySearchInput','gridCard','bulkInput','detailCard','soldPriceInput']],
  ['team','useDealerTeamPalette','styles',['container','staffCard','staffName','emailInput','rolePill','pendingCard']],
  ['leads','useDealerLeadsPalette','styles',['container','crmMetricCard','websiteLeadCard','contactCard','createInput','boardCard']],
  ['analytics','useDealerAnalyticsPalette','styles',['container','headerTitle','statCard','statValue','funnelCard','aiCard']],
  ['buybid','useDealerBuyBidScreenPalette','styles',['screen','pageTitle','navButton','auctionCard','metric','emptyState']],
  ['profile','useDealerProfilePalette','styles',['container','card','cardTitle','listingPrice','salesValue','metricCard']],
  ['unified','useUnifiedDashboardScreenPalette','styles',['container','profileCard','profileName','statCell','tile','signOutRow']],
  ['roles','useAccountRoleHomeScreenPalette','styles',['container','hero','title','description','card','secondaryAction']],
];

test('every Block 7 workspace has a semantic theme mapping, not global mutation of the palette', () => {
  for (const [name, hook, sheet, keys] of checks) {
    const source = files[name];
    assert.ok(source.includes('function '+hook+'()'), name + ' theme hook');
    assert.ok(source.includes('useNativeAppearance()'), name + ' appearance provider');
    assert.ok(source.includes('...'+sheet+','), name + ' original stylesheet defaults');
    for (const key of keys)
      assert.ok(source.includes(key+': ['+sheet+'.'+key+', { '), name + '.' + key);
    assert.doesNotMatch(source, /Object\.assign\(Colors|Colors\.[a-zA-Z]+\s*=/, name + ' must not mutate global theme');
  }
});

test('navigation and real store accounts stay role-specific while colours change', () => {
  assert.match(files.unified, /const \{ user, role, accountRole, logout \} = useAuthStore\(\)/);
  assert.match(files.unified, /navTab\('Search'\)/);
  assert.match(files.unified, /nav\('DealerInventory'\)/);
  assert.match(files.roles, /accountRole === 'contractor'/);
  assert.match(files.roles, /accountRole === 'finance_partner'/);
  assert.match(files.roles, /accountRole === 'insurance_partner'/);
  assert.match(files.roles, /accountRole === 'admin'/);
  assert.match(files.partner, /initializeAuth/);
  assert.match(files.partner, /getPartnerProfile/);
  assert.match(files.partner, /onPress=\{saveBusiness\}/);
});

test('dealer website dashboard retains real comparison period and role-gated destinations', () => {
  assert.match(files.overview, /const query = useMemo\(\(\) =>/);
  assert.match(files.overview, /range\.compare/);
  assert.match(files.overview, /onNavigate\(action\.destination\)/);
  assert.match(files.overview, /canManageInventory/);
  assert.match(files.overview, /canManageCrm/);
  assert.match(files.overview, /canViewTrade/);
  assert.match(files.overview, /canViewAnalytics/);
});

test('inventory detail, virtualized cards and stock permissions are not weakened', () => {
  const s=files.inventory;
  assert.match(s,/hasPermission\('MANAGE_INVENTORY'\)/);
  assert.match(s,/canManageInventory && listing\.status === 'LIVE'/);
  assert.match(s,/if \(selectedListing\) \{/);
  assert.match(s,/<ListingDetail/);
  assert.match(s,/<InventoryRow/);
  assert.match(s,/<InventoryGridCard/);
  assert.match(s,/<FlatList/);
  assert.match(s,/const \{ palette, resolvedAppearance \} = useNativeAppearance\(\)/);
  assert.ok((s.match(/const themed = useDealerInventoryPalette\(\)/g)||[]).length>=4);
  assert.match(s,/getScrollableStageHeight|getRawListingById|fetchListings/);
});

test('team staff role toggles and invite/remove actions remain guarded', () => {
  const s=files.team;
  assert.match(s,/<StaffCard/);
  assert.match(s,/<RolePill/);
  assert.match(s,/setTradeFlag\(email, field, value\)/);
  assert.match(s,/disabled=\{disabled\}/);
  assert.match(s,/disabled=\{removing\}/);
  assert.match(s,/handleInvite/);
  assert.match(s,/handleRemove/);
  assert.match(s,/useDealerAccess/);
  assert.match(s,/<FlatList/);
  assert.ok((s.match(/const themed = useDealerTeamPalette\(\)/g)||[]).length>=3);
});

test('CRM board list, lead detail and followups use local themed cards with original handlers', () => {
  const s=files.leads;
  assert.match(s,/hasPermission\('MANAGE_OFFERS'\)/);
  assert.match(s,/const leadsByStage = useMemo\(\(\) =>/);
  assert.match(s,/if \(selectedLead\) \{/);
  assert.match(s,/<LeadDetail/);
  assert.match(s,/<LeadRow/);
  assert.match(s,/<BoardCard/);
  assert.match(s,/createChatRoom\(lead\.buyerId, lead\.listingId\)/);
  assert.match(s,/onFollowUp\(lead\.id, lead\.nextFollowUpAt\)/);
  assert.match(s,/React\.memo\(\(\{ lead, onPress \}\) => \{/);
  assert.match(s,/React\.memo\(\(\{ lead, onPress, onMove, onFollowUp \}\) => \{/);
  assert.ok((s.match(/const themed = useDealerLeadsPalette\(\)/g)||[]).length>=4);
});

test('auction buying uses original owner-only access and dealer participation checks', () => {
  const s=files.buybid;
  assert.match(s,/hasPermission\('MANAGE_INVENTORY'\)/);
  assert.match(s,/hasPermission\('VIEW_PURCHASES'\)/);
  assert.match(s,/hasPermission\('PLACE_BID'\)/);
  assert.match(s,/if \(!accessLoading && !canPlaceBid\)|!accessLoading && !canPlaceBid/);
  assert.match(s,/<DealerAuctionShortlist/);
  assert.match(s,/<DealerActiveBidPositions/);
  assert.match(s,/<LiveScreen embeddedDealerHub/);
  assert.match(s,/fetchAllMyAuctions/);
});

test('analytics reporting remains tied to real backend and periods', () => {
  assert.match(files.analytics,/periodToQuery\(period\)/);
  assert.match(files.analytics,/useNativeAppearance\(\)/);
  assert.match(files.analytics,/onRefresh=\{\(\) => doFetch\(true\)\}/);
  assert.match(files.profile,/hasPermission\('MANAGE_CRM'\)/);
  assert.match(files.profile,/hasPermission\('VIEW_ANALYTICS'\)/);
  assert.match(files.profile,/hasPermission\('VIEW_INVENTORY'\)/);
  assert.match(files.profile,/<DealerWebParityOverview/);
});

test('all theme changes are still internal; visible Appearance choice remains blocked', () => {
  const settings=get('screens/main/SettingsScreen.tsx');
  assert.match(settings,/A live light\/dark switch is not yet supported by the native theme engine/);
  assert.doesNotMatch(settings,/setAppearancePreference\(/);
});
