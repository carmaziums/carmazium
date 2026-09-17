import { cva } from "class-variance-authority"

export const buttonVariants = cva(
    "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-body)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 active:translate-y-px",
    {
        variants: {
            variant: {
                default: "border border-primary bg-primary text-white shadow-sm shadow-primary/20 hover:border-[#c9151c] hover:bg-[#c9151c]",
                outline: "border border-[var(--border-hover)] bg-transparent text-[var(--text-primary)] hover:border-primary/50 hover:bg-primary/5 hover:text-primary",
                dark: "border border-slate-700 bg-slate-900 text-white shadow-sm hover:border-slate-600 hover:bg-slate-800",
                ghost: "border border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-primary/10 hover:text-primary",
                link: "h-auto border-0 bg-transparent p-0 text-primary underline-offset-4 shadow-none hover:underline",
            },
            size: {
                default: "h-11 px-5",
                sm: "h-9 rounded-lg px-4 text-xs",
                lg: "h-12 px-7 text-base",
                icon: "h-11 w-11 p-0",
            },
            shape: {
                default: "rounded-xl",
                // Keep the legacy prop for call-site compatibility while using
                // one CarMazium action geometry throughout the interface.
                pill: "rounded-xl",
                square: "rounded-lg",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
            shape: "default",
        },
    }
)
