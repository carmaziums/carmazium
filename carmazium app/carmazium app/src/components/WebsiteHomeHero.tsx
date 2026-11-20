import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { WebView } from 'react-native-webview';
import { Image } from 'expo-image';
import { Ionicons } from './BrandIcon';
import { homeHeroImages as art } from '../assets/homeHeroImages';
import { themeMode } from '../constants/colors';
import { FontFamily } from '../constants/typography';
import type { MainStackParamList } from '../navigation/MainStackNavigator';

const vehicles = ['hatchback', 'suv', 'flying-car-concept', 'campervan', 'touring-caravan', 'panel-van', 'box-truck', 'motorbike', 'pickup', 'tesla-inspired-flying-concept'] as const;

// Only the decorative artwork is HTML. Text, navigation and pause controls
// remain native/accessibile. No remote page, auth data or network is involved.
function sceneHtml(dark: boolean, desktop: boolean) {
  const scene = art[desktop ? 'scene-desktop' : 'scene-mobile'];
  const sources = vehicles.map(name => art[name]);
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'"><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${dark ? '#1b2538' : '#fff'}}
.scene{position:absolute;inset:0;background:${dark ? '#ff3b52' : `url('${scene}') center/100% 100% no-repeat`}}
${dark ? `.scene:before{content:'';position:absolute;inset:0;background:#1b2538;-webkit-mask:url('${scene}') center/100% 100% no-repeat;mask:url('${scene}') center/100% 100% no-repeat;mask-mode:luminance;}` : ''}
.lane{position:absolute;left:${desktop ? '44.5' : '6.1'}%;top:${desktop ? '33.48' : '31.9'}%;width:${desktop ? '50' : '87'}%;height:${desktop ? '61.07' : '59.44'}%}
img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center bottom}
</style></head><body><div class="scene"><div class="lane"><img src="${sources[0]}"/></div></div><script>
const sources=${JSON.stringify(sources)},vehicle=document.querySelector('.lane img');let generation=0,index=0;
const pose=(x,opacity)=>({transform:'translateX('+x+'%)',opacity});
function stop(){generation++;vehicle.getAnimations().forEach(a=>a.cancel());Object.assign(vehicle.style,pose(0,1))}
window.setSceneActive=async function(value){stop();if(!value)return;const run=generation;
const move=(from,to,duration)=>vehicle.animate([from,to],{duration,easing:'linear',fill:'forwards'}).finished;
while(run===generation){const next=(index+1)%sources.length,preload=new Image();preload.src=sources[next];
try{await Promise.all([preload.decode(),move(pose(0,1),pose(-2,1),1000)]);if(run!==generation)return;
// Finish fading out before swapping the single vehicle image. Predecoding
// avoids a loading gap while preventing two vehicles from overlapping.
await move(pose(-2,1),pose(-4,0),1000);if(run!==generation)return;
Object.assign(vehicle.style,pose(4,0));vehicle.getAnimations().forEach(a=>a.cancel());
vehicle.src=sources[next];index=next;
await move(pose(4,0),pose(0,1),2000);if(run!==generation)return;
Object.assign(vehicle.style,pose(0,1));vehicle.getAnimations().forEach(a=>a.cancel());
}catch(e){if(run===generation)stop();return}}};
</script></body></html>`;
}

export function WebsiteHomeHero({ visible = true }: { visible?: boolean }) {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { width } = useWindowDimensions();
  const desktop = width >= 768;
  const stageWidth = Math.min(width, desktop ? 1500 : 620);
  const dark = themeMode === 'dark';
  const ink = dark ? '#fff' : '#152537';
  const surface = dark ? '#1b2538' : '#fff';
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [failed, setFailed] = useState(false);
  const focused = useIsFocused();
  const scene = useRef<WebView>(null);
  const running = visible && focused && foreground && !paused && !reduced;
  const html = useMemo(() => sceneHtml(dark, desktop), [dark, desktop]);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduced(value); }).catch(() => { /* Keep a still image if the preference is unavailable. */ });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const app = AppState.addEventListener('change', value => setForeground(value === 'active'));
    return () => { mounted = false; motion.remove(); app.remove(); };
  }, []);
  useEffect(() => { scene.current?.injectJavaScript(`window.setSceneActive?.(${running});true;`); }, [running, html]);
  const titleSize = desktop ? Math.min(96, Math.max(48, width * .065)) : Math.min(72, Math.max(40, width * .118));
  const offerSize = desktop ? Math.min(39, Math.max(20, width * .027)) : Math.min(32, Math.max(19, width * .056));
  return <View style={{ backgroundColor: surface }}>
    <View style={[styles.stage, { width: stageWidth }, desktop && { minHeight: stageWidth * 507 / 1103, padding: stageWidth * .035 }]}>
      <View style={[styles.copy, desktop && { width: '46%', marginHorizontal: 0, zIndex: 1 }]}>
        <Text accessibilityRole="header" style={{ fontFamily: FontFamily.extraBold, color: ink, fontSize: titleSize, lineHeight: titleSize * .99, letterSpacing: -titleSize * .055 }}>Your car.{ '\n' }<Text style={{ color: dark ? '#ff6374' : '#c81024' }}>Your choice.</Text></Text>
        <Text style={{ fontFamily: FontFamily.extraBold, color: ink, fontSize: offerSize, lineHeight: offerSize * 1.2, letterSpacing: -offerSize * .04, marginTop: offerSize * .4 }}>Auction FREE. Retail for £1.</Text>
        {desktop && <Text style={{ color: ink, fontFamily: FontFamily.regular, fontSize: Math.min(27, width * .019), marginVertical: 12 }}>Advertise for £1 until sold, or choose a free dealer auction.</Text>}
      </View>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={desktop ? StyleSheet.absoluteFill : { height: stageWidth * 327 / 382 }}>
        {failed ? <Image source={{ uri: art.hatchback }} contentFit="contain" style={StyleSheet.absoluteFill} /> : <WebView
          ref={scene} source={{ html }} style={{ backgroundColor: surface }} scrollEnabled={false}
          originWhitelist={['about:blank']} onShouldStartLoadWithRequest={request => request.url === 'about:blank'}
          javaScriptEnabled domStorageEnabled={false} allowFileAccess={false} mixedContentMode="never"
          onLoadEnd={() => scene.current?.injectJavaScript(`window.setSceneActive?.(${running});true;`)}
          onError={() => setFailed(true)} onContentProcessDidTerminate={() => setFailed(true)} onRenderProcessGone={() => setFailed(true)}
        />}
      </View>
      <View style={[styles.actions, desktop && { width: '46%', marginHorizontal: 0, zIndex: 1 }]}>
        <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('SellCarFlow', { listingType: 'CLASSIFIED' })} style={[styles.action, { backgroundColor: '#c81024', borderColor: '#c81024' }]}><Text style={[styles.actionText, { color: '#fff' }]}>List my car for £1</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('SellCarFlow', { listingType: 'AUCTION' })} style={[styles.action, { backgroundColor: surface, borderColor: dark ? '#d7e0ee' : '#172534' }]}><Text style={[styles.actionText, { color: ink }]}>Sell by auction FREE</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('SellLanding')} style={styles.valuation}><Text style={{ fontFamily: FontFamily.bold, color: ink, fontSize: 16, textDecorationLine: 'underline' }}>Get a valuation →</Text></TouchableOpacity>
      </View>
      {!reduced && !failed && <TouchableOpacity accessibilityRole="button" accessibilityLabel={paused ? 'Play vehicle animation' : 'Pause vehicle animation'} onPress={() => setPaused(!paused)} style={[styles.motion, { backgroundColor: surface, borderColor: dark ? '#8594a9' : '#ccd0d5' }]}><Ionicons name={paused ? 'play' : 'pause'} size={14} color={ink} /></TouchableOpacity>}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  stage: { alignSelf: 'center', paddingBottom: 16 },
  copy: { marginHorizontal: '5.5%', paddingTop: 12 },
  actions: { marginHorizontal: '5%', gap: 9 },
  action: { minHeight: 48, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 2, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontFamily: FontFamily.bold, fontSize: 18, textAlign: 'center' },
  valuation: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  motion: { position: 'absolute', bottom: 20, right: 10, width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
