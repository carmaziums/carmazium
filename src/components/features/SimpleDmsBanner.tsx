import Image from "next/image"

/**
 * Original SimpleDMS artwork supplied and approved by the business.
 * Maintain original proportions; never crop or replace provider artwork.
 */
export function SimpleDmsBanner({ className = "" }: { className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-[#267c83]/50 bg-[#06121e] shadow-xl ${className}`}>
      <Image
        src="/assets/partners/simpledms/SimpleDMS-BuySmart-Desktop-1920x960.png"
        alt="SimpleDMS BuySmart promotion for UK dealers: auction research, vehicle history, and illustrative buying report screenshots"
        width={1920}
        height={960}
        sizes="(max-width: 1024px) 100vw, 1152px"
        className="hidden h-auto w-full sm:block"
      />
      <Image
        src="/assets/partners/simpledms/SimpleDMS-BuySmart-Mobile-1080x1920.png"
        alt="SimpleDMS BuySmart mobile promotion with illustrative buying intelligence and dealer research report"
        width={1080}
        height={1920}
        sizes="100vw"
        className="block h-auto w-full sm:hidden"
      />
    </div>
  )
}
