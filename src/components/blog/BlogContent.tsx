import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import Link from "next/link"

export function BlogContent({ content }: { content: string }) {
    return (
        <div className="text-[var(--text-secondary)] leading-relaxed [&>*:first-child]:mt-0">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: (props) => <h2 className="text-2xl font-black font-heading mt-10 mb-4 text-[var(--text-primary)]" {...props} />,
                    h2: (props) => <h2 className="text-2xl font-black font-heading mt-10 mb-4 text-[var(--text-primary)]" {...props} />,
                    h3: (props) => <h3 className="text-xl font-bold font-heading mt-8 mb-3 text-[var(--text-primary)]" {...props} />,
                    p: (props) => <p className="mb-5" {...props} />,
                    a: ({ href, ...props }) => (
                        <Link href={href || "#"} className="text-primary font-semibold hover:underline" {...props} />
                    ),
                    ul: (props) => <ul className="list-disc pl-6 mb-5 space-y-1.5" {...props} />,
                    ol: (props) => <ol className="list-decimal pl-6 mb-5 space-y-1.5" {...props} />,
                    li: (props) => <li className="marker:text-primary" {...props} />,
                    blockquote: (props) => (
                        <blockquote className="border-l-[3px] border-primary bg-[var(--bg-card)] px-5 py-4 rounded-r-xl my-6 text-[var(--text-primary)] italic" {...props} />
                    ),
                    code: (props) => <code className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded px-1.5 py-0.5 text-sm font-mono text-primary" {...props} />,
                    pre: (props) => <pre className="bg-[var(--bg-input)] border border-[var(--border-default)] rounded-xl p-4 overflow-x-auto mb-6 text-sm" {...props} />,
                    strong: (props) => <strong className="font-bold text-[var(--text-primary)]" {...props} />,
                    hr: () => <hr className="border-[var(--border-default)] my-10" />,
                    img: ({ src, alt }) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={typeof src === "string" ? src : undefined} alt={alt || ""} className="rounded-xl my-6 w-full" />
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}
