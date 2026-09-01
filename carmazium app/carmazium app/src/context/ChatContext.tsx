import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import {
  getChatRooms,
  getUnreadCount,
  type ChatRoom,
  type ChatMessage,
} from '../lib/chatApi';
import { getAccessToken } from '../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev';

interface ChatContextType {
  rooms: ChatRoom[];
  unreadCount: number;
  isConnected: boolean;
  isLoading: boolean;
  /** Ids of conversation partners currently online. The gateway broadcasts
   *  this and web has always consumed it; mobile listened for neither
   *  presence event, so it could never show who was reachable (DASH-023). */
  onlineUserIds: Set<string>;

  refreshRooms: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  sendMessage: (roomId: string, content: string) => void;
  startTyping: (roomId: string) => void;
  stopTyping: (roomId: string) => void;
  markAsRead: (roomId: string) => void;

  onNewMessage: (callback: (message: ChatMessage) => void) => () => void;
  onTyping: (callback: (data: { roomId: string; userId: string; isTyping: boolean }) => void) => () => void;
  onMessagesRead: (callback: (data: { roomId: string; readBy: string }) => void) => () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const socketRef = useRef<Socket | null>(null);
  const messageCallbacks = useRef<Set<(message: ChatMessage) => void>>(new Set());
  const typingCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const readCallbacks = useRef<Set<(data: any) => void>>(new Set());
  const hasInitiallyLoaded = useRef(false);

  // Initialize socket connection
  useEffect(() => {
    if (!isAuthenticated || !user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      hasInitiallyLoaded.current = false;
      return;
    }

    let socket: Socket | null = null;

    const connectSocket = async () => {
      const token = await getAccessToken();
      if (!token) {
        console.warn('No token available for WebSocket connection');
        return;
      }

      // Socket.io namespaces (/chat)
      socket = io(`${API_URL}/chat`, {
        // Function form so socket.io-client re-fetches a fresh token on every
        // (re)connection attempt instead of freezing the one captured here —
        // a plain object is never re-evaluated, so a reconnect after Supabase's
        // silent background token refresh would otherwise auth with a stale token.
        auth: (cb) => getAccessToken().then((t) => cb(t ? { token: t } : {})),
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socket.on('connect', () => {
        // Connection lifecycle noise — useful while developing the realtime
        // chat layer, not something end users' devices need logging on every
        // reconnect in production. Gated behind __DEV__ (also auto-stripped
        // from prod bundles by the babel transform-remove-console config).
        if (__DEV__) console.log('Mobile chat socket connected');
        setIsConnected(true);
      });

      socket.on('disconnect', () => {
        if (__DEV__) console.log('Mobile chat socket disconnected');
        setIsConnected(false);
        // Our own socket is down, so we no longer know who is online. Holding
        // the last known set would show stale green dots for as long as the
        // disconnection lasts — worse than showing nobody.
        setOnlineUserIds(new Set());
      });

      socket.on('message:new', (message: ChatMessage) => {
        messageCallbacks.current.forEach((cb) => cb(message));
        // Hydrate or refresh unread count / rooms list on new message
        if (message.senderId !== user.id) {
          setUnreadCount((prev) => prev + 1);
        }
        // Update rooms list locally
        refreshRoomsSilently();
      });

      // Who is already online at the moment we connect. Without this every
      // partner reads as offline until their next connect/disconnect — which
      // is exactly why the gateway sends it (`chat.gateway.ts:116-124`).
      socket.on('presence:snapshot', (data: { onlineUserIds?: string[] }) => {
        setOnlineUserIds(new Set(data?.onlineUserIds ?? []));
      });

      // Incremental changes from then on (`chat.gateway.ts:110-113,162-166`).
      socket.on('presence:update', (data: { userId?: string; online?: boolean }) => {
        if (!data?.userId) return;
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          if (data.online) next.add(data.userId!);
          else next.delete(data.userId!);
          return next;
        });
      });

      socket.on('user:typing', (data: any) => {
        typingCallbacks.current.forEach((cb) => cb(data));
      });

      socket.on('messages:read', (data: any) => {
        readCallbacks.current.forEach((cb) => cb(data));
      });

      socket.on('error', (error: any) => {
        console.error('Mobile chat socket error:', error);
      });

      socketRef.current = socket;
    };

    connectSocket();

    return () => {
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [user, isAuthenticated]);

  const refreshRooms = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const data = await getChatRooms();
      setRooms(data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      // NO_SESSION = user is on VerifyEmail screen, no real Supabase session yet
      // AUTH_REDIRECT = session expired/invalid — both are expected, not bugs
      // OFFLINE = no connectivity; the app-wide banner already says so, and a
      // chat error on top of it would be noise (CROSS-015).
      if (msg !== 'NO_SESSION' && msg !== 'AUTH_REDIRECT' && msg !== 'REQUEST_TIMEOUT' && msg !== 'OFFLINE') {
        console.error('Failed to fetch rooms:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const refreshRoomsSilently = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getChatRooms();
      setRooms(data);
    } catch (error) {
      console.warn('Failed to refresh rooms silently:', error);
    }
  }, [user]);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    if (user && isAuthenticated && !authLoading && !hasInitiallyLoaded.current) {
      hasInitiallyLoaded.current = true;
      refreshRooms();
      refreshUnreadCount();
    }
  }, [user, isAuthenticated, authLoading, refreshRooms, refreshUnreadCount]);

  // Socket Actions
  const sendMessage = useCallback((roomId: string, content: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('message:send', { roomId, content });
    } else {
      console.warn('Cannot send message, socket not connected');
    }
  }, []);

  const startTyping = useCallback((roomId: string) => {
    socketRef.current?.emit('typing:start', { roomId });
  }, []);

  const stopTyping = useCallback((roomId: string) => {
    socketRef.current?.emit('typing:stop', { roomId });
  }, []);

  const markAsRead = useCallback((roomId: string) => {
    socketRef.current?.emit('message:read', { roomId });
    // Optimistically decrement count
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  // Event Subscriptions
  const onNewMessage = useCallback((callback: (message: ChatMessage) => void) => {
    messageCallbacks.current.add(callback);
    return () => {
      messageCallbacks.current.delete(callback);
    };
  }, []);

  const onTyping = useCallback((callback: (data: any) => void) => {
    typingCallbacks.current.add(callback);
    return () => {
      typingCallbacks.current.delete(callback);
    };
  }, []);

  const onMessagesRead = useCallback((callback: (data: any) => void) => {
    readCallbacks.current.add(callback);
    return () => {
      readCallbacks.current.delete(callback);
    };
  }, []);

  const value: ChatContextType = {
    rooms,
    unreadCount,
    onlineUserIds,
    isConnected,
    isLoading,
    refreshRooms,
    refreshUnreadCount,
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead,
    onNewMessage,
    onTyping,
    onMessagesRead,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
