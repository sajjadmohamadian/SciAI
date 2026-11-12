import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeDb, getDb, initDb } from "../server/db.js";
import { ensureBootstrap, authenticateUser, createSession, getSession, revokeSession, createUser, updateUser, changePassword, resetPassword, redeemResetToken } from "../server/auth/service.js";

test("auth lifecycle hashes credentials, revokes sessions and protects last admin", async () => {
  closeDb(); const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sciai-auth-")); initDb(path.join(dir, "test.db"));
  try {
    const admin = await ensureBootstrap({ email: "synthetic-admin@example.test", password: "Synthetic-Test-Password!42" });
    assert(admin); assert.equal(admin.role, "admin"); assert.equal(admin.mustChangePassword, true);
    assert.equal(await ensureBootstrap({ email: "other@example.test", password: "Another-Test-Password!42" }), null);
    assert.equal(await authenticateUser(admin.email, "wrong-password"), null);
    assert(await authenticateUser(admin.email, "Synthetic-Test-Password!42"));
    const session = createSession(admin.id); assert(getSession(session.token)); revokeSession(session.token); assert.equal(getSession(session.token), null);
    assert.throws(() => updateUser(admin.id, { status: "disabled" }), /last|admin/i);
    const user = await createUser({ email: "synthetic-user@example.test", password: "Synthetic-User-Password!42" });
    const userSession = createSession(user.id); updateUser(user.id, { status: "disabled" }); assert.equal(getSession(userSession.token), null);
    updateUser(user.id, { status: "active" }); const reset = resetPassword(user.id);
    assert.equal(await authenticateUser(user.email, "Synthetic-User-Password!42"), null, "A recovery reset invalidates the previous password immediately");
    assert(await redeemResetToken(reset.token, "Replacement-Password!42")); assert.equal(await redeemResetToken(reset.token, "Replacement-Password!42"), null);
    const updated = await changePassword(admin.id, "Changed-Admin-Password!42"); assert.equal(updated.mustChangePassword, false);
    const db = getDb();
    const stored = db.prepare("SELECT password_hash FROM auth_users WHERE id=?").get(admin.id) as { password_hash: string };
    assert.match(stored.password_hash, /^scrypt\$/);
    assert(!stored.password_hash.includes("Changed-Admin-Password!42"));
    const expiring = createSession(admin.id);
    db.prepare("UPDATE auth_sessions SET expires_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(expiring.session.id);
    assert.equal(getSession(expiring.token), null);
    assert.equal(getSession("x".repeat(10000)), null);
    const expiredReset = resetPassword(user.id);
    db.prepare("UPDATE auth_reset_tokens SET expires_at='2000-01-01T00:00:00.000Z'").run();
    assert.equal(await redeemResetToken(expiredReset.token, "Replacement-Password!43"), null);
    const credential = createSession(admin.id, { password: "NEVER-PERSIST-THIS", token: "NEVER-PERSIST-THIS", userAgent: "Synthetic" });
    const persisted = JSON.stringify(db.prepare("SELECT * FROM auth_sessions").all()) + JSON.stringify(db.prepare("SELECT * FROM auth_audit_logs").all());
    assert(!persisted.includes("NEVER-PERSIST-THIS"));
    assert(!persisted.includes(credential.token));
    assert.throws(() => db.exec("DELETE FROM auth_audit_logs"), /append-only/);
    assert.throws(() => db.exec("UPDATE auth_audit_logs SET action='changed'"), /append-only/);
    await assert.rejects(() => createUser({ email: "bad", password: "Valid-Synthetic-Password!42" }), /email/);
    await assert.rejects(() => createUser({ email: "weak@example.test", password: "short" }), /12/);
  } finally { closeDb(); fs.rmSync(dir, { recursive: true, force: true }); }
});
