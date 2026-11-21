import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@/components/BrandIcon';
import { apiClient } from '../../lib/apiClient';
import { toCsv } from '../../lib/csvExport';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { DealerPageTabs } from '../../components/dealer/DealerPageTabs';
import { PaymentReceipts } from '../../components/payments/PaymentReceipts';
import { Button } from '../../components/Button';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
interface SaleRecord {
  id: string;
  listing?: {
    title?: string;
    vrm?: string;
    images?: string[];
  };
  buyer?: {
    firstName?: string;
    lastName?: string;
  } | null;
  buyerName?: string;
  listedPrice?: number;
  soldPrice: number;
  createdAt?: string;
}

/**
 * An auction the seller has actually been paid out on. The backend only
 * includes auctions with `sellerBonusReleased: true`, which is set once an
 * admin approves the handover proof — so this never contains auctions still
 * mid-handover or ones that were denied (`listings.service.ts:1610-1633`).
 */
interface AuctionSaleRecord {
  id: string;
  listingId: string;
  winningBidAmount: number;
  sellerBonus: number;
  sellerBonusReleasedAt?: string | null;
  createdAt?: string;
  listing?: { title?: string; vrm?: string; images?: string[] };
  winner?: { firstName?: string; lastName?: string } | null;
}

interface EarningsResponse {
  success: boolean;
  data: {
    sales: SaleRecord[];
    totalRevenue: number;
    totalSales: number;
    // All four already returned by GET /listings/earnings and simply never
    // read by mobile, so a seller could not see what they had earned in £100
    // auction bonuses anywhere (DASH-010). No backend change was needed.
    //
    // Note totalRevenue and totalSales ALREADY include the auction figures
    // (`listings.service.ts:1651-1656`) — mobile was not under-reporting, it
    // just could not show where the money came from.
    auctionSales?: AuctionSaleRecord[];
    totalAuctionSales?: number;
    totalAuctionRevenue?: number;
    totalAuctionBonus?: number;
  };
}


