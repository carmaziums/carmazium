import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-gifted-charts';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { apiClient } from '../../lib/apiClient';
import { analyticsRangeIssue } from '../../lib/analyticsDateRange';
import { readDealerAnalytics, type AnalyticsData } from '../../lib/dealerAnalytics';
import { toCsv } from '../../lib/csvExport';
import { WebsiteTopBar } from '../../components/WebsiteTopBar';
import { DealerPageTabs } from '../../components/dealer/DealerPageTabs';
import { Button } from '../../components/Button';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
const money=(n:number)=>n>=1000000?`£${(n/1000000).toFixed(1)}M`:n>=1000?`£${(n/1000).toFixed(1)}k`:`£${Number(n||0).toFixed(0)}`;
const label=(value:string)=>value.replace(/_/g,' ');
function Section({title,children}:{title:string;children:React.ReactNode}){return <View style={styles.section}><Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>{children}</View>;}
function Row({name,value}:{name:string;value:string|number}){return <View style={styles.row}><Text style={[styles.body,{flex:1}]}>{name}</Text><Text style={styles.rowValue}>{value}</Text></View>;}
function Distribution({values}:{values:[string,number][]}){
  const total=values.reduce((sum,[,n])=>sum+n,0);
  return <View style={{gap:12}}>{values.map(([name,n])=><View key={name} style={{gap:6}}><Row name={label(name)} value={`${n} · ${total?Math.round(n/total*100):0}%`}/><View style={styles.track}><View style={[styles.fill,{width:`${total?n/total*100:0}%`}]}/></View></View>)}</View>;
}
export const DealerAnalyticsScreen:React.FC<{navigation?:any}>=()=>{
  const {width,fontScale}=useWindowDimensions();
  const [range,setRange]=useState('30d');
  const [from,setFrom]=useState('');const [to,setTo]=useState('');
  const [retry,setRetry]=useState(0);
  const [result,setResult]=useState<{key:string;data:AnalyticsData}|null>(null);
  const [loading,setLoading]=useState(true);const [error,setError]=useState<string|null>(null);
  const [exporting,setExporting]=useState(false);
  const issue=analyticsRangeIssue(range,from,to);
  const key=`${range}:${from}:${to}:${retry}`;
  const data=!issue&&result?.key===key?result.data:null;
  useFocusEffect(useCallback(()=>{
    let active=true;setResult(null);setError(null);
    if(issue){setLoading(false);return()=>{active=false;};}
    setLoading(true);
    const params=new URLSearchParams({range});if(range==='custom'){params.set('from',from);params.set('to',to);}
    void apiClient<{data:AnalyticsData}>(`/dealers/analytics?${params}`).then(response=>{
      const report=readDealerAnalytics(response);if(active)setResult({key,data:report});
    }).catch(()=>{if(active)setError('Could not load your analytics. Please try again.');}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[key,issue]));
  const metrics=data?[
    {name:'Total Revenue',value:money(data.kpis.totalRevenue),trend:data.kpis.totalRevenueTrend},
    {name:'Units Sold',value:data.kpis.totalUnitsSold,trend:data.kpis.totalUnitsSoldTrend},
    {name:'Avg Sold Price',value:money(data.kpis.avgSoldPrice)},
    {name:'Avg Days to Sell',value:`${data.kpis.avgDaysToSell}d`,trend:data.kpis.avgDaysToSellTrend},
    {name:'Active Stock',value:data.inventoryHealth.ACTIVE},
    {name:'Stock Value',value:money(data.kpis.stockValue)},
    {name:'Offer Win Rate',value:`${data.kpis.offerConversionRate}%`,trend:data.kpis.offerConversionRateTrend},
    {name:'Lead Conversion',value:`${data.kpis.leadConversionRate}%`,trend:data.kpis.leadConversionRateTrend},
    {name:'Margin vs Listed',value:`${data.kpis.marginVsListed>=0?'+':''}${data.kpis.marginVsListed}%`},
    {name:'Aging Stock (60d+)',value:data.inventoryHealth.staleCount},
    {name:'Avg Views / Listing',value:data.kpis.avgViewsPerListing,trend:data.kpis.avgViewsPerListingTrend},
    {name:'Buyer Postcodes Captured',value:data.customersByArea?.length||0},
  ]:[];
  const exportReport=async()=>{
    if(!data)return;setExporting(true);
    try{
      const rows:unknown[][]=[['Metric','Value'],['Total Revenue',data.kpis.totalRevenue],['Units Sold',data.kpis.totalUnitsSold],['Avg Sold Price',data.kpis.avgSoldPrice],['Avg Days to Sell',data.kpis.avgDaysToSell],['Active Stock',data.inventoryHealth.ACTIVE],['Stock Value',data.kpis.stockValue],['Margin vs Listed (%)',data.kpis.marginVsListed],['Aging Stock (60d+)',data.inventoryHealth.staleCount],['Offer Win Rate (%)',data.kpis.offerConversionRate],['Lead Conversion (%)',data.kpis.leadConversionRate],['Avg Views / Listing',data.kpis.avgViewsPerListing],[],['Top Selling Models'],['Make + Model','Units','Revenue','Avg Price'],...(data.topSellingModels||[]).map(r=>[`${r.make} ${r.model}`,r.units,r.revenue,r.avgPrice])];
      const file=`${FileSystem.cacheDirectory}dealer_analytics_${new Date().toISOString().slice(0,10)}.csv`;
      await FileSystem.writeAsStringAsync(file,toCsv(rows),{encoding:FileSystem.EncodingType.UTF8});
      if(!await Sharing.isAvailableAsync())throw Error('This device cannot share exported files.');
      await Sharing.shareAsync(file,{mimeType:'text/csv',UTI:'public.comma-separated-values-text'});
    }catch(err){Alert.alert('Export failed',err instanceof Error?err.message:'Could not export analytics.');}finally{setExporting(false);}
  };
  return <View style={styles.screen}><WebsiteTopBar/>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>setRetry(n=>n+1)} colors={[Colors.accent]}/>}>
      <Text accessibilityRole="header" style={styles.title}>Performance Analytics</Text><Text style={styles.subtitle}>Real-time dealership performance metrics &amp; strategic insights</Text>
      <Button label="Export Report" variant="outline" disabled={!data} loading={exporting} onPress={()=>void exportReport()}/>
      <View style={styles.ranges}>{[['7d','Last 7 days'],['30d','Last 30 days'],['90d','Last 90 days'],['custom','Custom']].map(([value,name])=><Button key={value} size="sm" label={name} variant={range===value?'primary':'outline'} onPress={()=>setRange(value)}/>)}</View>
      {range==='custom'&&<View style={styles.ranges}><View style={{flex:1,minWidth:150}}><Text style={styles.body}>Start date</Text><TextInput style={styles.input} value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} accessibilityLabel="Start date" autoCapitalize="none"/></View><View style={{flex:1,minWidth:150}}><Text style={styles.body}>End date</Text><TextInput style={styles.input} value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textMuted} accessibilityLabel="End date" autoCapitalize="none"/></View></View>}
      {issue?<Text accessibilityRole="alert" style={styles.body}>{issue}</Text>:loading?<ActivityIndicator color={Colors.accent}/>:error?<View style={{gap:16}}><Text accessibilityRole="alert" style={styles.body}>{error}</Text><Button label="Try again" onPress={()=>setRetry(n=>n+1)}/></View>:null}
      {data&&<>
        <Text style={styles.sectionTitle}>Sales &amp; Stock Overview</Text><View style={styles.metrics}>{metrics.map(m=><View key={m.name} style={[styles.metric,{width:fontScale>=1.4?'100%':'48%'}]}><Text style={styles.value}>{m.value}</Text><Text style={styles.metricName}>{m.name}</Text>{m.trend!==undefined&&<Text style={styles.meta}>{m.trend>0?'+':''}{m.trend}% · {m.name==='Avg Days to Sell'?'lower is better':'vs prev period'}</Text>}</View>)}</View>
        <Section title="Revenue & Sales Trend"><Text style={styles.body}>Monthly revenue and units sold over the past year</Text>{data.revenueTrend.length>0?<>
          <Text style={styles.body}>Revenue (£)</Text><LineChart data={data.revenueTrend.map(p=>({value:p.revenue,label:p.month.slice(5)}))} width={Math.max(180,width-120)} height={160} color={Colors.accent} areaChart startFillColor={Colors.accent} startOpacity={0.15} endOpacity={0} yAxisTextStyle={{color:Colors.textMuted}} xAxisLabelTextStyle={{color:Colors.textMuted}}/>
          <Text style={styles.body}>Units sold</Text><LineChart data={data.revenueTrend.map(p=>({value:p.unitsSold,label:p.month.slice(5)}))} width={Math.max(180,width-120)} height={130} color={Colors.infoBlue} yAxisTextStyle={{color:Colors.textMuted}} xAxisLabelTextStyle={{color:Colors.textMuted}}/>
        </>:<Text style={styles.body}>No sales data for this period</Text>}</Section>
        <Section title="Offer Performance"><Row name="Total offers" value={['ACCEPTED','PENDING','COUNTERED','REJECTED','WITHDRAWN'].reduce((n,k)=>n+Number(data.offerBreakdown[k as keyof typeof data.offerBreakdown]),0)}/><Row name="Win rate" value={`${data.kpis.offerConversionRate}%`}/><Distribution values={(['ACCEPTED','PENDING','COUNTERED','REJECTED','WITHDRAWN'] as const).map(k=>[k,data.offerBreakdown[k]])}/><Row name="Avg accepted" value={money(data.offerBreakdown.avgAcceptedAmount)}/><Row name="Avg response" value={`${data.offerBreakdown.avgTimeToRespond}h`}/></Section>
        <Section title="Lead Conversion Funnel"><Row name="Total" value={Object.values(data.leadFunnel).reduce((s,n)=>s+n,0)}/><Distribution values={Object.entries(data.leadFunnel)}/></Section>
        <Section title="Inventory Health"><Row name="Stale stock" value={data.inventoryHealth.staleCount}/><Text style={styles.sectionTitle}>Stock Distribution</Text><Distribution values={(['ACTIVE','DRAFT','OFFER_ACCEPTED','SOLD','WITHDRAWN'] as const).map(k=>[k,data.inventoryHealth[k]])}/><Text style={styles.sectionTitle}>Active Listing Age</Text><Row name="Average age" value={`${data.inventoryHealth.avgAge}d`}/><Distribution values={Object.entries(data.inventoryHealth.agingBuckets)}/></Section>
        <Text style={styles.sectionTitle}>Inventory Performance</Text><Section title="Top Selling Models"><Text style={styles.body}>Ranked by units sold in selected period</Text>{(data.topSellingModels||[]).map((r,i)=><View key={`${r.make}-${r.model}-${i}`}><Row name={`${r.make} ${r.model}`} value={`${r.units} sold`}/><Text style={styles.meta}>Revenue {money(r.revenue)} · Average {money(r.avgPrice)}</Text></View>)}{!data.topSellingModels?.length&&<Text style={styles.body}>No sales data for this period</Text>}</Section>
        <Section title="Fast Movers"><Text style={styles.body}>Lowest avg days to sell</Text>{(data.fastMovers||[]).map((r,i)=><Row key={i} name={`${r.make} ${r.model} · ${r.units} sold`} value={`${r.avgDays}d`}/>)}{!data.fastMovers?.length&&<Text style={styles.body}>No sales yet</Text>}</Section>
        <Section title="Slow Movers"><Text style={styles.body}>Longest time in active stock</Text>{(data.slowMovers||[]).map((r,i)=><Row key={i} name={`${r.make} ${r.model} · ${r.count} active`} value={`${r.avgDays}d`}/>)}{!data.slowMovers?.length&&<Text style={styles.body}>No active stock</Text>}</Section>
        <Text style={styles.sectionTitle}>Sales Mix &amp; Customers</Text><Section title="Lead Sources"><Distribution values={(data.leadSourceBreakdown||[]).map(r=>[r.source,r.count])}/>{!data.leadSourceBreakdown?.length&&<Text style={styles.body}>No leads yet</Text>}</Section>
        <Section title="Sales Channel Mix">{data.salesByType&&Object.entries(data.salesByType).map(([type,s])=><Row key={type} name={type==='CLASSIFIED'?'Retail':'Auction'} value={`${s.units} sold · ${money(s.revenue)}`}/>)}</Section>
        <Section title="Customers by Area"><Text style={styles.body}>UK postcode areas (set when closing a deal)</Text>{(data.customersByArea||[]).map(r=><Row key={r.postcode} name={r.postcode} value={`${r.count} · ${money(r.revenue)}`}/>)}{!data.customersByArea?.length&&<Text style={styles.body}>No postcode data yet. Buyer postcodes can be recorded when closing deals.</Text>}</Section>
        {!!data.salespersonPerformance?.length&&<Section title="Team Performance">{data.salespersonPerformance.map((r,i)=><View key={i}><Row name={r.name} value={`${r.conversionRate}% conversion`}/><Text style={styles.meta}>{r.total} leads · {r.active} active · {r.won} won</Text></View>)}</Section>}
        <Text style={styles.sectionTitle}>Vehicle Engagement</Text><Section title="Top Performing Vehicles"><Text style={styles.body}>Ranked by total views and engagement</Text>{data.topVehicles.map((v,i)=><View key={v.id} style={styles.vehicle}><View style={styles.row}>{v.image&&<Image source={{uri:v.image}} style={styles.image}/>}<Text style={[styles.vehicleTitle,{flex:1}]}>{i+1}. {v.title}</Text></View><Row name="Views / Offers" value={`${v.views} / ${v.offerCount}`}/><Row name="Price / Status / Age" value={`${money(v.price)} · ${label(v.status)} · ${v.daysListed}d`}/></View>)}{!data.topVehicles.length&&<Text style={styles.body}>No vehicle engagement yet</Text>}</Section>
      </>}
    </ScrollView><DealerPageTabs/>
  </View>;
};
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:Colors.bgPrimary},content:{padding:20,paddingTop:24,paddingBottom:40,gap:20},title:{fontFamily:FontFamily.bold,fontSize:30,lineHeight:36,color:Colors.textPrimary},subtitle:{fontSize:12,lineHeight:18,letterSpacing:1.2,textTransform:'uppercase',color:Colors.textMuted},ranges:{flexDirection:'row',flexWrap:'wrap',gap:8},input:{padding:12,minHeight:48,borderWidth:1,borderRadius:12,borderColor:Colors.border,color:Colors.textPrimary,marginTop:8},section:{backgroundColor:Colors.bgCard,padding:20,borderRadius:20,borderWidth:1,borderColor:Colors.border,gap:16,overflow:'hidden'},sectionTitle:{fontSize:14,lineHeight:22,fontFamily:FontFamily.bold,textTransform:'uppercase',letterSpacing:1,color:Colors.textPrimary},body:{fontSize:14,lineHeight:22,color:Colors.textSecondary},metrics:{flexDirection:'row',flexWrap:'wrap',gap:12},metric:{padding:20,gap:8,borderRadius:16,borderWidth:1,borderColor:Colors.border,backgroundColor:Colors.bgCard},value:{fontFamily:FontFamily.bold,fontSize:24,color:Colors.textPrimary},metricName:{fontFamily:FontFamily.bold,fontSize:12,lineHeight:18,color:Colors.textMuted,textTransform:'uppercase'},meta:{fontSize:12,lineHeight:18,color:Colors.textMuted},row:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:12},rowValue:{fontSize:14,lineHeight:22,fontFamily:FontFamily.semiBold,color:Colors.textPrimary,flexShrink:1},track:{height:8,borderRadius:4,backgroundColor:Colors.bgSecondary,overflow:'hidden'},fill:{height:8,borderRadius:4,backgroundColor:Colors.accent},vehicle:{borderTopWidth:1,borderColor:Colors.border,paddingVertical:12,gap:10},vehicleTitle:{fontFamily:FontFamily.semiBold,fontSize:14,color:Colors.textPrimary},image:{height:56,width:56,borderRadius:12}});
