import { type FormEvent, useEffect, useState } from "react";
import { UserPlus, UserX, UserCheck, RotateCcw, ShieldAlert, KeyRound } from "lucide-react";
import { type AuthUser, useAuth } from "../context/AuthContext.js";
import { apiJson, apiRequest, getApiErrorMessage } from "../utils/apiClient.js";
import {
  AlertBanner,
  Button,
  Card,
  Input,
  SectionHeader,
  Select,
  StatusBadge,
} from "./CommonUI.js";

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
      .then((data) => {
        if (!controller.signal.aborted) setUsers(data.users);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(getApiErrorMessage(err, "Could not load users."));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!secret) return;
    const timer = window.setTimeout(
      () => setSecret(null),
      Math.max(0, Date.parse(secret.expires_at) - Date.now())
    );
    return () => window.clearTimeout(timer);
  }, [secret]);

  const run = async (operation: () => Promise<void>) => {
    if (busy || secret) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
    } catch (err) {
      setError(getApiErrorMessage(err, "Account request failed."));
    } finally {
      setBusy(false);
    }
  };

  const replaceUser = (user: AuthUser) =>
    setUsers((current) => current.map((item) => (item.id === user.id ? user : item)));

  const urlFor = (user: AuthUser) => `/api/admin/users/${encodeURIComponent(user.id)}`;

  const create = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const data = await apiJson<{ user: AuthUser }>("/api/admin/users", {
        email: email.trim(),
        password,
        role,
      });
      setUsers((current) => [...current, data.user]);
      setEmail("");
      setPassword("");
      setRole("user");
      setNotice("User created. Share the temporary password through a trusted private channel.");
    });
  };

  const update = (user: AuthUser, patch: { active?: boolean; role?: AuthUser["role"] }) =>
    void run(async () => {
      const data = await apiJson<{ user: AuthUser }>(urlFor(user), patch, { method: "PATCH" });
      replaceUser(data.user);
      setNotice("Account updated.");
    });

  const remove = (user: AuthUser) => {
    if (
      !window.confirm(
        `Remove access for ${user.email}? The account will be disabled, not permanently deleted.`
      )
    )
      return;
    void run(async () => {
      await apiRequest(urlFor(user), { method: "DELETE" });
      replaceUser({ ...user, active: false });
      setNotice("Account access removed. Audit history is retained.");
    });
  };

  const reset = (user: AuthUser) => {
    if (
      !window.confirm(
        `Issue a single-use reset token for ${user.email}? Existing sessions will be revoked.`
      )
    )
      return;
    void run(async () => {
      const data = await apiJson<{ reset_token: string; expires_at: string }>(
        `${urlFor(user)}/password-reset`,
        {}
      );
      replaceUser({ ...user, must_change_password: true });
      setSecret({ email: user.email, ...data });
    });
  };

  const disabled = busy || loading || Boolean(secret);

  return (
    <section className="space-y-6">
      {/* Page Header */}
      <div className="sciai-studio-shell p-6">
        <p className="sciai-kicker mb-1">Governance & Access Control</p>
        <h1 className="text-2xl font-black tracking-tight text-ink-primary">
          User administration
        </h1>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-muted">
          Create accounts, manage access, and issue single-use password resets. Removed accounts
          are soft-disabled for auditability.
        </p>
      </div>

      {/* Feedback Alerts */}
      {error && <AlertBanner tone="danger">{error}</AlertBanner>}
      {notice && <AlertBanner tone="success">{notice}</AlertBanner>}

      {/* Single-Use Secret Token Disclosure */}
      {secret && (
        <div
          role="region"
          aria-label="Single-use reset token"
          className="rounded-2xl border border-status-warning-border bg-status-warning-bg p-5 shadow-card"
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-status-warning-text/10 p-2 text-status-warning-text">
              <KeyRound className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-ink-primary">
                Reset token for {secret.email}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
                Copy this token now and share it through a trusted private channel. It cannot be
                retrieved after dismissal. The user must choose “Use a password reset token” on
                the sign-in page, then sign in manually.
              </p>

              <label className="mt-3 block space-y-1.5">
                <span className="block text-xs font-bold text-ink-secondary">
                  Single-use token
                </span>
                <input
                  readOnly
                  autoComplete="off"
                  spellCheck={false}
                  value={secret.reset_token}
                  onFocus={(event) => event.target.select()}
                  className="w-full rounded-xl border border-status-warning-border bg-surface-canvas px-3.5 py-2.5 font-mono text-xs text-ink-primary focus:border-brand-500 focus:outline-none"
                />
              </label>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="tabular-metrics text-xs font-medium text-status-warning-text">
                  Expires {new Date(secret.expires_at).toLocaleString("en-US")}.
                </p>
                <Button type="button" variant="primary" size="sm" onClick={() => setSecret(null)}>
                  Dismiss and clear token
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create User Form */}
      <Card padding="md">
        <SectionHeader
          kicker="Provisioning"
          title="Provision Researcher Account"
          description="Assign an institutional email and a temporary password (minimum 12 characters)."
        />
        <form onSubmit={create} className="mt-4">
          <fieldset
            disabled={disabled}
            className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_180px_auto]"
          >
            <Input
              label="Email"
              required
              type="email"
              autoComplete="off"
              placeholder="researcher@institution.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Temporary password (12+ characters)"
              required
              minLength={12}
              type="password"
              autoComplete="new-password"
              placeholder="Minimum 12 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Select
              label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value as AuthUser["role"])}
            >
              <option value="user">User</option>
              <option value="admin">Administrator</option>
            </Select>
            <div className="flex items-end">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                icon={<UserPlus className="h-4 w-4" />}
                className="w-full lg:w-auto"
              >
                Create user
              </Button>
            </div>
          </fieldset>
        </form>
      </Card>

      {/* Accounts Table */}
      {loading && (
        <p role="status" className="text-xs font-medium text-ink-muted">
          Loading accounts…
        </p>
      )}

      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="border-b border-border-default bg-surface-subtle">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-ink-secondary">Email</th>
                <th className="px-4 py-3 text-left font-bold text-ink-secondary">Role</th>
                <th className="px-4 py-3 text-left font-bold text-ink-secondary">Status</th>
                <th className="px-4 py-3 text-left font-bold text-ink-secondary">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {users.map((user) => {
                const isSelf = user.id === actorId;
                return (
                  <tr
                    key={user.id}
                    className="transition-colors hover:bg-surface-subtle/60"
                  >
                    <td className="px-4 py-3.5 font-semibold text-ink-primary">
                      <span>{user.email}</span>
                      {isSelf && (
                        <span className="ml-2 rounded-md border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">
                          (you)
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <select
                        aria-label={`Role for ${user.email}`}
                        value={user.role}
                        disabled={disabled || isSelf}
                        onChange={(e) =>
                          update(user, { role: e.target.value as AuthUser["role"] })
                        }
                        className="rounded-lg border border-border-default bg-surface-canvas px-2.5 py-1.5 text-xs font-medium text-ink-primary transition-colors hover:border-border-strong focus:border-brand-500 focus:outline-none disabled:opacity-50"
                      >
                        <option value="user">User</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={user.active ? "Active" : "Disabled"} />
                        {user.must_change_password && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-status-warning-text">
                            <ShieldAlert className="h-3 w-3" />
                            Password change required
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={disabled || isSelf}
                          onClick={() => update(user, { active: !user.active })}
                          icon={
                            user.active ? (
                              <UserX className="h-3.5 w-3.5" />
                            ) : (
                              <UserCheck className="h-3.5 w-3.5" />
                            )
                          }
                        >
                          {user.active ? "Disable" : "Enable"}
                        </Button>

                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={disabled || !user.active || isSelf}
                          onClick={() => reset(user)}
                          icon={<RotateCcw className="h-3.5 w-3.5" />}
                        >
                          Reset password
                        </Button>

                        <button
                          type="button"
                          disabled={disabled || !user.active || isSelf}
                          onClick={() => remove(user)}
                          className="inline-flex h-8 items-center rounded-lg border border-status-danger-border bg-status-danger-bg/60 px-3 text-xs font-semibold text-status-danger-text transition-colors hover:bg-status-danger-bg disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
                        >
                          Remove access
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!loading && !users.length && (
          <p className="p-6 text-center text-xs text-ink-muted">No accounts found.</p>
        )}
      </Card>
    </section>
  );
}