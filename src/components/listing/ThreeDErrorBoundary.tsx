"use client"

import * as React from "react"

interface ThreeDErrorBoundaryProps {
  children: React.ReactNode
  fallback: React.ReactNode
}

interface ThreeDErrorBoundaryState {
  hasError: boolean
}

/**
 * Error boundary for 3D / WebGL-based viewers (e.g. ThreeDVehicleViewer).
 *
 * WebGL support is NOT guaranteed on every device. In-app browsers
 * (Instagram/Facebook/TikTok webviews), iOS Safari in Low Power Mode,
 * older Android devices, or browsers with hardware acceleration disabled
 * all cause `@react-three/fiber` / `three` to throw SYNCHRONOUSLY while
 * creating the WebGLRenderer during mount — e.g.
 * "THREE.WebGLRenderer: Error creating WebGL context."
 *
 * Next.js installs no error boundaries by default, so without this one
 * that throw escapes the whole component tree and crashes the *entire*
 * page with the generic "Application error: a client-side exception has
 * occurred" overlay — wiping out the rest of the page (forms, listings,
 * everything) along with it.
 *
 * Catching it here lets the rest of the page keep working — the user can
 * still complete their task (e.g. mark damage from the zone list, or read
 * the seller's damage report) without the 3D preview.
 *
 * NOTE: This file intentionally contains NO `three`/`@react-three/*`
 * imports so it can be statically imported (it must not pull the heavy
 * client-only 3D bundle into the parent's module graph — that bundle is
 * loaded separately via `next/dynamic(..., { ssr: false })`).
 */
export class ThreeDErrorBoundary extends React.Component<ThreeDErrorBoundaryProps, ThreeDErrorBoundaryState> {
  constructor(props: ThreeDErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error("3D viewer failed to render (likely missing/blocked WebGL support):", error)
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}
