import { createHash, createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { getDb, runTransaction } from "../db.js";

export type AuthRole = "admin" | "user";
export type AuthStatus = "active" | "disabled";
export interface AuthUser {
  id: string; email: string; role: AuthRole; status: AuthStatus;
  createdAt: string; updatedAt: string; lastLoginAt: string | null;
  mustChangePassword: boolean;
}
export interface AuthSession {
  id: string; userId: string; createdAt: string; expiresAt: string;
  revokedAt: string | null; metadata: Record<string, unknown>; user: AuthUser;
}
export interface CreatedSession { token: string; session: AuthSession; }
export interface CreatedResetToken { token: string; expiresAt: string; user: AuthUser; }
export interface AuditRecord {
  id: string; userId: string | null; actorId: string | null; action: string;
  success: boolean; metadata: Record<string, unknown>; createdAt: string;
}
export interface BootstrapOptions { email?: string; password?: string; }
export interface CreateUserOptions { email: string; password: string; role?: AuthRole; status?: AuthStatus; mustChangePassword?: boolean; }

const DEFAULT_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const RESET_TTL_MS = 1000 * 60 * 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
// Fixed, structurally valid dummy credential: missing accounts still perform one full scrypt.
const DUMMY_HASH = `scrypt$${Buffer.alloc(16, 71).toString("base64url")}$${Buffer.alloc(64, 93).toString("base64url")}`;
type UserRow = { id: string; email: string; password_hash: string; role: AuthRole; status: AuthStatus; created_at: string; updated_at: string; last_login_at: string | null; must_change_password: number };
type SessionRow = { id: string; user_id: string; created_at: string; expires_at: string; revoked_at: string | null; metadata: string; };
type ResetRow = { id: string; user_id: string; expires_at: string; used_at: string | null };
type AuditRow = { id: string; user_id: string | null; actor_id: string | null; action: string; success: number; metadata: string; created_at: string };

function now(): string { return new Date().toISOString(); }
function normalizeEmail(email: string): string {
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(normalized) || normalized.length > 320) throw new Error("A valid email address is required");
  return normalized;
}
function boundedPassword(password: unknown): password is string { return typeof password === "string" && password.length >= 12 && password.length <= 256; }
function requirePassword(password: string): void {
  if (!boundedPassword(password)) throw new Error("Password must be between 12 and 256 characters");
}
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, key) => error ? reject(error) : resolve(key)));
}
async function hashPassword(password: string): Promise<string> {
  requirePassword(password);
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64url")}$${(await derive(password, salt)).toString("base64url")}`;
}
async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split("$");
  const validFormat = parts.length === 3 && parts[0] === "scrypt" && /^[A-Za-z0-9_-]{22}$/.test(parts[1]) && /^[A-Za-z0-9_-]{86}$/.test(parts[2]);
  const [, saltText, digestText] = (validFormat ? encoded : DUMMY_HASH).split("$");
  const actual = await derive(password, Buffer.from(saltText, "base64url"));
  return validFormat && timingSafeEqual(actual, Buffer.from(digestText, "base64url"));
}
function validToken(token: unknown): token is string {
  return typeof token === "string" && TOKEN_RE.test(token) && Buffer.from(token, "base64url").toString("base64url") === token;
}
function hashToken(token: string, domain = "session"): string {
  return `sha256:${createHash("sha256").update(`sciai:${domain}:v1\0`).update(token).digest("hex")}`;
}
/** A stable anti-CSRF secret bound to this bearer, never the bearer itself. */
export function csrfForToken(token: string): string {
  if (!validToken(token)) throw new Error("Invalid session token");
  return createHmac("sha256", Buffer.from(token, "base64url")).update("sciai:csrf:v1").digest("base64url");
}
function parseObject(value: string): Record<string, unknown> {
  try { const parsed: unknown = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; } catch { return {}; }
}
// Explicit allowlist rather than a blacklist: passwords, cookies, reset/session tokens and
// arbitrary nested request bodies must never enter persistent metadata or audit history.
function safeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const key of ["role", "status", "reason", "ip", "userAgent"]) {
    if (typeof metadata[key] === "string") safe[key] = (metadata[key] as string).slice(0, 512);
  }
  return safe;
}
function userFromRow(row: UserRow): AuthUser {
  return { id: row.id, email: row.email, role: row.role, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at, lastLoginAt: row.last_login_at, mustChangePassword: row.must_change_password === 1 };
}
function getUserRow(db: DatabaseSync, id: string): UserRow | undefined { return db.prepare("SELECT * FROM auth_users WHERE id = ?").get(id) as UserRow | undefined; }
function audit(db: DatabaseSync, action: string, userId: string | null, success: boolean, metadata: Record<string, unknown> = {}, actorId?: string): void {
  db.prepare("INSERT INTO auth_audit_logs (id,user_id,actor_id,action,success,metadata,created_at) VALUES (?,?,?,?,?,?,?)").run(randomUUID(), userId, actorId ?? null, action, success ? 1 : 0, JSON.stringify(safeMetadata(metadata)), now());
}
function sessionFromRow(db: DatabaseSync, row: SessionRow): AuthSession | null {
  const user = getUserRow(db, row.user_id);
  if (!user) return null;
  return { id: row.id, userId: row.user_id, createdAt: row.created_at, expiresAt: row.expires_at, revokedAt: row.revoked_at, metadata: parseObject(row.metadata), user: userFromRow(user) };
}
function revokeCredentials(db: DatabaseSync, userId: string, timestamp: string): void {
  db.prepare("UPDATE auth_sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL").run(timestamp, userId);
  db.prepare("UPDATE auth_reset_tokens SET used_at=? WHERE user_id=? AND used_at IS NULL").run(timestamp, userId);
}

