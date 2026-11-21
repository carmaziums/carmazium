import React, { useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Button } from '../Button';
import { apiClient } from '../../lib/apiClient';
import { Colors } from '../../constants/colors';
export function BuyerCollectedButton({saleId,onCollected}:{saleId:string;onCollected?:()=>void}) {
  const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null); const [done,setDone]=useState(false); const pending=useRef(false);
  const save=async()=>{if(pending.current)return;pending.current=true;setBusy(true);setError(null);
    try {await apiClient(`/listings/purchase-sales/${encodeURIComponent(saleId)}/confirm-collection`,{method:'POST'});setDone(true);onCollected?.();}
    catch(err){setError(err instanceof Error?err.message:'Could not confirm collection. Please try again.');}
    finally{pending.current=false;setBusy(false);}
  };
  const confirm=()=>Alert.alert('Confirm physical vehicle collection','I confirm I have physically received this vehicle and have paid the seller directly. This moves my purchase into Completed. It does not confirm payment on behalf of the seller or mark a transport job completed.',[{text:'Not yet',style:'cancel'},{text:'Confirm collected',onPress:()=>void save()}]);
  return <View style={{gap:8}}>{done?<Text style={{color:Colors.success}}>Collection recorded. This purchase is now under Completed.</Text>:<Button label="I've collected this car" variant="outline" loading={busy} disabled={busy} onPress={confirm}/>} {error&&<Text accessibilityRole="alert" style={{color:Colors.error}}>{error}</Text>}</View>;
}
