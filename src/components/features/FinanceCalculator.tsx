"use client"

import * as React from "react"
import { Calculator, HelpCircle, Minus, Plus } from "lucide-react"

interface FinanceCalculatorProps {
    vehiclePrice: number
}

export function FinanceCalculator({ vehiclePrice }: FinanceCalculatorProps) {
    const [deposit, setDeposit] = React.useState(vehiclePrice * 0.1)
    const [term, setTerm] = React.useState(48)
    const [apr, setApr] = React.useState(19)

    const MIN_APR = 9
    const MAX_APR = 49

    const calculateMonthlyPayment = () => {
        const principal = vehiclePrice - deposit
        const monthlyRate = apr / 100 / 12
        if (monthlyRate === 0) return principal / term

        const x = Math.pow(1 + monthlyRate, term)
        const monthly = (principal * x * monthlyRate) / (x - 1)
        return monthly
    }

    const monthlyPayment = calculateMonthlyPayment()

    const aprPercent = ((apr - MIN_APR) / (MAX_APR - MIN_APR)) * 100

    return (
        <div className="bg-slate-800/50 backdrop-blur-md border border-white/10 rounded-xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-400">
                    <Calculator size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white">Finance Calculator</h3>
                    <p className="text-xs text-gray-400">Estimate your monthly payments</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Inputs */}
                <div className="space-y-6">
                    {/* Deposit */}
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <label className="text-gray-300 font-medium">Deposit Amount</label>
                            <span className="text-white font-bold">£{deposit.toLocaleString()}</span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={vehiclePrice * 0.5}
                            step={500}
                            value={deposit}
                            onChange={(e) => setDeposit(Number(e.target.value))}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>£0</span>
                            <span>£{(vehiclePrice * 0.5).toLocaleString()} (50%)</span>
                        </div>
                    </div>

                    {/* Term */}
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <label className="text-gray-300 font-medium">Finance Term</label>
                            <span className="text-white font-bold">{term} Months</span>
                        </div>
                        <div className="flex gap-2">
                            {[12, 24, 36, 48, 60].map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setTerm(m)}
                                    className={`flex-1 py-2 text-xs font-bold rounded border transition-all ${term === m ? 'bg-primary border-primary text-white' : 'border-white/10 text-gray-400 hover:bg-white/5'}`}
                                >
                                    {m}m
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* APR Slider */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <label className="text-gray-300 font-medium flex items-center gap-1.5">
                                <HelpCircle size={13} className="text-gray-500" />
                                Representative APR
                            </label>
                            <span className="text-white font-bold">{apr}% fixed</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setApr(a => Math.max(MIN_APR, a - 1))}
                                className="w-8 h-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors shrink-0"
                                aria-label="Decrease APR"
                            >
                                <Minus size={14} />
                            </button>
                            <div className="relative flex-1">
                                <input
                                    type="range"
                                    min={MIN_APR}
                                    max={MAX_APR}
                                    step={1}
                                    value={apr}
                                    onChange={(e) => setApr(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                                <div
                                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary pointer-events-none"
                                    style={{ left: `calc(${aprPercent}% - ${aprPercent * 0.12}px)` }}
                                />
                            </div>
                            <button
                                onClick={() => setApr(a => Math.min(MAX_APR, a + 1))}
                                className="w-8 h-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors shrink-0"
                                aria-label="Increase APR"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>{MIN_APR}%</span>
                            <span>{MAX_APR}%</span>
                        </div>
                    </div>
                </div>

                {/* Result */}
                <div className="flex flex-col justify-center items-center bg-slate-900/50 rounded-xl p-6 border border-white/5 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-primary"></div>

                    <p className="text-gray-400 text-sm mb-1 uppercase tracking-wide">Monthly Payment</p>
                    <div className="text-4xl md:text-5xl font-heading font-bold text-white mb-2">
                        £{Math.round(monthlyPayment).toLocaleString()}
                    </div>
                    <p className="text-emerald-400 text-xs font-bold mb-6">Total Payable: £{Math.round(monthlyPayment * term + deposit).toLocaleString()}</p>

                    <button className="w-full bg-primary hover:bg-primary/90 text-white font-bold rounded-lg py-3 transition-colors">Apply for Finance</button>
                </div>
            </div>

            <p className="text-[10px] text-gray-500 mt-6 text-center">
                *Figures are estimates and do not constitute a formal offer of finance. Rates and acceptance subject to status.
            </p>
        </div>
    )
}
