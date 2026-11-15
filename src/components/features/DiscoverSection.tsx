import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

const CATEGORIES = [
  { title: "Everyday essentials", description: "Explore hatchbacks for everyday life.", href: "/search?bodyType=HATCHBACK", image: "/assets/images/body-hatchback.webp", alt: "Illustrative silver hatchback" },
  { title: "Room for more", description: "Find cars with seven seats or more.", href: "/search?minSeats=7", image: "/assets/images/body-suv.webp", alt: "Illustrative family SUV" },
  { title: "Electric & hybrid", description: "Explore a different way to drive.", href: "/search?fuelTypes=Electric%2CHybrid", image: "/assets/images/body-saloon.webp", alt: "Illustrative saloon car" },
]

export function DiscoverSection() {
  return (
    <section className="py-12 md:py-16" aria-labelledby="home-discover-heading">
      <div className="container mx-auto px-5">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">Discover your perfect car</p>
            <h2 id="home-discover-heading" className="font-heading text-3xl font-bold tracking-tight md:text-4xl">Find a car that fits your life.</h2>
            <p className="mt-3 text-sm text-[var(--text-secondary)]">Explore used cars across the UK from verified sellers.</p>
          </div>
          <Link href="/search" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold underline underline-offset-4">Browse All Cars <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {CATEGORIES.map(category => (
            <Link key={category.title} href={category.href} className="group block overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <div className="relative aspect-[16/9] overflow-hidden bg-white">
                <Image src={category.image} alt={category.alt} fill sizes="(max-width: 639px) 100vw, 33vw" className="object-cover" />
              </div>
              <div className="p-5">
                <h3 className="font-heading text-xl font-bold tracking-tight group-hover:text-primary">{category.title}</h3>
                <p className="mt-2 text-sm text-[var(--text-muted)]">{category.description}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4">Explore cars <ArrowRight size={16} aria-hidden="true" /></span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
