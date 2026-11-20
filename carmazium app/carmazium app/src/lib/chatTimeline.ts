import type { ChatHistoryCursor, ChatMessage, ChatMessagesResponse } from './chatApi';

type LoadPage = (before?: ChatHistoryCursor) => Promise<ChatMessagesResponse>;

// The API returns each page oldest first, with a cursor for the previous page.
// Catch up to the last successful snapshot even after a long disconnection.
export async function readChatUpdates(load: LoadPage, since: ChatMessage | null, active: () => boolean) {
  let page = await load();
  let rows = page.data;
  while (active() && since && page.pagination.hasMore && page.pagination.nextCursor && rows.length) {
    const oldest = rows[0];
    if (oldest.createdAt < since.createdAt || (oldest.createdAt === since.createdAt && oldest.id <= since.id)) break;
    const cursor = page.pagination.nextCursor;
    page = await load(cursor);
    if (!page.data.length) break;
    rows = [...page.data, ...rows];
  }
  return { rows, pagination: page.pagination };
}

export function mergeChatUpdates(current: ChatMessage[], updates: ChatMessage[], roomId: string) {
  const inRoom = current.filter(row => row.chatRoomId === roomId);
  let changed = inRoom.length !== current.length;
  const rows = new Map(inRoom.map(row => [row.id, row]));
  const pending = new Map(inRoom.filter(row => row.deliveryStatus && row.clientMessageId)
    .map(row => [row.senderId + '/' + row.clientMessageId, row.id]));
  for (const row of updates) {
    if (row.chatRoomId !== roomId) continue;
    const local = row.clientMessageId && pending.get(row.senderId + '/' + row.clientMessageId);
    if (local && local !== row.id) {
      rows.delete(local);
      changed = true;
    }
    const prior = rows.get(row.id);
    if (prior && !prior.deliveryStatus && prior.updatedAt > row.updatedAt) continue;
    const confirmed = prior?.isRead && !row.isRead ? { ...row, isRead: true } : row;
    if (!prior || JSON.stringify(prior) !== JSON.stringify(confirmed)) {
      rows.set(row.id, confirmed);
      changed = true;
    }
  }
  if (!changed) return current;
  return [...rows.values()].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
