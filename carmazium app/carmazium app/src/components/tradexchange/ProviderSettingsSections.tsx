import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Button } from '../Button';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import { savePartnerBusiness, getMyCapabilities, updateJobMatching, createStripeConnectOnboarding, type ContractorCapability } from '../../lib/servicesApi';
import { getCapabilityVerification, submitProviderDeclaration, type CapabilityVerificationDetail } from '../../lib/serviceOperationsApi';

type Service = 'DELIVERY' | 'INSPECTION';
type Capability = Pick<ContractorCapability, 'id' | 'serviceType' | 'status'>;
type DealerBusiness={companyName?:string|null;phone?:string|null;businessAddress?:string|null;isVerified?:boolean};
const parseAreas=(raw:string)=>[...new Set(raw.split(/[\s,]+/).map(s=>s.trim().toUpperCase()).filter(Boolean))];
const validArea=(area:string)=>/^(?:GIR|[A-Z]{1,2})$/.test(area);

function Heading({title,subtitle,expanded,onToggle}:{title:string;subtitle:string;expanded:boolean;onToggle:()=>void}) {
 return <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} accessibilityState={{expanded}} onPress={onToggle} style={styles.row}>
   <View style={{flex:1}}>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.desc}>{subtitle}</Text>
   </View>
   <Text style={styles.arrow}>{expanded?'−':'+'}</Text>
 </TouchableOpacity>;
}
function Entry({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}) {
 return <View style={styles.stack}>
   <Text style={styles.subtitle}>{label}</Text>
   <TextInput accessibilityLabel={label} style={styles.input} value={value} onChangeText={onChange} placeholderTextColor={Colors.textMuted} maxLength={500}/>
 </View>;
}

