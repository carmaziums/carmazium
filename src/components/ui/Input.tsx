import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> { }

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                onWheel={(e) => {
                    if (type === 'number') {
                        e.currentTarget.blur();
                    }
                }}
                className={cn(
                    "flex h-12 w-full border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 text-white font-sans transition-all duration-300 hover:bg-white/10 focus:bg-slate-900/80 focus:border-primary/50 shadow-inner rounded-xl",
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Input.displayName = "Input"

export { Input }
