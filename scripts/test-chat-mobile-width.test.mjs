// Owner screenshot (31 Oct 2026): on a phone, sent messages ran off the right
// edge of Messages. Shared inboxes and legacy/admin inboxes must all constrain
// the flex chat pane so long content cannot widen the viewport.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const sharedRolePages = ["dealer", "service", "finance", "insurance"]
    .map(role => `src/app/dashboard/${role}/messages/page.tsx`)

test("shared role message pages use the canonical inbox", () => {
    for (const page of sharedRolePages) {
        const src = readFileSync(page, "utf8")
        assert.match(src, /RoleMessagesInbox/, page)
    }
    assert.match(readFileSync("src/app/dashboard/user/page.tsx", "utf8"), /RoleMessagesInbox/)
})

test("the shared inbox constrains the desktop chat pane and owns the phone portal", () => {
    const src = readFileSync("src/components/chat/RoleMessagesInbox.tsx", "utf8")
    assert.match(src, /min-h-0 min-w-0 flex-1/)
    assert.match(src, /fixed inset-0 z-\[9999\].*h-\[100dvh\].*w-screen/)
    assert.match(src, /CarMazium support/)
})

test("legacy buyer, seller and admin message panes stay width-constrained", () => {
    for (const role of ["seller", "buyer", "admin"]) {
        const page = `src/app/dashboard/${role}/messages/page.tsx`
        const src = readFileSync(page, "utf8")
        assert.match(src, /min-w-0/, page)
    }
})

test("long words and links in a message wrap instead of widening the bubble", () => {
    assert.match(readFileSync("src/components/chat/ChatWindow.tsx", "utf8"), /whitespace-pre-wrap break-words \[overflow-wrap:anywhere\] px-1">\{parsed\.text\}/)
})

test("the message box can shrink so the send button stays on screen", () => {
    assert.match(readFileSync("src/components/chat/ChatWindow.tsx", "utf8"), /className="min-w-0 flex-1 bg-\[var\(--bg-input\)\] border border-\[var\(--border-default\)\] rounded-xl px-4 py-3/)
})
