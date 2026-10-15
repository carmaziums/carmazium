import Script from "next/script"

const SOURCE_PREFERENCES_URL = "https://www.google.com/preferences/source?q=carmazium.com"

/**
 * Google's official Preferred Sources control. Intended for editorial/blog
 * pages, not transactional car listings. The fallback link is useful when
 * the publisher script is blocked or the interactive control is unavailable.
 */
export function GooglePreferredSourceButton() {
    return (
        <aside
            aria-label="Follow CarMazium on Google"
            className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/[0.07] via-[var(--bg-card)] to-[var(--bg-card)] p-5 md:p-6"
        >
            <Script
                src="https://news.google.com/swg/js/v1/publisher.js"
                strategy="afterInteractive"
            />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-xl">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-primary">
                        Follow our automotive insights
                    </p>
                    <h2 className="mt-1 text-lg font-black font-heading text-[var(--text-primary)]">
                        Add CarMazium to your Google Preferred Sources
                    </h2>
                    <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                        Choose CarMazium to see more of our relevant articles in Google's Top Stories, when eligible.
                    </p>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2">
                    <div google-add-preferred-source-btn="" data-theme="light" />
                    <a
                        href={SOURCE_PREFERENCES_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-primary underline underline-offset-2 hover:opacity-80"
                    >
                        Open Google source preferences
                    </a>
                </div>
            </div>
        </aside>
    )
}
