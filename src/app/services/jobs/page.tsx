"use client"

import * as React from "react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/buttonVariants"
import { ArrowLeft, Loader2, Truck, ClipboardCheck, RefreshCw } from "lucide-react"
import { deliveryServiceEnabled, inspectionServiceEnabled } from "@/lib/featureFlags"
import { RequireAuth } from "@/components/auth/RequireAuth"
import { useAuth } from "@/context/AuthContext"
import { getMyJobsPage, formatPence, type ServiceJob } from "@/lib/servicesApi"
import { JobListCard } from "@/components/services/JobBits"
import { REQUEST_FILTERS, requestMatches, requestNextStep, type RequestFilter } from "@/lib/serviceRequestViews"

function RequestActions() {
    return <div className="flex flex-wrap gap-2">
        {deliveryServiceEnabled && <Link href="/services/delivery/new" className={buttonVariants({className:"min-h-12"})}><Truck size={18}/> Request transport</Link>}
        {inspectionServiceEnabled && <Link href="/services/inspection/new" className={buttonVariants({variant:"outline",className:"min-h-12"})}><ClipboardCheck size={18}/> Request inspection</Link>}
    </div>
}

// Only the authenticated customer's own jobs are returned by this API.
function MyJobsList() {
    const [jobs,setJobs] = React.useState<ServiceJob[] | null>(null)
    const [filter,setFilter] = React.useState<RequestFilter>("all")
    const [cursor,setCursor] = React.useState<string | null>(null)
    const [busy,setBusy] = React.useState(false)
    const [error,setError] = React.useState("")
    const generation = React.useRef(0)
    const lock = React.useRef(false)
    const load = React.useCallback(async (more=false, next?:string) => {
        if (lock.current) return
        const request = ++generation.current
        lock.current=true;setBusy(true);setError("")
        try {
            const page=await getMyJobsPage(more?next:undefined)
            if(request!==generation.current)return
            setJobs(old=>more?[...new Map([...(old??[]),...page.items].map(job=>[job.id,job])).values()]:page.items)
            setCursor(page.nextCursor)
        }catch(e){if(request===generation.current)setError(e instanceof Error?e.message:"Could not load your service requests")}
        finally{if(request===generation.current){lock.current=false;setBusy(false)}}
    },[])
    React.useEffect(()=>{void load();return()=>{generation.current++;lock.current=false}},[load])
    const visible=(jobs??[]).filter(j=>requestMatches(j,filter))
    return <div className="mx-auto max-w-6xl px-5 py-8 sm:py-12">
        <Link href="/auctions" className="mb-5 inline-flex min-h-12 items-center gap-2 font-semibold hover:underline"><ArrowLeft size={18}/> TradeXchange</Link>
        <header className="flex flex-wrap items-end justify-between gap-4">
            <div><h1 className="text-3xl sm:text-4xl font-heading font-black">My Service Requests</h1><p className="mt-2 max-w-2xl text-base text-[var(--text-secondary)]">Review quotes, pay for accepted services and track the work you requested. This is separate from providing services.</p></div>
            <RequestActions/>
        </header>
        <div className="mt-6 flex flex-wrap items-center gap-3"><Link href="/dashboard/warranties" className={buttonVariants({variant:"outline",className:"min-h-12"})}>Warranty orders</Link><Link href="/dashboard" className="inline-flex min-h-12 items-center font-semibold underline">Back to dashboard</Link><button type="button" disabled={busy} onClick={()=>void load()} className="ml-auto inline-flex min-h-12 items-center gap-2 rounded-xl border px-4 font-semibold disabled:opacity-50"><RefreshCw size={16}/> Refresh</button></div>
        <div className="mt-6 flex flex-wrap gap-2 border-b border-[var(--border-default)] pb-4" role="group" aria-label="Filter service requests">
            {REQUEST_FILTERS.map(([id,label])=><button type="button" key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)} className={"min-h-12 rounded-xl px-4 py-2 font-semibold border "+(filter===id?"bg-red-700 text-white border-red-700":"border-[var(--border-default)] bg-[var(--bg-card)]")}>{label}</button>)}
        </div>
        {jobs && <p className="mt-3 text-sm text-[var(--text-muted)]" aria-live="polite">{visible.length} matching request{visible.length===1?"":"s"} in {jobs.length} loaded{cursor?" — load more to search older requests":""}.</p>}
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 p-4 text-red-700 dark:text-red-300">{error} <button onClick={()=>void load()} className="underline font-semibold">Try again</button></p>}
        {!jobs && !error && <div role="status" className="flex items-center justify-center gap-2 py-16"><Loader2 className="animate-spin"/> Loading your requests</div>}
        {jobs && !visible.length && <section className="mt-5 rounded-2xl border border-dashed border-[var(--border-default)] p-6 text-center"><h2 className="text-xl font-bold">{jobs.length?"No matching requests in loaded history":"No jobs yet"}</h2><p className="mt-2 text-[var(--text-secondary)]">{jobs.length?"Choose another filter or load older requests if available.":"Request transport or an inspection to receive quotes from approved providers."}</p></section>}
        <section className="mt-5 grid gap-3 lg:grid-cols-2" aria-label="Service requests">
            {visible.map(j=><JobListCard key={j.id} job={j} href={"/services/jobs/"+j.id} trailing={<div className="text-right shrink-0"><p className="text-sm font-semibold">{requestNextStep(j)}</p>{j.status==="OPEN"?<p className="text-sm text-[var(--text-secondary)]">{j._count?.quotes??0} active quotes</p>:j.agreedAmountPence!=null?<p className="text-sm">{formatPence(j.agreedAmountPence)}</p>:null}</div>}/>)}
        </section>
        {cursor && <div className="mt-6 text-center"><button type="button" onClick={()=>void load(true,cursor)} disabled={busy} className="min-h-12 rounded-xl border border-[var(--border-default)] px-5 font-semibold disabled:opacity-50">{busy?"Loading…":"Load older requests"}</button></div>}
    </div>
}

function AccountRequests(){const {user}=useAuth();return user?<MyJobsList key={user.id}/>:null}
export default function MyServiceJobsPage() {
    return <div className="min-h-screen bg-[var(--bg-body)]"><RequireAuth title="Sign in to see your service requests" message="Your requests, quotes and completed services live here." helpHref="/auctions" helpLabel="Explore TradeXchange"><AccountRequests/></RequireAuth></div>
}
