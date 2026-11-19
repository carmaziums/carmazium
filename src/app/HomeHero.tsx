"use client"

import Link from "next/link"
import { ArrowRight, Pause, Play } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import styles from "./homeHero.module.css"

const directory = "/assets/images/home-hero/"
const vehicles = [
  "hatchback", "suv", "flying-car-concept", "campervan", "touring-caravan",
  "panel-van", "box-truck", "motorbike", "pickup", "tesla-inspired-flying-concept",
]
const source = (index: number) => directory + vehicles[index] + ".webp"
const pose = (x: number, opacity: number) => ({ transform: `translateX(${x}%)`, opacity })

export default function HomeHero() {
  const first = useRef<HTMLImageElement>(null)
  const second = useRef<HTMLImageElement>(null)
  const [paused, setPaused] = useState(false)

  const pauseRequested = useRef(false)
  const refresh = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!first.current || !second.current) return
    const images = [first.current, second.current]
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    let onScreen = false
    let generation = 0
    let active = 0
    let index = 0

    function stop() {
      generation++
      for (const image of images) {
        image.getAnimations().forEach(animation => animation.cancel())
        Object.assign(image.style, pose(0, image === images[active] ? 1 : 0))
      }
    }

    async function sync() {
      stop()
      if (!onScreen || document.hidden || pauseRequested.current || reduced.matches) return
      const run = generation
      while (run === generation) {
        const front = images[active]
        const incoming = images[1 - active]
        const next = (index + 1) % vehicles.length
        incoming.style.zIndex = "2"
        front.style.zIndex = "1"
        if (incoming.getAttribute("src") !== source(next)) incoming.src = source(next)
        const move = (img: HTMLImageElement, from: Keyframe, to: Keyframe, duration: number) =>
          img.animate([from, to], { duration, easing: "linear", fill: "forwards" }).finished
        try {
          await Promise.all([incoming.decode(), move(front, pose(0, 1), pose(-2, 1), 1000)])
          if (generation !== run) return
          await Promise.all([
            move(front, pose(-2, 1), pose(-4, 0), 1000),
            move(incoming, pose(4, 0), pose(0, 1), 2000),
          ])
          if (generation !== run) return
          active = 1 - active
          index = next
          // Commit each final pose before releasing finished animations.
          for (const image of images) {
            Object.assign(image.style, pose(0, image === incoming ? 1 : 0))
            image.getAnimations().forEach(animation => animation.cancel())
          }
        } catch {
          if (run === generation) stop()
          return
        }
      }
    }

    refresh.current = sync
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      void sync()
    })
    observer.observe(images[0].parentElement!)
    document.addEventListener("visibilitychange", sync)
    reduced.addEventListener("change", sync)
    return () => {
      refresh.current = null
      observer.disconnect()
      document.removeEventListener("visibilitychange", sync)
      reduced.removeEventListener("change", sync)
      stop()
    }
  }, [])

  return (
    <section className={styles.hero} aria-labelledby="home-marketplace-heading">
      <div className={styles.stage}>
        <div className={styles.copy}>
          <h1 id="home-marketplace-heading">Your car.<br /><span>Your choice.</span></h1>
          <p className={styles.offer}>Auction <span>FREE</span>. Retail for <span>£1</span>.</p>
          <p className={styles.detail}>Advertise for £1 until sold, or choose a free dealer auction.</p>
        </div>
        <div className={styles.scene} aria-hidden="true">
          <div className={styles.lane}>
            {/* Fixed boxes share a tyre line. Only the first URL is sent in the initial HTML. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={first} alt="" src={source(0)} width={548} height={292} fetchPriority="high" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={second} alt="" width={548} height={292} />
          </div>
        </div>
        <div className={styles.actions}>
          <Link href="/sell?sellMode=retail&package=basic#sell-options" className={styles.primary}>List my car for £1</Link>
          <Link href="/sell?sellMode=auction#sell-options" className={styles.secondary}>Sell by auction FREE</Link>
          <Link href="/sell" className={styles.valuation}>Get a valuation <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        <button className={styles.motion} aria-label={paused ? "Play vehicle animation" : "Pause vehicle animation"}
          type="button" onClick={() => {
            pauseRequested.current = !paused
            setPaused(!paused)
            refresh.current?.()
          }}>
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
      </div>
    </section>
  )
}
