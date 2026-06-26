"use client"

import * as React from "react"
import { Upload, X, CheckCircle, Loader2, AlertTriangle, FileSpreadsheet, ArrowRight, Car, Settings2, Download } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { dvlaLookup } from "@/lib/dvlaApi"
import { createListing, type CreateListingRequest, type BodyTypeValue, type VehicleTypeValue, type EuroStandardValue } from "@/lib/listingApi"

interface BulkImportModalProps {
    isOpen: boolean
    onClose: () => void
    onComplete: () => void
}

interface CsvRow {
    vrm: string
    price: string
    mileage: string
    images: string[]
}

type ImportStatus = "idle" | "parsing" | "importing" | "complete"

export function BulkImportModal({ isOpen, onClose, onComplete }: BulkImportModalProps) {
    const [status, setStatus] = React.useState<ImportStatus>("idle")
    const [progress, setProgress] = React.useState({ current: 0, total: 0 })
    const [errorRows, setErrorRows] = React.useState<{ vrm: string; error: string }[]>([])
    const [importedCount, setImportedCount] = React.useState(0)
    
    // File input ref
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    // Reset state when closed
    React.useEffect(() => {
        if (!isOpen) {
            setTimeout(() => {
                setStatus("idle")
                setProgress({ current: 0, total: 0 })
                setErrorRows([])
                setImportedCount(0)
            }, 300)
        }
    }, [isOpen])

    if (!isOpen) return null

    // RFC-4180 compliant CSV line parser — handles quoted fields with embedded commas
    const parseCsvLine = (line: string): string[] => {
        const result: string[] = []
        let current = ''
        let inQuotes = false
        for (let i = 0; i < line.length; i++) {
            const char = line[i]
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"'
                    i++ // skip escaped quote
                } else {
                    inQuotes = !inQuotes
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim())
                current = ''
            } else {
                current += char
            }
        }
        result.push(current.trim())
        return result
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setStatus("parsing")
        const reader = new FileReader()
        
        reader.onload = async (event) => {
            const text = event.target?.result as string
            if (!text) {
                setStatus("idle")
                return
            }
            
            // Basic CSV parser
            const lines = text.split('\n').map(l => l.trim()).filter(l => l)
            if (lines.length < 2) {
                alert("File seems empty or missing required headers.")
                setStatus("idle")
                return
            }

            // Expecting headers: vrm, price, mileage
            const headers = parseCsvLine(lines[0].toLowerCase())
            const vrmIdx = headers.findIndex(h => h.includes('vrm') || h.includes('reg'))
            const priceIdx = headers.findIndex(h => h.includes('price'))
            const mileageIdx = headers.findIndex(h => h.includes('mil'))
            const imageIdx = headers.findIndex(h => h.includes('image') || h.includes('url'))

            if (vrmIdx === -1) {
                alert("Could not find a 'vrm' or 'registration' column in the CSV.")
                setStatus("idle")
                return
            }

            const rows: CsvRow[] = []
            for (let i = 1; i < lines.length; i++) {
                const cols = parseCsvLine(lines[i])
                const vrm = cols[vrmIdx]?.replace(/\s/g, '').toUpperCase()
                if (vrm) {
                    const imagesStr = imageIdx !== -1 && cols[imageIdx] ? cols[imageIdx].trim() : ""
                    const images = imagesStr ? imagesStr.split('|').map(u => u.trim()).filter(u => u) : []
                    rows.push({
                        vrm,
                        price: priceIdx !== -1 && cols[priceIdx] ? cols[priceIdx].trim() : "0",
                        mileage: mileageIdx !== -1 && cols[mileageIdx] ? cols[mileageIdx].trim() : "0",
                        images
                    })
                }
            }

            if (rows.length === 0) {
                alert("No valid rows found to import.")
                setStatus("idle")
                return
            }

            // Start importing
            setStatus("importing")
            setProgress({ current: 0, total: rows.length })
            await processImports(rows)
        }

        reader.readAsText(file)
    }

    const processImports = async (rows: CsvRow[]) => {
        let successCount = 0
        const errors: { vrm: string; error: string }[] = []

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i]
            try {
                // 1. Fetch exact specifications from DVLA seamlessly
                const dvlaData = await dvlaLookup(row.vrm)
                
                // 2. Infer basic compliances internally to relax the dealer workflow
                let ulez = false
                const ft = (dvlaData.fuelType || "").toUpperCase()
                const es = (dvlaData.euroStandard || "").toUpperCase()
                if (ft === "ELECTRIC" || ft === "PLUGIN_HYBRID" || es.includes("EURO_6") || es === "EURO_6D" || (ft === "PETROL" && es === "EURO_4")) {
                    ulez = true
                }

                // Strip thousands-separator commas before parsing (e.g. "8,995" → 8995)
                const priceNum = parseFloat(row.price.replace(/,/g, '')) || 0
                const mileageNum = parseInt(row.mileage.replace(/,/g, ''), 10) || 0

                // 3. Assemble dynamic payload mapping the automated spec points
                const payload: CreateListingRequest = {
                    title: `${dvlaData.make} ${dvlaData.model} ${dvlaData.year || ''}`.trim(),
                    price: priceNum,
                    mileage: mileageNum,
                    year: dvlaData.year || new Date().getFullYear(),
                    vrm: row.vrm,
                    listingType: "CLASSIFIED",
                    status: "DRAFT", // Automatically drops into Draft queue for photo uploads later!
                    badgeTier: "BASIC",
                    vehicleType: "CAR", // default assumptions
                    images: row.images.length > 0 ? row.images : [],
                    
                    // DVLA Spec Map
                    make: dvlaData.make || undefined,
                    model: dvlaData.model || undefined,
                    fuelType: dvlaData.fuelType as any,
                    color: dvlaData.colour || undefined,
                    engineSize: dvlaData.engineSize || undefined,
                    co2Emissions: dvlaData.co2Emissions || undefined,
                    motStatus: dvlaData.motStatus || undefined,
                    taxStatus: dvlaData.taxStatus || undefined,
                    motExpiryDate: dvlaData.motExpiryDate || undefined,
                    taxDueDate: dvlaData.taxDueDate || undefined,
                    monthOfFirstRegistration: dvlaData.monthOfFirstRegistration || undefined,
                    wheelplan: dvlaData.wheelplan || undefined,
                    typeApproval: dvlaData.typeApproval || undefined,
                    ulezCompliant: ulez,
                    euroStandard: dvlaData.euroStandard as any,
                }

                // 4. Fire to server
                await createListing(payload)
                successCount++

            } catch (err: any) {
                errors.push({ vrm: row.vrm, error: err.message || "Failed to import." })
            }

            setProgress({ current: i + 1, total: rows.length })
        }

        setImportedCount(successCount)
        setErrorRows(errors)
        setStatus("complete")
    }

    const downloadCsvTemplate = () => {
        const csvContent = "data:text/csv;charset=utf-8,vrm,price,mileage,image_urls\nAB12CDE,10500,45000,https://example.com/car1-front.jpg|https://example.com/car1-rear.jpg\nXY34ZKL,22000,12000,"
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", "carmazium_import_template.csv")
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0A0A0C] border border-white/10 rounded-2xl w-full max-w-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/30">
                            <FileSpreadsheet size={20} className="text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold font-heading text-white tracking-tight">Bulk Inventory Import</h2>
                            <p className="text-xs text-gray-400 tracking-wide mt-0.5">Automate your stock sync via CSV</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        disabled={status === "importing"}
                        className="text-gray-500 hover:text-white transition-colors disabled:opacity-50"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto">
                    
                    {/* IDLE / PARSING STATE */}
                    {(status === "idle" || status === "parsing") && (
                        <div className="space-y-6">
                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex gap-3 text-sm text-blue-200/80 leading-relaxed">
                                <Settings2 size={18} className="text-blue-400 shrink-0 mt-0.5" />
                                <p>
                                    Instantly generate <strong className="text-white">Draft Listings</strong> using just the vehicle registration (VRM). Our engine systematically pulls all deep technical specifications from the DVLA, leaving you to only upload images and publish.
                                </p>
                            </div>

                            <div 
                                className="border-2 border-dashed border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center text-center hover:border-primary/50 hover:bg-white/[0.02] transition-colors cursor-pointer group"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input 
                                    type="file" 
                                    accept=".csv" 
                                    className="hidden" 
                                    ref={fileInputRef} 
                                    onChange={handleFileUpload}
                                />
                                
                                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-xl border border-white/5">
                                    {status === "parsing" ? (
                                        <Loader2 size={28} className="text-primary animate-spin" />
                                    ) : (
                                        <Upload size={28} className="text-gray-400 group-hover:text-primary transition-colors" />
                                    )}
                                </div>
                                <h3 className="text-lg font-bold text-white mb-1">Click to Upload CSV Document</h3>
                                <p className="text-sm text-gray-500 mb-6 max-w-sm">Spreadsheets must contain columns for VRM, price, and mileage. You can also include 'image_urls' separated by a pipe (|).</p>
                                
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="border-white/10 text-gray-400 hover:text-white gap-2 bg-black"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        downloadCsvTemplate()
                                    }}
                                >
                                    <Download size={14} /> Download Template
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* IMPORTING STATE */}
                    {status === "importing" && (
                        <div className="flex flex-col items-center justify-center py-10">
                            <div className="w-24 h-24 relative mb-8">
                                <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
                                <div 
                                    className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin" 
                                />
                                <div className="absolute inset-0 flex items-center justify-center text-primary font-bold text-xl">
                                    {Math.round((progress.current / progress.total) * 100)}%
                                </div>
                            </div>
                            
                            <h3 className="text-xl font-bold text-white mb-2 tracking-tight">Syncing Inventory...</h3>
                            <p className="text-sm text-gray-400 mb-6 text-center">
                                Processing {progress.current} of {progress.total} vehicles<br/>
                                <span className="text-xs uppercase tracking-widest text-emerald-500/70">Connecting to UK DVLA</span>
                            </p>
                            
                            <div className="w-full max-w-sm bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div 
                                    className="bg-gradient-to-r from-red-600 to-red-400 h-full shadow-neon transition-all duration-300"
                                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* COMPLETE STATE */}
                    {status === "complete" && (
                        <div className="space-y-6">
                            <div className="flex flex-col items-center text-center">
                                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                                    <CheckCircle size={36} className="text-emerald-400" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">Import Finished</h3>
                                <p className="text-gray-400 text-sm">
                                    Successfully created <strong className="text-white">{importedCount} draft listings</strong>.
                                </p>
                            </div>

                            {/* Show Errors if any */}
                            {errorRows.length > 0 && (
                                <div className="mt-8">
                                    <div className="flex items-center gap-2 mb-3 text-amber-500 text-sm font-bold">
                                        <AlertTriangle size={16} />
                                        {errorRows.length} vehicles failed to import
                                    </div>
                                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-amber-500/10 text-amber-500/80">
                                                <tr>
                                                    <th className="px-3 py-2 font-semibold">VRM</th>
                                                    <th className="px-3 py-2 font-semibold">Reason</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-amber-500/10 text-gray-300">
                                                {errorRows.map((err, i) => (
                                                    <tr key={i}>
                                                        <td className="px-3 py-2 font-mono">{err.vrm}</td>
                                                        <td className="px-3 py-2">{err.error}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <Button 
                                className="w-full h-14 text-lg font-bold shadow-neon mt-4" 
                                onClick={() => {
                                    onComplete()
                                    onClose()
                                }}
                            >
                                View Draft Listings <ArrowRight size={18} className="ml-2" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
