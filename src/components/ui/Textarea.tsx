import * as React from "react"

export interface TextareaProps
    extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { }

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className = "", ...props }, ref) => {
        return (
            <textarea
                className={`flex min-h-[80px] w-full rounded-md border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
                ref={ref}
                {...props}
            />
        )
    }
)
Textarea.displayName = "Textarea"

export { Textarea }
