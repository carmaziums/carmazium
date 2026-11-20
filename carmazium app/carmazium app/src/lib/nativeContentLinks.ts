export function nativeContentTarget(href: string): { name: string; params?: object } | null {
  let url: URL;
  try { url = new URL(href, 'https://www.carmazium.com'); } catch { return null; }
  if (!['carmazium.com', 'www.carmazium.com'].includes(url.hostname)) return null;
  const path = url.pathname.replace(/\/$/, '') || '/';
  const simple: Record<string, string> = { '/terms': 'Terms', '/privacy-policy': 'PrivacyPolicy', '/contact': 'Contact', '/pricing': 'Pricing', '/about': 'About', '/services': 'Services', '/blog': 'Blog', '/business-spotlight': 'BusinessSpotlight', '/used-car-types': 'CarBodyGuide', '/services/warranty': 'Warranty', '/dashboard/warranties': 'WarrantyOrders', '/delete-account': 'Settings', '/cookie-policy': 'CookiePolicy' };
  if (simple[path]) return { name: simple[path] };
  if (path === '/services/finance') return { name: 'Finance', params: { listingId: url.searchParams.get('listingId') || undefined } };
  if (path === '/become-a-partner') return { name: 'PartnerGuide' };
  if (path === '/services/warranty/terms') return { name: 'WarrantyTerms' };
  if (path === '/search' || path === '/used-cars') return { name: 'Tabs', params: { screen: 'Search', params: { ...Object.fromEntries(url.searchParams), _t: Date.now() } } };
  if (path === '/') return { name: 'Tabs', params: { screen: 'Home' } };
  if (path === '/auth/signup') return { name: 'PartnerDashboard' };
  if (path.startsWith('/blog/')) return { name: 'BlogArticle', params: { slug: decodeURIComponent(path.slice(6)) } };
  if (path.startsWith('/business-spotlight/')) return { name: 'BusinessSpotlight', params: { slug: path.split('/').pop() } };
  if (path === '/sell') return { name: 'SellLanding' };
  if (path.startsWith('/buy-cars/')) return { name: 'VehicleDeepLink', params: { slug: decodeURIComponent(path.slice(10)) } };
  return null;
}
