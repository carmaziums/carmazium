import React,{useCallback,useRef,useState} from 'react';
import {ActivityIndicator,FlatList,RefreshControl,StyleSheet,Text,View} from 'react-native';
import {useFocusEffect,useNavigation} from '@react-navigation/native';
import {Image} from 'expo-image';
import {WebsiteTopBar} from '../../components/WebsiteTopBar';
import {Button} from '../../components/Button';
import {apiClient} from '../../lib/apiClient';
import {getListingById} from '../../lib/listingsApi';
import {Colors} from '../../constants/colors';
import {FontFamily} from '../../constants/typography';
interface SavedItem {
 id:string;listingId:string;listing:{id:string;title:string;images:string[];year?:number;mileage?:number;price?:number;status:string;bids?:{amount:number|string}[];_count?:{bids:number};auction?:{id:string;status:string;startTime:string;endTime:string;startingBid:number|string}|null};
}
const money=(n:number|string|undefined)=>n==null?'—':Number(n).toLocaleString('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0});
export function DealerSavedScreen(){
 const navigation=useNavigation<any>();
 const [tab,setTab]=useState<'auctions'|'retail'>('auctions');const [page,setPage]=useState(1);
 const [items,setItems]=useState<SavedItem[]>([]);const [total,setTotal]=useState(0);const [pages,setPages]=useState(1);
 const [loading,setLoading]=useState(true);const [refreshing,setRefreshing]=useState(false);const [error,setError]=useState<string|null>(null);
 const [removing,setRemoving]=useState<string|null>(null);const [opening,setOpening]=useState<string|null>(null);
 const request=useRef(0);
 const load=useCallback(async(quiet=false)=>{
   const id=++request.current;if(quiet)setRefreshing(true);else setLoading(true);setError(null);
   try{
     const path=tab==='auctions'?`/watchlist/auctions?page=${page}&limit=12&view=all`:`/watchlist?page=${page}&limit=12&type=retail`;
     const res=await apiClient<{data:SavedItem[];pagination:{total:number;totalPages:number}}>(path);
     if(!Array.isArray(res.data)||!res.pagination)throw Error('Saved vehicles could not be loaded.');
     if(id!==request.current)return;
     setItems(res.data);setTotal(res.pagination.total);setPages(Math.max(1,res.pagination.totalPages));
     if(page>Math.max(1,res.pagination.totalPages))setPage(Math.max(1,res.pagination.totalPages));
   }catch(err){if(id===request.current)setError(err instanceof Error?err.message:'Saved vehicles could not be loaded.');}
   finally{if(id===request.current){setLoading(false);setRefreshing(false);}}
 },[tab,page]);
 useFocusEffect(useCallback(()=>{void load();const timer=setInterval(()=>void load(true),20000);return()=>{request.current++;clearInterval(timer);};},[load]));
 const remove=async(listingId:string)=>{
   if(removing)return;setRemoving(listingId);
   try{await apiClient(`/watchlist/${encodeURIComponent(listingId)}`,{method:'DELETE'});await load(true);}
   catch(err){setError(err instanceof Error?err.message:'Could not remove this saved car. Please try again.');}
   finally{setRemoving(null);}
 };
 const open=async(item:SavedItem)=>{
   if(tab==='auctions'){if(item.listing.auction?.id)navigation.navigate('AuctionDeepLink',{auctionId:item.listing.auction.id});return;}
   if(opening)return;setOpening(item.listingId);
   try{const listing=await getListingById(item.listingId);if(!listing)throw Error('Vehicle unavailable.');navigation.navigate('VehicleDetail',{listing});}
   catch(err){setError(err instanceof Error?err.message:'Could not open this vehicle.');}finally{setOpening(null);}
 };
 const browse=()=>navigation.navigate('Tabs',{screen:tab==='auctions'?'DealerBuyBid':'Search',params:tab==='auctions'?{initialSection:'live'}:undefined});
 const header=<View style={styles.header}><Text accessibilityRole="header" style={styles.heading}>Saved</Text><Text style={styles.subtitle}>Auctions and retail cars you have saved.</Text><Button label={tab==='auctions'?'Browse Live Auctions':'Browse Retail Cars'} variant="outline" onPress={browse}/><View style={styles.tabs}>{(['auctions','retail'] as const).map(t=><Button key={t} label={t==='auctions'?'Auctions':'Retail cars'} variant={tab===t?'primary':'ghost'} onPress={()=>{if(tab!==t){setItems([]);setTotal(0);setPage(1);setTab(t);}}}/>)}</View><View style={styles.row}><Text style={styles.body}>{loading?'Loading saved vehicles…':`${total} saved ${tab==='auctions'?'auctions':'retail cars'}`}</Text><Button label="Refresh" size="sm" variant="outline" loading={refreshing} onPress={()=>void load(true)}/></View>{error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}</View>;
 return <View style={styles.screen}><WebsiteTopBar/><FlatList data={items} keyExtractor={i=>i.id} contentContainerStyle={styles.list} ListHeaderComponent={header} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void load(true)} colors={[Colors.accent]}/>}
  renderItem={({item})=>{
   const a=item.listing.auction;const live=a?.status==='ACTIVE'&&item.listing.status==='ACTIVE'&&Date.parse(a.endTime)>Date.now();const scheduled=a?.status==='SCHEDULED'&&Date.parse(a.startTime)>Date.now();
   const status=tab==='retail'?(item.listing.status==='ACTIVE'?'AVAILABLE':'NO LONGER AVAILABLE'):live?'LIVE':scheduled?'UPCOMING':a?.status==='CANCELLED'?'CANCELLED':'ENDED / UNAVAILABLE';
   const amount=tab==='retail'?item.listing.price:item.listing._count?.bids&&item.listing.bids?.[0]?item.listing.bids[0].amount:a?.startingBid;
   return <View style={styles.card}><View style={styles.photo}>{item.listing.images?.[0]&&<Image source={{uri:item.listing.images[0]}} style={StyleSheet.absoluteFillObject} contentFit="cover"/>}<View style={styles.badge}><Text style={styles.badgeText}>{status}</Text></View></View><View style={styles.details}><Button label="Remove" variant="outline" size="sm" loading={removing===item.listingId} disabled={removing!==null} onPress={()=>void remove(item.listingId)}/><Text style={styles.title}>{item.listing.title}</Text><Text style={styles.body}>{item.listing.year||'Year not recorded'}{item.listing.mileage!=null?` · ${Number(item.listing.mileage).toLocaleString('en-GB')} mi`:''}</Text><View style={styles.row}><View><Text style={styles.body}>{tab==='retail'?'Price':item.listing._count?.bids?'Current bid':'Starting bid'}</Text><Text style={styles.title}>{money(amount)}</Text></View><View><Text style={styles.body}>{tab==='auctions'?'Auction status':'Availability'}</Text><Text style={styles.body}>{tab==='auctions'?status:item.listing.status}</Text></View></View><Button label={tab==='retail'?'View Vehicle':live?'Open Auction to Bid':'View Auction'} variant={live?'primary':'outline'} disabled={tab==='auctions'&&!a?.id} loading={opening===item.listingId} onPress={()=>void open(item)}/></View></View>;
  }}
  ListEmptyComponent={loading?<ActivityIndicator color={Colors.accent}/>:!error?<View style={styles.empty}><Text style={styles.title}>No saved {tab==='auctions'?'auctions':'retail cars'}</Text><Text style={styles.body}>Save vehicles while browsing to find them here.</Text><Button label={tab==='auctions'?'Browse Live Auctions':'Browse Retail Cars'} onPress={browse}/></View>:null}
  ListFooterComponent={pages>1?<View style={styles.row}><Button label="Previous" variant="outline" disabled={page===1} onPress={()=>setPage(p=>p-1)}/><Text style={styles.body}>Page {page} of {pages}</Text><Button label="Next" variant="outline" disabled={page>=pages} onPress={()=>setPage(p=>p+1)}/></View>:null}
 /></View>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:Colors.bgPrimary},list:{padding:20,paddingBottom:36},header:{gap:20,paddingVertical:24},heading:{fontSize:24,fontFamily:FontFamily.bold,color:Colors.textPrimary},subtitle:{fontSize:12,lineHeight:18,letterSpacing:1.2,textTransform:'uppercase',color:Colors.textMuted},tabs:{flexDirection:'row',flexWrap:'wrap',gap:6},row:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',alignItems:'center',gap:12},body:{fontSize:14,lineHeight:22,color:Colors.textMuted},error:{fontSize:14,color:Colors.error},card:{borderWidth:1,borderColor:Colors.border,borderRadius:16,backgroundColor:Colors.bgCard,overflow:'hidden',marginBottom:16},photo:{height:176,backgroundColor:Colors.bgSecondary},badge:{position:'absolute',top:12,left:12,borderRadius:20,paddingHorizontal:12,paddingVertical:8,backgroundColor:'#111827cc'},badgeText:{color:'#ffffff',fontSize:12,fontFamily:FontFamily.bold},details:{padding:20,gap:14},title:{fontSize:18,lineHeight:26,fontFamily:FontFamily.bold,color:Colors.textPrimary},empty:{gap:20,paddingVertical:40}});
