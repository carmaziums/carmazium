import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@/components/BrandIcon';
import { CarListing, getNativeListingPrice } from '../data/listings';
import { useWatchlistStore } from '../store/watchlistStore';
import { Colors, themeMode } from '../constants/colors';
import { FontFamily } from '../constants/typography';
import { useLocation } from '../context/LocationContext';
import { haversineDistanceMiles } from '../lib/distance';
import { BODY_TYPE_LABELS, FUEL_TYPE_LABELS, TRANSMISSION_LABELS } from '../lib/vehicleLabels';
import { ImageCarousel } from './ImageCarousel';
import { ImageLightbox } from './ImageLightbox';
import { SellerServiceBadges } from './SellerServiceBadges';
import { IconButton } from './IconButton';
import { Button } from './Button';

interface HorizontalVehicleCardProps {
  listing: CarListing;
  onPress: (id: string) => void;
  onWarranty?: () => void;
}
const BANNER_COLORS: Record<string,string> = {
  'Special Offer':'#dc2626','Limited Time Offer':'#e11d48',"Manager's Special":'#d97706',
  'Below Market Value':'#059669','Weekend Deal':'#7c3aed','5% Discount':'#059669',
  '10% Discount':'#059669','15% Discount':'#059669','Save £500':'#059669','Save £1,000':'#059669',
};
const GRADE_COLORS:Record<number,[string,string]>={1:['#10b981','#065f46'],2:['#84cc16','#3f6212'],3:['#f59e0b','#92400e'],4:['#f97316','#9a3412'],5:['#ef4444','#991b1b']};
const dark=themeMode==='dark';

