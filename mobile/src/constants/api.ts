export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://carmazium-hjoh9w.fly.dev';

export const WS_URL = API_BASE_URL;

export const ENDPOINTS = {
  // Auth
  AUTH_REGISTER: '/auth/register',
  AUTH_LOGIN:    '/auth/login',
  AUTH_LOGOUT:   '/auth/logout',
  AUTH_ME:       '/auth/me',

  // Listings
  LISTINGS:       '/listings',
  LISTING:        (id: string) => `/listings/${id}`,
  LISTING_HPI:    (id: string) => `/listings/${id}/hpi`,
  LISTING_DAMAGE: (id: string) => `/listings/${id}/damage`,
  DVLA_LOOKUP:    '/dvla/lookup',

  // Auctions
  AUCTIONS:    '/auctions',
  AUCTION:     (id: string) => `/auctions/${id}`,
  AUCTION_BIDS:(id: string) => `/auctions/${id}/bids`,
  BIDS_PLACE:  '/bids',

  // Watchlist
  WATCHLIST:      '/watchlist',
  WATCHLIST_ITEM: (id: string) => `/watchlist/${id}`,

  // Offers
  OFFERS:       '/offers',
  OFFER:        (id: string) => `/offers/${id}`,
  OFFER_RESPOND:(id: string) => `/offers/${id}/respond`,

  // Chat
  CHAT_ROOMS:   '/chat/rooms',
  CHAT_ROOM:    (id: string) => `/chat/rooms/${id}`,
  CHAT_MESSAGES:(id: string) => `/chat/rooms/${id}/messages`,

  // Dashboard
  DASHBOARD_BUYER:  '/dashboard/buyer',
  DASHBOARD_SELLER: '/dashboard/seller',
  DASHBOARD_DEALER: '/dashboard/dealer',

  // Partners
  AI_SEARCH:    '/ai/search',
  NOTIFICATIONS:              '/notifications',
  NOTIFICATION_READ:          (id: string) => `/notifications/${id}/read`,
  NOTIFICATIONS_READ_ALL:     '/notifications/read-all',
  NOTIFICATIONS_UNREAD_COUNT: '/notifications/unread-count',
  USERS_ME:     '/users/me',
  USERS_ME_KYC: '/users/me/kyc',
} as const;
