"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Newspaper, Loader2, ArrowLeft, Plus, Pencil, Trash2, ExternalLink } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { getAdminBlogPosts, deleteBlogPost, type BlogPost } from "@/lib/blogApi"

const STATUS_STYLES: Record<string, string> = {
    DRAFT: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    PUBLISHED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
}

export default function AdminBlogListPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [posts, setPosts] = React.useState<BlogPost[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [deletingId, setDeletingId] = React.useState<string | null>(null)
    const [page, setPage] = React.useState(1)
    const [total, setTotal] = React.useState(0)
    const limit = 20

    React.useEffect(() => {
        if (!authLoading) {
            if (!user) { router.replace('/auth/login'); return }
            if (profile?.role !== 'ADMIN') { router.replace('/dashboard'); return }
        }
    }, [user, profile, authLoading, router])

    const fetchPosts = React.useCallback(() => {
        if (profile?.role !== 'ADMIN') return
        setLoading(true)
        setError(null)
        getAdminBlogPosts(page, limit)
            .then(r => { setPosts(r.data || []); setTotal(r.pagination?.total || 0) })
            .catch(err => setError(err.message || 'Failed to load blog posts'))
            .finally(() => setLoading(false))
    }, [profile, page])

    React.useEffect(() => { fetchPosts() }, [fetchPosts])

    const handleDelete = async (post: BlogPost) => {
        if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return
        setDeletingId(post.id)
        try {
            await deleteBlogPost(post.id)
            setPosts(prev => prev.filter(p => p.id !== post.id))
            setTotal(t => t - 1)
        } catch (err: any) {
            alert(err.message || 'Failed to delete post')
        } finally {
            setDeletingId(null)
        }
    }

    if (authLoading || (user && !profile) || (loading && posts.length === 0)) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    }
    if (!user || profile?.role !== 'ADMIN') return null

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "Admin")

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />

                <main className="flex-1 space-y-8 min-w-0">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--bg-input)] p-6 rounded-2xl border border-[var(--border-default)] backdrop-blur-md">
                        <div>
                            <Link href="/dashboard/admin" className="inline-flex items-center text-[var(--text-muted)] hover:text-primary dark:hover:text-white mb-2 text-sm transition-colors">
                                <ArrowLeft size={16} className="mr-1" /> Back to Overview
                            </Link>
                            <h1 className="text-3xl font-black font-heading uppercase tracking-tight flex items-center gap-3">
                                <Newspaper className="text-blue-400 hidden sm:block" size={28} />
                                Blog
                            </h1>
                            <p className="text-[var(--text-muted)] text-sm mt-1">{total} total posts</p>
                        </div>
                        <Link
                            href="/dashboard/admin/blog/new"
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors shrink-0"
                        >
                            <Plus size={16} /> New Post
                        </Link>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">
                            <strong>Error:</strong> {error}
                        </div>
                    )}

                    <div className="glass-card overflow-hidden border border-[var(--border-default)] bg-[var(--bg-card)] rounded-2xl">
                        {posts.length === 0 ? (
                            <div className="p-12 text-center">
                                <Newspaper className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-4" />
                                <p className="text-sm text-[var(--text-muted)] mb-4">No blog posts yet.</p>
                                <Link href="/dashboard/admin/blog/new" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors">
                                    <Plus size={16} /> Write your first post
                                </Link>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-[var(--bg-input)] text-[var(--text-muted)] text-xs uppercase font-black tracking-widest border-b border-[var(--border-default)]">
                                        <tr>
                                            <th className="px-6 py-4">Title</th>
                                            <th className="px-6 py-4 text-center">Status</th>
                                            <th className="px-6 py-4">Author</th>
                                            <th className="px-6 py-4 text-right">Updated</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-default)]/80">
                                        {posts.map((post) => (
                                            <tr key={post.id} className="hover:bg-[var(--bg-card)] transition-colors">
                                                <td className="px-6 py-4">
                                                    <p className="font-bold text-sm max-w-[280px] truncate">{post.title}</p>
                                                    <p className="text-xs text-[var(--text-muted)] truncate max-w-[280px]">/blog/{post.slug}</p>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex px-2 py-1 rounded border text-xs font-bold ${STATUS_STYLES[post.status]}`}>
                                                        {post.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-xs text-[var(--text-muted)]">{post.authorName}</td>
                                                <td className="px-6 py-4 text-right text-xs text-[var(--text-muted)]">
                                                    {new Date(post.updatedAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {post.status === 'PUBLISHED' && (
                                                            <Link href={`/blog/${post.slug}`} target="_blank" className="p-2 hover:bg-white/10 rounded-lg transition-colors text-blue-400" title="View live">
                                                                <ExternalLink size={16} />
                                                            </Link>
                                                        )}
                                                        <Link href={`/dashboard/admin/blog/${post.id}/edit`} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-[var(--text-muted)] hover:text-primary dark:hover:text-white" title="Edit">
                                                            <Pencil size={16} />
                                                        </Link>
                                                        <button
                                                            onClick={() => handleDelete(post)}
                                                            disabled={deletingId === post.id}
                                                            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400 disabled:opacity-30"
                                                            title="Delete"
                                                        >
                                                            {deletingId === post.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="p-4 border-t border-[var(--border-default)] bg-[var(--bg-input)] flex items-center justify-between text-xs font-medium text-[var(--text-muted)]">
                            <span>Showing {posts.length === 0 ? 0 : (page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
                            <div className="flex items-center gap-2">
                                <button className="px-3 py-1 bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] rounded disabled:opacity-40 transition-colors" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
                                <span className="text-[var(--text-secondary)]">pg {page} / {Math.max(1, Math.ceil(total / limit))}</span>
                                <button className="px-3 py-1 bg-[var(--bg-input)] hover:bg-[var(--bg-card-hover)] rounded disabled:opacity-40 transition-colors" onClick={() => setPage(p => p + 1)} disabled={page * limit >= total}>Next</button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
