import React, { useState } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Button } from './Button';
import { Colors } from '../constants/colors';
import { encodeProfileImagePresentation, parseProfileImagePresentation, type ProfileImageFit } from '../lib/profileImagePresentation';

export function PresentedProfileImage({uri,style,fallbackFit='cover'}:{uri:string;style?:StyleProp<ViewStyle>;fallbackFit?:ProfileImageFit}) {
  const p=parseProfileImagePresentation(uri,fallbackFit);
  return <View style={[style,{overflow:'hidden'}]}><Image source={{uri:p.src}} contentFit={p.fit} contentPosition={{left:`${p.x}%`,top:`${p.y}%`}} style={{width:'100%',height:'100%',transform:[{scale:p.zoom}],transformOrigin:`${p.x}% ${p.y}%`}} cachePolicy="memory-disk"/></View>;
}
/** Same non-destructive URL presentation contract as the website. */
export function ProfileImageAdjustment({uri,fallbackFit='cover',onSave,onClose}:{uri:string;fallbackFit?:ProfileImageFit;onSave:(value:string)=>Promise<void>;onClose:()=>void}) {
  const [draft,setDraft]=useState(()=>parseProfileImagePresentation(uri,fallbackFit));
  const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
  const lock=React.useRef(false);
  const change=(key:'zoom'|'x'|'y',delta:number)=>setDraft(old=>({...old,[key]:Math.min(key==='zoom'?2.5:100,Math.max(key==='zoom'?1:0,Math.round((old[key]+delta)*100)/100))}));
  const save=async()=>{if(lock.current)return;lock.current=true;setBusy(true);setError(null);try{await onSave(encodeProfileImagePresentation(uri,draft));onClose();}catch(e){setError(e instanceof Error?e.message:'Could not save display. Please retry.');}finally{lock.current=false;setBusy(false);}};
  return <View style={{gap:16}}><Text style={{color:Colors.textPrimary,fontWeight:'700'}}>Visitor preview</Text>
    <PresentedProfileImage uri={encodeProfileImagePresentation(uri,draft)} style={{width:200,height:200,borderRadius:24,alignSelf:'center',backgroundColor:Colors.bgTertiary}} fallbackFit={fallbackFit}/>
    <Text style={{color:Colors.textMuted}}>These controls only change the public display. Your original uploaded image is not altered.</Text>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{(['cover','contain'] as const).map(fit=><Button key={fit} label={fit==='cover'?'Fill frame':'Show full image'} variant={draft.fit===fit?'primary':'outline'} disabled={busy} onPress={()=>setDraft(old=>({...old,fit}))}/>)}</View>
    {([{key:'zoom',label:'Zoom',step:0.05},{key:'x',label:'Move left / right',step:5},{key:'y',label:'Move up / down',step:5}] as const).map(({key,label,step})=><View key={key} style={{gap:8}}><Text style={{color:Colors.textPrimary}}>{label}: {Math.round(draft[key]*(key==='zoom'?100:1))}%</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:12}}><Button label={`Decrease ${label}`} size="sm" variant="outline" disabled={busy} onPress={()=>change(key,-step)}/><Button label={`Increase ${label}`} size="sm" variant="outline" disabled={busy} onPress={()=>change(key,step)}/></View></View>)}
    {!!error&&<Text accessibilityRole="alert" style={{color:Colors.error}}>{error}</Text>}
    <Button label="Save display" loading={busy} onPress={()=>void save()}/><Button label="Reset display" variant="outline" disabled={busy} onPress={()=>setDraft({src:draft.src,fit:fallbackFit,x:50,y:50,zoom:1})}/>
  </View>;
}
