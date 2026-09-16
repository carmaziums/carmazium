"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const brandActionClasses =
    "bg-gradient-to-r from-primary to-[#d9161d] text-white hover:from-[#ff4d4d] hover:to-primary shadow-lg shadow-primary/20 border border-transparent"

const buttonVariants = cva(
    "inline-flex cursor-pointer items-center justify-center whitespace-nowrap text-sm font-bold uppercase tracking-wider transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-body)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 hover:-translate-y-0.5 active:translate-y-0 duration-150",
    {
        variants: {
            variant: {
                default: brandActionClasses,
                outline: "border border-primary/35 bg-transparent text-primary hover:bg-primary/10 hover:border-primary/60 shadow-sm",
                dark: "bg-slate-800/90 border border-slate-700 text-white hover:bg-slate-700 hover:border-slate-600 shadow-sm",
                ghost: "border border-transparent hover:bg-primary/10 dark:hover:bg-white/10",
                link: "h-auto border-0 p-0 text-primary normal-case tracking-normal shadow-none underline-offset-4 hover:underline hover:translate-y-0",
            },
            size: {
                default: "h-11 px-6 py-2",
                sm: "h-9 px-4 text-xs",
                lg: "h-14 px-8 text-base",
                icon: "h-11 w-11",
            },
            shape: {
                default: "rounded-xl",
                pill: "rounded-full",
                square: "rounded-lg",
            }
        },
        defaultVariants: {
            variant: "default",
            size: "default",
            shape: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, shape, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"

        return (
            <Comp
                className={cn(buttonVariants({ variant, size, shape, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
