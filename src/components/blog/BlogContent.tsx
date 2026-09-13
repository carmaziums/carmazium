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

export function BlogContent({ content }: { content: string }) {
    return (
        <div className="text-[17px] md:text-[18px] text-[var(--text-secondary)] leading-8 [&>*:first-child]:mt-0">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ children, ...props }) => (
                        <h2 id={headingId(children)} className="scroll-mt-28 text-2xl md:text-3xl font-black font-heading mt-12 mb-5 text-[var(--text-primary)] leading-tight" {...props}>{children}</h2>
                    ),
                    h2: ({ children, ...props }) => (
                        <h2 id={headingId(children)} className="scroll-mt-28 text-2xl md:text-3xl font-black font-heading mt-12 mb-5 text-[var(--text-primary)] leading-tight" {...props}>{children}</h2>
                    ),
                    h3: ({ children, ...props }) => (
                        <h3 id={headingId(children)} className="scroll-mt-28 text-xl md:text-2xl font-bold font-heading mt-9 mb-4 text-[var(--text-primary)] leading-tight" {...props}>{children}</h3>
                    ),
                    p: (props) => <p className="mb-6" {...props} />,
                    a: ({ href, children, ...props }) => {
                        const target = href || "#"
                        const external = /^https?:\/\//i.test(target)
                        if (external) {
                            return <a href={target} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold underline decoration-primary/30 underline-offset-4 hover:decoration-primary transition-colors" {...props}>{children}</a>
                        }
                        return <Link href={target} className="text-primary font-semibold underline decoration-primary/30 underline-offset-4 hover:decoration-primary transition-colors" {...props}>{children}</Link>
                    },
                    ul: (props) => <ul className="list-disc pl-6 mb-7 space-y-2.5 marker:text-primary" {...props} />,
                    ol: (props) => <ol className="list-decimal pl-6 mb-7 space-y-2.5 marker:text-primary" {...props} />,
                    li: (props) => <li className="pl-1" {...props} />,
                    blockquote: (props) => (
                        <blockquote className="border-l-4 border-primary bg-primary/[0.06] px-5 md:px-6 py-5 rounded-r-2xl my-8 text-[var(--text-primary)] font-medium" {...props} />
                    ),
                    code: (props) => <code className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded px-1.5 py-0.5 text-[0.9em] font-mono text-primary" {...props} />,
                    pre: (props) => <pre className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded-2xl p-5 overflow-x-auto mb-8 text-sm leading-6" {...props} />,
                    strong: (props) => <strong className="font-bold text-[var(--text-primary)]" {...props} />,
                    hr: () => <hr className="border-[var(--border-default)] my-12" />,
                    table: (props) => <table className="block w-full overflow-x-auto border-collapse text-sm my-8 rounded-xl border border-[var(--border-default)]" {...props} />,
                    thead: (props) => <thead className="bg-[var(--bg-input)] text-[var(--text-primary)]" {...props} />,
                    th: (props) => <th className="border-b border-r last:border-r-0 border-[var(--border-default)] px-4 py-3 text-left font-bold whitespace-nowrap" {...props} />,
                    td: (props) => <td className="border-b border-r last:border-r-0 border-[var(--border-default)] px-4 py-3 align-top" {...props} />,
                    img: ({ src, alt }) => (
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
