import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = (path) => readFileSync(path, "utf8")

test("personal messages use full desktop width without hiding mobile navigation", () => {
    const page = read("src/app/dashboard/user/page.tsx")
    assert.match(page, /activeTab === "messages" \? "w-full max-w-none"/)
    assert.match(page, /activeTab === "messages" \? "lg:hidden" : "contents"/)
    assert.match(page, /backHref="\/dashboard\/user"/)
})

test("dealer messages do not reserve a desktop sidebar", () => {
    const page = read("src/app/dashboard/dealer/messages/page.tsx")
    assert.match(page, /className="w-full max-w-none/)
    assert.match(page, /className="lg:hidden">\s*<DashboardSidebar/)
    assert.match(page, /backHref="\/dashboard\/dealer"/)
})

test("admin inbox prioritises the conversation and preserves on-demand support tools", () => {
    const page = read("src/app/dashboard/admin/messages/page.tsx")
    assert.match(page, /className="w-full max-w-none/)
    assert.match(page, /className="lg:hidden">\s*<DashboardSidebar/)
    assert.match(page, /const \[showSupportPanel, setShowSupportPanel\]/)
    assert.match(page, /showSupportPanel \&\&/)
    assert.match(page, /aria-expanded=\{showSupportPanel\}/)
    assert.doesNotMatch(page, /lg:min-h-\[620px\]/)
    assert.match(page, /Back to admin dashboard/)
})

test("shared inbox provides dashboard navigation and uses available desktop height", () => {
    const inbox = read("src/components/chat/RoleMessagesInbox.tsx")
    assert.match(inbox, /backHref\?: string/)
    assert.match(inbox, /href=\{backHref\}/)
    assert.match(inbox, /lg:h-\[calc\(100dvh-170px\)\]/)
})
