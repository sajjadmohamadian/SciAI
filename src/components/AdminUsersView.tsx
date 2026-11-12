import { type FormEvent, useEffect, useState } from "react";
import { UserPlus, UserX, RotateCcw } from "lucide-react";
import { type AuthUser, useAuth } from "../context/AuthContext.js";
import { apiJson, apiRequest, getApiErrorMessage } from "../utils/apiClient.js";

type ResetSecret = { email: string; reset_token: string; expires_at: string };
export function AdminUsersView() {
  const { user, authEnabled } = useAuth();
  if (!authEnabled || user?.role !== "admin") return null;
  return <AdminUsers actorId={user.id} />;
}

function AdminUsers({ actorId }: { actorId: string }) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AuthUser["role"]>("user");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // A reset token is displayed once, in component memory only, and discarded on
  // dismissal, expiry, navigation, or session expiry. It is never put in a URL.
  const [secret, setSecret] = useState<ResetSecret | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<{ users: AuthUser[] }>("/api/admin/users", { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setUsers(data.users); })
      .catch((err) => { if (!controller.signal.aborted) setError(getApiErrorMessage(err, "Could not load users.")); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!secret) return;
    const timer = window.setTimeout(() => setSecret(null), Math.max(0, Date.parse(secret.expires_at) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [secret]);
  const run = async (operation: () => Promise<void>) => {
    if (busy || secret) return;
    setBusy(true); setError(""); setNotice("");
    try { await operation(); }
    catch (err) { setError(getApiErrorMessage(err, "Account request failed.")); }
    finally { setBusy(false); }
  };
  const replaceUser = (user: AuthUser) => setUsers((current) => current.map((item) => item.id === user.id ? user : item));
  const urlFor = (user: AuthUser) => `/api/admin/users/${encodeURIComponent(user.id)}`;
  const create = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const data = await apiJson<{ user: AuthUser }>("/api/admin/users", { email: email.trim(), password, role });
      setUsers((current) => [...current, data.user]);
      setEmail(""); setPassword(""); setRole("user");
      setNotice("User created. Share the temporary password through a trusted private channel.");
    });
  };
  const update = (user: AuthUser, patch: { active?: boolean; role?: AuthUser["role"] }) => void run(async () => {
    const data = await apiJson<{ user: AuthUser }>(urlFor(user), patch, { method: "PATCH" });
    replaceUser(data.user); setNotice("Account updated.");
  });
  const remove = (user: AuthUser) => {
    if (!window.confirm(`Remove access for ${user.email}? The account will be disabled, not permanently deleted.`)) return;
    void run(async () => {
      await apiRequest(urlFor(user), { method: "DELETE" });
      replaceUser({ ...user, active: false }); setNotice("Account access removed. Audit history is retained.");
    });
  };
  const reset = (user: AuthUser) => {
    if (!window.confirm(`Issue a single-use reset token for ${user.email}? Existing sessions will be revoked.`)) return;
    void run(async () => {
      const data = await apiJson<{ reset_token: string; expires_at: string }>(`${urlFor(user)}/password-reset`, {});
      replaceUser({ ...user, must_change_password: true });
      setSecret({ email: user.email, ...data });
    });
  };
  const disabled = busy || loading || Boolean(secret);
  return <section className="space-y-5">
    <div><h1 className="text-2xl font-black text-slate-900">User administration</h1><p className="mt-1 text-xs text-slate-500">Create accounts, manage access, and issue single-use password resets. Removed accounts are soft-disabled for auditability.</p></div>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</p>}
    {secret && <div role="region" aria-label="Single-use reset token" className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
      <h2 className="text-sm font-bold">Reset token for {secret.email}</h2>
      <p className="mt-2 text-xs">Copy this token now and share it through a trusted private channel. It cannot be retrieved after dismissal. The user must choose “Use a password reset token” on the sign-in page, then sign in manually.</p>
      <label className="mt-3 block text-xs font-bold">Single-use token<input readOnly autoComplete="off" spellCheck={false} value={secret.reset_token} onFocus={(event) => event.target.select()} className="mt-1 w-full rounded-lg border border-amber-300 bg-white p-3 font-mono text-xs" /></label>
      <p className="mt-2 text-xs">Expires {new Date(secret.expires_at).toLocaleString("en-US")}.</p>
      <button type="button" onClick={() => setSecret(null)} className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Dismiss and clear token</button>
    </div>}
    <form onSubmit={create} className="rounded-2xl border border-slate-200 bg-white p-5">
      <fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto]">
        <label className="text-xs font-semibold">Email<input required type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2" /></label>
        <label className="text-xs font-semibold">Temporary password (12+ characters)<input required minLength={12} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2" /></label>
        <label className="text-xs font-semibold">Role<select value={role} onChange={(e) => setRole(e.target.value as AuthUser["role"])} className="mt-1 block rounded-lg border border-slate-300 p-2"><option value="user">User</option><option value="admin">Administrator</option></select></label>
        <button className="inline-flex items-center justify-center gap-1 self-end rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><UserPlus className="h-4 w-4" />Create user</button>
      </fieldset>
    </form>
    {loading && <p role="status" className="text-sm text-slate-500">Loading accounts…</p>}
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="min-w-full text-xs"><thead className="bg-slate-50"><tr><th className="p-3 text-left">Email</th><th className="p-3 text-left">Role</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Actions</th></tr></thead>
      <tbody>{users.map((user) => <tr key={user.id} className="border-t border-slate-100">
        <td className="p-3 font-semibold">{user.email}{user.id === actorId && <span className="ml-2 text-slate-500">(you)</span>}</td>
        <td className="p-3"><select aria-label={`Role for ${user.email}`} value={user.role} disabled={disabled || user.id === actorId} onChange={(e) => update(user, { role: e.target.value as AuthUser["role"] })} className="rounded border border-slate-300 p-1"><option value="user">User</option><option value="admin">Administrator</option></select></td>
        <td className="p-3">{user.active ? "Active" : "Disabled"}{user.must_change_password && <span className="block text-slate-500">Password change required</span>}</td>
        <td className="p-3"><div className="flex flex-wrap gap-2">
          <button type="button" disabled={disabled || user.id === actorId} onClick={() => update(user, { active: !user.active })} className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 disabled:opacity-50"><UserX className="h-3 w-3" />{user.active ? "Disable" : "Enable"}</button>
          <button type="button" disabled={disabled || !user.active || user.id === actorId} onClick={() => reset(user)} className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 disabled:opacity-50"><RotateCcw className="h-3 w-3" />Reset password</button>
          <button type="button" disabled={disabled || !user.active || user.id === actorId} onClick={() => remove(user)} className="rounded border border-rose-200 px-2 py-1 text-rose-700 disabled:opacity-50">Remove access</button>
        </div></td>
      </tr>)}</tbody>
    </table>{!loading && !users.length && <p className="p-4 text-xs text-slate-500">No accounts found.</p>}</div>
  </section>;
}
