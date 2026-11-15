"use client"

import Image from "next/image"
import Link from "next/link"

/**
 * Body types displayed on the homepage.
 * Each links to /search?bodyType=KEY.
 * Actual marketplace photographs illustrate each category without implying availability.
 */
const BODY_TYPES = [
    { key: "COUPE", label: "Coupes", image: "/assets/images/marketplace/coupe.webp" },
    { key: "CONVERTIBLE", label: "Convertibles", image: "/assets/images/marketplace/convertible.webp" },
    { key: "HATCHBACK", label: "Hatchbacks", image: "/assets/images/marketplace/hatchback.webp" },
    { key: "MPV", label: "MPVs", image: "/assets/images/marketplace/mpv.webp" },
    { key: "PICKUP_TRUCK", label: "Pickup Trucks", image: "/assets/images/marketplace/pickup.webp" },
    { key: "SEDAN", label: "Saloons", image: "/assets/images/marketplace/saloon.webp" },
    { key: "SUV", label: "SUVs", image: "/assets/images/marketplace/suv.webp" },
    { key: "ESTATE", label: "Estates", image: "/assets/images/marketplace/estate.webp" },
] as const

export function BrowseByBodyType() {
  return (
    <section className="pb-12 md:pb-16" aria-labelledby="home-body-types-heading">
      <div className="container mx-auto px-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 id="home-body-types-heading" className="font-heading text-xl font-bold">Browse by body type</h2>
          <Link href="/used-car-types" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4">Not sure which body type suits you? Read the buying guide</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {BODY_TYPES.map(body => (
            <Link key={body.key} href={`/search?bodyType=${body.key}`} className="group overflow-hidden rounded-lg border border-[var(--border-default)] bg-white dark:bg-[#1b2538] text-center transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <div className="relative aspect-[16/9] bg-white">
                <Image src={body.image} alt={body.label} fill sizes="(max-width: 639px) 45vw, (max-width: 1279px) 23vw, 150px" className="object-cover" />
              </div>
              <span className="block border-t-2 border-primary px-2 py-3 text-sm font-bold group-hover:text-primary">{body.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