const HorizontalVehicleCardBase: React.FC<HorizontalVehicleCardProps> = ({listing,onPress,onWarranty}) => {
  const saved=useWatchlistStore(s=>s.savedIds.has(listing.id));
  const toggle=useWatchlistStore(s=>s.toggle);
  const {width,fontScale}=useWindowDimensions();
  const [cardWidth,setCardWidth]=useState(Math.max(200,width-40));
  const [lightboxOpen,setLightboxOpen]=useState(false);
  const [lightboxIndex,setLightboxIndex]=useState(0);
  const {latitude,longitude}=useLocation();
  const miles=latitude!=null&&longitude!=null&&listing.latitude!=null&&listing.longitude!=null
    ?haversineDistanceMiles(latitude,longitude,listing.latitude,listing.longitude):null;
  const pricing=getNativeListingPrice(listing);
  const premium=listing.badgeTier==='PREMIUM',standard=listing.badgeTier==='STANDARD';
  const grade=listing.exteriorGrade&&GRADE_COLORS[listing.exteriorGrade];
  const bodyType=listing.bodyTypeRaw?BODY_TYPE_LABELS[listing.bodyTypeRaw]:listing.category;
  const fuel=listing.fuelTypeRaw?FUEL_TYPE_LABELS[listing.fuelTypeRaw]:listing.fuelType;
  const gearbox=(listing.transmissionRaw?TRANSMISSION_LABELS[listing.transmissionRaw]:undefined)||listing.transmission||'Not specified';
  const specs=[
    {icon:'calendar-outline',label:listing.year?String(listing.year):''},
    {icon:'speedometer-outline',label:listing.mileage!=null?listing.mileage.toLocaleString('en-GB')+' mi':''},
    {icon:'water-outline',label:fuel},{icon:'settings-outline',label:gearbox},{icon:'car-outline',label:bodyType},
    {icon:'location-outline',label:miles!=null?(miles<1?'< 1 mi away':Math.round(miles)+' mi away'):listing.location?.split(',')[0]?.trim()},
  ].filter(x=>x.label);
  const rawCategory=(listing.writeOffCategory||'').toUpperCase().replace(/^CAT_/, '');
  const category=/^[SNAB]$/.test(rawCategory)?rawCategory:(/^CAT_[SNAB]$/.test(listing.conditionRaw||'')?listing.conditionRaw?.slice(4):null);
  const linkedAuction=listing.linkedListing?.type==='AUCTION';
  const sold=listing.status==='SOLD',pending=listing.status==='OFFER_ACCEPTED';
  const gallery=listing.images.filter(Boolean).slice(0,100);
  return <>
    <View onLayout={e=>setCardWidth(e.nativeEvent.layout.width)} style={[s.card,{borderColor:premium?'rgba(251,191,36,0.4)':standard?'rgba(96,165,250,0.3)':Colors.border}]}>
      <LinearGradient colors={['rgba(30,41,59,0.5)',Colors.groundClear]} style={s.imageContainer}>
        <ImageCarousel images={gallery} width={Math.max(1,cardWidth-50)} height={192} onPress={i=>{setLightboxIndex(i);setLightboxOpen(true);}}/>
        {listing.isFeatured&&<View pointerEvents="none" style={s.featured}><Ionicons name="flash" size={14} color="#0f172a"/><Text style={s.featuredText}>FEATURED</Text></View>}
        {linkedAuction&&<View pointerEvents="none" style={[s.linked,{top:listing.isFeatured?40:12}]}><Ionicons name="hammer-outline" size={10} color="#fff"/><Text style={s.whiteBadge}>Also at Auction</Text></View>}
        {!sold&&<View style={s.save}><IconButton icon={<Ionicons name={saved?'heart':'heart-outline'} size={24} color={saved?Colors.accent:'#fff'}/>} onPress={()=>toggle(listing)} accessibilityLabel={saved?'Remove from watchlist':'Save to watchlist'}/></View>}
        <View pointerEvents="none" style={s.trust}>
          {listing.isImported&&<View style={[s.trustBadge,{backgroundColor:'#fbbf24'}]}><Ionicons name="globe-outline" size={11} color="#0f172a"/><Text style={[s.trustText,{color:'#0f172a'}]}>IMPORTED VEHICLE</Text></View>}
          {!!category&&<View style={[s.trustBadge,{backgroundColor:'#ffedd5'}]}><Text style={[s.trustText,{color:'#9a3412'}]}>Category {category.replace('CAT_','')}</Text></View>}
          {(standard||premium)&&listing.bodyTypeRaw!=='CARAVAN'&&<View style={s.trustBadge}><Ionicons name="shield-checkmark-outline" size={12} color="#3b82f6"/><Text style={s.trustText}>History Report Included</Text></View>}
        </View>
        {!!listing.bannerLabel&&!sold&&<View pointerEvents="none" style={[s.banner,{backgroundColor:BANNER_COLORS[listing.bannerLabel]??Colors.accent}]}><Text style={s.bannerText}>{listing.bannerLabel.toUpperCase()}</Text></View>}
        {(sold||pending)&&<View pointerEvents="none" style={s.statusOverlay}><Text style={[s.statusText,{color:sold?'#ef4444':'#fbbf24'}]}>{sold?'SOLD':'SALE PENDING'}</Text></View>}
      </LinearGradient>
      <LinearGradient colors={[dark?'rgba(255,255,255,0.05)':Colors.accentAlpha05,Colors.groundClear]} style={s.details}>
        <SellerServiceBadges seller={listing.seller}/>
        <View style={s.titleRow}><View style={{width:"100%"}}>
          <Text style={s.title} numberOfLines={fontScale>1.2?undefined:2}>{listing.title||`${listing.make} ${listing.model} ${listing.year}`}</Text>
          <Text style={s.makeModel} numberOfLines={fontScale>1.2?undefined:1}>{listing.make.toUpperCase()} {listing.model.toUpperCase()}</Text>
        </View><View style={s.marketplace}><Text style={s.marketplaceText}>MARKETPLACE LISTING</Text></View></View>
        <View style={{gap:4,marginBottom:12}}>
          <Text style={s.price} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{listing.listingType==='AUCTION'?pricing.amount:new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(listing.price)}</Text>
          <Text style={s.priceLabel}>{pricing.label}</Text>
          {!!pricing.reserveLabel&&<Text style={s.meta}>{pricing.reserveLabel}</Text>}
          {!!pricing.buyItNowLabel&&<Text style={s.meta}>{pricing.buyItNowLabel}</Text>}
          {listing.listingType!=='AUCTION'&&listing.status==='ACTIVE'&&<View style={s.offers}><Text style={s.offerText}>OFFERS WELCOME</Text></View>}
        </View>
        {(premium||standard)&&<View style={[s.tier,{borderColor:premium?'#f59e0b4d':'#3b82f64d',backgroundColor:premium?'#f59e0b1a':'#3b82f61a'}]}><Ionicons name={premium?'star':'shield-checkmark-outline'} size={10} color={premium?Colors.warning:Colors.infoBlue}/><Text style={[s.chipText,{color:premium?Colors.warning:Colors.infoBlue}]}>{premium?'PREMIUM':'STANDARD'}</Text></View>}
        {!!listing.isDepartedSale&&<View style={[s.spec,{alignSelf:'flex-start',marginBottom:12}]}><Text style={s.chipText}>Estate</Text></View>}
        {!!grade&&<View accessibilityLabel={`Exterior grade ${listing.exteriorGrade}. Exterior damage grade from seller reports; mechanical condition is not assessed.`} style={[s.tier,{backgroundColor:grade[0]+'1a',borderColor:grade[0]+'4d'}]}><View style={{width:6,height:6,borderRadius:3,backgroundColor:grade[0]}}/><Text style={[s.chipText,{color:dark?grade[0]:grade[1]}]}>EXTERIOR GRADE {listing.exteriorGrade}</Text></View>}
        <View style={s.specs}>{specs.map(spec=><View key={spec.icon} style={s.spec}><Ionicons name={spec.icon as any} size={10} color={Colors.textMuted}/><Text style={s.chipText}>{spec.label}</Text></View>)}{listing.deliveryAvailable&&<View style={[s.spec,{borderColor:'#10b9814d',backgroundColor:'#10b98126'}]}><Ionicons name="car-outline" size={11} color={Colors.success}/><Text style={[s.chipText,{color:Colors.success}]}>Delivery</Text></View>}</View>
        <Button label={sold?'View Sold Vehicle':listing.listingType==='AUCTION'?'View auction':pending?'View Sale Pending':'View Details'} fullWidth size="sm" onPress={()=>onPress(listing.id)} style={{backgroundColor:sold?Colors.textMuted:premium?'#d97706':Colors.accent}} textStyle={{fontFamily:FontFamily.bodyBold}}/>
        {!!onWarranty&&!sold&&!pending&&listing.listingType!=='AUCTION'&&<TouchableOpacity accessibilityRole="button" onPress={onWarranty} style={s.warranty}><Ionicons name="shield-checkmark-outline" size={14} color={Colors.textPrimary}/><Text style={s.warrantyText}>Get a warranty quote for this car</Text></TouchableOpacity>}
      </LinearGradient>
    </View>
    <ImageLightbox visible={lightboxOpen} images={gallery} initialIndex={lightboxIndex} onClose={()=>setLightboxOpen(false)}/>
  </>;
};
export const HorizontalVehicleCard=React.memo(HorizontalVehicleCardBase);

