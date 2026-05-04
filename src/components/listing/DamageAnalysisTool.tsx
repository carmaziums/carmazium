import * as React from "react"
import { Sparkles, Loader2, AlertCircle, CheckCircle2, ChevronRight, Search, Camera } from "lucide-react"
import { CarDamageMap, type DamagePoint } from "./CarDamageMap"
import Image from "next/image"

interface DamageAnalysisToolProps {
  images: string[];
  onComplete: (detections: DamagePoint[]) => void;
}

export function DamageAnalysisTool({ images, onComplete }: DamageAnalysisToolProps) {
  const [analyzing, setAnalyzing] = React.useState(false)
  const [results, setResults] = React.useState<DamagePoint[]>([])
  const [activePoint, setActivePoint] = React.useState<DamagePoint | null>(null)
  const [currentView, setCurrentView] = React.useState<'FRONT' | 'SIDE' | 'REAR' | 'TOP'>('FRONT')

  const damageImages = images; // Ideally filter by category if parent didn't

  const runAnalysis = async () => {
    if (damageImages.length === 0) return
    
    setAnalyzing(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/damage/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls: damageImages })
      })
      const json = await res.json()
      if (json.success) {
        setResults(json.data)
        if (json.data.length > 0) {
          setActivePoint(json.data[0])
          setCurrentView(json.data[0].coords.view)
        }
      }
    } catch (err) {
      console.error("Analysis failed:", err)
    } finally {
      setAnalyzing(false)
    }
  }

  if (analyzing) {
    return (
      <div className="bg-slate-900/80 border border-primary/20 rounded-2xl p-12 text-center space-y-6">
        <div className="relative w-24 h-24 mx-auto">
          <Loader2 className="w-24 h-24 text-primary animate-spin" />
          <Sparkles className="absolute inset-0 m-auto w-10 h-10 text-amber-400 animate-pulse" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white font-heading">AI Damage Assessment in Progress</h3>
          <p className="text-gray-400 max-w-md mx-auto">
            Our computer vision model is scanning your photos for scratches, scuffs, and dents using YOLOv8...
          </p>
        </div>
        <div className="flex justify-center gap-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    )
  }

  if (results.length > 0) {
    return (
      <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="text-emerald-400" size={18} />
              AI Analysis Complete
            </h3>
            <p className="text-sm text-gray-400">{results.length} issues detected across {damageImages.length} photos.</p>
          </div>
          <button 
            onClick={() => onComplete(results)}
            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-emerald-500/20"
          >
            Apply to Listing
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Map */}
          <div className="space-y-4">
            <div className="flex gap-2 mb-2">
              {(['FRONT', 'SIDE', 'REAR', 'TOP'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setCurrentView(v)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border ${currentView === v ? 'bg-primary border-primary text-white' : 'bg-slate-900 border-white/10 text-gray-400 hover:border-white/30'}`}
                >
                  {v}
                </button>
              ))}
            </div>
            <CarDamageMap 
              view={currentView}
              points={results}
              activePointId={activePoint?.id}
              onPointClick={(p) => {
                setActivePoint(p)
                setCurrentView(p.coords.view)
              }}
            />
            
            {/* Legend/Info */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 space-y-3">
              <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider">Detection Report</h4>
              <div className="space-y-2">
                {results.map((r, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setActivePoint(r)
                      setCurrentView(r.coords.view)
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${activePoint === r ? 'bg-primary/10 border-primary/30 text-white' : 'bg-slate-900/50 border-white/5 text-gray-400 hover:bg-slate-900'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${r.type === 'Scratch' ? 'bg-amber-400' : 'bg-red-500'}`} />
                      <div className="text-left">
                        <p className="text-xs font-bold">{r.part}</p>
                        <p className="text-[10px] opacity-60">{r.type} &middot; {r.size}</p>
                      </div>
                    </div>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Evidence */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase text-gray-500 tracking-wider">Visual Evidence</h4>
            {activePoint ? (
              <div className="space-y-4">
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 group">
                  <Image 
                    src={activePoint.imageUrl!} 
                    alt="Damage evidence" 
                    fill 
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all" />
                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white uppercase tracking-widest">
                    Source Photo
                  </div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl space-y-1">
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">AI Assessment</p>
                  <p className="text-sm text-gray-300">
                    Detected a <span className="text-white font-bold">{activePoint.size.toLowerCase()} {activePoint.type.toLowerCase()}</span> on the <span className="text-white font-bold">{activePoint.part.toLowerCase()}</span>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="aspect-[4/3] rounded-2xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-gray-600">
                <Search size={48} className="mb-2 opacity-20" />
                <p className="text-sm">Select an issue to see evidence</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-8 text-center space-y-6">
      <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-2">
        <Sparkles className="text-primary w-8 h-8" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-white font-heading">AI Damage Scanning</h3>
        <p className="text-gray-400 max-w-md mx-auto text-sm">
          Run our automated visual inspection tool to identify bodywork issues, plot them on a map, and categorize severity automatically.
        </p>
      </div>
      <button
        onClick={runAnalysis}
        disabled={damageImages.length === 0}
        className={`px-8 py-3 rounded-xl font-bold transition-all shadow-xl flex items-center gap-2 mx-auto ${damageImages.length > 0 ? 'bg-primary hover:bg-red-600 text-white shadow-primary/20 hover:scale-105' : 'bg-slate-800 text-gray-500 cursor-not-allowed opacity-50'}`}
      >
        <Search size={18} />
        {damageImages.length === 0 ? 'Upload Photos First' : `Scan ${damageImages.length} Photos`}
      </button>
      <p className="text-[10px] text-gray-500 uppercase tracking-widest">Powered by YOLOv8 Computer Vision</p>
    </div>
  )
}
