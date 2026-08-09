"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, ArrowLeft, Newspaper } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { BlogPostForm } from "../BlogPostForm"

export default function NewBlogPostPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const router = useRouter()

    React.useEffect(() => {
        if (!authLoading) {
            if (!user) { router.replace('/auth/login'); return }
            if (profile?.role !== 'ADMIN') { router.replace('/dashboard'); return }
        }
    }, [user, profile, authLoading, router])

    if (authLoading || (user && !profile)) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    }
    if (!user || profile?.role !== 'ADMIN') return null

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "Admin")

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="admin" userName={userName} userType="Super Admin" />
                <main className="flex-1 space-y-6 min-w-0">
                    <div>
                        <Link href="/dashboard/admin/blog" className="inline-flex items-center text-[var(--text-muted)] hover:text-primary dark:hover:text-white mb-2 text-sm transition-colors">
                            <ArrowLeft size={16} className="mr-1" /> Back to Blog
                        </Link>
                        <h1 className="text-3xl font-black font-heading uppercase tracking-tight flex items-center gap-3">
                            <Newspaper className="text-blue-400 hidden sm:block" size={28} />
                            New Post
                        </h1>
                    </div>
                    <BlogPostForm />
                </main>
            </div>
        </div>
    )
}