/** Hash outside the write transaction; recheck emptiness under BEGIN IMMEDIATE. */
export async function ensureBootstrap(options: BootstrapOptions = {}): Promise<AuthUser | null> {
  const db = getDb();
  if (db.prepare("SELECT 1 FROM auth_users LIMIT 1").get()) return null;
  const email = options.email ?? process.env.SCIAI_BOOTSTRAP_ADMIN_EMAIL ?? process.env.SCIAI_BOOTSTRAP_EMAIL;
  const password = options.password ?? process.env.SCIAI_BOOTSTRAP_ADMIN_PASSWORD ?? process.env.SCIAI_BOOTSTRAP_PASSWORD;
  if (!email || !password) return null;
  const normalized = normalizeEmail(email);
  const passwordHash = await hashPassword(password);
  return runTransaction(db, () => {
    if (db.prepare("SELECT 1 FROM auth_users LIMIT 1").get()) return null;
    const timestamp = now(); const id = randomUUID();
    db.prepare("INSERT INTO auth_users (id,email,password_hash,role,status,created_at,updated_at,must_change_password) VALUES (?,?,?,'admin','active',?,?,1)").run(id, normalized, passwordHash, timestamp, timestamp);
    audit(db, "bootstrap", id, true);
    return userFromRow(getUserRow(db, id)!);
  });
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  const db = getDb();
  const normalized = typeof email === "string" ? email.trim().toLowerCase().slice(0, 321) : "";
  const row = db.prepare("SELECT * FROM auth_users WHERE email = ? COLLATE NOCASE").get(normalized) as UserRow | undefined;
  // Out-of-bounds input is never sent to the KDF, but follows the same dummy work path.
  const acceptable = boundedPassword(password);
  const verified = await verifyPassword(acceptable ? password : "invalid-password-input", row?.password_hash ?? DUMMY_HASH);
  return runTransaction(db, () => {
    const current = row && getUserRow(db, row.id);
    const valid = acceptable && verified && !!current && current.status === "active" && current.password_hash === row?.password_hash;
    audit(db, "login", row?.id ?? null, valid);
    if (!valid || !current) return null;
    const timestamp = now();
    db.prepare("UPDATE auth_users SET last_login_at=?,updated_at=? WHERE id=?").run(timestamp, timestamp, current.id);
    return userFromRow({ ...current, last_login_at: timestamp, updated_at: timestamp });
  });
}

