"use client"

import * as React from "react"
import { apiClient } from "@/lib/apiClient"
import { Button } from "@/components/ui/Button"
import { getMyCapabilities, updateJobMatching, type ContractorCapability } from "@/lib/servicesApi"
import { getCapabilityVerification, submitProviderDeclaration, type CapabilityVerificationDetail } from "@/lib/serviceOperationsApi"

type Service = "DELIVERY" | "INSPECTION"
type MinimalCapability = Pick<ContractorCapability,"id" | "serviceType">
type DealerBusiness = { companyName?: string | null; businessAddress?: string | null; phone?: string | null; isVerified?: boolean }
const inputStyle="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-primary)] p-3 text-sm"
const labelStyle="block text-sm font-semibold space-y-1"
const quiet="text-sm text-[var(--text-muted)]"
const parseAreas=(value:string)=>[...new Set(value.split(/[\s,]+/).map(a=>a.trim().toUpperCase()).filter(Boolean))]
const validArea=(value:string)=>/^(?:GIR|[A-Z]{1,2})$/.test(value)

function SectionHeading({ title, subtitle, expanded, onToggle, id }: {title:string;subtitle:string;expanded:boolean;onToggle:()=>void;id:string}) {
 return <button type="button" className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={expanded} aria-controls={id} onClick={onToggle}>
   <span><span className="block text-xl font-bold">{title}</span><span className={"block mt-1 "+quiet}>{subtitle}</span></span>
   <span aria-hidden="true" className="text-xl">{expanded?"−":"+"}</span>
 </button>
}

