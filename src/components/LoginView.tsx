import sciaiLogoDark from "../assets/sciai-logo-dark.png";
import { type FormEvent, useEffect, useState } from "react";
import { ArrowLeft, LogIn } from "lucide-react";
import { useAuth } from "../context/AuthContext.js";
import { apiJson, getApiErrorMessage } from "../utils/apiClient.js";
import { AlertBanner } from "./CommonUI.js";

export function LoginView() {
  const { login, loginWithOrcid, error: sessionError } = useAuth();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [orcidMode, setOrcidMode] = useState(false);
  const [orcidId, setOrcidId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [oauthEnabled, setOauthEnabled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orcidErr = params.get("orcid_error");
    if (orcidErr) {
      setError(orcidErr);
      window.history.replaceState({}, "", window.location.pathname);
    }
    fetch("/api/auth/orcid/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.oauth_enabled) setOauthEnabled(true);
      })
      .catch(() => {});
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "login" && orcidMode) {
        await loginWithOrcid(orcidId.trim());
      } else if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await apiJson("/api/auth/reset", {
          token: resetToken.trim(),
          new_password: newPassword,
        });
        setResetToken("");
        setNewPassword("");
        setMode("login");
        setNotice("Password reset successfully. Sign in with your new password.");
      }
      setPassword("");
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          orcidMode
            ? "ORCID sign in failed."
            : mode === "login"
              ? "Sign in failed."
              : "Password reset failed."
        )
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-surface-dark px-4 py-8">
      {/* Subtle ambient glow behind brand mark */}
      <div className="pointer-events-none absolute top-1/5 h-64 w-64 -translate-y-1/2 rounded-full bg-brand-500/15 blur-3xl" />

      {/* Frameless Brand Header positioned higher */}
      <div className="relative z-10 mb-12 -mt-8 flex flex-col items-center text-center">
        <img
          src={sciaiLogoDark}
          alt="SciAI Research Intelligence"
          className="h-24 w-auto object-contain drop-shadow-sm"
        />
      </div>

      {/* Compact Login Card */}
      <form
        onSubmit={submit}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-surface-canvas p-6 shadow-elevated"
      >
        {(error || sessionError) && (
          <div className="mb-3.5">
            <AlertBanner tone="danger">{error || sessionError}</AlertBanner>
          </div>
        )}

        {notice && (
          <div className="mb-3.5">
            <AlertBanner tone="success">{notice}</AlertBanner>
          </div>
        )}

        <div className="space-y-3.5">
          {mode === "login" ? (
            orcidMode ? (
              <div className="space-y-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-black text-white">
                      iD
                    </span>
                    ORCID Researcher Sign-In
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setOrcidMode(false);
                      setError("");
                    }}
                    className="cursor-pointer text-[11px] font-semibold text-ink-muted hover:text-ink-primary"
                  >
                    Use Email
                  </button>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-ink-primary">
                    16-Digit ORCID iD
                  </label>
                  <input
                    type="text"
                    value={orcidId}
                    onChange={(e) => setOrcidId(e.target.value)}
                    required
                    autoFocus
                    placeholder="0000-0002-1825-0097 or orcid.org/..."
                    className="w-full rounded-xl border border-border-default bg-surface-canvas px-3 py-2 font-mono text-xs text-ink-primary outline-none transition-colors focus:border-emerald-500"
                  />
                </div>
                <p className="text-[11px] leading-relaxed text-ink-muted">
                  Connects your ORCID iD to your SciAI profile and enables one-click{" "}
                  <strong className="text-ink-secondary">Sync My ORCID Corpus</strong>.
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-xs font-bold text-ink-primary">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="researcher@institution.edu"
                    className="w-full rounded-xl border border-border-default bg-surface-canvas px-3 py-2 text-sm text-ink-primary outline-none transition-colors focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-ink-primary">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    className="w-full rounded-xl border border-border-default bg-surface-canvas px-3 py-2 text-sm text-ink-primary outline-none transition-colors focus:border-brand-500"
                  />
                </div>
              </>
            )
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs font-bold text-ink-primary">Reset token</label>
                <input
                  type="text"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  required
                  placeholder="Paste one-time reset token"
                  className="w-full rounded-xl border border-border-default bg-surface-canvas px-3 py-2 font-mono text-xs text-ink-primary outline-none transition-colors focus:border-brand-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-ink-primary">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={10}
                  autoComplete="new-password"
                  placeholder="Minimum 10 characters"
                  className="w-full rounded-xl border border-border-default bg-surface-canvas px-3 py-2 text-sm text-ink-primary outline-none transition-colors focus:border-brand-500"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={busy}
            className={`mt-1 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-xs transition-all disabled:opacity-50 ${
              mode === "login" && orcidMode
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-brand-500 hover:bg-brand-600"
            }`}
          >
            {mode === "login" && orcidMode ? (
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-black text-emerald-700">
                iD
              </span>
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {busy
              ? "Please wait..."
              : mode === "login" && orcidMode
                ? "Continue with ORCID"
                : mode === "login"
                  ? "Sign in"
                  : "Update password"}
          </button>
        </div>

        {mode === "login" && !orcidMode && (
          <div className="mt-4 space-y-3">
            <div className="relative flex items-center justify-center">
              <div className="w-full border-t border-border-subtle" />
              <span className="bg-surface-canvas px-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                or
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (oauthEnabled) {
                  window.location.href = "/api/auth/orcid/authorize";
                  return;
                }
                setOrcidMode(true);
                setError("");
              }}
              className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-700 transition-all hover:bg-emerald-500/20 dark:text-emerald-300"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-black text-white">
                iD
              </span>
              <span>Continue with ORCID</span>
            </button>
          </div>
        )}

        <div className="mt-4 flex items-center justify-center border-t border-border-subtle pt-3 text-xs">
          {mode === "login" ? (
            <button
              type="button"
              onClick={() => {
                setMode("reset");
                setOrcidMode(false);
                setError(null);
              }}
              className="cursor-pointer font-semibold text-ink-secondary hover:text-ink-primary"
            >
              Use a password reset token
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-ink-secondary hover:text-ink-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to sign in
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
