import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { Button } from '../../components/Button';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import { apiClient } from '../../lib/apiClient';
import { sellerGuideGroups } from '../../data/sellerGuideGroups';

type Post = { id: string; slug: string; title: string; excerpt: string; coverImage?: string; content?: string; publishedAt?: string; tags?: string[] };
export const guideReadTime = (content = '') => Math.max(1, Math.ceil(content.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#>*_`~|\-]/g, ' ').trim().split(/\s+/).filter(Boolean).length / 220));
const dateLabel = (date?: string) => date && Number.isFinite(new Date(date).getTime()) ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export function BlogScreen({ navigation }: any) {
  const insets = useSafeAreaInsets(), scroll = useRef<ScrollView>(null), libraryY = useRef(0);
  const [posts, setPosts] = useState<Post[]>([]), [page, setPage] = useState(1), [requestedPage, setRequestedPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1), [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0), [linkError, setLinkError] = useState('');
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    apiClient<{ data: Post[]; pagination?: { totalPages?: number } }>(`/blog?page=${requestedPage}&limit=12`).then(({ data, pagination }) => {
      if (!active) return;
      if (!Array.isArray(data) || !Number.isInteger(pagination?.totalPages) || (pagination?.totalPages ?? -1) < 0) throw Error('Invalid guide response');
      setPosts(data); setPage(requestedPage); setTotalPages(Math.max(1, pagination!.totalPages!));
      scroll.current?.scrollTo({ y: 0, animated: false });
    }).catch(() => { if (active) setError('Could not load the guides. Please retry.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [requestedPage, retry]);
  const open = (slug: string) => navigation.navigate('BlogArticle', { slug });
  const sell = () => navigation.navigate('SellLanding');
  const featured = page === 1 ? posts[0] : undefined;
  const card = (post: Post, first = false) => <View key={post.id} style={s.card}>
    {post.coverImage && <Image source={{ uri: post.coverImage }} contentFit="cover" accessibilityLabel={post.title} style={s.photo} />}
    <View style={s.cardContent}>
      {!!post.tags?.[0] && <Text style={s.eyebrow}>{post.tags[0]}</Text>}
      <Text accessibilityRole="header" style={[s.heading, !first && { fontSize: 20, lineHeight: 28 }]}>{post.title}</Text>
      <Text style={s.body}>{post.excerpt}</Text>
      <Text style={s.meta}>{[dateLabel(post.publishedAt), `${guideReadTime(post.content)} min${first ? ' read' : ''}`].filter(Boolean).join(' · ')}</Text>
      <Button label={first ? 'Read the full guide' : 'Read guide'} accessibilityLabel={`Read ${post.title}`} onPress={() => open(post.slug)} />
    </View>
  </View>;
  return <View style={s.page}><WebsiteTopBar /><ScrollView ref={scroll} contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]}>
    <View style={s.hero}>
      <Text style={s.eyebrow}>CarMazium Automotive Insights</Text>
      <Text accessibilityRole="header" style={s.title}>Make smarter decisions about buying and selling cars.</Text>
      <Text style={[s.body, { lineHeight: 32 }]}>UK market comparisons, selling guides, auction advice and practical automotive research written to help you understand your options before you act.</Text>
      <Button label="Sell My Car" onPress={sell} /><Button label="Browse Guides" variant="outline" onPress={() => scroll.current?.scrollTo({ y: libraryY.current, animated: true })} />
    </View>
    {page === 1 && <>
      <Text accessibilityRole="header" style={s.heading}>Practical guides for UK car sellers</Text>
      <Text style={s.body}>Compare selling options, prepare your documents and understand how your car’s condition affects the sale.</Text>
      {sellerGuideGroups.map(group => <View key={group.title} style={s.panel}><Text style={s.label}>{group.title}</Text>{group.guides.map(([slug, label]) => <TouchableOpacity key={slug} accessibilityRole="link" onPress={() => open(slug)} style={{ paddingVertical: 8 }}><Text style={s.link}>{label}</Text></TouchableOpacity>)}</View>)}
      <View style={s.panel}><Text style={s.eyebrow}>Follow our automotive insights</Text><Text style={s.heading}>Add CarMazium to your Google Preferred Sources</Text><Text style={s.body}>Choose CarMazium to see more of our relevant articles in Google's Top Stories, when eligible.</Text><Button label="Open Google source preferences" variant="outline" onPress={async () => { setLinkError(''); try { await Linking.openURL('https://www.google.com/preferences/source?q=carmazium.com'); } catch { setLinkError('Could not open Google source preferences. Please try again.'); } }} />{!!linkError && <Text accessibilityRole="alert" style={s.link}>{linkError}</Text>}</View>
      <Text style={s.eyebrow}>Explore by goal</Text><Text accessibilityRole="header" style={s.heading}>Find the right CarMazium guide</Text>
      {[
        { title: 'Find used cars for sale', text: 'Search available retail cars from CarMazium sellers.', action: () => navigation.navigate('Tabs', { screen: 'Search' }) },
        { title: 'Understand dealer car auctions', text: 'Learn how sellers list for free and verified traders bid.', action: () => navigation.navigate('HowItWorks') },
        { title: 'Compare used-car body types', text: 'Choose between hatchbacks, SUVs, estates and more.', action: () => navigation.navigate('CarBodyGuide') },
      ].map(item => <TouchableOpacity key={item.title} accessibilityRole="button" accessibilityLabel={item.title} style={s.panel} onPress={item.action}><Text style={s.label}>{item.title} →</Text><Text style={s.body}>{item.text}</Text></TouchableOpacity>)}
    </>}
    {!!error && <View style={s.panel}><Text accessibilityRole="alert" style={s.link}>{error}</Text><Button label="Retry" onPress={() => setRetry(n => n + 1)} /></View>}
    {loading && <ActivityIndicator accessibilityLabel="Loading guides" />}
    {!loading && !error && posts.length === 0 && <View style={s.panel}><Text style={s.heading}>No posts yet</Text><Text style={s.body}>Check back soon for new articles.</Text></View>}
    {featured && <><Text style={s.eyebrow}>Featured guide</Text><Text accessibilityRole="header" style={s.heading}>Start with our latest research</Text>{card(featured, true)}</>}
    <View onLayout={event => { libraryY.current = event.nativeEvent.layout.y; }}><Text style={s.eyebrow}>Research library</Text><Text accessibilityRole="header" style={s.heading}>{page === 1 ? 'More automotive guides' : `Automotive guides — page ${page}`}</Text></View>
    {(featured ? posts.slice(1) : posts).map(post => card(post))}
    <View style={s.panel}><Text style={s.eyebrow}>Ready when you are</Text><Text style={s.heading}>Research the market, then sell your car your way.</Text><Text style={s.body}>Auction listing £0 or retail advertising from £1.</Text><Button label="Start Selling" onPress={sell} /></View>
    {totalPages > 1 && <View style={s.pagination}>
      {page > 1 && <Button label="Previous" variant="outline" disabled={loading} onPress={() => setRequestedPage(page - 1)} />}
      {Array.from({ length: totalPages }, (_, i) => i + 1).filter(n => totalPages <= 9 || n === 1 || n === totalPages || Math.abs(n - page) <= 3).map(n => <Button key={n} label={String(n)} accessibilityLabel={`Page ${n}`} variant={n === page ? 'primary' : 'outline'} disabled={loading || n === page} onPress={() => setRequestedPage(n)} />)}
      <Text style={s.meta}>Page {page} of {totalPages}</Text>
      {page < totalPages && <Button label="Next" variant="outline" disabled={loading} onPress={() => setRequestedPage(page + 1)} />}
    </View>}
  </ScrollView></View>;
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.bgPrimary }, content: { paddingHorizontal: 20, paddingTop: 96, gap: 24 },
  hero: { paddingHorizontal: 24, paddingVertical: 40, gap: 20, borderRadius: 24, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard, marginBottom: 16 },
  title: { fontFamily: FontFamily.extraBold, fontSize: 30, lineHeight: 33, letterSpacing: -.7, color: Colors.textPrimary },
  heading: { fontFamily: FontFamily.extraBold, fontSize: 24, lineHeight: 32, color: Colors.textPrimary },
  label: { fontFamily: FontFamily.bold, fontSize: 17, lineHeight: 25, color: Colors.textPrimary },
  body: { fontFamily: FontFamily.regular, fontSize: 16, lineHeight: 26, color: Colors.textSecondary },
  meta: { fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 20, color: Colors.textMuted },
  eyebrow: { fontFamily: FontFamily.bold, fontSize: 10, letterSpacing: 1.7, textTransform: 'uppercase', color: Colors.accent },
  link: { fontFamily: FontFamily.regular, fontSize: 16, lineHeight: 26, color: Colors.accent, textDecorationLine: 'underline' },
  panel: { padding: 20, gap: 14, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard },
  card: { overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard },
  photo: { width: '100%', aspectRatio: 16 / 9 }, cardContent: { padding: 24, gap: 18 },
  pagination: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 12 },
});
