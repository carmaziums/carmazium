import type { ChatMessage } from './chatApi';

export function chatAppearance(message: Pick<ChatMessage, 'aiGenerated' | 'sender'>, dark: boolean, fallbackRole?: string) {
  const kind = message.aiGenerated ? 'ai' : (message.sender?.role || fallbackRole)?.toUpperCase() === 'ADMIN' ? 'admin' : 'customer';
  if (kind === 'admin') return { kind, background: '#B91C1C', foreground: '#FFFFFF', secondary: '#FEE2E2' };
  if (kind === 'ai') return dark
    ? { kind, background: '#1E3A5F', foreground: '#EFF6FF', secondary: '#BFDBFE' }
    : { kind, background: '#DBEAFE', foreground: '#172554', secondary: '#1E40AF' };
  return dark
    ? { kind, background: '#374151', foreground: '#F9FAFB', secondary: '#D1D5DB' }
    : { kind, background: '#E5E7EB', foreground: '#111827', secondary: '#374151' };
}

/** Only platform links produced by support become actionable. Never execute arbitrary schemes. */
export function supportLinkUrl(target: string): string | null {
  try {
    if (!target.startsWith('/') && !target.startsWith('https://')) return null;
    const url = new URL(target, 'https://www.carmazium.com');
    if (url.protocol !== 'https:' || !['carmazium.com', 'www.carmazium.com'].includes(url.hostname)
      || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

export function supportTextParts(content: string) {
  const parts: Array<{ text: string; url?: string; bold?: boolean }> = [];
  const pattern = /\[([^\]\n]+)\]\(([^\s)]+)\)/g;
  let end = 0;
  for (const match of content.matchAll(pattern)) {
    if (match.index! > end) parts.push({ text: content.slice(end, match.index) });
    const url = supportLinkUrl(match[2]);
    parts.push({ text: url ? match[1] : match[0], ...(url ? { url } : {}) });
    end = match.index! + match[0].length;
  }
  if (end < content.length) parts.push({ text: content.slice(end) });
  return parts.flatMap<{ text: string; url?: string; bold?: boolean }>(part => {
    if (part.url) return [part];
    return part.text.split(/(\*\*[^*\n]+\*\*)/g).filter(Boolean).map(text =>
      text.startsWith('**') && text.endsWith('**')
        ? { text: text.slice(2, -2), bold: true }
        : { text });
  });
}

/** Acknowledgements and loading older pages must not be mistaken for new replies. */
export class ChatFollowTracker {
  private room = '';
  private newest = '';
  update(room: string, message: Pick<ChatMessage, 'id' | 'clientMessageId' | 'senderId' | 'aiGenerated'> | undefined,
    viewerId: string | undefined, support: boolean, nearBottom: boolean): boolean {
    if (room !== this.room) { this.room = room; this.newest = ''; }
    if (!message) return false;
    const key = message.clientMessageId || message.id;
    if (key === this.newest) return false;
    const initial = !this.newest;
    this.newest = key;
    return initial || nearBottom || support || !!message.aiGenerated || message.senderId === viewerId;
  }
}
