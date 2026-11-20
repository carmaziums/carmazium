import React, { useMemo } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { parseDocument } from 'htmlparser2';
import { marked } from 'marked';
import { Button } from './Button';
import { pageStyles as s } from './NativePage';
import { Colors } from '../constants/colors';
import { nativeContentTarget } from '../lib/nativeContentLinks';

// Data-only HTML parser. Article/policy content is rendered with native views;
// scripts, frames and styles never execute and no website session is loaded.
export function NativeRichContent({ html, markdown = false }: { html: string; markdown?: boolean }) {
  const navigation = useNavigation<any>();
  const document = useMemo(() => parseDocument(markdown ? marked.parse(html, { async: false }) : html), [html, markdown]);
  const open = (href: string) => {
    const target = nativeContentTarget(href);
    if (target) { navigation.navigate(target.name, target.params); return; }
    try {
      const url = new URL(href, 'https://www.carmazium.com');
      if (['carmazium.com', 'www.carmazium.com'].includes(url.hostname)) { Alert.alert('Link unavailable in the app', 'Contact the team for help with this page.'); return; }
      if (['https:', 'mailto:', 'tel:'].includes(url.protocol)) void Linking.openURL(url.toString()).catch(() => Alert.alert('Could not open link', 'Please try again.'));
    } catch { /* Invalid article links are not executable. */ }
  };
  type Node = ReturnType<typeof parseDocument>['children'][number];
  const text = (node: Node): string => node.type === 'text' ? node.data : 'children' in node ? node.children.map(text).join('') : '';
  const render = (node: Node, key: string): React.ReactNode => {
    if (node.type === 'text') return node.data.trim() ? <Text key={key} style={s.body}>{node.data}</Text> : null;
    if (!('attribs' in node)) return null;
    if (['script', 'style', 'iframe', 'noscript'].includes(node.name)) return null;
    if (node.name === 'img') {
      let uri: string;
      try { uri = new URL(node.attribs.src || '', 'https://www.carmazium.com').toString(); } catch { return null; }
      return uri.startsWith('https:') ? <Image key={key} source={{ uri }} accessibilityLabel={node.attribs.alt} contentFit="contain" style={{ width: '100%', height: 220 }} /> : null;
    }
    if (node.name === 'a') return <Button key={key} variant="ghost" label={text(node) || 'Open link'} onPress={() => open(node.attribs.href || '')} />;
    if (node.name === 'p' && node.children.some(child => 'name' in child && child.name === 'img')) return <View key={key} style={{ gap: 8 }}>{node.children.map((child, i) => render(child, `${key}.${i}`))}</View>;
    const heading = /^h[1-6]$/.test(node.name);
    if (heading) return <Text key={key} accessibilityRole="header" style={[s.label, { fontSize: node.name === 'h1' ? 25 : 21, marginTop: 12 }]}>{text(node)}</Text>;
    // Keep inline words together, with native clickable Text for inline links.
    if (['p', 'li', 'td', 'th', 'blockquote'].includes(node.name)) {
      const inline = (child: Node, i: number): React.ReactNode => {
        if (child.type === 'text') return child.data;
        if (!('attribs' in child) || ['script', 'style'].includes(child.name)) return null;
        if (child.name === 'br') return '\n';
        return <Text key={i} onPress={child.name === 'a' ? () => open(child.attribs.href || '') : undefined} accessibilityRole={child.name === 'a' ? 'link' : undefined} style={child.name === 'a' ? { color: Colors.accent, textDecorationLine: 'underline' } : ['b', 'strong'].includes(child.name) ? { fontWeight: '700' } : undefined}>{child.children.map(inline)}</Text>;
      };
      return <Text key={key} selectable style={[s.body, { marginVertical: 5 }]}>{node.name === 'li' ? '• ' : ''}{node.children.map(inline)}</Text>;
    }
    return <View key={key} style={{ gap: 8 }}>{node.children.map((child, i) => render(child, `${key}.${i}`))}</View>;
  };
  return <View style={{ gap: 12 }}>{document.children.map((node, i) => render(node, String(i)))}</View>;
}
