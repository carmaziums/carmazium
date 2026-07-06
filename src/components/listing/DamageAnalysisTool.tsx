import * as React from "react"
import { Sparkles, Loader2, AlertCircle, CheckCircle2, ChevronRight, Search, Camera } from "lucide-react"
import { CarDamageMap, type DamagePoint } from "./CarDamageMap"
import Image from "next/image"
import { apiClient } from "@/lib/apiClient"

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
      const res = await apiClient<{ success: boolean; data: DamagePoint[] }>('/damage/analyze', {
        method: 'POST',
        body: JSON.stringify({ imageUrls: damageImages })
      })
      
      if (res.success) {
        setResults(res.data)
        if (res.data.length > 0) {
          setActivePoint(res.data[0])
          setCurrentView(res.data[0].coords.view)
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
      <div className="bg-[var(--bg-card)] border border-primary/20 rounded-2xl p-12 text-center space-y-6">
        <div className="relative w-24 h-24 mx-auto">
          <Loader2 className="w-24 h-24 text-primary animate-spin" />
          <Sparkles className="absolute inset-0 m-auto w-10 h-10 text-amber-400 animate-pulse" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-[var(--text-primary)] font-heading">AI Damage Assessment in Progress</h3>
          <p className="text-[var(--text-muted)] max-w-md mx-auto">
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
            <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <CheckCircle2 className="text-emerald-400" size={18} />
              AI Analysis Complete
            </h3>
            <p className="text-sm text-[var(--text-muted)]">{results.length} issues detected across {damageImages.length} photos.</p>
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
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all border ${currentView === v ? 'bg-primary border-primary text-white' : 'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-muted)] hover:border-primary/30'}`}
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
            <div className="bg-[var(--bg-input)] rounded-xl p-4 border border-[var(--border-default)] space-y-3">
              <h4 className="text-xs font-bold uppercase text-[var(--text-muted)] tracking-wider">Detection Report</h4>
              <div className="space-y-2">
                {results.map((r, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setActivePoint(r)
                      setCurrentView(r.coords.view)
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${activePoint === r ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-[var(--bg-input)] border-[var(--border-default)] text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)]'}`}
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
            <h4 className="text-xs font-bold uppercase text-[var(--text-muted)] tracking-wider">Visual Evidence</h4>
            {activePoint ? (
              <div className="space-y-4">
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-[var(--border-default)] group">
                  {/* `imageUrl` is declared optional on DamagePoint — passing
                      `undefined`/empty string to next/image throws synchronously
                      ("Image is missing required src property"), which crashes
                      the whole listing page (no error boundary around this tree).
                      Guard it and fall back to a neutral placeholder instead. */}
                  {activePoint.imageUrl ? (
                    <Image
                      src={activePoint.imageUrl}
                      alt="Damage evidence"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-input)]">
                      <Camera className="text-gray-700" size={32} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-all" />
                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-[var(--border-default)] px-3 py-1.5 rounded-lg text-[10px] font-bold text-white uppercase tracking-widest">
                    Source Photo
                  </div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl space-y-1">
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">AI Assessment</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Detected a <span className="text-[var(--text-primary)] font-bold">{activePoint.size.toLowerCase()} {activePoint.type.toLowerCase()}</span> on the <span className="text-[var(--text-primary)] font-bold">{activePoint.part.toLowerCase()}</span>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="aspect-[4/3] rounded-2xl border-2 border-dashed border-[var(--border-default)] flex flex-col items-center justify-center text-[var(--text-secondary)]">
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
    <div className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded-2xl p-8 text-center space-y-6">
      <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-2">
        <Sparkles className="text-primary w-8 h-8" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-[var(--text-primary)] font-heading">AI Damage Scanning</h3>
        <p className="text-[var(--text-muted)] max-w-md mx-auto text-sm">
          Run our automated visual inspection tool to identify bodywork issues, plot them on a map, and categorize severity automatically.
        </p>
      </div>
      <button
        onClick={runAnalysis}
        disabled={damageImages.length === 0}
        className={`px-8 py-3 rounded-xl font-bold transition-all shadow-xl flex items-center gap-2 mx-auto ${damageImages.length > 0 ? 'bg-primary hover:bg-red-600 text-white shadow-primary/20 hover:scale-105' : 'bg-[var(--bg-input)] text-[var(--text-muted)] cursor-not-allowed opacity-50'}`}
      >
        <Search size={18} />
        {damageImages.length === 0 ? 'Upload Photos First' : `Scan ${damageImages.length} Photos`}
      </button>
      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">Powered by YOLOv8 Computer Vision</p>
    </div>
  )
}
