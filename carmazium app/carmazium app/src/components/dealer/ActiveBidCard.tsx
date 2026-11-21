import React, {useEffect,useState} from 'react';
import {Alert,StyleSheet,Text,View} from 'react-native';
import {Image} from 'expo-image';
import {Button} from '../Button';
import {apiClient} from '../../lib/apiClient';
import {Colors} from '../../constants/colors';
import {FontFamily} from '../../constants/typography';
export interface ActiveBidPosition {
  listingId:string;auctionId:string|null;myBidId:string;myHighestBid:number;currentHighestBid:number;
  nextMinimumBid?:number;isLeading:boolean;bidCount:number;endTime:string;canCancelCurrentBid:boolean;cancelDeadline:string;
  listing:{id:string;title:string;images?:string[];make?:string|null;year?:number|null;model?:string|null;mileage?:number|null};
}
const money=(value:number)=>Number(value).toLocaleString('en-GB',{style:'currency',currency:'GBP'});
function remaining(deadline:string,now:number){const minutes=Math.max(0,Math.ceil((Date.parse(deadline)-now)/60000));return minutes>=60?`${Math.floor(minutes/60)}h ${minutes%60}m`:`${minutes}m`;}
export function ActiveBidCard({position:p,canPlaceBid,onRefresh,onOpen}:{position:ActiveBidPosition;canPlaceBid:boolean;onRefresh:()=>Promise<void>;onOpen:()=>void}){
  const [now,setNow]=useState(Date.now());const [busy,setBusy]=useState(false);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const cancelOpen=canPlaceBid&&p.canCancelCurrentBid&&Date.parse(p.cancelDeadline)>now;
  const requestCancel=()=>{
    if(!canPlaceBid||!p.canCancelCurrentBid||Date.parse(p.cancelDeadline)<=Date.now()||busy)return;
    Alert.alert('Cancel your current highest bid?',p.isLeading?'If you placed an earlier lower bid on this auction, that earlier bid may become your active position.':'Earlier lower bids you placed may remain active.',[
      {text:'Keep bid',style:'cancel'},
      {text:'Cancel Current Bid',style:'destructive',onPress:async()=>{
        if(Date.parse(p.cancelDeadline)<=Date.now()){setNow(Date.now());Alert.alert('Cancel window ended','The 24-hour cancellation window has ended.');return;}
        setBusy(true);
        try{await apiClient(`/bids/${encodeURIComponent(p.myBidId)}/cancel`,{method:'PATCH'});await onRefresh();}
        catch(err){Alert.alert('Could not cancel bid',err instanceof Error?err.message:'Please try again.');}
        finally{setBusy(false);}
      }},
    ]);
  };
  return <View style={styles.card}>
    <View style={styles.photo}>{p.listing.images?.[0]&&<Image source={{uri:p.listing.images[0]}} style={StyleSheet.absoluteFillObject} contentFit="cover"/>}<View style={[styles.badge,{left:12,backgroundColor:p.isLeading?'#059669':'#d97706'}]}><Text style={styles.badgeText}>{p.isLeading?'LEADING':'OUTBID'}</Text></View><View style={[styles.badge,{right:12,backgroundColor:'#000000b3'}]}><Text style={styles.badgeText}>{remaining(p.endTime,now)}</Text></View></View>
    <View style={styles.content}><Text style={styles.title}>{p.listing.title}</Text><Text style={styles.meta}>{[p.listing.year,p.listing.make,p.listing.model].filter(Boolean).join(' ')}{p.listing.mileage!=null?` · ${Number(p.listing.mileage).toLocaleString('en-GB')} miles`:''}</Text>
      <View style={styles.metrics}><View style={styles.metric}><Text style={styles.label}>Your Highest Bid</Text><Text style={styles.amount}>{money(p.myHighestBid)}</Text></View><View style={styles.metric}><Text style={styles.label}>Current Highest</Text><Text style={[styles.amount,{color:p.isLeading?Colors.success:Colors.textPrimary}]}>{money(p.currentHighestBid)}</Text></View></View>
      {!p.isLeading&&p.nextMinimumBid!=null&&<View style={styles.metric}><Text style={styles.label}>Next minimum bid</Text><Text style={styles.amount}>{money(p.nextMinimumBid)}</Text></View>}
      <Text style={styles.meta}>{p.bidCount} total bid{p.bidCount===1?'':'s'} on this auction{cancelOpen?` · ${remaining(p.cancelDeadline,now)} left to cancel`:''}</Text>
      <Button label={p.isLeading?'View Live Auction':'Bid Again'} disabled={!p.auctionId} onPress={onOpen}/>
      {canPlaceBid&&<Button label={cancelOpen?'Cancel Current Bid':'24h Cancel Window Ended'} variant="outline" disabled={!cancelOpen||busy} loading={busy} onPress={requestCancel}/>}
    </View>
  </View>;
}
const styles=StyleSheet.create({card:{borderRadius:16,borderWidth:1,borderColor:Colors.border,backgroundColor:Colors.bgCard,overflow:'hidden',marginBottom:16},photo:{height:176,backgroundColor:Colors.bgSecondary},badge:{position:'absolute',top:12,paddingHorizontal:12,paddingVertical:8,borderRadius:24},badgeText:{color:'#ffffff',fontFamily:FontFamily.bold,fontSize:12},content:{padding:20,gap:16},title:{fontSize:18,lineHeight:24,fontFamily:FontFamily.bold,color:Colors.textPrimary},meta:{fontSize:14,lineHeight:22,color:Colors.textMuted},metrics:{flexDirection:'row',flexWrap:'wrap',gap:12},metric:{flexGrow:1,flexBasis:'45%',padding:12,borderWidth:1,borderRadius:12,borderColor:Colors.border,backgroundColor:Colors.bgSecondary,gap:6},label:{fontSize:10,lineHeight:16,fontFamily:FontFamily.bold,letterSpacing:1,textTransform:'uppercase',color:Colors.textMuted},amount:{fontFamily:FontFamily.bold,fontSize:20,color:Colors.textPrimary}});
