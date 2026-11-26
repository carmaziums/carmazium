import type { DamagePoint } from "./damageMarkers";
import { DAMAGE_ZONES_3D, CUSTOM_ZONE_COORDS } from "../components/damage/damageZones";
export interface DamageEntry {
 id: string; zone: string; type: "SCRATCH" | "SCUFF" | "DENT" | "CRACK" | "OTHER"; description: string;
 referenceBodyType?: string; surfacePoint?: DamagePoint; imageUrl?: string; originalType?: string; size?: string;
 coords?: typeof CUSTOM_ZONE_COORDS | { x: number; y: number; view: "FRONT" | "SIDE" | "REAR" | "TOP" | "INTERIOR" };
}
export function suggestDamageZone(point: DamagePoint) {
 const d=(z: NonNullable<(typeof DAMAGE_ZONES_3D)[number]["box"]>) => ((point.fx-z.fx)*2.2)**2+((point.fy-z.fy)*1.6)**2+((point.fz-z.fz)*5.2)**2;
 return DAMAGE_ZONES_3D.filter(z=>z.box).sort((a,b)=>d(a.box!)-d(b.box!))[0]?.label ?? "Other exterior area";
}
export function damageEntryToRecord(r: DamageEntry) {
 const zone = DAMAGE_ZONES_3D.find(z=>z.label===r.zone || z.id===r.zone);
 return { id: r.id, part: zone?.id ?? r.zone, type: r.originalType ?? (r.description.trim() ? r.type+" - "+r.description.trim() : r.type), size:r.size ?? "MODERATE", coords:{...(r.coords ?? zone?.coords ?? CUSTOM_ZONE_COORDS),...(r.surfacePoint?{surfacePoint:r.surfacePoint}:{}),...(r.referenceBodyType?{referenceBodyType:r.referenceBodyType}:{})}, imageUrl:r.imageUrl ?? null };
}
export function damageRecordToEntry(r: any, fallbackBodyType?: unknown): DamageEntry {
 const zone = DAMAGE_ZONES_3D.find(z=>z.id===r.part);
 const raw=String(r.type??"OTHER"); const match=raw.match(/^(SCRATCH|SCUFF|DENT|CRACK|OTHER)(?: - (.*))?$/i);
 const p=r.coords?.surfacePoint; const surfacePoint=p && [p.fx,p.fy,p.fz].every(n=>typeof n==="number" && Number.isFinite(n) && n>=0 && n<=1)?p:undefined;
 const c=r.coords; const coords=c && Number.isFinite(c.x)&&Number.isFinite(c.y)&&["FRONT","SIDE","REAR","TOP","INTERIOR"].includes(c.view)?{x:c.x,y:c.y,view:c.view}:undefined;
 return {id:r.id,referenceBodyType:r.coords?.referenceBodyType ?? (typeof fallbackBodyType==='string'?fallbackBodyType:undefined),zone:zone?.label??r.part,type:match?match[1].toUpperCase() as DamageEntry["type"]:"OTHER",description:match?match[2]??"":raw,originalType:raw,size:r.size,coords,surfacePoint,imageUrl:r.imageUrl??undefined};
}
