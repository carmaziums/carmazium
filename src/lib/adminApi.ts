import type { ChatMessage, ChatRoom } from './chatApi';
import { apiClient } from './apiClient';

export interface AdminStats {
  totalUsers: number;
  totalListings: number;
  activeListings: number;
  soldListings: number;
  totalAuctions: number;
  activeAuctions: number;
  endedAuctions: number;
  totalBids: number;
  totalRevenue: number;
}

export interface AnalyticsMonth {
  month: string;
  newUsers: number;
  newListings: number;
  revenue: number;
}

export interface AccountVerificationStats {
  activeAccounts: number;
  verifiedAccounts: number;
  unverifiedAccounts: number;
  publicVerifiedProfiles: number;
  verifiedDealerBusinesses: number;
  unverifiedDealerBusinessRecords: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const result = await apiClient<{ data: AdminStats }>('/admin/stats');
  return result.data;
}

export async function getAdminAnalytics(): Promise<AnalyticsMonth[]> {
  const result = await apiClient<{ data: AnalyticsMonth[] }>('/admin/analytics');
  return result.data;
}

export async function getAccountVerificationStats(): Promise<AccountVerificationStats> {
  // This analytics endpoint returns the data object directly rather than using
  // the admin StandardResponse wrapper.
  return apiClient<AccountVerificationStats>('/analytics/account-verification');
}

export async function getAdminUsers(page = 1, limit = 20, search?: string) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  const result = await apiClient<any>(`/admin/users?${params.toString()}`);
  return result;
}

// ─── Chat Moderation ──────────────────────────────────────────────────────────

export type AdminChatReportStatus = 'OPEN' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';
export type AdminChatReportReason =
  | 'HARASSMENT'
  | 'SCAM_FRAUD'
  | 'SPAM'
  | 'INAPPROPRIATE_CONTENT'
  | 'OTHER';

export interface AdminChatReport {
  id: string;
  chatRoomId: string;
  messageId: string;
  reporterId: string;
  reportedUserId: string;
  reason: AdminChatReportReason;
  details?: string | null;
  messageContent: string;
  attachmentPath?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
  attachmentSize?: number | null;
  attachmentUrl?: string | null;
  roomContext: 'RETAIL' | 'AUCTION' | 'DISPUTE' | 'SUPPORT' | 'LEGACY';
  listingId?: string | null;
  listingTitle?: string | null;
  status: AdminChatReportStatus;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  adminNote?: string | null;
  createdAt: string;
  updatedAt: string;
  reporter: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    profileImage?: string | null;
    role?: string;
  };
  reportedUser: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    profileImage?: string | null;
    role: string;
  };
  reviewedBy?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
}

