"use client"

import * as React from "react"
import { AlertCircle, Inbox, Loader2, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/Button"

type SharedProps = {
    className?: string
}

export function LoadingState({
    label = "Loading…",
    className = "",
}: SharedProps & { label?: string }) {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            className={`flex min-h-40 flex-col items-center justify-center gap-3 px-6 py-12 text-center ${className}`}
        >
            <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm font-bold text-[var(--text-muted)]">{label}</p>
        </div>
    )
}

export function ErrorState({
    message,
    onRetry,
    retryLabel = "Try again",
    className = "",
}: SharedProps & {
    message: string
    onRetry?: () => void
    retryLabel?: string
}) {
    return (
        <div
            role="alert"
            aria-live="assertive"
            className={`flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 px-6 py-10 text-center ${className}`}
        >
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
                <AlertCircle className="h-6 w-6 text-red-400" aria-hidden="true" />
            </div>
            <div>
                <p className="font-black text-[var(--text-secondary)]">Couldn&apos;t load this information</p>
                <p className="mt-1 max-w-md text-sm text-[var(--text-muted)]">{message}</p>
            </div>
            {onRetry ? (
                <Button type="button" variant="outline" onClick={onRetry} className="mt-1 min-h-11">
                    {retryLabel}
                </Button>
            ) : null}
        </div>
    )
}

export function EmptyState({
    title,
    description,
    icon: Icon = Inbox,
    actionLabel,
    onAction,
    className = "",
}: SharedProps & {
    title: string
    description?: string
    icon?: LucideIcon
    actionLabel?: string
    onAction?: () => void
}) {
    return (
        <div
            role="status"
            aria-live="polite"
            className={`flex min-h-40 flex-col items-center justify-center gap-3 px-6 py-12 text-center ${className}`}
        >
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-card)]">
                <Icon className="h-7 w-7 text-[var(--text-muted)]" aria-hidden="true" />
            </div>
            <div>
                <p className="font-black text-[var(--text-secondary)]">{title}</p>
                {description ? (
                    <p className="mt-1 max-w-md text-sm text-[var(--text-muted)]">{description}</p>
                ) : null}
            </div>
            {actionLabel && onAction ? (
                <Button type="button" onClick={onAction} className="mt-1 min-h-11">
                    {actionLabel}
                </Button>
            ) : null}
        </div>
    )
}
