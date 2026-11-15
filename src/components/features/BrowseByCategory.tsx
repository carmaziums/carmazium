"use client"

import Link from "next/link"

/**
 * Each category maps to a sensible combination of search query params.
 * When clicked, the user is taken to /search?...those params.
 */
const CATEGORIES = [
    {
        label: "Small and sporty",
        params: { bodyType: "HATCHBACK", search: "sporty" },
    },
    {
        label: "Eco-friendly",
        params: { fuelTypes: "Electric,Hybrid" },
    },
    {
        label: "Automatic",
        params: { transmissions: "Automatic" },
    },
    {
        label: "Seven-seater",
        params: { minSeats: "7" },
    },
    {
        label: "Affordable 4x4",
        params: { bodyType: "SUV", maxPrice: "20000" },
    },
    {
        label: "Great first cars",
        params: { maxPrice: "8000", maxEngine: "1400" },
    },
    {
        label: "Dog-friendly",
        params: { bodyType: "ESTATE" },
    },
    {
        label: "Fuel-efficient",
        params: { fuelTypes: "Hybrid,Plugin Hybrid" },
    },
] as const

function buildSearchUrl(params: Record<string, string>): string {
    const qs = new URLSearchParams(params).toString()
    return `/search?${qs}`
}

export function BrowseByCategory() {
  return (
    <section className="pb-8" aria-labelledby="home-categories-heading">
      <div className="container mx-auto px-5">
        <h2 id="home-categories-heading" className="mb-5 font-heading text-xl font-bold">Browse by category</h2>
        <div className="flex flex-wrap gap-3">
          {CATEGORIES.map(cat => (
            <Link key={cat.label} href={buildSearchUrl(cat.params)} className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              {cat.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