export async function getAdminChatReports(
  page = 1,
  limit = 30,
  status?: AdminChatReportStatus,
  search?: string,
): Promise<{
  data: AdminChatReport[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (status) params.set('status', status);
  if (search?.trim()) params.set('search', search.trim());

  const result = await apiClient<{ data: {
    data: AdminChatReport[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  } }>(`/admin/messaging/moderation/reports?${params.toString()}`);
  return result.data;
}

export async function updateAdminChatReport(
  id: string,
  status: Exclude<AdminChatReportStatus, 'OPEN'>,
  adminNote?: string,
): Promise<AdminChatReport> {
  const result = await apiClient<{ data: AdminChatReport }>(
    `/admin/messaging/moderation/reports/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        adminNote: adminNote?.trim() || undefined,
      }),
    },
  );
  return result.data;
}

// ─── Vehicle Disputes ─────────────────────────────────────────────────────────

export type AdminDisputeStatus = 'OPEN' | 'RESOLVED';

export interface AdminDisputeCase {
  id: string;
  sourceRoomId: string;
  chatRoomId: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  openedById: string;
  joinedAdminId?: string | null;
  resolvedById?: string | null;
  status: AdminDisputeStatus;
  reason?: string | null;
  adminJoinedAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  listing: {
    id: string;
    title: string;
    slug: string;
    images: string[];
    type: string;
    status: string;
  };
  buyer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    profileImage?: string | null;
    role: string;
  };
  seller: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    profileImage?: string | null;
    role: string;
  };
  openedBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    role: string;
  };
  joinedAdmin?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    profileImage?: string | null;
  } | null;
  resolvedBy?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  chatRoom: {
    id: string;
    updatedAt: string;
    messages: Array<{
      id: string;
      content: string;
      senderId: string;
      createdAt: string;
    }>;
  };
}

export async function getAdminDisputes(
  page = 1,
  limit = 30,
  status?: AdminDisputeStatus,
  search?: string,
): Promise<{
  data: AdminDisputeCase[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (status) params.set('status', status);
  if (search?.trim()) params.set('search', search.trim());

  const result = await apiClient<{ data: {
    data: AdminDisputeCase[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  } }>(`/admin/messaging/disputes?${params.toString()}`);
  return result.data;
}

export async function joinAdminDispute(id: string): Promise<{
  room: ChatRoom;
  eventMessage: ChatMessage | null;
  joined: boolean;
}> {
  const result = await apiClient<{ data: {
    room: ChatRoom;
    eventMessage: ChatMessage | null;
    joined: boolean;
  } }>(`/admin/messaging/disputes/${id}/join`, {
    method: 'POST',
  });
  return result.data;
}

export async function resolveAdminDispute(id: string): Promise<{
  room: ChatRoom;
  eventMessage: ChatMessage | null;
  resolved: boolean;
}> {
  const result = await apiClient<{ data: {
    room: ChatRoom;
    eventMessage: ChatMessage | null;
    resolved: boolean;
  } }>(`/admin/messaging/disputes/${id}/resolve`, {
    method: 'POST',
  });
  return result.data;
}

// ─── Admin Broadcast Messaging ────────────────────────────────────────────────

export type AdminMessageAudience =
  | 'ALL'
  | 'ROLE'
  | 'DEALERS'
  | 'SERVICE_PROVIDERS'
  | 'DELIVERY_PROVIDERS'
  | 'INSPECTION_PROVIDERS'
  | 'FINANCE_PROVIDERS'
  | 'WARRANTY_PROVIDERS'
  | 'INSURANCE_PROVIDERS';

export type AdminMessageMediaKind = 'IMAGE' | 'VIDEO';

export interface AdminAudienceSelection {
  audience: AdminMessageAudience;
  role?: string;
  userId?: string;
}

export interface AdminAudiencePreview {
  count: number;
  sample: Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
  }>;
}

export interface AdminMessagePayload extends AdminAudienceSelection {
  text?: string;
  mediaUrl?: string;
  mediaKind?: AdminMessageMediaKind;
  mediaName?: string;
  mediaMime?: string;
  mediaSize?: number;
  expectedRecipientCount: number;
}

export interface AdminMessageSendResult {
  campaignId: string;
  requested: number;
  sent: number;
  failed: number;
  pending?: number;
  status?: BroadcastCampaignStatus;
  failures: Array<{ userId: string; error: string }>;
}

export interface AdminMessageScheduleResult {
  campaignId: string;
  requested: number;
  scheduledAt: string;
  status: BroadcastCampaignStatus;
}

export async function previewAdminMessageAudience(selection: AdminAudienceSelection): Promise<AdminAudiencePreview> {
  const result = await apiClient<{ data: AdminAudiencePreview }>('/admin/messaging/preview', {
    method: 'POST',
    body: JSON.stringify(selection),
  });
  return result.data;
}

export async function sendAdminAudienceMessage(payload: AdminMessagePayload): Promise<AdminMessageSendResult> {
  const result = await apiClient<{ data: AdminMessageSendResult }>('/admin/messaging/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result.data;
}

export async function scheduleAdminAudienceMessage(
  payload: AdminMessagePayload,
  scheduledAt: string,
): Promise<AdminMessageScheduleResult> {
  const result = await apiClient<{ data: AdminMessageScheduleResult }>('/admin/messaging/schedule', {
    method: 'POST',
    body: JSON.stringify({ ...payload, scheduledAt }),
  });
  return result.data;
}

// ─── Admin Support Operations ─────────────────────────────────────────────────

export interface AdminSupportAgent {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profileImage?: string | null;
}

export interface AdminSupportNote {
  id: string;
  chatRoomId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

export async function getAdminSupportAgents(): Promise<AdminSupportAgent[]> {
  const result = await apiClient<{ data: AdminSupportAgent[] }>('/admin/messaging/support/agents');
  return result.data;
}

export async function assignAdminSupportRoom(
  roomId: string,
  adminId: string | null,
): Promise<{ supportAssignedAdminId: string | null; supportAssignedAdmin: AdminSupportAgent | null }> {
  const result = await apiClient<{ data: { supportAssignedAdminId: string | null; supportAssignedAdmin: AdminSupportAgent | null } }>(
    `/admin/messaging/support/rooms/${roomId}/assignment`,
    {
      method: 'PATCH',
      body: JSON.stringify({ adminId }),
    },
  );
  return result.data;
}

export async function updateAdminSupportTags(roomId: string, tags: string[]): Promise<string[]> {
  const result = await apiClient<{ data: string[] }>(
    `/admin/messaging/support/rooms/${roomId}/tags`,
    {
      method: 'PATCH',
      body: JSON.stringify({ tags }),
    },
  );
  return result.data;
}

export async function updateAdminSupportClosed(
  roomId: string,
  closed: boolean,
): Promise<{ supportClosedAt: string | null }> {
  const result = await apiClient<{ data: { supportClosedAt: string | null } }>(
    `/admin/messaging/support/rooms/${roomId}/closed`,
    {
      method: 'PATCH',
      body: JSON.stringify({ closed }),
    },
  );
  return result.data;
}

export async function getAdminSupportNotes(roomId: string): Promise<AdminSupportNote[]> {
  const result = await apiClient<{ data: AdminSupportNote[] }>(
    `/admin/messaging/support/rooms/${roomId}/notes`,
  );
  return result.data;
}

export async function addAdminSupportNote(roomId: string, body: string): Promise<AdminSupportNote> {
  const result = await apiClient<{ data: AdminSupportNote }>(
    `/admin/messaging/support/rooms/${roomId}/notes`,
    {
      method: 'POST',
      body: JSON.stringify({ body }),
    },
  );
  return result.data;
}

export async function deleteAdminSupportNote(roomId: string, noteId: string): Promise<void> {
  await apiClient(
    `/admin/messaging/support/rooms/${roomId}/notes/${noteId}`,
    { method: 'DELETE' },
  );
}

// ─── Admin Broadcast History ──────────────────────────────────────────────────

export type BroadcastCampaignStatus =
  | 'SCHEDULED'
  | 'SENDING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLED';
export type BroadcastDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface AdminBroadcastCampaign {
  id: string;
  adminId: string;
  audience: string;
  role?: string | null;
  text?: string | null;
  mediaUrl?: string | null;
  mediaKind?: string | null;
  mediaName?: string | null;
  mediaMime?: string | null;
  mediaSize?: number | null;
  requested: number;
  sent: number;
  failed: number;
  status: BroadcastCampaignStatus;
  scheduledAt?: string | null;
  startedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  finishedAt?: string | null;
  admin: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

export interface AdminBroadcastDelivery {
  id: string;
  campaignId: string;
  userId: string;
  roomId?: string | null;
  messageId?: string | null;
  status: BroadcastDeliveryStatus;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
  };
}

export interface AdminBroadcastCampaignDetail extends AdminBroadcastCampaign {
  deliveries: AdminBroadcastDelivery[];
}

export interface AdminBroadcastHistoryFilters {
  search?: string;
  status?: BroadcastCampaignStatus;
  audience?: string;
  from?: string;
  to?: string;
}

export interface AdminBroadcastAnalytics {
  totalCampaigns: number;
  scheduledCampaigns: number;
  completedCampaigns: number;
  partialCampaigns: number;
  failedCampaigns: number;
  cancelledCampaigns: number;
  sendingCampaigns: number;
  requestedRecipients: number;
  sentRecipients: number;
  failedRecipients: number;
  pendingRecipients: number;
  attemptedRecipients: number;
  deliverySuccessRate: number | null;
}

export async function getAdminBroadcastCampaigns(
  page = 1,
  limit = 20,
  filters: AdminBroadcastHistoryFilters = {},
): Promise<{
  data: AdminBroadcastCampaign[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.audience) params.set('audience', filters.audience);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);

  const result = await apiClient<{ data: {
    data: AdminBroadcastCampaign[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  } }>(`/admin/messaging/broadcasts?${params.toString()}`);
  return result.data;
}

export async function getAdminBroadcastAnalytics(
  from?: string,
  to?: string,
): Promise<AdminBroadcastAnalytics> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const result = await apiClient<{ data: AdminBroadcastAnalytics }>(
    `/admin/messaging/broadcasts-analytics${suffix}`,
  );
  return result.data;
}

export async function getAdminBroadcastCampaign(id: string): Promise<AdminBroadcastCampaignDetail> {
  const result = await apiClient<{ data: AdminBroadcastCampaignDetail }>(
    `/admin/messaging/broadcasts/${id}`,
  );
  return result.data;
}

export async function retryAdminBroadcastFailures(id: string): Promise<AdminBroadcastCampaignDetail> {
  const result = await apiClient<{ data: AdminBroadcastCampaignDetail }>(
    `/admin/messaging/broadcasts/${id}/retry-failed`,
    { method: 'POST' },
  );
  return result.data;
}

export async function cancelAdminScheduledBroadcast(id: string): Promise<AdminBroadcastCampaignDetail> {
  const result = await apiClient<{ data: AdminBroadcastCampaignDetail }>(
    `/admin/messaging/broadcasts/${id}/cancel`,
    { method: 'POST' },
  );
  return result.data;
}

export async function sendAdminScheduledBroadcastNow(id: string): Promise<AdminBroadcastCampaignDetail> {
  const result = await apiClient<{ data: AdminBroadcastCampaignDetail }>(
    `/admin/messaging/broadcasts/${id}/send-now`,
    { method: 'POST' },
  );
  return result.data;
}

// ─── Admin Free Listing Grants ────────────────────────────────────────────────

export type FreeListingGrantStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED';
export type FreeListingDurationUnit = 'HOURS' | 'DAYS' | 'MONTHS' | 'FOREVER';

export interface FreeListingGrant {
  id: string;
  grantedAt: string;
  grantedById: string;
  expiresAt: string | null;
  usedAt: string | null;
  usedListingId: string | null;
  revokedAt: string | null;
  status: FreeListingGrantStatus;
}

export interface AdminFreeListingUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  createdAt: string;
  deletedAt: string | null;
  freeListingGrant: FreeListingGrant | null;
}

export interface AdminFreeListingUsersResponse {
  data: AdminFreeListingUser[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export async function getAdminFreeListingUsers(page = 1, limit = 20, search?: string): Promise<AdminFreeListingUsersResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  return apiClient<AdminFreeListingUsersResponse>(`/admin/free-listings/users?${params.toString()}`);
}

export async function grantAdminFreeListing(
  userId: string,
  durationUnit: FreeListingDurationUnit,
  durationValue?: number,
): Promise<FreeListingGrant> {
  const result = await apiClient<{ data: FreeListingGrant }>(`/admin/free-listings/users/${userId}`, {
    method: 'POST',
    body: JSON.stringify({ durationUnit, durationValue }),
  });
  return result.data;
}

export async function revokeAdminFreeListing(userId: string): Promise<FreeListingGrant | null> {
  const result = await apiClient<{ data: FreeListingGrant | null }>(`/admin/free-listings/users/${userId}`, {
    method: 'DELETE',
  });
  return result.data;
}

export async function getAdminUserDetail(id: string) {
  const result = await apiClient<{ data: any }>(`/admin/users/${id}`);
  return result.data;
}

export async function getAdminDealersKycArchive(page = 1, limit = 20) {
  const result = await apiClient<any>(`/admin/dealers/kyc-archive?page=${page}&limit=${limit}`);
  return result;
}

export async function getAdminListings(page = 1, limit = 20, sellerRole?: string) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (sellerRole) query.set('sellerRole', sellerRole);
  const result = await apiClient<any>(`/admin/listings?${query.toString()}`);
  return result;
}

export async function getAdminListing(id: string) {
  const result = await apiClient<{ data: any }>(`/admin/listings/${id}`);
  return result.data;
}

export async function getAdminAuctions(page = 1, limit = 20) {
  const result = await apiClient<any>(`/admin/auctions?page=${page}&limit=${limit}`);
  return result;
}

export async function correctAuctionPrice(
  auctionId: string,
  reservePrice: number,
  reason?: string,
) {
  const result = await apiClient<{ data: any }>(`/admin/auctions/${auctionId}/price`, {
    method: 'PATCH',
    body: JSON.stringify({
      reservePrice,
      reason: reason?.trim() || undefined,
    }),
  });
  return result.data;
}

export async function getAllDealers() {
  const result = await apiClient<{ data: any[] }>('/admin/dealers');
  return result.data;
}

export async function assignAuctionWinner(auctionId: string, dealerId: string) {
  const result = await apiClient<any>(`/admin/auctions/${auctionId}/assign-winner`, {
    method: 'POST',
    body: JSON.stringify({ dealerId }),
  });
  return result;
}

export async function getAdminTransactions(page = 1, limit = 20) {
  const result = await apiClient<any>(`/admin/transactions?page=${page}&limit=${limit}`);
  return result;
}

export async function getPendingHandovers() {
  const result = await apiClient<{ data: any[] }>('/admin/handovers/pending');
  return result.data;
}

export async function approveHandover(auctionId: string) {
  const result = await apiClient<any>(`/admin/handovers/${auctionId}/approve`, { method: 'POST' });
  return result;
}

export async function denyHandover(auctionId: string) {
  const result = await apiClient<any>(`/admin/handovers/${auctionId}/deny`, { method: 'POST' });
  return result;
}

export async function getPendingPayouts() {
  const result = await apiClient<{ data: any[] }>('/admin/payouts/pending');
  return result.data;
}

export async function retryPayout(auctionId: string) {
  const result = await apiClient<any>(`/admin/payouts/${auctionId}/retry`, { method: 'POST' });
  return result;
}

export async function markPayoutPaidManually(auctionId: string) {
  const result = await apiClient<any>(`/admin/payouts/${auctionId}/mark-paid`, { method: 'POST' });
  return result;
}

export async function updateUserRole(userId: string, role: string) {
  const result = await apiClient<any>(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
  return result;
}

export async function banUser(userId: string) {
  return apiClient<any>(`/admin/users/${userId}/ban`, { method: 'PATCH' });
}

export async function unbanUser(userId: string) {
  return apiClient<any>(`/admin/users/${userId}/unban`, { method: 'PATCH' });
}

export async function lockUser(userId: string) {
  return apiClient<any>(`/admin/users/${userId}/lock`, { method: 'PATCH' });
}

export async function unlockUser(userId: string) {
  return apiClient<any>(`/admin/users/${userId}/unlock`, { method: 'PATCH' });
}

export async function deleteListingForce(listingId: string) {
  const result = await apiClient<any>(`/admin/listings/${listingId}`, {
    method: 'DELETE',
  });
  return result;
}

// ─── Listing Review ───────────────────────────────────────────────────────────

export async function getPendingListingReviews() {
  const result = await apiClient<{ data: any[] }>('/admin/listings/pending-review');
  return result.data;
}

export async function updateListingAsAdmin(listingId: string, fields: Record<string, unknown>) {
  const result = await apiClient<any>(`/admin/listings/${listingId}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
  return result;
}

export async function approveListing(listingId: string) {
  const result = await apiClient<any>(`/admin/listings/${listingId}/approve`, { method: 'POST' });
  return result;
}

export async function rejectListing(listingId: string, reason: string) {
  const result = await apiClient<any>(`/admin/listings/${listingId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  return result;
}

export async function getPendingKycList() {
  const result = await apiClient<{ data: any[] }>('/admin/dealers/kyc-pending');
  return result.data;
}

export async function reviewKyc(id: string, fields: { field: string; status: 'APPROVED' | 'REJECTED'; note?: string }[]) {
  const result = await apiClient<any>(`/admin/dealers/kyc/${id}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  });
  return result;
}

// ─── Traffic Analytics ────────────────────────────────────────────────────────

export interface TrafficOverview {
  pageViews: number;
  uniqueVisitors: number;
  pagesPerVisit: number;
  searches: number;
  excludedInternalPageViews: number;
}

export interface TrafficDataQuality {
  source: string;
  visitorMetric: string;
  excludedRoutes: string[];
}

export interface TrafficByDay {
  date: string;
  sessions: number;
  pageviews: number;
}

export interface BusySlot {
  dow?: number;
  hour?: number;
  sessions: number;
}

export interface TopPage { url: string; views: number }
export interface Referrer { referrer: string; count: number }
export interface GeoItem { city?: string; country?: string; count: number }
export interface DeviceItem { device: string; count: number }
export interface SearchItem { query: string; count: number }

export interface TrafficAnalytics {
  overview: TrafficOverview;
  dataQuality: TrafficDataQuality;
  trafficByDay: TrafficByDay[];
  busyDayOfWeek: { dow: number; sessions: number }[];
  busyHour: { hour: number; sessions: number }[];
  topPages: TopPage[];
  referrers: Referrer[];
  topCities: { city: string; count: number }[];
  topCountries: { country: string; count: number }[];
  devices: DeviceItem[];
  topSearches: SearchItem[];
}

export interface ValuationLiveAnalytics {
  timezone: string;
  generatedAt: string;
  attribution: {
    windowDays: number;
    exactKey: string;
    historicalFallback: string;
  };
  today: {
    requests: number;
    uniqueSessions: number;
    loggedInUsers: number;
    loggedInSessions: number;
    anonymousSessions: number;
    auctionRequests: number;
    retailRequests: number;
    valuationJourneys: number;
    listingStarted: number;
    listingCreated: number;
    uniqueListingsCreated: number;
    retailListingsCreated: number;
    auctionListingsCreated: number;
    retailFeePaid: number;
    reachedReview: number;
    retailReachedReview: number;
    auctionReachedReview: number;
    approvedLive: number;
    rejected: number;
    conversionRate: number;
    approvalRate: number;
    liveFromValuationRate: number;
  };
  hourly: Array<{
    hour: string;
    requests: number;
    sessions: number;
  }>;
  last7Days: Array<{
    date: string;
    requests: number;
    sessions: number;
    valuationJourneys: number;
    listingStarted: number;
    listingCreated: number;
    uniqueListingsCreated: number;
    retailListingsCreated: number;
    auctionListingsCreated: number;
    retailFeePaid: number;
    reachedReview: number;
    retailReachedReview: number;
    auctionReachedReview: number;
    approvedLive: number;
    rejected: number;
    conversionRate: number;
    approvalRate: number;
    liveFromValuationRate: number;
  }>;
  recent: Array<{
    id: string;
    createdAt: string;
    make: string | null;
    model: string | null;
    year: number | null;
    fuelType: string | null;
    listingType: string | null;
    device: string | null;
    city: string | null;
    country: string | null;
    entryPoint: string | null;
    startedListing: boolean;
    createdListing: boolean;
    listingId: string | null;
    listingStatus: string | null;
    feePaid: boolean;
    reachedReview: boolean;
    approvedLive: boolean;
    rejected: boolean;
  }>;
}

export async function getLiveValuationAnalytics(): Promise<ValuationLiveAnalytics> {
  return apiClient<ValuationLiveAnalytics>('/analytics/valuations/live');
}

export async function getTrafficAnalytics(from?: string, to?: string): Promise<TrafficAnalytics> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  // /analytics/traffic returns the object directly (no StandardResponse wrapper)
  return apiClient<TrafficAnalytics>(`/analytics/traffic${qs ? `?${qs}` : ''}`);
}
