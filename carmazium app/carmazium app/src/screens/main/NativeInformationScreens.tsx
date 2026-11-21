import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { NativePage, pageStyles as s } from '../../components/NativePage';
import { NativeRichContent } from '../../components/NativeRichContent';
import { Button } from '../../components/Button';
import { nativeDocuments, nativePartners } from '../../data/nativeDocuments';
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
export { CarBodyGuideScreen } from './CarBodyGuideScreen';

type Post = { id: string; slug: string; title: string; excerpt: string; coverImage?: string; content?: string };
export { BlogScreen } from './BlogScreen';
export const BlogArticleScreen = ({ route }: any) => {
  const [post, setPost] = useState<Post | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setPost(null); setError('');
    apiClient<{ data: Post }>(`/blog/${encodeURIComponent(route.params.slug)}`).then(({ data }) => { if (active) setPost(data); }).catch(() => { if (active) setError('This article could not be loaded. It may have been removed, or your connection may be unavailable.'); });
    return () => { active = false; };
  }, [route.params.slug, retry]);
  return <NativePage title="CarMazium guide">{error ? <><Text style={s.error}>{error}</Text><Button label="Retry" onPress={() => setRetry(n => n + 1)} /></> : !post ? <ActivityIndicator accessibilityLabel="Loading article" /> : <><Text style={s.title}>{post.title}</Text>{post.coverImage && <Image source={{ uri: post.coverImage }} contentFit="contain" style={{ height: 220 }} />}<NativeRichContent markdown html={post.content || post.excerpt} /></>}</NativePage>;
};