export function ProviderBusinessPaymentsSection({
 capabilities,dealer,stripeComplete,onSaved,openRequest=0,onVerifyDealer,
}:{capabilities:Capability[];dealer?:DealerBusiness|null;stripeComplete?:boolean;onSaved?:()=>Promise<void>;openRequest?:number;onVerifyDealer?:()=>void}) {
 const [expanded,setExpanded]=useState(false);
 const [service,setService]=useState<Service>('DELIVERY');
 const cap=capabilities.find(c=>c.serviceType===service);
 const [detail,setDetail]=useState<CapabilityVerificationDetail|null>(null);
 const [businessName,setBusinessName]=useState(dealer?.companyName??'');
 const [businessPhone,setBusinessPhone]=useState(dealer?.phone??'');
 const [businessAddress,setBusinessAddress]=useState(dealer?.businessAddress??'');
 const [declaration,setDeclaration]=useState({businessName:'',businessAddress:'',phone:'',registeredBusiness:false});
 const [accepted,setAccepted]=useState(false);
 const [loading,setLoading]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const generation=useRef(0);
 useEffect(()=>{if(openRequest>0)setExpanded(true);},[openRequest]);
 useEffect(()=>{
   setBusinessName(dealer?.companyName??'');setBusinessPhone(dealer?.phone??'');setBusinessAddress(dealer?.businessAddress??'');
 },[dealer?.companyName,dealer?.phone,dealer?.businessAddress]);
 useEffect(()=>{
   setDetail(null);setError('');setNotice('');
   if(!expanded||!cap){generation.current++;return;}
   const id=++generation.current;let active=true;setLoading(true);
   getCapabilityVerification(cap.id).then(next=>{
     if(!active||id!==generation.current)return;
     if(next.capabilityId!==cap.id || next.serviceType!==service)throw Error('Incorrect service verification record.');
     setDetail(next);
     const d=next.verification.declaration;
     setDeclaration({businessName:d?.businessName??dealer?.companyName??'',businessAddress:d?.businessAddress??dealer?.businessAddress??'',phone:d?.phone??dealer?.phone??'',registeredBusiness:d?.registeredBusiness??false});
   }).catch((e:any)=>{if(active)setError(e?.message||'Could not load declaration.');})
     .finally(()=>{if(active)setLoading(false);});
   return()=>{active=false;generation.current++;};
 },[expanded,cap?.id,service,dealer?.companyName,dealer?.phone,dealer?.businessAddress]);
 const saveDealer=async()=>{
   if(!businessName.trim()){setError('Business name required.');return;}
   setBusy(true);setError('');setNotice('');
   try{
     await savePartnerBusiness({companyName:businessName.trim(),phone:businessPhone.trim(),businessAddress:businessAddress.trim()});
     await onSaved?.();
     setNotice('Business details saved.');
   }catch(e:any){setError(e?.message||'Could not save business details.');}
   finally{setBusy(false);}
 };
 const saveDeclaration=async()=>{
   if(!cap||!detail||!accepted||!declaration.registeredBusiness)return;
   setBusy(true);setError('');setNotice('');
   try{
     const updated=await submitProviderDeclaration(cap.id,{...declaration,accepted:true});
     setDetail(updated);setAccepted(false);setNotice('Declaration saved to this existing service application.');
   }catch(e:any){setError(e?.message||'Could not save declaration.');}
   finally{setBusy(false);}
 };
 const startPayouts=async()=>{
   setBusy(true);setError('');
   try{await Linking.openURL(await createStripeConnectOnboarding());}
   catch(e:any){setError(e?.message||'Could not open secure payout setup.');}
   finally{setBusy(false);}
 };
 return <View style={styles.card}>
  <Heading title="Business & Payments" subtitle="Manage declarations and business payouts without leaving TradeXchange." expanded={expanded} onToggle={()=>setExpanded(v=>!v)}/>
  {expanded&&<View style={styles.stack}>
   {dealer&&<View style={styles.subcard}>
     <Text style={styles.subtitle}>Business profile</Text>
     <Entry label="Business name" value={businessName} onChange={setBusinessName}/>
     <Entry label="Business phone" value={businessPhone} onChange={setBusinessPhone}/>
     <Entry label="Registered business address" value={businessAddress} onChange={setBusinessAddress}/>
     <Button label={busy?'Saving…':'Save business details'} disabled={busy} onPress={()=>void saveDealer()}/>
     <Text style={styles.desc}>{dealer.isVerified?'Dealer verification approved.':'Dealer verification is not complete. Existing records remain saved.'}</Text>
     {!dealer.isVerified&&onVerifyDealer&&<Button label="Continue dealer verification" variant="outline" onPress={onVerifyDealer}/>}
   </View>}
   <View style={styles.subcard}>
    <Text style={styles.subtitle}>Service declaration</Text>
    <Text style={styles.desc}>Confirm the business responsible for each service. Your existing declarations are reused.</Text>
    <View style={styles.row}>
      <Button label="Delivery & recovery" variant={service==='DELIVERY'?'primary':'outline'} onPress={()=>setService('DELIVERY')}/>
      <Button label="Inspection" variant={service==='INSPECTION'?'primary':'outline'} onPress={()=>setService('INSPECTION')}/>
    </View>
    {!cap?<Text style={styles.desc}>Add this service in My Services before submitting its declaration.</Text>
    :loading?<ActivityIndicator color={Colors.accent} accessibilityLabel="Loading declaration"/>
    :!detail?<Text style={styles.error}>{error||'Declaration unavailable.'}</Text>
    :!detail.verification.declarationRequired?<Text style={styles.desc}>No declaration required for this service.</Text>
    :<View style={styles.stack}>
      {detail.verification.declarationCurrent&&<Text style={styles.success}>Declaration already saved. Update only if business details change.</Text>}
      <Entry label="Declaration trading name" value={declaration.businessName} onChange={v=>setDeclaration(d=>({...d,businessName:v}))}/>
      <Entry label="Declaration address" value={declaration.businessAddress} onChange={v=>setDeclaration(d=>({...d,businessAddress:v}))}/>
      <Entry label="Declaration phone" value={declaration.phone} onChange={v=>setDeclaration(d=>({...d,phone:v}))}/>
      <View style={styles.row}><Switch accessibilityLabel="Business registered" value={declaration.registeredBusiness} onValueChange={v=>setDeclaration(d=>({...d,registeredBusiness:v}))}/><Text style={[styles.desc,{flex:1}]}>My business is registered, including a registered sole trader.</Text></View>
      <View style={styles.row}><Switch accessibilityLabel="Accept service declaration" value={accepted} onValueChange={setAccepted}/><Text style={[styles.desc,{flex:1}]}>I confirm these details and accept responsibility for work undertaken.</Text></View>
      <Button label="Save declaration" disabled={busy||!accepted||!declaration.registeredBusiness||!declaration.businessName.trim()||!declaration.businessAddress.trim()||!declaration.phone.trim()} onPress={()=>void saveDeclaration()}/>
    </View>}
   </View>
   <View style={styles.subcard}>
    <Text style={styles.subtitle}>Business payouts</Text>
    <Text style={styles.desc}>Business payments use secure Stripe Connect setup. Do not upload bank statements as verification evidence.</Text>
    {stripeComplete?<Text style={styles.success}>Business payouts enabled</Text>:<Button label="Set up secure payouts" variant="outline" disabled={busy} onPress={()=>void startPayouts()}/>}
   </View>
   {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
   {!!notice&&<Text accessibilityRole="alert" style={styles.success}>{notice}</Text>}
  </View>}
 </View>;
}

export function ProviderJobPreferencesSection({capabilities,openRequest=0}:{capabilities:Capability[];openRequest?:number}) {
 const [expanded,setExpanded]=useState(false);
 const [service,setService]=useState<Service>('DELIVERY');
 const available=capabilities.find(c=>c.serviceType===service);
 const [cap,setCap]=useState<ContractorCapability|null>(null);
 const [nationwide,setNationwide]=useState(false);
 const [areas,setAreas]=useState('');
 const [loading,setLoading]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const generation=useRef(0);
 useEffect(()=>{if(openRequest>0)setExpanded(true);},[openRequest]);
 useEffect(()=>{
   setCap(null);setError('');setNotice('');
   if(!expanded||!available){generation.current++;return;}
   const id=++generation.current;let active=true;setLoading(true);
   getMyCapabilities().then(data=>{
     if(!active||id!==generation.current)return;
     const current=data.capabilities.find(c=>c.id===available.id&&c.serviceType===service);
     if(!current)throw Error('This service does not belong to your account.');
     setCap(current);setNationwide(current.jobNationwide);setAreas(current.jobPostcodeAreas.join(', '));
   }).catch((e:any)=>{if(active)setError(e?.message||'Could not load working areas.');})
     .finally(()=>{if(active)setLoading(false);});
   return()=>{active=false;generation.current++;};
 },[expanded,available?.id,service]);
 const save=async()=>{
   if(!cap)return;
   const next=nationwide?[]:parseAreas(areas);
   if(!nationwide&&(!next.length||next.some(a=>!validArea(a)))){setError('Choose nationwide or enter UK postcode areas such as B, CV, WS.');return;}
   setBusy(true);setError('');setNotice('');
   try{
     const updated=await updateJobMatching(cap.id,{jobNationwide:nationwide,jobPostcodeAreas:next});
     setCap(updated);setNationwide(updated.jobNationwide);setAreas(updated.jobPostcodeAreas.join(', '));
     setNotice('Working areas saved. Existing assigned jobs remain unchanged.');
   }catch(e:any){setError(e?.message||'Could not save working areas.');}
   finally{setBusy(false);}
 };
 return <View style={styles.card}>
  <Heading title="Job Preferences" subtitle="Set working locations here, without another matching page." expanded={expanded} onToggle={()=>setExpanded(v=>!v)}/>
  {expanded&&<View style={styles.stack}>
    <View style={styles.row}>
      <Button label="Delivery & recovery" variant={service==='DELIVERY'?'primary':'outline'} onPress={()=>setService('DELIVERY')}/>
      <Button label="Inspection" variant={service==='INSPECTION'?'primary':'outline'} onPress={()=>setService('INSPECTION')}/>
    </View>
    {!available?<Text style={styles.desc}>Apply for this service in My Services first.</Text>
    :loading?<ActivityIndicator color={Colors.accent} accessibilityLabel="Loading job preferences"/>
    :!cap?<Text style={styles.error}>{error||'Working areas unavailable.'}</Text>
    :<View style={styles.stack}>
      <View style={styles.row}><Switch accessibilityLabel="Available nationwide" value={nationwide} onValueChange={setNationwide}/><Text style={styles.desc}>Available nationwide</Text></View>
      {!nationwide&&<Entry label="UK postcode areas" value={areas} onChange={setAreas}/>}
      <Text style={styles.desc}>{service==='DELIVERY'?'New delivery jobs match the collection postcode area.':'Inspection work matches vehicle location.'} Existing accepted jobs are not removed.</Text>
      <Button label={busy?'Saving…':'Save job preferences'} disabled={busy} onPress={()=>void save()}/>
    </View>}
    {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!!notice&&<Text accessibilityRole="alert" style={styles.success}>{notice}</Text>}
  </View>}
 </View>;
}

const styles=StyleSheet.create({
 card:{borderRadius:16,borderWidth:1,borderColor:Colors.border,backgroundColor:Colors.bgCard,padding:20,gap:16},
 subcard:{borderRadius:12,borderWidth:1,borderColor:Colors.border,padding:14,gap:12},
 row:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:8},
 stack:{gap:12},
 title:{fontSize:20,fontFamily:FontFamily.bold,color:Colors.textPrimary},
 subtitle:{fontSize:14,fontFamily:FontFamily.bold,color:Colors.textPrimary},
 desc:{fontSize:14,lineHeight:21,color:Colors.textSecondary},
 input:{borderRadius:10,borderWidth:1,borderColor:Colors.border,backgroundColor:Colors.bgTertiary,padding:12,fontSize:15,color:Colors.textPrimary},
 arrow:{fontSize:24,color:Colors.textSecondary},
 error:{fontSize:14,color:Colors.error},
 success:{fontSize:14,color:Colors.success},
});
