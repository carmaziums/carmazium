// Only the menu item's own section counts. A nested stackParams.section is a
// navigation parameter, not another group heading.
export function dealerMenuSectionOrders(webSource, nativeSource) {
  const web = [...(webSource.match(/DEALER_SECTION_ORDER = \[([^\]]*)\]/)?.[1] || '')
    .matchAll(/"([^"]+)"/g)].map(m => m[1]);
  const items = nativeSource.match(/const DEALER_ITEMS[^=]*=\s*\[([\s\S]*?)^\];/m)?.[1] || '';
  const sections = [...items.matchAll(/^\s*\{\s*id:\s*'[^']+',\s*section:\s*'([^']+)'/gm)].map(m => m[1]);
  const native = sections.filter((s, i) => s !== sections[i - 1]);
  return { web, native };
}

export function dealerMenuSectionsMatch(webSource, nativeSource) {
  const { web, native } = dealerMenuSectionOrders(webSource, nativeSource);
  const expected = 'Dashboard,Sell,Buy,Business,Services';
  return web.join(',') === expected && native.join(',') === expected;
}
