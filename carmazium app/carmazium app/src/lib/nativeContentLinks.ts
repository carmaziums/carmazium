import dashboardCards from '../data/dashboardCards.json';

export function nativeContentTarget(href: string): { name: string; params?: object } | null {
  let url: URL;
  try { url = new URL(href, 'https://www.carmazium.com'); } catch { return null; }
  if (!['carmazium.com', 'www.carmazium.com'].includes(url.hostname)) return null;
  const path = url.pathname.replace(/\/$/, '') || '/';
  if (path === '/search' || path === '/used-cars') return { name: 'Tabs', params: { screen: 'Search', params: { ...Object.fromEntries(url.searchParams), _t: Date.now() } } };
  const cards = [...dashboardCards.personal, ...dashboardCards.dealer].sort((a, b) => Number(b.href.includes('?')) - Number(a.href.includes('?')));
  for (const card of cards) {
    const destination = new URL(card.href, 'https://www.carmazium.com');
    if (destination.pathname !== path || [...destination.searchParams].some(([key, value]) => url.searchParams.get(key) !== value)) continue;
    if ('tabName' in card) return { name: 'Tabs', params: { screen: card.tabName, params: 'tabParams' in card ? card.tabParams : undefined } };
    if ('stackScreen' in card) return { name: card.stackScreen, params: 'stackParams' in card && typeof card.stackParams === 'object' && card.stackParams !== null ? card.stackParams : undefined };
  }
  if (path === '/dashboard/user' || path === '/dashboard') return { name: 'Tabs', params: { screen: 'Profile' } };
  if (path === '/dashboard/dealer') return { name: 'Tabs', params: { screen: 'DealerHome' } };
  const simple: Record<string, string> = { '/terms': 'Terms', '/privacy-policy': 'PrivacyPolicy', '/contact': 'Contact', '/pricing': 'Pricing', '/about': 'About', '/how-it-works': 'HowItWorks', '/auctions/how-it-works': 'AuctionGuide', '/services': 'Services', '/blog': 'Blog', '/business-spotlight': 'BusinessSpotlight', '/used-car-types': 'CarBodyGuide', '/services/warranty': 'Warranty', '/dashboard/warranties': 'WarrantyOrders', '/delete-account': 'Settings', '/cookie-policy': 'CookiePolicy' };
  if (simple[path]) return { name: simple[path] };
  if (path === '/services/finance') return { name: 'Finance', params: { listingId: url.searchParams.get('listingId') || undefined } };
  if (path === '/become-a-partner') return { name: 'PartnerGuide' };
  if (path === '/services/warranty/terms') return { name: 'WarrantyTerms' };
  if (path === '/') return { name: 'Tabs', params: { screen: 'Home' } };
  if (path === '/auth/signup') return { name: 'PartnerDashboard' };
  if (path.startsWith('/blog/')) return { name: 'BlogArticle', params: { slug: decodeURIComponent(path.slice(6)) } };
  if (path.startsWith('/business-spotlight/')) return { name: 'BusinessSpotlight', params: { slug: path.split('/').pop() } };
  if (path === '/sell') return { name: 'SellLanding' };
  if (path.startsWith('/buy-cars/')) return { name: 'VehicleDeepLink', params: { slug: decodeURIComponent(path.slice(10)) } };
  return null;
}