const money=(value:number)=>Number(value).toLocaleString('en-GB',{style:'currency',currency:'GBP'});
const date=(value?:string)=>value?new Date(value).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}):'—';
export const DealerEarningsScreen: React.FC<{navigation?:any}> = () => {
  const {width,fontScale}=useWindowDimensions();
  const [data,setData]=useState<EarningsResponse['data']|null>(null);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [retry,setRetry]=useState(0);
  const [activeTab,setActiveTab]=useState<'sales'|'auctions'|'receipts'>('sales');
  const [search,setSearch]=useState('');
  const [exporting,setExporting]=useState(false);
  useFocusEffect(useCallback(()=>{
    let active=true;
    setError(null);
    void apiClient<EarningsResponse>('/listings/earnings').then(res=>{
      if(!res.success||!Array.isArray(res.data?.sales)||!Array.isArray(res.data?.auctionSales))throw Error('Invalid earnings');
      if(active)setData(res.data);
    }).catch(()=>{if(active)setError('Your earnings could not be loaded. The figures below may be incomplete.');})
      .finally(()=>{if(active){setLoading(false);setRefreshing(false);}});
    return()=>{active=false;};
  },[retry]));
  const filteredSales=(data?.sales||[]).filter(s=>[s.listing?.title,s.listing?.vrm,s.buyer?.firstName,s.buyer?.lastName,s.buyerName].some(v=>v?.toLowerCase().includes(search.toLowerCase())));
  const refresh=()=>{setRefreshing(true);setRetry(n=>n+1);};
  const handleExport=async()=>{
    if(error||!filteredSales.length)return;
    setExporting(true);
    try{
      const rows:unknown[][]=[['Date','Vehicle','Registration','Buyer','Listed price (GBP)','Sold price (GBP)'],...filteredSales.map(s=>[s.createdAt?new Date(s.createdAt).toISOString().slice(0,10):'',s.listing?.title||'',s.listing?.vrm||'',s.buyer?[s.buyer.firstName,s.buyer.lastName].filter(Boolean).join(' '):s.buyerName||'Direct',Number(s.listedPrice),Number(s.soldPrice)])];
      const file=`${FileSystem.cacheDirectory}carmazium-sales-${new Date().toISOString().slice(0,10)}.csv`;
      await FileSystem.writeAsStringAsync(file,toCsv(rows),{encoding:FileSystem.EncodingType.UTF8});
      if(!await Sharing.isAvailableAsync())throw Error('This device cannot share exported files.');
      await Sharing.shareAsync(file,{mimeType:'text/csv',UTI:'public.comma-separated-values-text'});
    }catch(err){Alert.alert('Export failed',err instanceof Error?err.message:'Could not export sales.');}
    finally{setExporting(false);}
  };
  const metrics=[
    {label:'Total Dealership Revenue',value:money(data?.totalRevenue||0),icon:'business-outline',color:'#10b981'},
    {label:'Total Units Sold',value:String(data?.totalSales||0),icon:'trending-up-outline',color:Colors.accent},
    {label:'Average Sale Price',value:money(data?.totalSales?data.totalRevenue/data.totalSales:0),icon:'arrow-up-outline',color:'#3b82f6'},
    {label:'Auction Bonuses Earned',value:money(data?.totalAuctionBonus||0),icon:'hammer-outline',color:'#f59e0b'},
  ];
  const thumbnail=(listing?:{images?:string[]})=>listing?.images?.[0]?<Image source={{uri:listing.images[0]}} style={styles.image}/>:<View style={[styles.image,styles.placeholder]}><Ionicons name="car-outline" size={22} color={Colors.textMuted}/></View>;
  return <View style={styles.screen}><WebsiteTopBar/>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[Colors.accent]}/>}>
      <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>Dealership Earnings</Text><Text style={styles.body}>Track dealership vehicle sales proceeds and CarMazium auction bonus payments.</Text><Button variant="outline" label="Export sales CSV" disabled={loading||!!error||filteredSales.length===0} loading={exporting} onPress={()=>void handleExport()}/></View>
      {error&&<View style={styles.section}><Text accessibilityRole="alert" style={styles.body}>{error}</Text><Button label="Try again" variant="outline" onPress={refresh}/></View>}
      <View style={styles.metrics}>{metrics.map(m=><View key={m.label} style={[styles.metric,{width:width>=640&&fontScale<1.4?'48%':'100%'}]}>
        <View style={[styles.icon,{backgroundColor:m.color+'18',borderColor:m.color+'50'}]}><Ionicons name={m.icon as any} size={20} color={m.color}/></View>
        <Text style={styles.value}>{loading?'…':m.value}</Text><Text style={styles.label}>{m.label}</Text>
        <Svg style={styles.wave} height={48} width="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><Path d="M0,100 L0,80 Q25,90 50,70 T100,50 L100,100 Z" fill={m.color} opacity={0.2}/></Svg>
      </View>)}</View>
      <View style={styles.tabs}>{(['sales','auctions','receipts'] as const).map(tab=><Button key={tab} variant={activeTab===tab?'primary':'ghost'} size="sm" label={tab==='sales'?'Sales Registry':tab==='auctions'?`Auction Sales (${data?.totalAuctionSales??data?.auctionSales?.length??0})`:'Receipts'} onPress={()=>setActiveTab(tab)}/>)}</View>
      {activeTab==='receipts'?<PaymentReceipts isDealer/>:loading?<ActivityIndicator color={Colors.accent}/>:activeTab==='sales'?<View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Sales Registry</Text>
        <TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder="Search by vehicle, VRM or buyer..." placeholderTextColor={Colors.textMuted} accessibilityLabel="Search by vehicle, VRM or buyer"/>
        {filteredSales.map(s=><View key={s.id} style={styles.sale}>{thumbnail(s.listing)}<View style={styles.details}><Text style={styles.vehicle}>{s.listing?.title||'Vehicle'}</Text><Text style={styles.meta}>{s.listing?.vrm||'PRIVATE'}</Text><Text style={styles.meta}>{s.buyer?[s.buyer.firstName,s.buyer.lastName].filter(Boolean).join(' '):s.buyerName||'Direct'} · {date(s.createdAt)}</Text></View><View style={{gap:6}}><Text style={styles.amount}>{money(s.soldPrice)}</Text>{s.listedPrice!=null&&<Text style={[styles.meta,{color:Number(s.soldPrice)>=Number(s.listedPrice)?Colors.success:Colors.error}]}>{Number(s.soldPrice)>=Number(s.listedPrice)?'+':'−'}{money(Math.abs(Number(s.soldPrice)-Number(s.listedPrice)))}</Text>}</View></View>)}
        {!error&&!filteredSales.length&&<Text style={styles.body}>{search?'No sales match your search.':'No sales yet. Vehicles your dealership sells will appear here.'}</Text>}
      </View>:<View style={styles.section}><Text accessibilityRole="header" style={styles.sectionTitle}>Auction Sales</Text><Text style={styles.body}>Vehicles sold through auction with handover verified. The winning bid is settled directly with the buyer — the £100 bonus is what CarMazium paid you.</Text>
        {(data?.auctionSales||[]).map(a=><View key={a.id} style={styles.sale}>{thumbnail(a.listing)}<View style={styles.details}><Text style={styles.vehicle}>{a.listing?.title||'Vehicle'}</Text><Text style={styles.meta}>{a.listing?.vrm||'PRIVATE'}</Text><Text style={styles.meta}>{date(a.createdAt)}</Text></View><View style={{gap:6}}><Text style={styles.amount}>{money(a.winningBidAmount)}</Text><Text style={[styles.meta,{color:Colors.warning}]}>+{money(a.sellerBonus)} bonus</Text></View></View>)}
        {!error&&!data?.auctionSales?.length&&<Text style={styles.body}>No completed auction sales yet. Records appear here once a winning bidder’s handover has been verified and your £100 bonus released.</Text>}
      </View>}
    </ScrollView><DealerPageTabs/>
  </View>;
};
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:Colors.bgPrimary},content:{padding:20,paddingTop:32,paddingBottom:40,gap:24},heading:{gap:16},title:{fontFamily:FontFamily.bold,fontSize:30,lineHeight:36,textTransform:'uppercase',color:Colors.textPrimary},body:{fontSize:14,lineHeight:22,color:Colors.textSecondary},metrics:{flexDirection:'row',flexWrap:'wrap',gap:16},metric:{padding:24,gap:10,borderRadius:16,borderWidth:1,borderColor:Colors.border,backgroundColor:Colors.bgCard,overflow:'hidden'},icon:{width:36,height:36,borderRadius:8,borderWidth:1,alignItems:'center',justifyContent:'center',marginBottom:6},value:{fontSize:30,fontFamily:FontFamily.bold,color:Colors.textPrimary},label:{fontSize:12,lineHeight:18,letterSpacing:1.2,textTransform:'uppercase',fontFamily:FontFamily.bold,color:Colors.textMuted},wave:{position:'absolute',bottom:0,left:0,right:0},tabs:{flexDirection:'row',flexWrap:'wrap',gap:4,padding:4,borderWidth:1,borderRadius:12,borderColor:Colors.border},section:{padding:16,gap:16,borderRadius:24,borderWidth:1,borderColor:Colors.border,backgroundColor:Colors.bgCard},sectionTitle:{fontFamily:FontFamily.bold,fontSize:24,color:Colors.textPrimary,textTransform:'uppercase'},search:{padding:12,borderWidth:1,borderRadius:16,borderColor:Colors.border,color:Colors.textPrimary,fontSize:14},sale:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:16,borderTopWidth:1,borderColor:Colors.border},image:{width:56,height:56,borderRadius:12},placeholder:{backgroundColor:Colors.bgSecondary,alignItems:'center',justifyContent:'center'},details:{flex:1,gap:4},vehicle:{fontFamily:FontFamily.bold,fontSize:14,color:Colors.textPrimary,textTransform:'uppercase'},meta:{fontSize:12,lineHeight:18,color:Colors.textMuted},amount:{fontFamily:FontFamily.bold,fontSize:16,color:Colors.textPrimary}});
