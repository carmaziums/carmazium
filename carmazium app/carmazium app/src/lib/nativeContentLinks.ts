import dashboardCards from '../data/dashboardCards.json';

export function nativeContentTarget(href: string): { name: string; params?: object } | null {
  let url: URL;
  try { url = new URL(href, 'https://www.carmazium.com'); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || !['carmazium.com', 'www.carmazium.com'].includes(url.hostname)) return null;
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
  const simple: Record<string, string> = { '/terms': 'Terms', '/privacy-policy': 'PrivacyPolicy', '/contact': 'Contact', '/pricing': 'Pricing', '/about': 'About', '/how-it-works': 'HowItWorks', '/auctions/how-it-works': 'AuctionGuide', '/auctions': 'Services', '/services': 'Services', '/blog': 'Blog', '/business-spotlight': 'BusinessSpotlight', '/used-car-types': 'CarBodyGuide', '/services/warranty': 'Warranty', '/dashboard/warranties': 'WarrantyOrders', '/delete-account': 'Settings', '/cookie-policy': 'CookiePolicy' };
  if (path === '/contact') {
    const topic = url.searchParams.get('topic');
    return { name: 'Contact', params: ['finance-partnership', 'warranty-partnership', 'insurance-partnership'].includes(topic || '') ? { topic } : undefined };
  }
  if (path === '/services/warranty') return { name: 'Warranty', params: { listingId: url.searchParams.get('listingId') || undefined } };
  // Match the website's bounded listing prefill. This carries context only;
  // the existing service API still checks listing access and job eligibility.
  const linkedVehicleParams = () => {
    const field = (name: string, max: number) => url.searchParams.get(name)?.trim().slice(0, max) || undefined;
    const listingId = field('listingId', 36);
    if (!listingId) return {};
    const yearText = url.searchParams.get('year')?.trim() || '';
    const year = /^\d{4}$/.test(yearText) && Number(yearText) >= 1900 && Number(yearText) <= 2100 ? Number(yearText) : undefined;
    return { purchase: { listingId, title: field('vehicleTitle', 120) || 'Selected vehicle',
      registration: url.searchParams.get('registration')?.trim().toUpperCase().replace(/\s+/g, '').slice(0, 10) || undefined,
      make: field('make', 60), model: field('model', 60), year } };
  };
  if (path === '/services/delivery' || path === '/services/delivery/new') {
    const kind = url.searchParams.get('kind');
    return { name: 'CreateServiceJob', params: { serviceType: 'DELIVERY', ...linkedVehicleParams(), ...(['delivery', 'collection', 'recovery'].includes(kind || '') ? { kind } : {}) } };
  }
  if (path === '/services/inspection' || path === '/services/inspection/new') {
    const kind = url.searchParams.get('kind');
    return { name: 'CreateServiceJob', params: { serviceType: 'INSPECTION', ...linkedVehicleParams(), ...(['prepurchase', 'mechanical', 'cosmetic', 'stock'].includes(kind || '') ? { kind } : {}) } };
  }
  if (path === '/services/jobs/new') return { name: 'Services' };
  if (path === '/services/jobs') return { name: 'CustomerServiceJobs' };
  if (path === '/auctions/browse') return { name: 'Tabs', params: { screen: 'Live' } };
  if (simple[path]) return { name: simple[path] };
  if (path === '/services/finance' || path === '/finance') return { name: 'Finance', params: { listingId: url.searchParams.get('listingId') || undefined } };
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