export function createSession(userId: string, metadata: Record<string, unknown> = {}, ttlMs = DEFAULT_SESSION_TTL_MS): CreatedSession {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > 1000 * 60 * 60 * 24 * 365) throw new Error("Invalid session lifetime");
  const db = getDb();
  return runTransaction(db, () => {
    const user = getUserRow(db, userId);
    if (!user || user.status !== "active") throw new Error("Active user not found");
    const token = randomBytes(32).toString("base64url"); const createdAt = now();
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    const row: SessionRow = { id: randomUUID(), user_id: userId, created_at: createdAt, expires_at: expiresAt, revoked_at: null, metadata: JSON.stringify(safeMetadata(metadata)) };
    db.prepare("INSERT INTO auth_sessions (id,user_id,token_hash,created_at,expires_at,metadata) VALUES (?,?,?,?,?,?)").run(row.id, userId, hashToken(token), createdAt, expiresAt, row.metadata);
    audit(db, "session_created", userId, true, metadata);
    return { token, session: sessionFromRow(db, row)! };
  });
}
export function getSession(token: string): AuthSession | null {
  if (!validToken(token)) return null;
  const db = getDb();
  const row = db.prepare("SELECT * FROM auth_sessions WHERE token_hash=?").get(hashToken(token)) as SessionRow | undefined;
  if (!row || row.revoked_at || !Number.isFinite(Date.parse(row.expires_at)) || Date.parse(row.expires_at) <= Date.now()) return null;
  const session = sessionFromRow(db, row);
  return session?.user.status === "active" ? session : null;
}
export function revokeSession(token: string): boolean {
  if (!validToken(token)) return false;
  const db = getDb();
  return runTransaction(db, () => {
    const row = db.prepare("SELECT id,user_id FROM auth_sessions WHERE token_hash=? AND revoked_at IS NULL").get(hashToken(token)) as { id: string; user_id: string } | undefined;
    if (!row) return false;
    db.prepare("UPDATE auth_sessions SET revoked_at=? WHERE id=?").run(now(), row.id);
    audit(db, "session_revoked", row.user_id, true); return true;
  });
}

