from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


# Normal user dashboard: clearer language and quick actions, without touching tab logic.
user_path = Path("src/app/dashboard/user/page.tsx")
user = user_path.read_text(encoding="utf-8-sig")

user = replace_once(
    user,
    '<h2 className="text-2xl font-black font-heading uppercase tracking-tight">Unified Overview</h2>\n                    <p className="text-[var(--text-muted)] text-sm font-medium">Your combined activity as a buyer and seller.</p>',
    '<h2 className="text-2xl font-black font-heading uppercase tracking-tight">My Dashboard</h2>\n                    <p className="text-[var(--text-muted)] text-sm font-medium">Everything you need to buy, sell and manage your cars in one place.</p>',
    "user heading",
)

user = replace_once(
    user,
    '            {/* Stats Cards */}',
    '''            {/* Quick Actions */}\n            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">\n                <Link href="/sell" className="flex items-center gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors">\n                    <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0"><PlusCircle size={18} /></div>\n                    <div className="min-w-0"><p className="font-bold text-sm">Sell a Car</p><p className="text-[11px] text-[var(--text-muted)] truncate">Create a listing</p></div>\n                </Link>\n                <Link href="/search" className="flex items-center gap-3 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-colors">\n                    <div className="w-9 h-9 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0"><Car size={18} /></div>\n                    <div className="min-w-0"><p className="font-bold text-sm">Buy a Car</p><p className="text-[11px] text-[var(--text-muted)] truncate">Browse vehicles</p></div>\n                </Link>\n                <button type="button" onClick={() => setTab('bids')} className="text-left flex items-center gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors">\n                    <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0"><Gavel size={18} /></div>\n                    <div className="min-w-0"><p className="font-bold text-sm">My Offers</p><p className="text-[11px] text-[var(--text-muted)] truncate">Track offers sent</p></div>\n                </button>\n                <button type="button" onClick={() => setTab('messages')} className="text-left flex items-center gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors">\n                    <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0"><MessageSquare size={18} /></div>\n                    <div className="min-w-0"><p className="font-bold text-sm">Messages</p><p className="text-[11px] text-[var(--text-muted)] truncate">Open your inbox</p></div>\n                </button>\n            </div>\n\n            {/* Stats Cards */}''',
    "user quick actions",
)

for old, new, label in [
    ('label="Active Inventory"', 'label="My Listings"', "listings label"),
    ('label="Total Revenue"', 'label="Sales Revenue"', "revenue label"),
    ('label="Watchlist"', 'label="Saved Cars"', "saved label"),
    ('label="Total Views"', 'label="Listing Views"', "views label"),
    ('<TrendingUp className="text-primary" size={20} /> Seller Insights', '<TrendingUp className="text-primary" size={20} /> Selling', "selling heading"),
    ('<Gavel className="text-blue-400" size={20} /> Buyer Insights', '<Gavel className="text-blue-400" size={20} /> Buying', "buying heading"),
    ('<Button variant="ghost" size="sm" className="text-yellow-400 hover:bg-yellow-500/10">Browse</Button>', '<Button variant="ghost" size="sm" className="text-yellow-400 hover:bg-yellow-500/10" onClick={() => setTab(\'watchlist\')}>View Saved</Button>', "saved action"),
]:
    user = replace_once(user, old, new, label)

user_path.write_text(user, encoding="utf-8")


# Dealer dashboard: surface daily actions and remove a non-actionable status tile.
dealer_path = Path("src/app/dashboard/dealer/page.tsx")
dealer = dealer_path.read_text(encoding="utf-8-sig")

dealer = replace_once(
    dealer,
    '    Car, Eye, TrendingUp, Users, Kanban,\n    PlusCircle, ArrowUpRight, Loader2, Building2, CheckCircle,',
    '    Car, Eye, TrendingUp, Users, Kanban, Gavel,\n    PlusCircle, ArrowUpRight, Loader2, Building2, CheckCircle,',
    "dealer gavel import",
)

dealer = replace_once(dealer, '                        <div className="dealer-glass-card p-8 group">', '                        <div className="dealer-glass-card p-5 md:p-8 group">', "dealer compact hero")
dealer = replace_once(dealer, '                                            <h1 className="text-3xl font-black font-heading uppercase tracking-tighter metallic-foil">', '                                            <h1 className="text-2xl md:text-3xl font-black font-heading uppercase tracking-tighter metallic-foil">', "dealer responsive heading")

dealer = replace_once(
    dealer,
    '''                    {/* ── Quick Actions & Proprietary Insights ── */}\n                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">''',
    '''                    {/* ── Quick Actions ── */}\n                    <div>\n                        <h2 className="text-lg font-black font-heading uppercase tracking-tight mb-3">Quick Actions</h2>\n                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">''',
    "dealer quick actions open",
)

dealer = replace_once(
    dealer,
    '''                        \n                        <div className="dealer-glass-card p-5 group flex items-center justify-center col-span-1 md:col-span-2">\n                            <p className="text-[var(--text-muted)] text-sm">Dashboard Overview initialized successfully.</p>\n                        </div>\n                    </div>''',
    '''                        <Link href="/dashboard/dealer/add-listing" className="dealer-glass-card p-5 group flex items-center justify-between col-span-1">\n                            <div className="flex items-center gap-3">\n                                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"><PlusCircle size={20} className="text-emerald-400 group-hover:scale-110 transition-transform" /></div>\n                                <div>\n                                    <p className="font-bold text-[var(--text-primary)] text-sm">Add Vehicle</p>\n                                    <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider mt-0.5">Create Listing</p>\n                                </div>\n                            </div>\n                        </Link>\n                        <Link href="/dashboard/dealer/auctions" className="dealer-glass-card p-5 group flex items-center justify-between col-span-1">\n                            <div className="flex items-center gap-3">\n                                <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl"><Gavel size={20} className="text-blue-400 group-hover:scale-110 transition-transform" /></div>\n                                <div>\n                                    <p className="font-bold text-[var(--text-primary)] text-sm">Auctions</p>\n                                    <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider mt-0.5">Buy & Bid</p>\n                                </div>\n                            </div>\n                        </Link>\n                        </div>\n                    </div>''',
    "dealer actionable shortcuts",
)

dealer_path.write_text(dealer, encoding="utf-8")
