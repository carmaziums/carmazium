// Owner rule (31 Oct 2026): a person who deleted their own account can sign up
// again with the same email; admin screens must not treat that as a ban.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = (p) => readFileSync(p, "utf8")

test("deletion frees the email: identity removed, address anonymised, shared marker", () => {
    const users = read("backend/src/users/users.service.ts")
    assert.match(users, /await this\.deleteSupabaseIdentity\(userId\);/)
    assert.match(users, /const deletedEmail = `deleted-\$\{userId\}@\$\{DELETED_EMAIL_DOMAIN\}`;/)
    assert.match(users, /passwordHash: SELF_DELETED_PASSWORD_MARKER,/)
    assert.match(read("src/lib/accountDeletion.ts"), /export const DELETED_EMAIL_DOMAIN = "deleted\.carmazium\.com"/)
    assert.match(read("backend/src/users/account-deletion.ts"), /export const DELETED_EMAIL_DOMAIN = 'deleted\.carmazium\.com';/)
})

test("sign-in releases a leftover identity only for self-deleted accounts", () => {
    const auth = read("backend/src/auth/auth.service.ts")
    assert.match(auth, /localUser\.passwordHash === SELF_DELETED_PASSWORD_MARKER/)
    assert.match(auth, /await this\.releaseSelfDeletedIdentity\(data\.user\.id\);/)
})

test("admin screens show DELETED, not BAN, and offer no Unban for self-deleted accounts", () => {
    const list = read("src/app/dashboard/admin/users/page.tsx")
    assert.equal((list.match(/const isBanned = !!u\.deletedAt && !isSelfDeleted/g) || []).length, 2)
    assert.match(list, /\{isSelfDeleted \? 'DELETED' : isBanned \? 'BAN'/)
    assert.match(list, /\{isSelfDeleted \? 'DELETED BY USER' : isBanned \? 'BANNED'/)
    assert.equal((list.match(/!isSelf && !isSelfDeleted &&/g) || []).length, 2)
    const modal = read("src/components/dashboard/UserDetailModal.tsx")
    assert.match(modal, /They can sign up again with the same email\./)
    assert.match(read("backend/src/admin/admin.service.ts"), /if \(isSelfDeletedAccount\(user\)\)/)
})