export async function changePassword(userId: string, password: string, actorId?: string): Promise<AuthUser> {
  const passwordHash = await hashPassword(password); const db = getDb();
  return runTransaction(db, () => {
    const row = getUserRow(db, userId);
    if (!row || row.status !== "active") throw new Error("Active user not found");
    const timestamp = now();
    db.prepare("UPDATE auth_users SET password_hash=?,must_change_password=0,updated_at=? WHERE id=?").run(passwordHash, timestamp, userId);
    revokeCredentials(db, userId, timestamp);
    audit(db, "password_changed", userId, true, {}, actorId);
    return userFromRow({ ...row, must_change_password: 0, updated_at: timestamp });
  });
}
export async function createUser(options: CreateUserOptions, actorId?: string): Promise<AuthUser> {
  const email = normalizeEmail(options.email);
  const role = options.role ?? "user"; const status = options.status ?? "active";
  if (role !== "admin" && role !== "user") throw new Error("Invalid role");
  if (status !== "active" && status !== "disabled") throw new Error("Invalid status");
  const passwordHash = await hashPassword(options.password); const db = getDb();
  return runTransaction(db, () => {
    const timestamp = now(); const id = randomUUID();
    db.prepare("INSERT INTO auth_users (id,email,password_hash,role,status,created_at,updated_at,must_change_password) VALUES (?,?,?,?,?,?,?,?)").run(id, email, passwordHash, role, status, timestamp, timestamp, options.mustChangePassword ? 1 : 0);
    audit(db, "user_created", id, true, { role, status }, actorId);
    return userFromRow(getUserRow(db, id)!);
  });
}
export function getUser(userId: string): AuthUser | null { const row = getUserRow(getDb(), userId); return row ? userFromRow(row) : null; }
export function listUsers(): AuthUser[] { return (getDb().prepare("SELECT * FROM auth_users ORDER BY created_at ASC").all() as UserRow[]).map(userFromRow); }
function protectLastAdmin(db: DatabaseSync, row: UserRow, role: AuthRole, status: AuthStatus): void {
  if (row.role === "admin" && row.status === "active" && (role !== "admin" || status !== "active")) {
    const { count } = db.prepare("SELECT COUNT(*) AS count FROM auth_users WHERE role='admin' AND status='active'").get() as { count: number };
    if (Number(count) <= 1) throw new Error("Cannot disable or demote the last active administrator");
  }
}
export function updateUser(userId: string, changes: Partial<Pick<AuthUser, "email" | "role" | "status">>, actorId?: string): AuthUser {
  const db = getDb();
  return runTransaction(db, () => {
    const row = getUserRow(db, userId); if (!row) throw new Error("User not found");
    const email = changes.email === undefined ? row.email : normalizeEmail(changes.email);
    const role = changes.role ?? row.role; const status = changes.status ?? row.status;
    if (!["admin", "user"].includes(role) || !["active", "disabled"].includes(status)) throw new Error("Invalid user attributes");
    protectLastAdmin(db, row, role, status);
    const timestamp = now();
    db.prepare("UPDATE auth_users SET email=?,role=?,status=?,updated_at=? WHERE id=?").run(email, role, status, timestamp, userId);
    if (status === "disabled" || role !== row.role || email !== row.email) revokeCredentials(db, userId, timestamp);
    audit(db, "user_updated", userId, true, { role, status }, actorId);
    return userFromRow({ ...row, email, role, status, updated_at: timestamp });
  });
}
/** Deletion is deliberately a soft disable; history and subject identity survive. */
export function deleteUser(userId: string, actorId?: string): boolean {
  const db = getDb();
  return runTransaction(db, () => {
    const row = getUserRow(db, userId); if (!row) return false;
    protectLastAdmin(db, row, row.role, "disabled");
    const timestamp = now();
    db.prepare("UPDATE auth_users SET status='disabled',updated_at=? WHERE id=?").run(timestamp, userId);
    revokeCredentials(db, userId, timestamp);
    audit(db, "user_deleted", userId, true, {}, actorId); return true;
  });
}
/** Returns a random, single-use one-hour reset credential, not a temporary password. */
export function resetPassword(userId: string, actorId?: string): CreatedResetToken {
  const db = getDb();
  return runTransaction(db, () => {
    const row = getUserRow(db, userId);
    if (!row || row.status !== "active") throw new Error("Active user not found");
    const timestamp = now(); const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();
    const token = randomBytes(32).toString("base64url");
    revokeCredentials(db, userId, timestamp);
    // A recovery reset must invalidate the previous password, not merely revoke cookies.
    // This is deliberately not a valid scrypt credential; only token redemption restores login.
    db.prepare("UPDATE auth_users SET password_hash=?,must_change_password=1,updated_at=? WHERE id=?").run(`reset-required:${randomBytes(32).toString("hex")}`, timestamp, userId);
    db.prepare("INSERT INTO auth_reset_tokens (id,user_id,token_hash,created_at,expires_at) VALUES (?,?,?,?,?)").run(randomUUID(), userId, hashToken(token, "reset"), timestamp, expiresAt);
    audit(db, "password_reset_issued", userId, true, {}, actorId);
    return { token, expiresAt, user: userFromRow({ ...row, must_change_password: 1, updated_at: timestamp }) };
  });
}
export async function redeemResetToken(token: string, password: string): Promise<AuthUser | null> {
  requirePassword(password);
  if (!validToken(token)) return null;
  const db = getDb(); const tokenHash = hashToken(token, "reset");
  const candidate = db.prepare("SELECT * FROM auth_reset_tokens WHERE token_hash=?").get(tokenHash) as ResetRow | undefined;
  if (!candidate || candidate.used_at || Date.parse(candidate.expires_at) <= Date.now() || !Number.isFinite(Date.parse(candidate.expires_at))) return null;
  const passwordHash = await hashPassword(password);
  return runTransaction(db, () => {
    const reset = db.prepare("SELECT * FROM auth_reset_tokens WHERE token_hash=?").get(tokenHash) as ResetRow | undefined;
    const row = reset && getUserRow(db, reset.user_id);
    if (!reset || reset.used_at || !Number.isFinite(Date.parse(reset.expires_at)) || Date.parse(reset.expires_at) <= Date.now() || !row || row.status !== "active") return null;
    const timestamp = now();
    db.prepare("UPDATE auth_users SET password_hash=?,must_change_password=0,updated_at=? WHERE id=?").run(passwordHash, timestamp, row.id);
    revokeCredentials(db, row.id, timestamp);
    audit(db, "password_reset_redeemed", row.id, true);
    return userFromRow({ ...row, must_change_password: 0, updated_at: timestamp });
  });
}
export const adminCreateUser = createUser;
export const adminGetUser = getUser;
export const adminListUsers = listUsers;
export const adminUpdateUser = updateUser;
export const adminDeleteUser = deleteUser;
export const adminResetPassword = resetPassword;
export function listAuditLogs(limit = 100, userId?: string): AuditRecord[] {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(1000, Math.floor(limit))) : 100;
  const db = getDb();
  const rows = (userId ? db.prepare("SELECT * FROM auth_audit_logs WHERE user_id=? ORDER BY created_at DESC LIMIT ?").all(userId, safeLimit) : db.prepare("SELECT * FROM auth_audit_logs ORDER BY created_at DESC LIMIT ?").all(safeLimit)) as AuditRow[];
  return rows.map((r) => ({ id: r.id, userId: r.user_id, actorId: r.actor_id, action: r.action, success: r.success === 1, metadata: parseObject(r.metadata), createdAt: r.created_at }));
}
