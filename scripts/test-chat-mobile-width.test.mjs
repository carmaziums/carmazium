// Owner screenshot (31 Oct 2026): on a phone, sent messages ran off the right
// edge of dealer Messages. The chat pane is a flex item and needs min-w-0, or
// its content can make it wider than the screen.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const pages = ["dealer", "seller", "buyer", "service", "finance", "insurance", "admin"]
    .map(role => `src/app/dashboard/${role}/messages/page.tsx`)

test("every Messages page constrains the chat pane to the screen width", () => {
    for (const page of pages) {
        const src = readFileSync(page, "utf8")
        assert.match(src, /className=\{`min-h-0 min-w-0 flex-1 \$\{selectedRoom \? ["']flex["'] : ["']hidden lg:flex lg:items-center lg:justify-center["']\}`\}/, page)
        // "flex" and "hidden" must never be applied together.
        assert.doesNotMatch(src, /`flex min-h-0 min-w-0 flex-1 \$\{!selectedRoom/, page)
    }
})

test("long words and links in a message wrap instead of widening the bubble", () => {
    assert.match(readFileSync("src/components/chat/ChatWindow.tsx", "utf8"), /whitespace-pre-wrap break-words \[overflow-wrap:anywhere\] px-1">\{parsed\.text\}/)
})

test("the message box can shrink so the send button stays on screen", () => {
    assert.match(readFileSync("src/components/chat/ChatWindow.tsx", "utf8"), /className="min-w-0 flex-1 bg-\[var\(--bg-input\)\] border border-\[var\(--border-default\)\] rounded-xl px-4 py-3/)
})
