"use client"

import * as React from "react"

interface ChatErrorBoundaryProps {
    children: React.ReactNode
    fallback: React.ReactNode
}

interface ChatErrorBoundaryState {
    hasError: boolean
}

/**
 * Next.js installs no error boundaries by default, so a synchronous throw
 * anywhere inside the chat panel (e.g. a chat room missing an expected field)
 * escapes the whole component tree and crashes the *entire* page with the
 * generic "Something went wrong" overlay — wiping out vehicle details, seller
 * info, everything, over what's meant to be a self-contained side panel.
 * Same pattern as ThreeDErrorBoundary.
 */
export class ChatErrorBoundary extends React.Component<ChatErrorBoundaryProps, ChatErrorBoundaryState> {
    constructor(props: ChatErrorBoundaryProps) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError() {
        return { hasError: true }
    }

    componentDidCatch(error: unknown) {
        console.error("Chat panel failed to render:", error)
    }

    render() {
        if (this.state.hasError) return this.props.fallback
        return this.props.children
    }
}
