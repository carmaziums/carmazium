import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { apiClient } from '../../lib/apiClient';
import { getAccessToken } from '../../lib/supabase';
import { mergePaymentReceipts, paymentReceiptPath, type PaymentReceipt, type ReceiptKyc } from '../../lib/paymentReceipts';
import { Button } from '../Button';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
const labels:Record<string,string>={DEPOSIT:'Deposit',FULL_PAYMENT:'Full Payment',COMMISSION:'Commission',REFUND:'Refund',HPI_REPORT:'Vehicle History Report',HPI_REPORT_EMAIL:'Vehicle History Report (emailed)',LISTING_FEE:'Listing Fee',BOOST:'Featured Boost',KYC_VERIFICATION:'KYC Verification'};
export function PaymentReceipts({isDealer=false}:{isDealer?:boolean}) {
  const [receipts,setReceipts]=useState<PaymentReceipt[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [retry,setRetry]=useState(0);
  const [busy,setBusy]=useState<string|null>(null);
  const [downloadError,setDownloadError]=useState<string|null>(null);
  useEffect(()=>{
    let active=true;
    setLoading(true);setError(null);
    void (async()=>{
      const [history,kyc]=await Promise.allSettled([
        apiClient<{data:PaymentReceipt[]}>('/payments/history'),
        isDealer?apiClient<{data:ReceiptKyc|null}>('/dealers/kyc'):Promise.resolve({data:null}),
      ]);
      if(!active)return;
      if(history.status==='fulfilled'&&Array.isArray(history.value.data)) {
        setReceipts(mergePaymentReceipts(history.value.data,kyc.status==='fulfilled'?kyc.value.data:null));
        if(kyc.status==='rejected')setError('Older verification payments could not be checked. This list may be incomplete.');
      } else setError('Payment receipts could not be loaded. Please try again.');
      setLoading(false);
    })();
    return()=>{active=false;};
  },[isDealer,retry]);
  const download=async(receipt:PaymentReceipt)=>{
    setBusy(receipt.id);setDownloadError(null);
    try{
      const path=paymentReceiptPath(receipt);
      const token=await getAccessToken();
      if(!token)throw Error('Please sign in again to download this receipt.');
      if(!await Sharing.isAvailableAsync())throw Error('This device cannot open PDF files.');
      const file=`${FileSystem.cacheDirectory}carmazium-receipt-${receipt.id.replace(/[^a-zA-Z0-9-]/g,'')}.pdf`;
      const result=await FileSystem.downloadAsync(`${process.env.EXPO_PUBLIC_API_URL||'https://carmazium-hjoh9w.fly.dev'}${path}`,file,{headers:{Authorization:`Bearer ${token}`}});
      if(result.status!==200){await FileSystem.deleteAsync(result.uri,{idempotent:true});throw Error('Could not download the receipt. Please try again.');}
      await Sharing.shareAsync(result.uri,{mimeType:'application/pdf',UTI:'com.adobe.pdf'});
    }catch(err){setDownloadError(err instanceof Error?err.message:'Could not download the receipt.');}
    finally{setBusy(null);}
  };
  return <View style={styles.wrap}>
    <Text accessibilityRole="header" style={styles.heading}>Payment Receipts</Text>
    <Text style={styles.body}>All platform fees, listing charges, and KYC payments.</Text>
    {loading?<ActivityIndicator color={Colors.accent}/>:<>
      {error&&<View style={styles.wrap}><Text accessibilityRole="alert" style={styles.body}>{error}</Text><Button label="Retry receipts" variant="outline" onPress={()=>setRetry(n=>n+1)}/></View>}
      {!error&&receipts.length===0&&<Text style={styles.body}>No receipts yet. Your payment receipts will appear here as you make transactions on the platform.</Text>}
      {receipts.map((receipt,i)=><View key={receipt.id} style={styles.card}>
        <View style={styles.row}><Text style={styles.number}>#{receipts.length-i}</Text>
          {receipt.listing?.images?.[0]&&<Image source={{uri:receipt.listing.images[0]}} style={styles.image}/>}
          <View style={{flex:1,gap:6}}><Text style={styles.title}>{labels[receipt.type]||receipt.type} · {receipt.status==='COMPLETED'?'Paid':receipt.status.toLowerCase()}</Text><Text style={styles.body}>{receipt.listing?.title||receipt.description||labels[receipt.type]}</Text><Text style={styles.meta}>{new Date(receipt.createdAt).toLocaleString('en-GB')}{receipt.stripePaymentId?` · ref: ···${receipt.stripePaymentId.slice(-8)}`:''}</Text></View>
        </View>
        <Text style={styles.amount}>{Number(receipt.amount).toLocaleString('en-GB',{style:'currency',currency:'GBP'})}</Text>
        <Button label="Download PDF" variant="outline" size="sm" loading={busy===receipt.id} disabled={!!receipt.synthetic||busy!==null} onPress={()=>void download(receipt)}/>
        {receipt.synthetic&&<Text style={styles.meta}>Receipt will be available after the payment ledger is reconciled.</Text>}
      </View>)}
    </>}
    {downloadError&&<Text accessibilityRole="alert" style={styles.error}>{downloadError}</Text>}
  </View>;
}
const styles=StyleSheet.create({wrap:{gap:16},heading:{fontFamily:FontFamily.bold,fontSize:24,color:Colors.textPrimary},body:{fontSize:14,lineHeight:21,color:Colors.textSecondary},card:{padding:16,gap:12,borderWidth:1,borderColor:Colors.border,borderRadius:16,backgroundColor:Colors.bgCard},row:{flexDirection:'row',gap:12,alignItems:'center'},number:{fontSize:14,color:Colors.accent},image:{height:56,width:56,borderRadius:12},title:{fontFamily:FontFamily.semiBold,fontSize:13,color:Colors.textPrimary},meta:{fontSize:12,lineHeight:18,color:Colors.textMuted},amount:{fontFamily:FontFamily.bold,fontSize:18,color:Colors.textPrimary},error:{color:Colors.error,fontSize:14}});
