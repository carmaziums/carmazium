import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import {
  fetchPartnerAgreement, fetchPartnerAgreementStatus,
  signPartnerAgreement, type BusinessKind,
  type PartnerAgreementDocument, type PartnerAgreementStatus,
} from '../../lib/partnerAgreementApi';
import { useAuthStore } from '../../store/authStore';

const kinds: {kind: BusinessKind; label: string}[] = [
  {kind:'COMPANY', label:'Registered company'},
  {kind:'SOLE_TRADER', label:'Sole trader'},
  {kind:'PARTNERSHIP', label:'Partnership'},
  {kind:'OTHER_BUSINESS', label:'Other business'},
];

/** A mandatory authenticated business-owner signature when used by RootNavigator.
 * Also supports read-only receipt display from Settings after signing.
 */
export const PartnerAgreementScreen: React.FC<{onAccepted?: () => void}> = ({onAccepted}) => {
  const insets = useSafeAreaInsets();
  const user = useAuthStore(s=>s.user);
  const [document, setDocument] = useState<PartnerAgreementDocument | null>(null);
  const [status, setStatus] = useState<PartnerAgreementStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kind, setKind] = useState<BusinessKind>('COMPANY');
  const [legalName, setLegalName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [signer, setSigner] = useState('');
  const [capacity, setCapacity] = useState('Director / owner');
  const [readAccepted, setReadAccepted] = useState(false);
  const [authorityAccepted, setAuthorityAccepted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [doc, state] = await Promise.all([fetchPartnerAgreement(), fetchPartnerAgreementStatus()]);
      setDocument(doc); setStatus(state);
      if (state.accepted) onAccepted?.();
    } catch (err: any) {
      setError(err?.message || 'Could not load the Business Partner Agreement.');
    } finally {setLoading(false);}
  }, [onAccepted]);

  useEffect(() => {
    setSigner([user?.firstName, user?.lastName].filter(Boolean).join(' '));
  }, [user?.id, user?.firstName, user?.lastName]);
  useEffect(() => {void load();}, [load]);

  const accept = async () => {
    if (!document || !status?.canSign || busy) return;
    if (!readAccepted || !authorityAccepted || legalName.trim().length < 3 ||
        signer.trim().length < 5 || capacity.trim().length < 2 ||
        (kind === 'COMPANY' && !registrationNumber.trim())) {
      Alert.alert('Signature incomplete', 'Enter your legal business name, company number where applicable, full signing name and position. Accept both declarations.');
      return;
    }
    setBusy(true); setError('');
    try {
      await signPartnerAgreement({
        version: document.version,
        sha256: document.sha256,
        businessKind: kind,
        legalEntityName: legalName.trim(),
        registrationNumber: registrationNumber.trim() || undefined,
        signatoryFullName: signer.trim(),
        signatoryCapacity: capacity.trim(),
        authorityConfirmed: true,
        explicitAcceptance: true,
        channel: 'ANDROID',
      });
      const next = await fetchPartnerAgreementStatus();
      setStatus(next);
      if (next.accepted) onAccepted?.();
      else setError('Signature was not confirmed. Try again.');
    } catch (err: any) {setError(err?.message || 'Could not save the electronic signature.');}
    finally {setBusy(false);}
  };

  const field = (label: string, value: string, onChangeText: (v:string)=>void, placeholder: string) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} style={styles.input} value={value}
        onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={Colors.textMuted}
        autoCapitalize="words" />
    </View>
  );

  return <View style={[styles.screen,{paddingTop:insets.top}]}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>CARMAZIUM · BUSINESS ACCOUNT</Text>
      <Text style={styles.title}>Master Business Partner Agreement</Text>
      <Text style={styles.muted}>One agreement for dealer trading, inspection, collection, delivery and recovery services. Personal consumer terms remain separate.</Text>
      {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={()=>void load()}><Text style={styles.link}>Retry loading</Text></TouchableOpacity>
      </View>:null}
      {loading ? <ActivityIndicator color={Colors.accent} size="large"/>:null}
      {document ? <View style={styles.card}>
        <Text style={styles.heading}>{document.title}</Text>
        <Text style={styles.muted}>Version {document.version} · SHA-256 {document.sha256.slice(0,18)}…</Text>
        <Text style={styles.muted}>The complete terms and all schedules are displayed below. Read before signing.</Text>
        {document.text.split(/\n\s*\n/).map((block, i) => <Text key={i}
          style={block.startsWith('# ') ? styles.docTitle : block.startsWith('## ') ? styles.docHeading : block.startsWith('### ') ? styles.docSubheading : styles.docText}>
          {block.replace(/^#{1,3} /,'')}
        </Text>)}
      </View>:null}
      {status?.accepted && status.acceptance ? <View style={styles.card}>
        <Text style={styles.heading}>Agreement signed and recorded</Text>
        <Text style={styles.docText}>Signed by {status.acceptance.signatoryFullName} for {status.acceptance.legalEntityName} on {new Date(status.acceptance.acceptedAt).toLocaleString('en-GB')}.</Text>
        <Text style={styles.muted}>Version {status.acceptance.agreementVersion}</Text>
        <Text style={styles.muted}>Acceptance reference: {status.acceptance.id}</Text>
      </View>:null}
      {status?.required && !status.accepted && !status.canSign ? <View style={styles.card}>
        <Text style={styles.heading}>Business owner signature required</Text>
        <Text style={styles.docText}>A dealership staff account cannot sign on behalf of the legal business. Please ask your dealership owner to accept using their Partner Account.</Text>
      </View>:null}
      {status?.required && !status.accepted && status.canSign && document ? <View style={styles.card}>
        <Text style={styles.heading}>Sign electronically for your business</Text>
        <Text style={styles.muted}>Choose the legal entity you have authority to bind.</Text>
        <View style={styles.field}><Text style={styles.label}>Legal business type</Text>
          {kinds.map(item => <TouchableOpacity key={item.kind} accessibilityRole="radio"
            accessibilityState={{checked:kind===item.kind}}
            style={[styles.option,kind===item.kind&&styles.selected]}
            onPress={()=>setKind(item.kind)}><Text style={styles.optionText}>{kind===item.kind?'●':'○'} {item.label}</Text></TouchableOpacity>)}
        </View>
        {field('Full legal business name',legalName,setLegalName,'Company name / legal name of sole trader')}
        {kind==='COMPANY'?field('Company registration number',registrationNumber,setRegistrationNumber,'Companies House number'):null}
        {field('Full legal name of signatory',signer,setSigner,'Your full legal name')}
        {field('Position / authority to sign',capacity,setCapacity,'Director, owner, partner or authorised representative')}
        <View style={styles.row}><Text style={[styles.docText,styles.flex]}>I have read the full agreement and all applicable schedules and expressly agree for the named business.</Text>
          <Switch value={readAccepted} onValueChange={setReadAccepted}/></View>
        <View style={styles.row}><Text style={[styles.docText,styles.flex]}>I am authorised to bind this business and intend my typed name and acceptance to constitute my electronic signature.</Text>
          <Switch value={authorityAccepted} onValueChange={setAuthorityAccepted}/></View>
        <TouchableOpacity accessibilityRole="button" disabled={busy || !readAccepted || !authorityAccepted}
          onPress={()=>void accept()} style={[styles.submit,(busy||!readAccepted||!authorityAccepted)&&styles.disabled]}>
          {busy ? <ActivityIndicator color={Colors.onAccent}/> : <Text style={styles.submitText}>ACCEPT & ELECTRONICALLY SIGN</Text>}
        </TouchableOpacity>
        <Text style={styles.muted}>The authenticated signer, exact version, document fingerprint and server acceptance time are retained as evidence.</Text>
      </View>:null}
    </ScrollView>
  </View>;
};
const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:Colors.bgPrimary},
  content:{padding:18,paddingBottom:48,gap:18},
  eyebrow:{fontSize:11,fontWeight:'800',color:Colors.accent,letterSpacing:1.2},
  title:{fontSize:25,fontWeight:'800',color:Colors.white},
  muted:{fontSize:12,color:Colors.textMuted,lineHeight:19},
  card:{padding:16,borderRadius:14,backgroundColor:Colors.bgCardSolid,borderColor:Colors.borderSubtle,borderWidth:1,gap:12},
  heading:{fontSize:19,fontWeight:'800',color:Colors.white},
  docTitle:{fontSize:20,fontWeight:'800',color:Colors.white,marginTop:8},
  docHeading:{fontSize:17,fontWeight:'800',color:Colors.white,marginTop:14},
  docSubheading:{fontSize:15,fontWeight:'700',color:Colors.white,marginTop:10},
  docText:{fontSize:13,color:Colors.textSecondary,lineHeight:21},
  field:{gap:7},
  label:{fontSize:13,fontWeight:'700',color:Colors.white},
  input:{borderRadius:10,borderWidth:1,borderColor:Colors.borderSubtle,backgroundColor:Colors.bgPrimary,color:Colors.white,padding:13,minHeight:48},
  option:{padding:12,borderRadius:9,borderWidth:1,borderColor:Colors.borderSubtle},
  selected:{borderColor:Colors.accent},
  optionText:{fontSize:13,color:Colors.white},
  row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:14},
  flex:{flex:1},
  submit:{backgroundColor:Colors.accent,borderRadius:10,padding:16,alignItems:'center'},
  submitText:{color:Colors.onAccent,fontWeight:'800'},
  disabled:{opacity:0.5},
  error:{padding:13,borderWidth:1,borderColor:Colors.accent,borderRadius:10,gap:8},
  errorText:{color:Colors.white},
  link:{color:Colors.accent,fontWeight:'800'},
});
