import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { NativePage, pageStyles as s } from '../../components/NativePage';
import { NativeRichContent } from '../../components/NativeRichContent';
import { Button } from '../../components/Button';
import { nativeDocuments, nativePartners, nativeBodyTypes } from '../../data/nativeDocuments';
import { apiClient } from '../../lib/apiClient';

export const PrivacyPolicyScreen = () => <NativePage title="Privacy Policy"><NativeRichContent html={nativeDocuments.privacy} /></NativePage>;
export const PartnerGuideScreen = () => <NativePage title="Partner Accounts"><NativeRichContent html={nativeDocuments.partner} /></NativePage>;
export const WarrantyTermsScreen = () => <NativePage title="Warranty order information"><NativeRichContent html={nativeDocuments.warrantyTerms} /></NativePage>;
export const CookiePolicyScreen = ({ navigation }: any) => <NativePage title="Cookies and privacy"><Text style={s.body}>The website uses cookies for account access and optional analytics and marketing. Cookie choices made in a browser apply to that browser. The native app uses your app settings and the separate consent notices shown when you use AI features.</Text><Button label="App settings" onPress={() => navigation.navigate('Settings')} /><Button label="Read the Privacy Policy" variant="outline" onPress={() => navigation.navigate('PrivacyPolicy')} /></NativePage>;
export const BusinessSpotlightScreen = ({ navigation, route }: any) => {
  const entries = route.params?.slug ? nativePartners.filter(p => p.slug === route.params.slug) : nativePartners;
  return <NativePage title="Business Spotlight"><Text style={s.body}>Independent automotive businesses featured by CarMazium. Contact each provider directly to confirm its services, prices and terms.</Text>
    {entries.map(p => <View key={p.slug} style={s.panel}><Text style={s.label}>{p.category}</Text><Text style={s.title}>{p.name}</Text><Text style={s.label}>{p.strapline}</Text><Text style={s.body}>{p.summary}</Text>{p.highlights.map(h => <Text key={h} style={s.body}>• {h}</Text>)}{'priceNote' in p && <Text style={s.body}>{p.priceNote}</Text>}<Button label={`Email ${p.name}`} onPress={() => void Linking.openURL(`mailto:${p.email}`)} />{'website' in p && <Button label={`Visit ${p.name}`} variant="outline" onPress={() => void Linking.openURL(p.website!)} />}</View>)}
    {!entries.length && <Text style={s.body}>This business profile is unavailable.</Text>}
    <Button label="Contact CarMazium" variant="outline" onPress={() => navigation.navigate('Contact')} />
  </NativePage>;
};
export const CarBodyGuideScreen = ({ navigation }: any) => <NativePage title="Choose a body type">
  {nativeBodyTypes.map(b => <View key={b.key} style={s.panel}><Text style={s.title}>{b.name}</Text><Text style={s.body}>{b.description}</Text><Text style={s.label}>What to check</Text><Text style={s.body}>{b.check}</Text><Button label={`Browse ${b.name}`} onPress={() => navigation.navigate('Tabs', { screen: 'Search', params: { bodyType: b.key, _t: Date.now() } })} /></View>)}
</NativePage>;

type Post = { id: string; slug: string; title: string; excerpt: string; coverImage?: string; content?: string };
export const BlogScreen = ({ navigation }: any) => {
  const [posts, setPosts] = useState<Post[]>([]), [page, setPage] = useState(1), [loading, setLoading] = useState(true), [error, setError] = useState(''), [hasMore, setHasMore] = useState(true), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    apiClient<{ data: Post[]; pagination?: { totalPages?: number } }>(`/blog?page=${page}&limit=12`).then(({ data, pagination }) => {
      if (!active) return;
      setPosts(previous => page === 1 ? data : [...previous, ...data.filter(p => !previous.some(old => old.id === p.id))]);
      setHasMore(pagination?.totalPages !== undefined ? page < pagination.totalPages : data.length === 12);
    }).catch(() => { if (active) setError('Could not load the guides. Please retry.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, retry]);
  return <NativePage title="Automotive guides">{posts.map(post => <View key={post.id} style={s.panel}>{post.coverImage && <Image source={{ uri: post.coverImage }} contentFit="cover" style={{ height: 180, borderRadius: 12 }} />}<Text style={s.title}>{post.title}</Text><Text style={s.body}>{post.excerpt}</Text><Button label="Read article" accessibilityLabel={`Read ${post.title}`} onPress={() => navigation.navigate('BlogArticle', { slug: post.slug })} /></View>)}
    {loading && <ActivityIndicator accessibilityLabel="Loading guides" />}{!!error && <><Text style={s.error}>{error}</Text><Button label="Retry" onPress={() => setRetry(n => n + 1)} /></>}
    {!loading && !error && !posts.length && <Text style={s.body}>No guides have been published yet.</Text>}
    {!loading && !error && hasMore && <Button label="More guides" variant="outline" onPress={() => setPage(p => p + 1)} />}
  </NativePage>;
};
export const BlogArticleScreen = ({ route }: any) => {
  const [post, setPost] = useState<Post | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setPost(null); setError('');
    apiClient<{ data: Post }>(`/blog/${encodeURIComponent(route.params.slug)}`).then(({ data }) => { if (active) setPost(data); }).catch(() => { if (active) setError('This article could not be loaded. It may have been removed, or your connection may be unavailable.'); });
    return () => { active = false; };
  }, [route.params.slug, retry]);
  return <NativePage title="CarMazium guide">{error ? <><Text style={s.error}>{error}</Text><Button label="Retry" onPress={() => setRetry(n => n + 1)} /></> : !post ? <ActivityIndicator accessibilityLabel="Loading article" /> : <><Text style={s.title}>{post.title}</Text>{post.coverImage && <Image source={{ uri: post.coverImage }} contentFit="contain" style={{ height: 220 }} />}<NativeRichContent markdown html={post.content || post.excerpt} /></>}</NativePage>;
};
