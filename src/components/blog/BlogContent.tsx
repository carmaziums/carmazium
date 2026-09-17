import { Children, isValidElement, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import Link from "next/link"

function textFromChildren(children: ReactNode): string {
    return Children.toArray(children).map((child) => {
        if (typeof child === "string" || typeof child === "number") return String(child)
        if (isValidElement<{ children?: ReactNode }>(child)) return textFromChildren(child.props.children)
        return ""
    }).join("")
}

export function blogHeadingId(value: string): string {
    return value
        .toLowerCase()
        .replace(/[`*_~]/g, "")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
}

function headingId(children: ReactNode): string {
    return blogHeadingId(textFromChildren(children))
}

const LEGACY_HEADING_SMALL_WORDS = new Set([
    "a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "nor", "of", "on", "or", "per", "the", "to", "vs", "with",
])

const LEGACY_HEADING_EXACT = new Set([
    "Final Thoughts",
    "Frequently Asked Questions",
    "Key Takeaways",
    "The Bottom Line",
])

/**
 * Older CarMazium articles were stored as plain text with section titles on
 * their own paragraph instead of Markdown headings. Keep the heuristic
 * deliberately conservative so normal prose and rhetorical questions remain
 * paragraphs while obvious title-case section labels become semantic H2s.
 */
function looksLikeLegacyHeading(children: ReactNode): boolean {
    const text = textFromChildren(children).trim()
    if (!text || text.includes("\n")) return false
    if (LEGACY_HEADING_EXACT.has(text)) return true
    if (text.length < 8 || text.length > 110) return false
    if (/[.!:;]$/.test(text)) return false
    if (/[£=→\t|]/.test(text)) return false
    if (/^(?:---|#{1,6}\s|[-*+]\s|https?:\/\/)/i.test(text)) return false
    if (/^(?:Car [A-Z0-9]|Vehicle [A-Z0-9]|EV [A-Z0-9]|Cat [SN] Car [A-Z0-9])(?:$|\s)/.test(text)) return false

    const words = text.split(/\s+/).filter(Boolean)
    if (words.length < 3 || words.length > 15) return false

    return words.every((word) => {
        const cleaned = word
            .replace(/^[“"'([]+/, "")
            .replace(/[?,”"')\]]+$/, "")
        if (!cleaned) return true
        if (LEGACY_HEADING_SMALL_WORDS.has(cleaned.toLowerCase())) return true
        return /^[A-Z0-9]/.test(cleaned)
    })
}

const h2Class = "scroll-mt-28 text-2xl md:text-3xl font-black font-heading mt-12 mb-5 text-[var(--text-primary)] leading-tight"
const h3Class = "scroll-mt-28 text-xl md:text-2xl font-bold font-heading mt-9 mb-4 text-[var(--text-primary)] leading-tight"

export function BlogContent({ content }: { content: string }) {
    return (
        <div className="text-[17px] md:text-[18px] text-[var(--text-secondary)] leading-8 [&>*:first-child]:mt-0">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ children, node: _node, ...props }) => (
                        <h2 id={headingId(children)} className={h2Class} {...props}>{children}</h2>
                    ),
                    h2: ({ children, node: _node, ...props }) => (
                        <h2 id={headingId(children)} className={h2Class} {...props}>{children}</h2>
                    ),
                    h3: ({ children, node: _node, ...props }) => (
                        <h3 id={headingId(children)} className={h3Class} {...props}>{children}</h3>
                    ),
                    p: ({ children, node: _node, ...props }) => {
                        if (looksLikeLegacyHeading(children)) {
                            return <h2 id={headingId(children)} className={h2Class} {...props}>{children}</h2>
                        }
                        return <p className="mb-6" {...props}>{children}</p>
                    },
                    a: ({ href, children, node: _node, ...props }) => {
                        const target = href || "#"
                        const external = /^https?:\/\//i.test(target)
                        if (external) {
                            return <a href={target} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold underline decoration-primary/30 underline-offset-4 hover:decoration-primary transition-colors" {...props}>{children}</a>
                        }
                        return <Link href={target} className="text-primary font-semibold underline decoration-primary/30 underline-offset-4 hover:decoration-primary transition-colors" {...props}>{children}</Link>
                    },
                    ul: ({ node: _node, ...props }) => <ul className="list-disc pl-6 mb-7 space-y-2.5 marker:text-primary" {...props} />,
                    ol: ({ node: _node, ...props }) => <ol className="list-decimal pl-6 mb-7 space-y-2.5 marker:text-primary" {...props} />,
                    li: ({ node: _node, ...props }) => <li className="pl-1" {...props} />,
                    blockquote: ({ node: _node, ...props }) => (
                        <blockquote className="border-l-4 border-primary bg-primary/[0.06] px-5 md:px-6 py-5 rounded-r-2xl my-8 text-[var(--text-primary)] font-medium" {...props} />
                    ),
                    code: ({ node: _node, ...props }) => <code className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded px-1.5 py-0.5 text-[0.9em] font-mono text-primary" {...props} />,
                    pre: ({ node: _node, ...props }) => <pre className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded-2xl p-5 overflow-x-auto mb-8 text-sm leading-6" {...props} />,
                    strong: ({ node: _node, ...props }) => <strong className="font-bold text-[var(--text-primary)]" {...props} />,
                    hr: ({ node: _node }) => <hr className="border-[var(--border-default)] my-12" />,
                    table: ({ node: _node, ...props }) => <table className="block w-full overflow-x-auto border-collapse text-sm my-8 rounded-xl border border-[var(--border-default)]" {...props} />,
                    thead: ({ node: _node, ...props }) => <thead className="bg-[var(--bg-input)] text-[var(--text-primary)]" {...props} />,
                    th: ({ node: _node, ...props }) => <th className="border-b border-r last:border-r-0 border-[var(--border-default)] px-4 py-3 text-left font-bold whitespace-nowrap" {...props} />,
                    td: ({ node: _node, ...props }) => <td className="border-b border-r last:border-r-0 border-[var(--border-default)] px-4 py-3 align-top" {...props} />,
                    img: ({ src, alt, node: _node }) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={typeof src === "string" ? src : undefined} alt={alt || "Article illustration"} loading="lazy" className="rounded-2xl my-9 w-full border border-[var(--border-default)] shadow-xl shadow-black/10" />
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}