export function ProviderBusinessPaymentsSection({
 capabilities, dealer, stripeComplete, onSaved,
}:{
 capabilities:MinimalCapability[];dealer?:DealerBusiness|null;stripeComplete?:boolean;onSaved?:()=>Promise<void>;
}) {
 const [expanded,setExpanded]=React.useState(false)
 const [service,setService]=React.useState<Service>("DELIVERY")
 const cap=capabilities.find(c=>c.serviceType===service)
 const [detail,setDetail]=React.useState<CapabilityVerificationDetail|null>(null)
 const [busy,setBusy]=React.useState(false)
 const [error,setError]=React.useState("")
 const [message,setMessage]=React.useState("")
 const [loading,setLoading]=React.useState(false)
 const [accountName,setAccountName]=React.useState(dealer?.companyName??"")
 const [accountPhone,setAccountPhone]=React.useState(dealer?.phone??"")
 const [accountAddress,setAccountAddress]=React.useState(dealer?.businessAddress??"")
 const [fields,setFields]=React.useState({businessName:"",businessAddress:"",phone:"",registeredBusiness:false})
 const [accepted,setAccepted]=React.useState(false)
 const generation=React.useRef(0)

 React.useEffect(()=>{
  setAccountName(dealer?.companyName??"");setAccountPhone(dealer?.phone??"");setAccountAddress(dealer?.businessAddress??"")
 },[dealer?.companyName,dealer?.phone,dealer?.businessAddress])
 React.useEffect(()=>{
  setDetail(null);setMessage("");setError("")
  if(!expanded||!cap){generation.current++;return}
  let active=true;const request=++generation.current;setLoading(true)
  getCapabilityVerification(cap.id).then(next=>{
   if(!active||request!==generation.current)return
   if(next.capabilityId!==cap.id||next.serviceType!==service)throw Error("Incorrect service verification record")
   setDetail(next)
   const d=next.verification.declaration
   setFields({businessName:d?.businessName??dealer?.companyName??"",businessAddress:d?.businessAddress??dealer?.businessAddress??"",phone:d?.phone??dealer?.phone??"",registeredBusiness:d?.registeredBusiness??false})
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Could not read saved declarations")})
   .finally(()=>{if(active)setLoading(false)})
  return()=>{active=false;generation.current++}
 },[expanded,cap?.id,service,dealer?.companyName,dealer?.businessAddress,dealer?.phone])

 const saveDealer=async()=>{
  if(!accountName.trim()){setError("Enter your business name");return}
  setBusy(true);setError("");setMessage("")
  try{
   await apiClient("/users/dealer-profile",{method:"PATCH",body:JSON.stringify({companyName:accountName.trim(),phone:accountPhone.trim(),businessAddress:accountAddress.trim()})})
   await onSaved?.()
   setMessage("Business details saved.")
  }catch(e){setError(e instanceof Error?e.message:"Business details could not be saved")}
  finally{setBusy(false)}
 }
 const saveDeclaration=async()=>{
  if(!cap||!detail||!accepted||!fields.registeredBusiness)return
  setBusy(true);setError("");setMessage("")
  try{
   const result=await submitProviderDeclaration(cap.id,{...fields,accepted:true})
   setDetail(result);setAccepted(false);setMessage("Declaration saved. Your existing application was updated.")
  }catch(e){setError(e instanceof Error?e.message:"Declaration could not be saved")}
  finally{setBusy(false)}
 }
 const startPayouts=async()=>{
  setBusy(true);setError("")
  try{
   const origin=window.location.origin
   const response=await apiClient<{data?:{url:string};url?:string}>("/users/stripe-connect/onboard",{
    method:"POST",body:JSON.stringify({returnUrl:origin+"/dashboard/partner#provider-business",refreshUrl:origin+"/dashboard/partner#provider-business"})
   })
   const url=response.data?.url??response.url
   if(!url)throw Error("Payout setup link unavailable")
   window.location.assign(url)
  }catch(e){setError(e instanceof Error?e.message:"Could not start payout setup");setBusy(false)}
 }
 React.useEffect(()=>{
  const sync=()=>{
   const id=new URLSearchParams(window.location.search).get("capability")
   const target=capabilities.find(c=>c.id===id)
   if(target?.serviceType==="INSPECTION"||target?.serviceType==="DELIVERY")setService(target.serviceType)
   if(window.location.hash==="#provider-business")setExpanded(true)
  }
  sync();window.addEventListener("hashchange",sync)
  return()=>window.removeEventListener("hashchange",sync)
 },[capabilities])
 return <section id="provider-business" className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 md:p-7">
  <SectionHeading title="Business & Payments" subtitle="Business details, declarations and payout verification — without another setup page." expanded={expanded} id="business-payment-options" onToggle={()=>setExpanded(v=>!v)} />
  {expanded&&<div id="business-payment-options" className="space-y-5 mt-5">
   {dealer&&<div className="rounded-xl border border-[var(--border-default)] p-4 space-y-3">
    <h3 className="font-semibold">Business profile</h3>
    <label className={labelStyle}>Business name<input aria-label="Business name" className={inputStyle} value={accountName} maxLength={120} onChange={e=>setAccountName(e.target.value)} /></label>
    <label className={labelStyle}>Business phone<input aria-label="Business phone" className={inputStyle} value={accountPhone} maxLength={30} onChange={e=>setAccountPhone(e.target.value)} /></label>
    <label className={labelStyle}>Registered business address<input aria-label="Registered business address" className={inputStyle} value={accountAddress} maxLength={500} onChange={e=>setAccountAddress(e.target.value)} /></label>
    <Button onClick={()=>void saveDealer()} disabled={busy}>{busy?"Saving…":"Save business details"}</Button>
    <p className={quiet}>{dealer.isVerified?"Dealer verification approved.":"Dealer verification is not complete. Existing verification records remain on your account."}</p>
    {!dealer.isVerified && <a href="/profile?section=verification" className="inline-block text-sm font-semibold text-primary underline">Continue mandatory dealer verification</a>}
   </div>}
   <div className="rounded-xl border border-[var(--border-default)] p-4 space-y-3">
    <h3 className="font-semibold">Service declaration</h3>
    <p className={quiet}>Confirm the business responsible for each service once. Previously submitted declarations will be shown here.</p>
    <div className="flex flex-wrap gap-2">{(["DELIVERY","INSPECTION"] as const).map(type=><Button key={type} variant={service===type?"default":"outline"} onClick={()=>setService(type)}>{type==="DELIVERY"?"Delivery & recovery":"Inspection"}</Button>)}</div>
    {!cap?<p className={quiet}>This service has not been added yet. Use My Services above to apply.</p>
    :loading?<p role="status" className={quiet}>Loading saved declaration…</p>
    :!detail?<p role="alert" className={quiet}>{error||"Verification currently unavailable."}</p>
    :!detail.verification.declarationRequired?<p className={quiet}>No further declaration is requested for this service.</p>
    :<div className="space-y-3">
      {detail.verification.declarationCurrent&&<p className="text-sm text-emerald-600 dark:text-emerald-300">Declaration already saved. You only need to update it if your business details change.</p>}
      <label className={labelStyle}>Trading name<input aria-label="Declaration trading name" className={inputStyle} value={fields.businessName} onChange={e=>setFields(f=>({...f,businessName:e.target.value}))} /></label>
      <label className={labelStyle}>Registered business address<input aria-label="Declaration address" className={inputStyle} value={fields.businessAddress} onChange={e=>setFields(f=>({...f,businessAddress:e.target.value}))} /></label>
      <label className={labelStyle}>Business phone<input aria-label="Declaration phone" className={inputStyle} value={fields.phone} onChange={e=>setFields(f=>({...f,phone:e.target.value}))} /></label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={fields.registeredBusiness} onChange={e=>setFields(f=>({...f,registeredBusiness:e.target.checked}))} />I confirm the business is registered, including a registered sole trader.</label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} />I confirm these details are accurate and accept responsibility for work undertaken.</label>
      <Button onClick={()=>void saveDeclaration()} disabled={busy||!accepted||!fields.registeredBusiness||!fields.businessName.trim()||!fields.businessAddress.trim()||!fields.phone.trim()}>Save declaration</Button>
    </div>}
   </div>
   <div className="rounded-xl border border-[var(--border-default)] p-4 space-y-2">
    <h3 className="font-semibold">Business payouts</h3>
    <p className={quiet}>Payments for completed work use your business Stripe Connect account. Do not upload bank statements as service evidence.</p>
    {stripeComplete?<p className="text-sm text-emerald-600 dark:text-emerald-300">Business payouts enabled</p>:<Button variant="outline" disabled={busy} onClick={()=>void startPayouts()}>Set up secure payouts</Button>}
   </div>
   {error&&<p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
   {message&&<p role="status" className="text-sm text-emerald-600 dark:text-emerald-300">{message}</p>}
  </div>}
 </section>
}

export function ProviderJobPreferencesSection({capabilities}:{capabilities:MinimalCapability[]}) {
 const [expanded,setExpanded]=React.useState(false)
 const [service,setService]=React.useState<Service>("DELIVERY")
 const [cap,setCap]=React.useState<ContractorCapability|null>(null)
 const [nationwide,setNationwide]=React.useState(false)
 const [areas,setAreas]=React.useState("")
 const [loading,setLoading]=React.useState(false)
 const [busy,setBusy]=React.useState(false)
 const [error,setError]=React.useState("")
 const [notice,setNotice]=React.useState("")
 const generation=React.useRef(0)
 const available=capabilities.find(c=>c.serviceType===service)
 React.useEffect(()=>{
  setCap(null);setError("");setNotice("")
  if(!expanded||!available){generation.current++;return}
  const request=++generation.current;let active=true;setLoading(true)
  getMyCapabilities().then(data=>{
   if(!active||request!==generation.current)return
   const current=data.capabilities.find(c=>c.id===available.id && c.serviceType===service)
   if(!current)throw Error("This service does not belong to your account")
   setCap(current);setNationwide(current.jobNationwide);setAreas(current.jobPostcodeAreas.join(", "))
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:"Could not load work areas")})
   .finally(()=>{if(active)setLoading(false)})
  return()=>{active=false;generation.current++}
 },[expanded,available?.id,service])
 React.useEffect(()=>{
  const sync=()=>{
   const id=new URLSearchParams(window.location.search).get("capability")
   const target=capabilities.find(c=>c.id===id)
   if(target?.serviceType==="INSPECTION"||target?.serviceType==="DELIVERY")setService(target.serviceType)
   if(window.location.hash==="#provider-preferences")setExpanded(true)
  }
  sync();window.addEventListener("hashchange",sync)
  return()=>window.removeEventListener("hashchange",sync)
 },[capabilities])
 const save=async()=>{
  if(!cap)return
  const parsed=nationwide?[]:parseAreas(areas)
  if(!nationwide&&(!parsed.length||parsed.some(v=>!validArea(v)))){setError("Enter UK postcode areas such as B, CV, WS or choose nationwide.");return}
  setBusy(true);setError("");setNotice("")
  try{
   const result=await updateJobMatching(cap.id,{jobNationwide:nationwide,jobPostcodeAreas:parsed})
   setCap(result);setNationwide(result.jobNationwide);setAreas(result.jobPostcodeAreas.join(", "))
   setNotice("Working areas saved. Your existing assigned work is unchanged.")
  }catch(e){setError(e instanceof Error?e.message:"Could not save your working areas")}
  finally{setBusy(false)}
 }
 return <section id="provider-preferences" className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 md:p-7">
  <SectionHeading title="Job Preferences" subtitle="Working locations for new jobs, managed without another matching page." expanded={expanded} id="provider-preferences-options" onToggle={()=>setExpanded(v=>!v)}/>
  {expanded&&<div id="provider-preferences-options" className="mt-5 space-y-3">
   <div className="flex gap-2 flex-wrap">{(["DELIVERY","INSPECTION"] as const).map(type=><Button key={type} variant={service===type?"default":"outline"} onClick={()=>setService(type)}>{type==="DELIVERY"?"Delivery & recovery":"Inspection"}</Button>)}</div>
   {!available?<p className={quiet}>Apply for this service in My Services first.</p>
   :loading?<p role="status" className={quiet}>Loading preferences…</p>
   :!cap?<p role="alert" className={quiet}>{error||"Preferences unavailable."}</p>
   :<div className="space-y-3">
    <label className="flex gap-2 text-sm items-center"><input type="checkbox" checked={nationwide} onChange={e=>setNationwide(e.target.checked)} />Available nationwide</label>
    {!nationwide&&<label className={labelStyle}>UK postcode areas<input aria-label="UK postcode areas" className={inputStyle} value={areas} onChange={e=>setAreas(e.target.value)} placeholder="B, CV, WS, DY"/></label>}
    <p className={quiet}>{service==="DELIVERY"?"New delivery jobs match their collection postcode area.":"Inspection jobs match the vehicle location postcode area."} Existing accepted jobs are not removed by this setting.</p>
    <Button onClick={()=>void save()} disabled={busy}>{busy?"Saving…":"Save job preferences"}</Button>
   </div>}
   {error&&<p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
   {notice&&<p role="status" className="text-sm text-emerald-600 dark:text-emerald-300">{notice}</p>}
  </div>}
 </section>
}
