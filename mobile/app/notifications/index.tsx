import React, { useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, type ListRenderItemInfo,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, type NotificationItem } from '@/lib/api/notifications';
import { useNotificationsStore } from '@/store/notification.store';

// ─── Row ─────────────────────────────────────────────────────────────────────

function NotificationRow({
  item,
  onPress,
}: {
  item:    NotificationItem;
  onPress: (item: NotificationItem) => void;
}) {
  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      activeOpacity={0.7}
      className={`px-4 py-4 border-b border-white/5 ${item.isRead ? 'opacity-60' : ''}`}
    >
      <View className="flex-row items-start gap-3">
        {/* Unread indicator */}
        <View className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${item.isRead ? 'bg-transparent' : 'bg-[#ff0037]'}`} />
        <View className="flex-1">
          <Text className="text-white font-semibold text-sm">{item.title}</Text>
          <Text className="text-white/60 text-sm mt-0.5">{item.message}</Text>
          <Text className="text-white/30 text-xs mt-1">
            {new Date(item.createdAt).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short',
              hour: '2-digit', minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const router      = useRouter();
  const qc          = useQueryClient();
  const { markRead, markAllRead } = useNotificationsStore();

  const {
    data, fetchNextPage, hasNextPage,
    isFetchingNextPage, isLoading, isError,
  } = useInfiniteQuery({
    queryKey:       ['notifications'],
    queryFn:        ({ pageParam = 1 }) => notificationsApi.fetchPage(pageParam as number),
    getNextPageParam: (last) => {
      const loaded = last.page * last.limit;
      return loaded < last.total ? last.page + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: (_d, id) => {
      markRead(id);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      markAllRead();
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const handleRowPress = useCallback((item: NotificationItem) => {
    if (!item.isRead) markReadMutation.mutate(item.id);
    const link = item.data?.link as string | undefined;
    if (link) router.push(link as any);
  }, [markReadMutation, router]);

  const notifications = data?.pages.flatMap((p) => p.data) ?? [];
  const allRead       = notifications.every((n) => n.isRead);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<NotificationItem>) => (
      <NotificationRow item={item} onPress={handleRowPress} />
    ),
    [handleRowPress],
  );

  return (
    <View className="flex-1 bg-[#0a0d14]">
      {/* Header */}
      <View className="px-4 pt-14 pb-4 flex-row items-center justify-between border-b border-white/5">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Text className="text-white/60 text-base">←</Text>
        </TouchableOpacity>
        <Text className="text-white font-bold text-lg">Notifications</Text>
        <TouchableOpacity
          onPress={() => markAllMutation.mutate()}
          disabled={markAllMutation.isPending || allRead}
          className="py-1 px-3"
        >
          <Text className={`text-sm font-medium ${allRead ? 'text-white/20' : 'text-[#ff0037]'}`}>
            {markAllMutation.isPending ? 'Clearing…' : 'Mark all read'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#ff0037" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-white/40 text-center">
            Could not load notifications. Pull down to retry.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            isFetchingNextPage
              ? () => <ActivityIndicator size="small" color="#ff0037" className="py-4" />
              : null
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Text className="text-white/30 text-base">No notifications yet</Text>
              <Text className="text-white/20 text-sm mt-2">
                Activity from bids, offers, and messages will appear here
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