const s=StyleSheet.create({
 card:{backgroundColor:Colors.bgCard,borderWidth:1,borderRadius:16,overflow:'hidden',shadowColor:'#334155',shadowOffset:{width:0,height:6},shadowOpacity:0.08,shadowRadius:9,elevation:2},
 imageContainer:{height:240,padding:24,alignItems:'center',justifyContent:'center',position:'relative'},
 featured:{position:'absolute',top:0,left:16,flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:12,paddingVertical:8,borderBottomLeftRadius:12,borderBottomRightRadius:12,backgroundColor:'#f59e0b'},
 featuredText:{fontFamily:FontFamily.bodyBold,fontSize:12,color:'#0f172a'},
 linked:{position:'absolute',left:12,backgroundColor:'#f59e0be6',padding:6,borderRadius:4,flexDirection:'row',alignItems:'center',gap:4},
 whiteBadge:{fontFamily:FontFamily.bodyBold,fontSize:10,color:'#fff'},
 save:{position:'absolute',top:12,right:12,borderRadius:28,backgroundColor:'rgba(0,0,0,0.6)'},
 trust:{position:'absolute',top:64,right:12,alignItems:'flex-end',gap:6},
 trustBadge:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:4,backgroundColor:'rgba(255,255,255,0.9)',borderRadius:4,borderWidth:1,borderColor:'#3b82f64d'},
 trustText:{fontFamily:FontFamily.bodyBold,fontSize:10,color:'#1d4ed8'},
 banner:{position:'absolute',bottom:0,left:0,right:0,paddingHorizontal:12,paddingVertical:6},
 bannerText:{fontFamily:FontFamily.bodyBlack,fontSize:10,letterSpacing:1,color:'#fff',textAlign:'center'},
 statusOverlay:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center'},
 statusText:{fontFamily:FontFamily.bodyBlack,fontSize:28,padding:12,backgroundColor:'rgba(0,0,0,0.65)',transform:[{rotate:'-8deg'}]},
 details:{padding:24,borderTopWidth:1,borderTopColor:Colors.border},
 titleRow:{flexDirection:'column',alignItems:'flex-start',gap:6,marginBottom:8},
 title:{fontFamily:FontFamily.bold,fontSize:16,lineHeight:23,letterSpacing:0,color:Colors.textPrimary},
 makeModel:{fontFamily:FontFamily.semiBold,fontSize:12,lineHeight:16,letterSpacing:0.6,color:Colors.textMuted,marginTop:2},
 marketplace:{backgroundColor:Colors.accentAlpha20,borderRadius:4,paddingHorizontal:8,paddingVertical:4,flexShrink:0},
 marketplaceText:{fontFamily:FontFamily.bodyBold,fontSize:10,lineHeight:15,color:Colors.accent},
 price:{fontFamily:FontFamily.mono,fontSize:20,lineHeight:28,color:Colors.textPrimary},
 priceLabel:{fontFamily:FontFamily.bodyBold,fontSize:12,lineHeight:16,color:Colors.textMuted},
 meta:{fontFamily:FontFamily.regular,fontSize:12,lineHeight:16,color:Colors.textMuted},
 offers:{alignSelf:'flex-start',marginTop:4,borderRadius:999,borderWidth:1,borderColor:Colors.accentAlpha30,backgroundColor:Colors.accentAlpha10,paddingHorizontal:8,paddingVertical:2},
 offerText:{fontFamily:FontFamily.bodyBold,fontSize:10,lineHeight:15,letterSpacing:0.5,color:Colors.accent},
 tier:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,borderWidth:1,borderRadius:999,paddingHorizontal:8,paddingVertical:2,marginBottom:12},
 specs:{flexDirection:'row',flexWrap:'wrap',gap:6,marginBottom:16},
 spec:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:4,borderWidth:1,borderColor:Colors.border,borderRadius:6,backgroundColor:Colors.whiteAlpha06},
 chipText:{fontFamily:FontFamily.semiBold,fontSize:10,lineHeight:15,color:Colors.textMuted},
 warranty:{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:6,paddingTop:12,minHeight:48},
 warrantyText:{fontFamily:FontFamily.semiBold,fontSize:12,color:Colors.textPrimary},
});
