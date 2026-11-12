import express from "express";
import { timingSafeEqual } from "node:crypto";
import {
  authenticateUser, changePassword, createSession, createUser, csrfForToken, deleteUser,
  getSession, getUser, listUsers, resetPassword, redeemResetToken, revokeSession, updateUser,
  type AuthSession, type AuthUser,
} from "./service.js";

export const userAuthEnabled = () => {
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(process.env.HOST || "localhost");
  return !(loopback && process.env.SCIAI_USER_AUTH_ENABLED === "false");
};
const COOKIE = "sciai_session";
const SESSION_MS = 8 * 60 * 60 * 1000;
const mutation = (req: express.Request) => !["GET", "HEAD", "OPTIONS"].includes(req.method);
export function cookieToken(req: express.Request): string | null {
  const values = (req.headers.cookie || "").split(";").map((part) => part.trim()).filter((part) => part.startsWith(`${COOKIE}=`));
  if (values.length !== 1) return null;
  try { return decodeURIComponent(values[0].slice(COOKIE.length + 1)); } catch { return null; }
}
export function requestSession(req: express.Request): AuthSession | null {
  return (req as express.Request & { authSession?: AuthSession }).authSession || getSession(cookieToken(req) || "");
}
export function safeUser(user: AuthUser) {
  return { id: user.id, email: user.email, role: user.role, active: user.status === "active", must_change_password: user.mustChangePassword, created_at: user.createdAt };
}
function equal(a: string, b: string): boolean { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
export function originAllowed(req: express.Request): boolean {
  if (req.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  if (!origin && !referer) return true;
  try {
    const incoming = new URL(origin || referer!).origin;
    const configured = process.env.APP_URL && process.env.APP_URL !== "MY_APP_URL" ? new URL(process.env.APP_URL).origin : null;
    // Never trust forwarded headers; hosted deployments must set APP_URL.
    const host = process.env.HOST || "localhost";
    if (configured) return incoming === configured;
    if (!["localhost", "127.0.0.1", "::1"].includes(host)) return false;
    const parsed = new URL(incoming);
    return ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) && parsed.port === String(process.env.PORT || "3000") && parsed.protocol === "http:";
  } catch { return false; }
}
export const requireSession: express.RequestHandler = (req, res, next) => {
  const session = requestSession(req);
  if (!session) return res.status(401).json({ error: "Sign in to continue", code: "session_required" });
  (req as express.Request & { authSession: AuthSession }).authSession = session;
  res.setHeader("Cache-Control", "no-store");
  next();
};
export const csrfGuard: express.RequestHandler = (req, res, next) => {
  if (!mutation(req)) return next();
  const token = cookieToken(req);
  const submitted = req.headers["x-csrf-token"];
  if (!token || typeof submitted !== "string" || !equal(csrfForToken(token), submitted) || !originAllowed(req)) {
    return res.status(403).json({ error: "CSRF validation failed", code: "csrf_invalid" });
  }
  next();
};
export const requireAdmin: express.RequestHandler = (req, res, next) => {
  const session = requestSession(req);
  if (!session) return res.status(401).json({ error: "Sign in to continue" });
  if (session.user.role !== "admin") return res.status(403).json({ error: "Administrator role required" });
  if (session.user.mustChangePassword) return res.status(403).json({ error: "Change your temporary password first", code: "password_change_required" });
  next();
};
export const acceptSession: express.RequestHandler = (req, res, next) => {
  requireSession(req, res, () => csrfGuard(req, res, () => {
    if (requestSession(req)!.user.mustChangePassword) return res.status(403).json({ error: "Change your temporary password first", code: "password_change_required" });
    next();
  }));
};
function setCookie(res: express.Response, token: string) {
  const secure = process.env.NODE_ENV === "production";
  const csrf = csrfForToken(token);
  res.setHeader("Set-Cookie", `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_MS / 1000)}${secure ? "; Secure" : ""}`);
  return csrf;
}
function clearCookie(res: express.Response) {
  res.setHeader("Set-Cookie", ["sciai_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0", "sciai_csrf=; SameSite=Lax; Path=/; Max-Age=0"]);
}
function errorResponse(res: express.Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Account operation failed";
  if (/UNIQUE|already exists/i.test(message)) return res.status(409).json({ error: "An account with this email already exists" });
  if (/not found/i.test(message)) return res.status(404).json({ error: "Account not found" });
  return res.status(400).json({ error: /sqlite|SQL|constraint/i.test(message) ? "Invalid account operation" : message });
}
// Bounded buckets use the socket address, never attacker-controlled X-Forwarded-For.
const attempts = new Map<string, { count: number; until: number }>();
const rateLimit: express.RequestHandler = (req, res, next) => {
  const now = Date.now();
  for (const [key, bucket] of attempts) if (bucket.until <= now) attempts.delete(key);
  const key = req.socket.remoteAddress || "unknown";
  const bucket = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
  if (bucket.count >= 20 || (!attempts.has(key) && attempts.size >= 10000)) { res.setHeader("Retry-After", "900"); return res.status(429).json({ error: "Too many authentication attempts. Try again later." }); }
  bucket.count++; attempts.set(key, bucket); next();
};
const checkOrigin: express.RequestHandler = (req, res, next) => originAllowed(req) ? next() : res.status(403).json({ error: "Request origin is not allowed" });
export function createAuthRouter(): express.Router {
  const router = express.Router();
  router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  router.post("/auth/login", checkOrigin, rateLimit, async (req, res) => {
    try {
      const user = await authenticateUser(req.body?.email, req.body?.password);
      if (!user) return res.status(401).json({ error: "Invalid email or password" });
      const old = cookieToken(req); if (old) revokeSession(old);
      const created = createSession(user.id, {}, SESSION_MS);
      const csrf = setCookie(res, created.token);
      res.json({ user: safeUser(user), csrf_token: csrf });
    } catch { res.status(401).json({ error: "Invalid email or password" }); }
  });
  router.get("/auth/me", (req, res) => {
    if (!userAuthEnabled()) return res.json({ user: null, csrf_token: null, auth_enabled: false });
    const session = requestSession(req); if (!session) return res.status(401).json({ error: "Authentication required" });
    res.json({ user: safeUser(session.user), csrf_token: csrfForToken(cookieToken(req)!) });
  });
  router.post("/auth/logout", requireSession, csrfGuard, (req, res) => { revokeSession(cookieToken(req)!); clearCookie(res); res.json({ success: true }); });
  router.post("/auth/password", requireSession, csrfGuard, rateLimit, async (req, res) => {
    try {
      const session = requestSession(req)!;
      if (!await authenticateUser(session.user.email, req.body?.current_password)) return res.status(400).json({ error: "Current password is incorrect" });
      const user = await changePassword(session.user.id, req.body?.new_password, session.user.id);
      const created = createSession(user.id, {}, SESSION_MS);
      res.json({ user: safeUser(user), csrf_token: setCookie(res, created.token) });
    } catch (error) { errorResponse(res, error); }
  });
  router.post("/auth/reset", checkOrigin, rateLimit, async (req, res) => {
    try { const user = await redeemResetToken(req.body?.token, req.body?.new_password); if (!user) return res.status(400).json({ error: "Invalid or expired reset token" }); res.json({ success: true }); }
    catch (error) { errorResponse(res, error); }
  });
  router.use("/admin", requireSession, csrfGuard, requireAdmin);
  router.get("/admin/users", (_req, res) => res.json({ users: listUsers().map(safeUser) }));
  router.post("/admin/users", async (req, res) => {
    try { const user = await createUser({ email: req.body?.email, password: req.body?.password, role: req.body?.role || "user", mustChangePassword: true }, requestSession(req)!.user.id); res.status(201).json({ user: safeUser(user) }); }
    catch (error) { errorResponse(res, error); }
  });
  router.patch("/admin/users/:id", (req, res) => {
    try {
      const actor = requestSession(req)!.user;
      if (!getUser(req.params.id)) return res.status(404).json({ error: "Account not found" });
      const { active, role } = req.body || {};
      if (active !== undefined && typeof active !== "boolean") return res.status(400).json({ error: "active must be a boolean" });
      if (role !== undefined && role !== "admin" && role !== "user") return res.status(400).json({ error: "Invalid role" });
      if (actor.id === req.params.id && (active === false || role === "user")) return res.status(400).json({ error: "You cannot remove your own administrator access" });
      const user = updateUser(req.params.id, { ...(active === undefined ? {} : { status: active ? "active" : "disabled" }), ...(role ? { role } : {}) }, actor.id);
      res.json({ user: safeUser(user) });
    } catch (error) { errorResponse(res, error); }
  });
  router.delete("/admin/users/:id", (req, res) => { try { const actor = requestSession(req)!.user; if (actor.id === req.params.id) return res.status(400).json({ error: "You cannot remove your own account" }); if (!deleteUser(req.params.id, actor.id)) return res.status(404).json({ error: "Account not found" }); res.json({ success: true }); } catch (error) { errorResponse(res, error); } });
  router.post("/admin/users/:id/password-reset", (req, res) => { try { const result = resetPassword(req.params.id, requestSession(req)!.user.id); res.json({ reset_token: result.token, expires_at: result.expiresAt }); } catch (error) { errorResponse(res, error); } });
  return router;
}
