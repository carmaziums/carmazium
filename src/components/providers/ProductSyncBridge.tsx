"use client"

import * as React from "react"
import { io } from "socket.io-client"
import { getWebSocketUrl } from "@/lib/chatApi"
import { PRODUCT_SYNC_EVENT, type ProductSyncEvent } from "@/lib/productSync"

export function ProductSyncBridge() {
  React.useEffect(() => {
    const socket = io(`${getWebSocketUrl()}/sync`, {
      transports: ["websocket", "polling"],
      reconnection: true,
      withCredentials: true,
    })

    const handleChange = (event: ProductSyncEvent) => {
      window.dispatchEvent(new CustomEvent(PRODUCT_SYNC_EVENT, { detail: event }))
    }

    socket.on("product:changed", handleChange)
    return () => {
      socket.off("product:changed", handleChange)
      socket.disconnect()
    }
  }, [])

  return null
}
