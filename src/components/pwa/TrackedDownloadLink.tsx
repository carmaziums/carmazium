"use client"

import type { ReactNode } from "react"
import { countAppEvent, type AppInstallPlatform } from "@/lib/appInstallCounter"

/** Download link that counts the tap (anonymously) for the admin app stats. */
export function TrackedDownloadLink({ href, platform, className, ariaLabel, children }: {
  href: string
  platform: AppInstallPlatform
  className?: string
  ariaLabel?: string
  children: ReactNode
}) {
  return (
    <a href={href} download className={className} aria-label={ariaLabel} onClick={() => countAppEvent("app_download_click", platform)}>
      {children}
    </a>
  )
}
