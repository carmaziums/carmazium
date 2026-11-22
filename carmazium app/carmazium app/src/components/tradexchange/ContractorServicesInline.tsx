import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Button } from '../Button';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import { apiClient } from '../../lib/apiClient';
import type { ContractorCapability } from '../../lib/servicesApi';

type Service = 'DELIVERY' | 'INSPECTION';
type Profile = { businessName: string | null; phone: string | null; serviceArea: string | null } | null;
const ORDER:Service[]=['DELIVERY','INSPECTION'];
export function ContractorServicesInline({
 capabilities,profile,onUpdated,openRequest=0,
}:{capabilities:ContractorCapability[];profile:Profile;onUpdated:()=>Promise<void>;openRequest?:number}){
 const [expanded,setExpanded]=useState(true);
 const [name,setName]=useState(profile?.businessName||'');
 const [phone,setPhone]=useState(profile?.phone||'');
 const [area,setArea]=useState(profile?.serviceArea||'');
 const [busy,setBusy]=useState<Service|null>(null);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 useEffect(()=>{setName(profile?.businessName||'');setPhone(profile?.phone||'');setArea(profile?.serviceArea||'');},[profile?.businessName,profile?.phone,profile?.serviceArea]);
 useEffect(()=>{if(openRequest>0)setExpanded(true)},[openRequest]);
 const apply=async(serviceType:Service)=>{
  const old=capabilities.find(c=>c.serviceType===serviceType);
  if(old&&old.status!=='REJECTED')return;
  if(!name.trim()){setError('Enter your business or trading name.');return;}
  setBusy(serviceType);setError('');setNotice('');
  try{
   const response=await apiClient<{data:ContractorCapability}>('/services/capabilities',{
    method:'POST',
    body:JSON.stringify({serviceType,businessName:name.trim(),phone:phone.trim()||undefined,serviceArea:area.trim()||undefined}),
   });
   const cap=response.data;
   if(!cap?.id||!/^[a-zA-Z0-9_-]+$/.test(cap.id)||cap.serviceType!==serviceType){
    throw Error('Service setup returned a different application. No changes were made to navigation.');
   }
   await onUpdated();
   setNotice('Service application saved. Complete business declaration and working areas below.');
  }catch(e:any){setError(e?.message||'Unable to apply for service.');}
  finally{setBusy(null);}
 };
 return <View style={styles.card}>
  <TouchableOpacity accessibilityRole="button" accessibilityLabel="My Services" accessibilityState={{expanded}}
   onPress={()=>setExpanded(v=>!v)} style={styles.heading}>
   <View style={{flex:1}}><Text style={styles.title}>My Services</Text><Text style={styles.desc}>Existing applications remain on your account. No second registration.</Text></View>
   <Text style={styles.arrow}>{expanded?'−':'+'}</Text>
  </TouchableOpacity>
  {expanded&&<View style={styles.stack}>
   <Text style={styles.label}>Trading name</Text>
   <TextInput accessibilityLabel="Provider trading name" value={name} onChangeText={setName} maxLength={120} style={styles.input} placeholder="Business or trading name" placeholderTextColor={Colors.textMuted}/>
   <Text style={styles.label}>Phone</Text>
   <TextInput accessibilityLabel="Provider phone" value={phone} onChangeText={setPhone} maxLength={30} style={styles.input} placeholder="Business phone" placeholderTextColor={Colors.textMuted}/>
   <Text style={styles.label}>Coverage description (optional)</Text>
   <TextInput accessibilityLabel="Provider coverage description" value={area} onChangeText={setArea} maxLength={200} style={styles.input} placeholder="Service area" placeholderTextColor={Colors.textMuted}/>
   <Text style={styles.desc}>Use Job Preferences below to change the postcodes for new work.</Text>
   {ORDER.map(type=>{
    const c=capabilities.find(cap=>cap.serviceType===type);
    const label=type==='DELIVERY'?'Collection, delivery & recovery':'Vehicle inspection';
    const status=c?.status==='APPROVED'?'Approved':c?.status==='PENDING'?'Awaiting approval':c?.status==='SUSPENDED'?'Suspended':c?.status==='REJECTED'?'Needs attention':'Not applied';
    return <View key={type} style={styles.service}>
     <Text style={styles.subtitle}>{label}</Text>
     <Text style={styles.desc}>{status}</Text>
     {c?.status==='REJECTED'&&!!c.reviewNote&&<Text style={styles.error}>{c.reviewNote}</Text>}
     {!c||c.status==='REJECTED'?<Button label={c?'Reapply':'Apply for service'} loading={busy===type} disabled={!!busy} onPress={()=>void apply(type)}/>:
      c.status==='SUSPENDED'?<Text style={styles.desc}>Contact CarMazium to reactivate this service.</Text>:
      <Text style={styles.desc}>Continue declarations, documents and job preferences on this screen.</Text>}
    </View>;
   })}
   {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
   {!!notice&&<Text accessibilityRole="alert" style={styles.success}>{notice}</Text>}
  </View>}
 </View>;
}
const styles=StyleSheet.create({
 card:{borderRadius:16,borderColor:Colors.border,borderWidth:1,backgroundColor:Colors.bgCard,padding:20,gap:16},
 heading:{flexDirection:'row',gap:12,alignItems:'center'},stack:{gap:9},
 title:{fontFamily:FontFamily.bold,fontSize:20,color:Colors.textPrimary},
 subtitle:{fontFamily:FontFamily.bold,fontSize:16,color:Colors.textPrimary},
 label:{fontFamily:FontFamily.bold,fontSize:13,color:Colors.textPrimary},
 desc:{fontSize:14,lineHeight:20,color:Colors.textSecondary},
 service:{borderWidth:1,borderColor:Colors.border,borderRadius:10,padding:12,gap:8},
 input:{borderRadius:10,borderWidth:1,borderColor:Colors.border,backgroundColor:Colors.bgTertiary,color:Colors.textPrimary,padding:12,fontSize:15},
 arrow:{fontSize:24,color:Colors.textSecondary},error:{fontSize:14,color:Colors.error},success:{fontSize:14,color:Colors.success}
});
