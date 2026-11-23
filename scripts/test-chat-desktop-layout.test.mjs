import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"

const read = (path) => readFileSync(path, "utf8")

test("personal messages use full desktop width without hiding mobile navigation", () => {
    const page = read("src/app/dashboard/user/page.tsx")
    assert.match(page, /activeTab === "messages" \? "w-full max-w-none/)
    assert.match(page, /activeTab === "messages" \? "lg:hidden" : "contents"/)
    assert.match(page, /backHref="\/dashboard\/user"/)
})

test("dealer messages do not reserve a desktop sidebar", () => {
    const page = read("src/app/dashboard/dealer/messages/page.tsx")
    assert.match(page, /className="flex w-full max-w-none/)
    assert.match(page, /className="lg:hidden">\s*<DashboardSidebar/)
    assert.match(page, /backHref="\/dashboard\/dealer"/)
})

test("service, finance and insurance partners receive the same full-width messages layout", () => {
    for (const role of ["service", "finance", "insurance"]) {
        const page = read(`src/app/dashboard/${role}/messages/page.tsx`)
        assert.match(page, /className="flex w-full max-w-none/)
        assert.match(page, /className="lg:hidden">\s*<DashboardSidebar/)
        assert.match(page, new RegExp(`backHref="/dashboard/${role}"`))
    }
})

test("admin inbox prioritises the conversation and preserves on-demand support tools", () => {
    const page = read("src/app/dashboard/admin/messages/page.tsx")
    assert.match(page, /className="flex w-full max-w-none/)
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
    assert.match(inbox, /lg:h-full/)
})

test("desktop Messages are an edge-to-edge workspace, not a hovering glass card", () => {
    const admin = read("src/app/dashboard/admin/messages/page.tsx")
    const personal = read("src/app/dashboard/user/page.tsx")
    const inbox = read("src/components/chat/RoleMessagesInbox.tsx")
    const chat = read("src/components/chat/ChatWindow.tsx")
    assert.match(admin, /lg:h-\[calc\(100dvh-5rem\)\]/)
    assert.match(admin, /bg-\[var\(--bg-card\)\] lg:h-full/)
    assert.doesNotMatch(admin, /glass-card flex h-/)
    assert.match(personal, /lg:h-\[calc\(100dvh-5rem\)\]/)
    assert.doesNotMatch(inbox, /className = "glass-card"/)
    assert.match(chat, /lg:rounded-none lg:border-0/)
    assert.match(chat, /showAdminQuickReplies \&\&/)
    assert.match(chat, /aria-expanded=\{showAdminQuickReplies\}/)
    assert.match(admin, /role="region" aria-label="Internal support controls"/)
    assert.match(admin, /aria-label="Close support controls"/)
    assert.match(admin, /Additional admin messaging tools/)
})

// Execute the real personal dashboard with its messages query. Import-only and
// CSS assertions cannot detect a lost conditional render during integration.
test("personal messages query mounts the existing inbox inside the dashboard", () => {
    const exports = {};
    const placeholder = ({ children }) => React.createElement(React.Fragment, null, children);
    const modules = {
        react: React,
        "next/navigation": { useSearchParams: () => new URLSearchParams("tab=messages"), useRouter: () => ({ push() {}, replace() {} }) },
        "@/context/AuthContext": { useAuth: () => ({ user: { id: "customer-fixture", email: "fixture@example.test" }, profile: { role: "BUYER" }, loading: false, refreshProfile() {} }) },
        "@/context/ChatContext": { useChat: () => ({ refreshRooms() {} }) },
        "@/components/chat/RoleMessagesInbox": { RoleMessagesInbox: props => React.createElement("section", { "data-existing-inbox": "true", "data-dashboard-back": props.backHref }, props.title) },
    };
    const code = ts.transpileModule(read("src/app/dashboard/user/page.tsx"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
    runInNewContext(code, { exports, require: name => modules[name] || new Proxy({}, { get: (_target, key) => key === "__esModule" ? true : placeholder }) });
    const output = renderToStaticMarkup(React.createElement(exports.default));
    assert.match(output, /data-existing-inbox="true"/);
    assert.match(output, /data-dashboard-back="\/dashboard\/user"/);
    assert.equal((output.match(/data-existing-inbox/g) || []).length, 1);
});
